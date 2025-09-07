// Entry point: 初始化模块并启动功能
// Note: This file should not contain imports/exports when built as content.js

// Inline logger functionality to avoid imports
const logger = {
  log: (...args) => {
    if (typeof __ENABLE_LOGGING__ !== 'undefined' && __ENABLE_LOGGING__) {
      console.log(...args)
    }
  },
  warn: (...args) => {
    if (typeof __ENABLE_LOGGING__ !== 'undefined' && __ENABLE_LOGGING__) {
      console.warn(...args)
    }
  },
  error: (...args) => {
    if (typeof __ENABLE_LOGGING__ !== 'undefined' && __ENABLE_LOGGING__) {
      console.error(...args)
    }
  }
}

// Inline storage functionality
const cachedState = {
  emojiGroups: [],
  appSettings: {}
}

function sendMessageToBackground(message) {
  return new Promise(resolve => {
    try {
      if (
        (window).chrome &&
        (window).chrome.runtime &&
        (window).chrome.runtime.sendMessage
      ) {
        ;(window).chrome.runtime.sendMessage(message, (response) => {
          resolve(response)
        })
      } else {
        resolve({ success: false, error: 'chrome.runtime.sendMessage not available' })
      }
    } catch (e) {
      resolve({ success: false, error: e instanceof Error ? e.message : String(e) })
    }
  })
}

async function loadDataFromStorage() {
  try {
    logger.log('[Emoji Extension] Requesting emoji data from background')
    const resp = await sendMessageToBackground({ type: 'GET_EMOJI_DATA' })

    if (resp && resp.success && resp.data) {
      const groups = resp.data.groups || []
      const settings = resp.data.settings || {}

      logger.log('[Emoji Extension] Received groups from background:', groups?.length || 0)

      if (Array.isArray(groups) && groups.length > 0) {
        let validGroups = 0
        let totalEmojis = 0
        groups.forEach((group) => {
          if (group && group.emojis && Array.isArray(group.emojis)) {
            validGroups++
            totalEmojis += group.emojis.length
          }
        })

        if (validGroups > 0 && totalEmojis > 0) {
          cachedState.emojiGroups = groups
          logger.log(
            `[Emoji Extension] Successfully loaded ${validGroups} valid groups with ${totalEmojis} total emojis (from background)`
          )
        }
      }

      cachedState.appSettings = settings
    }
  } catch (e) {
    logger.error('[Emoji Extension] Failed to load data from storage:', e)
  }
}

// Inline toolbar finding functionality
const TOOLBAR_SELECTORS = [
  '.d-editor-button-bar[role="toolbar"]', // Standard editor toolbar
  '.chat-composer__inner-container' // Chat composer
]

function findAllToolbars() {
  const toolbars = []
  for (const selector of TOOLBAR_SELECTORS) {
    const elements = document.querySelectorAll(selector)
    toolbars.push(...Array.from(elements))
  }
  return toolbars
}

// Inline button injection functionality
function injectButton(toolbar) {
  // Check if button already exists
  if (toolbar.querySelector('.emoji-extension-button')) {
    return
  }

  // Create emoji button
  const emojiButton = document.createElement('button')
  emojiButton.className = 'btn btn-default emoji-extension-button'
  emojiButton.type = 'button'
  emojiButton.title = 'Insert Emoji'
  emojiButton.innerHTML = '😀'
  emojiButton.style.cssText = 'margin-right: 5px; padding: 6px 8px; cursor: pointer;'

  // Add click handler
  emojiButton.addEventListener('click', (e) => {
    e.preventDefault()
    logger.log('[Emoji Extension] Emoji button clicked')
    // Basic emoji insertion - just insert a simple emoji for now
    const textarea = document.querySelector('textarea.d-editor-input, .ProseMirror.d-editor-input')
    if (textarea) {
      if (textarea.tagName === 'TEXTAREA') {
        const cursorPos = textarea.selectionStart
        const text = textarea.value
        const newText = text.slice(0, cursorPos) + '😀' + text.slice(cursorPos)
        textarea.value = newText
        textarea.setSelectionRange(cursorPos + 2, cursorPos + 2)
        textarea.focus()
        
        // Trigger input event for reactivity
        const event = new Event('input', { bubbles: true })
        textarea.dispatchEvent(event)
      }
    }
  })

  // Insert button at the beginning of toolbar
  toolbar.insertBefore(emojiButton, toolbar.firstChild)
  logger.log('[Emoji Extension] Emoji button injected successfully')
}

// Function to check and re-inject buttons if needed
function checkAndReinjectButtons() {
  const toolbars = findAllToolbars()
  toolbars.forEach((toolbar) => {
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
  document.addEventListener('click', (event) => {
    const target = event.target

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
          const element = node

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

// Inline initialization code to avoid imports
async function initializeEmojiFeature(
  maxInjectionAttempts = 10,
  delay = 1000
) {
  logger.log('[Emoji Extension] Initializing (module)...')
  await loadDataFromStorage()

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
  if ((window).chrome?.storage?.onChanged) {
    ;(window).chrome.storage.onChanged.addListener((changes, _namespace) => {
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
  if ((window).chrome?.runtime?.onMessage) {
    ;(window).chrome.runtime.onMessage.addListener(
      (message, _sender, _sendResponse) => {
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

// Inline uninject functionality
function Uninject() {
  try {
    // For now, just log that uninject was called
    // The original Uninject function called initBilibili and initX
    // but those are for specific platforms, we'll keep this simple
    logger.log('[Emoji Extension] Uninject called')
  } catch (e) {
    logger.error('[Emoji Extension] Uninject failed', e)
  }
}

logger.log('[Emoji Extension] Content script loaded (entry)')

// Function to check if current page should have emoji injection
function shouldInjectEmoji(): boolean {
  // Check for discourse meta tag as example
  const discourseMetaTags = document.querySelectorAll(
    'meta[name*="discourse"], meta[content*="discourse"], meta[property*="discourse"]'
  )
  if (discourseMetaTags.length > 0) {
    logger.log('[Emoji Extension] Discourse detected via meta tags')
    return true
  }

  // Check for common forum/discussion platforms
  const generatorMeta = document.querySelector('meta[name="generator"]')
  if (generatorMeta) {
    const content = generatorMeta.getAttribute('content')?.toLowerCase() || ''
    if (content.includes('discourse') || content.includes('flarum') || content.includes('phpbb')) {
      logger.log('[Emoji Extension] Forum platform detected via generator meta')
      return true
    }
  }

  // Check current domain - allow linux.do and other known sites
  const hostname = window.location.hostname.toLowerCase()
  const allowedDomains = ['linux.do', 'meta.discourse.org']
  if (allowedDomains.some(domain => hostname.includes(domain))) {
    logger.log('[Emoji Extension] Allowed domain detected:', hostname)
    return true
  }

  // Check for editor elements that suggest a discussion platform
  const editors = document.querySelectorAll(
    'textarea.d-editor-input, .ProseMirror.d-editor-input, .composer-input, .reply-area textarea'
  )
  if (editors.length > 0) {
    logger.log('[Emoji Extension] Discussion editor detected')
    return true
  }

  logger.log('[Emoji Extension] No compatible platform detected')
  return false
}

// Only inject if compatible platform is detected
if (shouldInjectEmoji()) {
  logger.log('[Emoji Extension] Initializing emoji feature')
  initializeEmojiFeature()
} else {
  Uninject()
  logger.log('[Emoji Extension] Skipping injection - incompatible platform')
}

// Remove exports to ensure content.js has no exports
