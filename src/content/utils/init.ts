import { loadDataFromStorage } from '../data/storage'
import { startReadTracker, stopReadTracker } from '../discourse/utils/readTracker'

// logger removed: replaced by direct console usage in migration
import { findAllToolbars, injectButton } from './injector'
import { requestSettingFromBackground } from './core'
import { initOneClickAdd } from './oneClickAdd'
import { showFloatingButton, checkAndShowFloatingButton, cleanupFloatingButton } from './ui'
import { applyCustomCssFromCache } from './injectCustomCss'
import { startEditorFocusTracking, stopEditorFocusTracking } from './upload/helpers'

// 缓存子菜单注入设置状态
let cachedSubmenuInjectorEnabled: boolean | null = null

// 存储定时器 ID 以便清理
let toolbarCheckIntervalId: number | null = null
let floatingButtonIntervalId: number | null = null
let injectionRetryTimeoutId: number | null = null
let mutationCheckTimeoutId: number | null = null
let storageDebounceTimeoutId: number | null = null
let mutationObserver: MutationObserver | null = null
let replyClickHandler: ((event: Event) => void) | null = null
let domReadyHandler: (() => void) | null = null
let storageChangeHandler: ((changes: Record<string, unknown>, namespace: string) => void) | null =
  null
let visibilityChangeHandler: (() => void) | null = null
let initialized = false

const clearTimeoutHandle = (handle: number | null): number | null => {
  if (handle !== null) window.clearTimeout(handle)
  return null
}

/**
 * 清理所有定时器和监听器
 * 用于热更新或插件卸载时释放资源
 */
export function cleanupEmojiFeature(): void {
  // 清理定时器
  if (toolbarCheckIntervalId) {
    window.clearInterval(toolbarCheckIntervalId)
    toolbarCheckIntervalId = null
  }
  if (floatingButtonIntervalId) {
    window.clearInterval(floatingButtonIntervalId)
    floatingButtonIntervalId = null
  }
  injectionRetryTimeoutId = clearTimeoutHandle(injectionRetryTimeoutId)
  mutationCheckTimeoutId = clearTimeoutHandle(mutationCheckTimeoutId)
  storageDebounceTimeoutId = clearTimeoutHandle(storageDebounceTimeoutId)

  // 清理 MutationObserver
  if (mutationObserver) {
    mutationObserver.disconnect()
    mutationObserver = null
  }

  if (replyClickHandler) {
    document.removeEventListener('click', replyClickHandler)
    replyClickHandler = null
  }
  if (domReadyHandler) {
    document.removeEventListener('DOMContentLoaded', domReadyHandler)
    domReadyHandler = null
  }
  if (visibilityChangeHandler) {
    document.removeEventListener('visibilitychange', visibilityChangeHandler)
    visibilityChangeHandler = null
  }
  if (storageChangeHandler) {
    ;(window as any).chrome?.storage?.onChanged?.removeListener(storageChangeHandler)
    storageChangeHandler = null
  }

  stopReadTracker()
  stopEditorFocusTracking()

  // 清理浮动按钮
  cleanupFloatingButton()
  initialized = false

  console.log('[Emoji Extension] Cleanup completed')
}

// 页面卸载时清理资源，防止内存泄漏
window.addEventListener('beforeunload', () => {
  cleanupEmojiFeature()
})

// Function to check and re-inject buttons if needed
function checkAndReinjectButtons() {
  // 如果启用了子菜单注入，则跳过工具栏按钮注入
  if (cachedSubmenuInjectorEnabled === true || document.hidden) {
    return
  }

  const toolbars = findAllToolbars()
  toolbars.forEach((toolbar: Element) => {
    if (
      !toolbar.querySelector('.emoji-extension-button') &&
      !toolbar.querySelector('.image-upload-button')
    ) {
      console.log('[Emoji Extension] Buttons missing after reply button click, re-injecting...')
      injectButton(toolbar)
    }
  })
}

