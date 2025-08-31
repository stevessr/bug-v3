import { loadDataFromStorage } from './storage'
import { findAllToolbars, injectButton } from './injector'
import { initOneClickAdd } from './oneClickAdd'
import { initBatchEmojiAdd } from './batchEmojiAdd'
import { logger } from './buildFlags'

// Function to check and re-inject buttons if needed
function checkAndReinjectButtons() {
  const toolbars = findAllToolbars()
  toolbars.forEach((toolbar: Element) => {
    if (
      !toolbar.querySelector('.emoji-extension-button') &&
      !toolbar.querySelector('.image-upload-button')
    ) {
      logger.log('[Mr Emoji] Buttons missing after reply button click, re-injecting...')
      injectButton(toolbar)
    }
  })
}

// Setup reply button listeners
function setupReplyButtonListeners() {
  // Selectors for different types of reply buttons and create buttons
  const replyButtonSelectors = [
    // Topic footer reply button
    'button.btn.btn-icon-text.btn-primary.create.topic-footer-button[title*="回复"]',
    // Simple reply button (no text)
    'button.btn.no-text.btn-icon.btn-default.create.reply-to-post[title*="回复"]',
    // Post action menu reply button
    'button.btn.btn-icon-text.post-action-menu__reply.reply.create[title*="回复"]',
    // Create topic button
    'button.btn.btn-icon-text.btn-default#create-topic',
    // Draft button
    'button.btn.btn-icon-text.btn-secondary[title*="草稿"], button.btn.btn-icon-text.btn-secondary:has(.d-button-label:contains("草稿"))',
    // Additional reply button variants
    'button.btn.btn-icon-text.post-action-menu__reply.reply.create.fade-out.btn-flat[title*="回复"]',
  ]

  // Use event delegation to handle dynamically added buttons
  document.addEventListener('click', (event: Event) => {
    const target = event.target as HTMLElement

    // Check if the clicked element matches any reply button selector
    const isReplyButton = replyButtonSelectors.some((selector) => {
      try {
        return target.matches(selector) || target.closest(selector)
      } catch (e) {
        // Handle invalid selector gracefully
        return false
      }
    })

    if (isReplyButton) {
      logger.log('[Mr Emoji] Reply button clicked, checking for injection needs...')

      // Delay check to allow the editor to be created
      setTimeout(() => {
        checkAndReinjectButtons()
      }, 500)

      // Additional check after a longer delay for complex UI changes
      setTimeout(() => {
        checkAndReinjectButtons()
      }, 2000)
    }
  })

  // Also listen for mutations in case buttons are added/removed dynamically
  const observer = new MutationObserver((mutations) => {
    let shouldCheck = false

    mutations.forEach((mutation) => {
      // Check if any added nodes contain reply buttons
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element

          // Check if the added element or its descendants contain reply buttons
          const hasReplyButtons = replyButtonSelectors.some((selector) => {
            try {
              return element.matches(selector) || element.querySelector(selector)
            } catch (e) {
              return false
            }
          })

          if (hasReplyButtons) {
            shouldCheck = true
          }
        }
      })
    })

    if (shouldCheck) {
      logger.log('[Mr Emoji] Reply buttons detected in DOM changes, checking injection...')
      setTimeout(() => {
        checkAndReinjectButtons()
      }, 500)
    }
  })

  // Start observing DOM changes
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })

  logger.log('[Mr Emoji] Reply button listeners initialized')
}

export async function initializeEmojiFeature(
  maxInjectionAttempts: number = 10,
  delay: number = 1000,
) {
  const initStartTime = performance.now()
  logger.log('[性能] 初始化表情功能开始...')

  // 使用新的缓存系统加载数据，首次加载强制刷新
  await loadDataFromStorage(true)

  const dataLoadTime = performance.now() - initStartTime
  logger.log(`[性能] 数据加载耗时: ${Math.round(dataLoadTime)}ms`)

  // 初始化一键添加表情功能
  initOneClickAdd()

  // 初始化批量添加表情功能
  initBatchEmojiAdd()

  // 初始化回复按钮监听器
  setupReplyButtonListeners()

  let injectionAttempts = 0

  function attemptInjection() {
    injectionAttempts++

    // Inject into all available toolbars
    const toolbars = findAllToolbars()
    let injectedCount = 0

    toolbars.forEach((toolbar) => {
      if (
        !toolbar.querySelector('.emoji-extension-button') &&
        !toolbar.querySelector('.image-upload-button')
      ) {
        logger.log('[Mr Emoji] Toolbar found, injecting buttons.')
        injectButton(toolbar)
        injectedCount++
      }
    })

    // If we found toolbars and successfully injected, we're done
    if (injectedCount > 0) {
      logger.log(`[Mr Emoji] Successfully injected ${injectedCount} buttons`)
      return
    }

    // If we found toolbars but they already have buttons, that's also success
    if (toolbars.length > 0) {
      logger.log(`[Mr Emoji] Found ${toolbars.length} toolbars, buttons already present`)
      return
    }

    // No toolbars found, continue retry logic only for the first round
    if (injectionAttempts < maxInjectionAttempts) {
      logger.log(
        `[Mr Emoji] Toolbar not found, attempt ${injectionAttempts}/${maxInjectionAttempts}. Retrying ${
          delay / 1000
        } s.`,
      )
      setTimeout(attemptInjection, delay)
    } else {
      logger.warn(
        '[Mr Emoji] Failed to find toolbar after initial attempts. Relying on event-based injection.',
      )
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attemptInjection)
  } else {
    attemptInjection()
  }

  // storage change listener (using chrome.storage.onChanged if available)
  if ((window as any).chrome?.storage?.onChanged) {
    ;(window as any).chrome.storage.onChanged.addListener((changes: any, namespace: string) => {
      if (namespace === 'local') {
        const relevantKeys = ['emojiGroups', 'emojiGroupIndex', 'appSettings']
        const hasRelevant = Object.keys(changes).some(
          (k) => relevantKeys.includes(k) || k.startsWith('emojiGroup_'),
        )
        if (hasRelevant) {
          logger.log('[Mr Emoji] Storage change detected (module), reloading data')
          loadDataFromStorage()
        }
      }
    })
  }

  // Listen for settings updates from background script
  if ((window as any).chrome?.runtime?.onMessage) {
    ;(window as any).chrome.runtime.onMessage.addListener(
      (message: any, _sender: any, _sendResponse: any) => {
        if (message.type === 'SETTINGS_UPDATED') {
          logger.log('[Mr Emoji] Settings updated from background, reloading data')
          loadDataFromStorage()
        }
      },
    )
  }

  // periodic checks
  setInterval(() => {
    const toolbars = findAllToolbars()
    toolbars.forEach((toolbar) => {
      if (
        !toolbar.querySelector('.emoji-extension-button') &&
        !toolbar.querySelector('.image-upload-button')
      ) {
        logger.log('[Mr Emoji] Toolbar found but buttons missing, injecting... (module)')
        injectButton(toolbar)
      }
    })
  }, 30000)

  setInterval(() => {
    logger.log('[Mr Emoji] Periodic data reload (module)')
    loadDataFromStorage()
  }, 120000)
}
