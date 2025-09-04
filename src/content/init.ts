import { logger } from '../config/buildFlags'

import { loadDataFromStorage } from './storage'
import { findAllToolbars, injectButton } from './injector'
import { initOneClickAdd } from './oneClickAdd'

// Function to check and re-inject buttons if needed
function checkAndReinjectButtons() {
  const toolbars = findAllToolbars()
  toolbars.forEach((toolbar: Element) => {
    if (
      !toolbar.querySelector('.emoji-extension-button') &&
      !toolbar.querySelector('.image-upload-button')
    ) {
      logger.log('[Emoji Extension] Buttons missing after reply button click, re-injecting...')
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

  // Use event delegation to handle dynamically added buttons
  document.addEventListener('click', (event: Event) => {
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
      logger.log('[Emoji Extension] Reply button clicked, checking for injection needs...')

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
  const observer = new MutationObserver(mutations => {
    let shouldCheck = false

    mutations.forEach(mutation => {
      // Check if any added nodes contain reply buttons
      mutation.addedNodes.forEach(node => {
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
          }
        }
      })
    })

    if (shouldCheck) {
      logger.log('[Emoji Extension] Reply buttons detected in DOM changes, checking injection...')
      setTimeout(() => {
        checkAndReinjectButtons()
      }, 500)
    }
  })

  // Start observing DOM changes
  observer.observe(document.body, {
    childList: true,
    subtree: true
  })

  logger.log('[Emoji Extension] Reply button listeners initialized')
}

export async function initializeEmojiFeature(
  maxInjectionAttempts: number = 10,
  delay: number = 1000
) {
  logger.log('[Emoji Extension] Initializing (module)...')
  await loadDataFromStorage()

  // 初始化一键添加表情功能
  initOneClickAdd()

  // 初始化回复按钮监听器
  setupReplyButtonListeners()

  let injectionAttempts = 0

  function attemptInjection() {
    injectionAttempts++

    // Inject into all available toolbars
    const toolbars = findAllToolbars()
    let injectedCount = 0

    toolbars.forEach(toolbar => {
      if (
        !toolbar.querySelector('.emoji-extension-button') &&
        !toolbar.querySelector('.image-upload-button')
      ) {
        logger.log('[Emoji Extension] Toolbar found, injecting buttons.')
        injectButton(toolbar)
        injectedCount++
      }
    })

    if (injectedCount > 0 || toolbars.length > 0) {
      // Success - we found toolbars and injected or they already have buttons
      return
    }

    // No toolbars found, continue retry logic
    if (injectionAttempts < maxInjectionAttempts) {
      logger.log(
        `[Emoji Extension] Toolbar not found, attempt ${injectionAttempts}/${maxInjectionAttempts}. Retrying ${
          delay / 1000
        } s.`
      )
      setTimeout(attemptInjection, delay)
    } else if (maxInjectionAttempts < 20) {
      initializeEmojiFeature(20, 2000)
    } else if (maxInjectionAttempts < 40) {
      initializeEmojiFeature(40, 4000)
    } else if (maxInjectionAttempts < 80) {
      initializeEmojiFeature(80, 8000)
    } else if (maxInjectionAttempts < 160) {
      initializeEmojiFeature(160, 16000)
    } else if (maxInjectionAttempts < 320) {
      initializeEmojiFeature(320, 32000)
    } else if (maxInjectionAttempts < 640) {
      initializeEmojiFeature(640, 64000)
    } else {
      logger.error(
        '[Emoji Extension] Failed to find toolbar after multiple attempts. Button injection failed. 我感觉你是人机'
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
    ;(window as any).chrome.storage.onChanged.addListener((changes: any, _namespace: string) => {
      if (_namespace === 'local') {
        const relevantKeys = ['emojiGroups', 'emojiGroupIndex', 'appSettings']
        const hasRelevant = Object.keys(changes).some(
          k => relevantKeys.includes(k) || k.startsWith('emojiGroup_')
        )
        if (hasRelevant) {
          logger.log('[Emoji Extension] Storage change detected (module), reloading data')
          loadDataFromStorage()
        }
      }
    })
  }

  // Listen for settings updates from background script
  if ((window as any).chrome?.runtime?.onMessage) {
    ;(window as any).chrome.runtime.onMessage.addListener(
      (message: any, _sender: any, _sendResponse: any) => {
        // mark intentionally-unused params
        void _sender
        void _sendResponse
        if (message.type === 'SETTINGS_UPDATED') {
          logger.log('[Emoji Extension] Settings updated from background, reloading data')
          loadDataFromStorage()
        }
      }
    )
  }

  // periodic checks
  setInterval(() => {
    const toolbars = findAllToolbars()
    toolbars.forEach(toolbar => {
      if (
        !toolbar.querySelector('.emoji-extension-button') &&
        !toolbar.querySelector('.image-upload-button')
      ) {
        logger.log('[Emoji Extension] Toolbar found but buttons missing, injecting... (module)')
        injectButton(toolbar)
      }
    })
  }, 30000)

  setInterval(() => {
    logger.log('[Emoji Extension] Periodic data reload (module)')
    loadDataFromStorage()
  }, 120000)
}