// Setup reply button listeners
function setupReplyButtonListeners() {
  // Selectors for different types of reply buttons
  const replyButtonSelectors = [
    // Topic footer reply button
    'button.btn.btn-icon-text.btn-primary.create.topic-footer-button[title*="回复"]',
    // Simple reply button (no text)
    'button.btn.no-text.btn-icon.btn-default.create.reply-to-post[title*="回复"]',
    // Post action menu reply button
    'button.btn.btn-icon-text.post-action-menu__reply.reply.create[title*="回复"]'
  ]

  if (replyClickHandler) {
    document.removeEventListener('click', replyClickHandler)
  }

  // Use one delegated listener instead of one listener per reply button.
  replyClickHandler = (event: Event) => {
    const target = event.target as HTMLElement

    // Check if the clicked element matches any reply button selector
    const isReplyButton = replyButtonSelectors.some(selector => {
      try {
        return target.matches(selector) || target.closest(selector)
      } catch (_e) {
        // Handle invalid selector gracefully
        void _e
        return false
      }
    })

    if (isReplyButton) {
      console.log('[Emoji Extension] Reply button clicked, checking for injection needs...')

      // Delay check to allow the editor to be created
      window.setTimeout(() => {
        checkAndReinjectButtons()
      }, 500)

      // Additional check after a longer delay for complex UI changes
      window.setTimeout(() => {
        checkAndReinjectButtons()
      }, 2000)
    }
  }
  document.addEventListener('click', replyClickHandler)

  // Also listen for mutations in case buttons are added/removed dynamically
  // 使用节流策略减少高负载页面的 CPU 占用
  let pendingCheck = false

  // 清理之前的 observer（防止热更新时重复创建）
  if (mutationObserver) {
    mutationObserver.disconnect()
  }

  mutationObserver = new MutationObserver(mutations => {
    let shouldCheck = false

    mutationLoop: for (const mutation of mutations) {
      // Check if any added nodes contain reply buttons
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element

          // Check if the added element or its descendants contain reply buttons
          const hasReplyButtons = replyButtonSelectors.some(selector => {
            try {
              return element.matches(selector) || element.querySelector(selector)
            } catch (_e) {
              void _e
              return false
            }
          })

          if (hasReplyButtons) {
            shouldCheck = true
            break mutationLoop
          }
        }
      }
    }

    if (shouldCheck) {
      // 节流：500ms 内只执行一次检查
      if (!pendingCheck) {
        pendingCheck = true
        console.log(
          '[Emoji Extension] Reply buttons detected in DOM changes, checking injection...'
        )

        mutationCheckTimeoutId = clearTimeoutHandle(mutationCheckTimeoutId)

        mutationCheckTimeoutId = window.setTimeout(() => {
          checkAndReinjectButtons()
          pendingCheck = false
          mutationCheckTimeoutId = null
        }, 500)
      }
    }
  })

  // Start observing DOM changes
  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true
  })

  console.log('[Emoji Extension] Reply button listeners initialized')
}

export async function initializeEmojiFeature(
  maxInjectionAttempts: number = 10,
  delay: number = 1000
) {
  if (initialized) return
  initialized = true

  console.log('[Emoji Extension] Initializing (module)...')
  // Remember the actual Discourse composer/caret before injected upload UI
  // takes focus. Non-editor controls never replace this remembered target.
  startEditorFocusTracking()
  await loadDataFromStorage()
  try {
    applyCustomCssFromCache()
  } catch (_e) {
    void _e
  }

  // 检查是否启用了子菜单注入（仅在 Discourse 上生效）
  try {
    const isDiscourse =
      window.location.hostname.endsWith('linux.do') ||
      document.querySelector('meta[name="discourse_theme_id"]') !== null ||
      document.querySelector('#discourse-main') !== null

    if (isDiscourse) {
      const setting = await requestSettingFromBackground('enableSubmenuInjector')
      cachedSubmenuInjectorEnabled = setting === true
      if (cachedSubmenuInjectorEnabled) {
        console.log('[Emoji Extension] Submenu injector enabled, skipping toolbar button injection')
      }
    }
  } catch (e) {
    console.warn('[Emoji Extension] Failed to get enableSubmenuInjector setting:', e)
    cachedSubmenuInjectorEnabled = false
  }

  // 初始化一键添加表情功能
  initOneClickAdd()

  // 初始化回复按钮监听器
  setupReplyButtonListeners()

  let injectionAttempts = 0
  const retryLimit = Math.max(1, Math.min(Math.floor(maxInjectionAttempts), 40))
  const baseRetryDelay = Math.max(250, Math.min(Math.floor(delay), 5000))

  function attemptInjection() {
    // 如果启用了子菜单注入，则跳过工具栏按钮注入
    if (cachedSubmenuInjectorEnabled === true || document.hidden) {
      console.log('[Emoji Extension] Submenu injector enabled, skipping toolbar injection')
      return
    }

    injectionAttempts++

    // Inject into all available toolbars
    const toolbars = findAllToolbars()
    let injectedCount = 0

    toolbars.forEach(toolbar => {
      if (
        !toolbar.querySelector('.emoji-extension-button') &&
        !toolbar.querySelector('.image-upload-button')
      ) {
        console.log('[Emoji Extension] Toolbar found, injecting buttons.')
        injectButton(toolbar)
        injectedCount++
      }
    })

    if (injectedCount > 0 || toolbars.length > 0) {
      // Success - we found toolbars and injected or they already have buttons
      return
    }

    // No toolbars found, continue retry logic
    if (injectionAttempts < retryLimit) {
      const retryDelay = Math.min(
        baseRetryDelay * 2 ** Math.floor((injectionAttempts - 1) / 5),
        8000
      )
      console.log(
        `[Emoji Extension] Toolbar not found, attempt ${injectionAttempts}/${retryLimit}. Retrying ${
          retryDelay / 1000
        } s.`
      )
      injectionRetryTimeoutId = window.setTimeout(() => {
        injectionRetryTimeoutId = null
        attemptInjection()
      }, retryDelay)
    } else {
      console.warn('[Emoji Extension] Toolbar not found; using floating-button fallback')
      // Show floating button as fallback when injection fails
      showFloatingButton()
    }
  }

  if (document.readyState === 'loading') {
    domReadyHandler = () => {
      domReadyHandler = null
      attemptInjection()
    }
    document.addEventListener('DOMContentLoaded', domReadyHandler, { once: true })
  } else {
    attemptInjection()
  }

  // Start read time tracker (simplified)
  try {
    startReadTracker()
  } catch (e) {
    console.warn('[Emoji Extension] Failed to start read tracker', e)
  }

  // storage change listener with debounce (using chrome.storage.onChanged if available)
  if ((window as any).chrome?.storage?.onChanged) {
    storageChangeHandler = (changes: Record<string, unknown>, _namespace: string) => {
      if (_namespace === 'local') {
        const relevantKeys = ['emojiGroupIndex', 'appSettings']
        const hasRelevant = Object.keys(changes).some(
          k => relevantKeys.includes(k) || k.startsWith('emojiGroup_')
        )
        if (hasRelevant) {
          // Clear existing timer if any
          storageDebounceTimeoutId = clearTimeoutHandle(storageDebounceTimeoutId)

          // Set new timer
          storageDebounceTimeoutId = window.setTimeout(() => {
            console.log('[Emoji Extension] Storage change detected (module), reloading data')
            void loadDataFromStorage()
            // re-apply custom css after storage changes
            try {
              applyCustomCssFromCache()
            } catch (_e) {
              void _e
            }
            storageDebounceTimeoutId = null
          }, 300)
        }
      }
    }
    ;(window as any).chrome.storage.onChanged.addListener(storageChangeHandler)
  }

  // periodic checks - 使用模块级变量存储定时器 ID 以便清理
  // 清理之前可能存在的定时器（防止热更新时重复创建）
  if (toolbarCheckIntervalId) {
    window.clearInterval(toolbarCheckIntervalId)
  }
  toolbarCheckIntervalId = window.setInterval(() => {
    // 如果启用了子菜单注入，则跳过工具栏按钮注入
    if (cachedSubmenuInjectorEnabled === true || document.hidden) return
    checkAndReinjectButtons()
  }, 30000)

  // Check if floating button should be shown periodically
  if (floatingButtonIntervalId) {
    window.clearInterval(floatingButtonIntervalId)
  }
  floatingButtonIntervalId = window.setInterval(() => {
    // 如果启用了子菜单注入，则不要显示浮动按钮
    if (cachedSubmenuInjectorEnabled === true || document.hidden) return
    checkAndShowFloatingButton()
  }, 10000)

  visibilityChangeHandler = () => {
    if (document.hidden || cachedSubmenuInjectorEnabled === true) return
    checkAndReinjectButtons()
    checkAndShowFloatingButton()
  }
  document.addEventListener('visibilitychange', visibilityChangeHandler)
}
