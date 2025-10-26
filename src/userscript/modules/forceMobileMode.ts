// Force mobile mode functionality for toolbar injection
import { userscriptState } from '../state'
import { getPlatformToolbarSelectors } from '../utils/platformDetection'
import { injectCustomMenuButtons } from './uiComponents'

// Setup DOM change observer for force mobile mode
let domObserver: MutationObserver | null = null
// (removed unused lastDomChangeTime variable)

function setupDomObserver() {
  if (domObserver) return // Already set up

  domObserver = new MutationObserver(mutations => {
    let hasChanges = false
    
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
        hasChanges = true
        break
      }
      if (mutation.type === 'attributes') {
        hasChanges = true
        break
      }
    }
    
    if (hasChanges) {
      // DOM changed — no-op (previously recorded timestamp here)
    }
  })

  domObserver.observe(document, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'id']
  })

  console.log('[Emoji Extension Userscript] DOM observer set up for force mobile mode')
}

// Setup listeners for force mobile mode menu triggers
// menuTriggersInitialized removed (not used)
let toolbarOptionsTriggerInitialized = false
let chatComposerTriggerInitialized = false

export function setupForceMobileMenuTriggers() {
  const forceMobileMode = userscriptState.settings?.forceMobileMode || false
  if (!forceMobileMode) return

  // Check for d-menu-portals container
  const portalContainer = document.querySelector('#d-menu-portals')
  if (!portalContainer) {
    console.log('[Emoji Extension Userscript] #d-menu-portals not found, skipping force mobile menu triggers')
    return
  }

  console.log('[Emoji Extension Userscript] Force mobile mode enabled, setting up menu triggers')

  // Setup DOM observer if not already set up
  setupDomObserver()

  // Setup observer for menu content in portals
  const portalObserver = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement

          // Check if this is a toolbar menu or chat composer menu
          if (
            element.classList.contains('toolbar-menu__options-content') ||
            element.classList.contains('chat-composer-dropdown__content') ||
            element.classList.contains('chat-composer-dropdown__menu-content')
          ) {
            console.log('[Emoji Extension Userscript] Menu expanded in portal, injecting custom buttons')
            injectCustomMenuButtons(element)
          }
        }
      })
    })
  })

  // Observe the portal container for new menus
  portalObserver.observe(portalContainer, {
    childList: true,
    subtree: true
  })

  // Also observe modal-container for modal-based menus (PRIORITY: inject immediately)
  const modalObserver = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement

          // Check for modal container with toolbar menu or chat composer dropdown menu
          if (element.classList.contains('modal-container')) {
            // Try to find toolbar menu first
            let modalMenu = element.querySelector(
              '.toolbar-menu__options-content[data-identifier="toolbar-menu__options"]'
            ) as HTMLElement | null
            
            // If no toolbar menu, try to find chat composer dropdown menu
            if (!modalMenu) {
              modalMenu = element.querySelector(
                '.chat-composer-dropdown__menu-content[data-identifier="chat-composer-dropdown__menu"]'
              ) as HTMLElement | null
            }
            
            if (modalMenu) {
              console.log('[Emoji Extension Userscript] Modal menu detected (immediate), injecting custom buttons')
              injectCustomMenuButtons(modalMenu)
            } else {
              // If menu not found immediately, observe the modal container for menu appearance
              const modalContentObserver = new MutationObserver(() => {
                // Check for toolbar menu
                let delayedMenu = element.querySelector(
                  '.toolbar-menu__options-content[data-identifier="toolbar-menu__options"]'
                ) as HTMLElement | null
                
                // If no toolbar menu, try to find chat composer dropdown menu
                if (!delayedMenu) {
                  delayedMenu = element.querySelector(
                    '.chat-composer-dropdown__menu-content[data-identifier="chat-composer-dropdown__menu"]'
                  ) as HTMLElement | null
                }
                
                if (delayedMenu) {
                  console.log('[Emoji Extension Userscript] Modal menu detected (delayed), injecting custom buttons')
                  injectCustomMenuButtons(delayedMenu)
                  modalContentObserver.disconnect()
                }
              })
              
              modalContentObserver.observe(element, {
                childList: true,
                subtree: true
              })
              
              // Disconnect after 1 second to prevent memory leaks
              setTimeout(() => modalContentObserver.disconnect(), 1000)
            }
          }
        }
      })
    })
  })

  // Observe document body for modal containers
  modalObserver.observe(document.body, {
    childList: true,
    subtree: false
  })

  // --- INITIAL CHECK: if a modal-container already exists on page load, inject immediately ---
  try {
    const existingModal = document.querySelector('.modal-container') as HTMLElement | null
    if (existingModal) {
      const existingMenu = existingModal.querySelector(
        '.toolbar-menu__options-content[data-identifier="toolbar-menu__options"]'
      ) as HTMLElement | null
      if (existingMenu) {
        console.log('[Emoji Extension Userscript] Found existing modal menu at init, injecting custom buttons')
        // Inject synchronously to prioritize modal menus
        injectCustomMenuButtons(existingMenu)
      }
    }
  } catch (e) {
    // ignore errors during initial check
  }

  // Handle toolbar options trigger independently
  const toolbarOptionsTrigger = document.querySelector(
    'button.toolbar-menu__options-trigger[data-identifier="toolbar-menu__options"]:not(.emoji-detected)'
  ) as HTMLButtonElement | null

  if (toolbarOptionsTrigger) {
    // Add emoji-detected class to found trigger
    toolbarOptionsTrigger.classList.add('emoji-detected')
    
    // Add emoji-attached class as well
    toolbarOptionsTrigger.classList.add('emoji-attached')
    
    // Only add listener if it doesn't already have one
    if (!toolbarOptionsTrigger.dataset.emojiListenerAttached) {
      toolbarOptionsTrigger.addEventListener('click', () => {
        // Multiple check attempts for faster injection
        const checkMenu = (attempt: number = 0) => {
          // Try modal container first (PRIORITY)
          const modalContainer = document.querySelector('.modal-container')
          let menu: HTMLElement | null = null
          
          if (modalContainer) {
            menu = modalContainer.querySelector(
              '.toolbar-menu__options-content[data-identifier="toolbar-menu__options"]'
            ) as HTMLElement | null
          }
          
          // Fallback to portal-based menu
          if (!menu) {
            menu = document.querySelector(
              '.toolbar-menu__options-content[data-identifier="toolbar-menu__options"]'
            ) as HTMLElement | null
          }
          
          if (menu) {
            injectCustomMenuButtons(menu)
          } else if (attempt < 5) {
            // Retry up to 5 times with shorter intervals for faster injection
            setTimeout(() => checkMenu(attempt + 1), 20)
          }
        }
        
        checkMenu()
      })
      toolbarOptionsTrigger.dataset.emojiListenerAttached = 'true'
      console.log('[Emoji Extension Userscript] Toolbar options trigger listener added')
    }
    toolbarOptionsTriggerInitialized = true
  }

  // Handle chat composer dropdown trigger independently
  const chatComposerTrigger = document.querySelector(
    'button.chat-composer-dropdown__trigger-btn[data-identifier="chat-composer-dropdown__menu"]:not(.emoji-detected), button.chat-composer-dropdown__menu-trigger[data-identifier="chat-composer-dropdown__menu"]:not(.emoji-detected), button.chat-composer-dropdown__menu-trigger.chat-composer-dropdown__trigger-btn:not(.emoji-detected)'
  ) as HTMLButtonElement | null

  if (chatComposerTrigger) {
    // Add emoji-detected class to found trigger
    chatComposerTrigger.classList.add('emoji-detected')
    
    // Add emoji-attached class as well
    chatComposerTrigger.classList.add('emoji-attached')
    
    // Only add listener if it doesn't already have one
    if (!chatComposerTrigger.dataset.emojiListenerAttached) {
      chatComposerTrigger.addEventListener('click', () => {
        setTimeout(() => {
          const menu = document.querySelector(
            '.chat-composer-dropdown__content[data-identifier="chat-composer-dropdown__menu"], .chat-composer-dropdown__menu-content[data-identifier="chat-composer-dropdown__menu"]'
          ) as HTMLElement | null
          if (menu) {
            injectCustomMenuButtons(menu)
          }
        }, 100)
      })
      chatComposerTrigger.dataset.emojiListenerAttached = 'true'
      console.log('[Emoji Extension Userscript] Chat composer trigger listener added')
    }
    chatComposerTriggerInitialized = true
  }

  // menuTriggersInitialized removed (no longer tracked)
}

// Track toolbar and chat composer triggers independently
let toolbarTriggersAttached = new Set<string>() // Store unique toolbar trigger IDs
let chatComposerTriggersAttached = new Set<string>() // Store unique chat composer trigger IDs

// Scan all platform toolbars and attach click listeners to their menu triggers
// when forceMobileMode is active. This ensures we catch toolbar/menu opens even
// when menus are portalled into #d-menu-portals and normal injection is skipped.
export function setupForceMobileToolbarListeners() {
  const forceMobileMode = userscriptState.settings?.forceMobileMode || false
  if (!forceMobileMode) return

  const selectors = getPlatformToolbarSelectors()
  selectors.forEach(selector => {
    // Add :not(.emoji-detected) to selector to skip already detected buttons
    const elements = Array.from(document.querySelectorAll(selector)) as HTMLElement[]
    elements.forEach(toolbar => {
      try {
        // Try to find toolbar options trigger(s) inside this toolbar
        const toolbarOptionsTriggers = Array.from(
          toolbar.querySelectorAll(
            'button.toolbar-menu__options-trigger[data-identifier="toolbar-menu__options"]:not(.emoji-detected):not(.emoji-attached), button.toolbar-menu__options-trigger:not(.emoji-detected):not(.emoji-attached)'
          )
        ) as HTMLButtonElement[]

        toolbarOptionsTriggers.forEach(trigger => {
          // Generate unique ID for this trigger
          const triggerId = `toolbar-${trigger.id || Math.random().toString(36).substr(2, 9)}`
          
          // Skip if this trigger is already processed
          if (toolbarTriggersAttached.has(triggerId)) return
          
          // Mark trigger as detected and attached to avoid re-processing
          trigger.classList.add('emoji-detected')
          trigger.classList.add('emoji-attached')
          
          const handler = () => {
            // Multiple quick attempts to locate the menu (priority: modal, then portal)
            const checkMenu = (attempt: number = 0) => {
              const modalContainer = document.querySelector('.modal-container')
              let menu: HTMLElement | null = null

              if (modalContainer) {
                menu = modalContainer.querySelector(
                  '.toolbar-menu__options-content[data-identifier="toolbar-menu__options"]'
                ) as HTMLElement | null
              }

              if (!menu) {
                menu = document.querySelector(
                  '.toolbar-menu__options-content[data-identifier="toolbar-menu__options"]'
                ) as HTMLElement | null
              }

              if (menu) {
                injectCustomMenuButtons(menu)
              } else if (attempt < 5) {
                setTimeout(() => checkMenu(attempt + 1), 20)
              }
            }

            checkMenu()
          }

          // Add listener
          trigger.addEventListener('click', handler)
          trigger.dataset.emojiListenerAttached = 'true'
          
          // Track this trigger to avoid processing it again
          toolbarTriggersAttached.add(triggerId)
        })

        // Also try to attach to any chat-composer dropdown triggers inside toolbar
        const chatComposerTriggers = Array.from(
          toolbar.querySelectorAll(
            'button.chat-composer-dropdown__trigger-btn:not(.emoji-detected):not(.emoji-attached), button.chat-composer-dropdown__menu-trigger:not(.emoji-detected):not(.emoji-attached), button.chat-composer-dropdown__trigger-btn:not(.emoji-detected):not(.emoji-attached), button.chat-composer-dropdown__menu-trigger:not(.emoji-detected):not(.emoji-attached)'
          )
        ) as HTMLButtonElement[]

        chatComposerTriggers.forEach(trigger => {
          // Generate unique ID for this trigger
          const triggerId = `chat-${trigger.id || Math.random().toString(36).substr(2, 9)}`
          
          // Skip if this trigger is already processed
          if (chatComposerTriggersAttached.has(triggerId)) return
          
          // Mark trigger as detected and attached to avoid re-processing
          trigger.classList.add('emoji-detected')
          trigger.classList.add('emoji-attached')
          
          const handler = () => {
            setTimeout(() => {
              const menu = document.querySelector(
                '.chat-composer-dropdown__content[data-identifier="chat-composer-dropdown__menu"], .chat-composer-dropdown__menu-content[data-identifier="chat-composer-dropdown__menu"]'
              ) as HTMLElement | null
              if (menu) {
                injectCustomMenuButtons(menu)
              }
            }, 80)
          }
          
          // Add listener
          trigger.addEventListener('click', handler)
          trigger.dataset.emojiListenerAttached = 'true'
          
          // Track this trigger to avoid processing it again
          chatComposerTriggersAttached.add(triggerId)
        })
      } catch (e) {
        // Don't let one toolbar failure stop the rest
        console.warn('[Emoji Extension Userscript] Failed to attach force-mobile listeners to toolbar', e)
      }
    })
  })
}

// Interval handle for periodic force-mobile toolbar listener attachment
let _forceMobileToolbarIntervalId: number | null = null
let _domChangeCheckIntervalId: number | null = null
let _buttonExistenceCheckIntervalId: number | null = null

/**
 * Start a periodic runner that calls `setupForceMobileToolbarListeners()`.
 * It will no-op if forceMobileMode is not enabled or if already started.
 */
export function startForceMobileToolbarListenerInterval(intervalMs: number = 1000) { // Changed to 1 second
  const forceMobileMode = userscriptState.settings?.forceMobileMode || false
  if (!forceMobileMode) return
  if (_forceMobileToolbarIntervalId !== null) return

  // Run once immediately, then schedule periodic runs
  try {
    setupForceMobileToolbarListeners()
  } catch (e) {
    // ignore
  }

  _forceMobileToolbarIntervalId = window.setInterval(() => {
    try {
      setupForceMobileToolbarListeners()
    } catch (e) {
      // ignore per-interval errors
    }
  }, intervalMs)
}

// Function to check for DOM changes and attempt injection if needed
export function startDomChangeCheckInterval() {
  const forceMobileMode = userscriptState.settings?.forceMobileMode || false
  if (!forceMobileMode) return
  if (_domChangeCheckIntervalId !== null) return // Already running

  // Run once immediately, then schedule periodic runs
  try {
    checkButtonsAndInjectIfNeeded()
  } catch (e) {
    // ignore
  }

  _domChangeCheckIntervalId = window.setInterval(() => {
    try {
      checkButtonsAndInjectIfNeeded()
    } catch (e) {
      // ignore per-interval errors
    }
  }, 1000) // Check every 1 second (changed from conditional check to always run)
}

// Function to check if injected buttons still exist
function startButtonExistenceCheckInterval() {
  if (_buttonExistenceCheckIntervalId !== null) return // Already running

  _buttonExistenceCheckIntervalId = window.setInterval(() => {
    try {
      // Check if injected menu buttons still exist
      const existingMenuButtons = document.querySelectorAll('.emoji-extension-menu-item')
      if (existingMenuButtons.length === 0) {
        // If injected buttons are missing, try to re-inject them
        setupForceMobileMenuTriggers()
        setupForceMobileToolbarListeners()
      }
    } catch (e) {
      // ignore per-interval errors
    }
  }, 10000) // Check every 10 seconds
}

export function checkButtonsAndInjectIfNeeded() {
  const forceMobileMode = userscriptState.settings?.forceMobileMode || false
  if (!forceMobileMode) return

  // Check if toolbar trigger listener exists (not marked as emoji-detected)
  const toolbarTrigger = document.querySelector(
    'button.toolbar-menu__options-trigger[data-identifier="toolbar-menu__options"]:not(.emoji-detected)'
  ) as HTMLButtonElement | null

  // Check if chat composer trigger listener exists (not marked as emoji-detected)
  const chatComposerTrigger = document.querySelector(
    'button.chat-composer-dropdown__trigger-btn[data-identifier="chat-composer-dropdown__menu"]:not(.emoji-detected), button.chat-composer-dropdown__menu-trigger[data-identifier="chat-composer-dropdown__menu"]:not(.emoji-detected), button.chat-composer-dropdown__menu-trigger.chat-composer-dropdown__trigger-btn:not(.emoji-detected)'
  ) as HTMLButtonElement | null

  // Handle each trigger type independently
  if (toolbarTrigger && !toolbarOptionsTriggerInitialized) {
    const availableToolbarTrigger = document.querySelector(
      'button.toolbar-menu__options-trigger[data-identifier="toolbar-menu__options"]:not(.emoji-detected)'
    ) as HTMLButtonElement | null
    if (availableToolbarTrigger) {
      setupForceMobileMenuTriggers() // This will handle the toolbar trigger
    }
  }

  if (chatComposerTrigger && !chatComposerTriggerInitialized) {
    const availableChatComposerTrigger = document.querySelector(
      'button.chat-composer-dropdown__trigger-btn[data-identifier="chat-composer-dropdown__menu"]:not(.emoji-detected), button.chat-composer-dropdown__menu-trigger[data-identifier="chat-composer-dropdown__menu"]:not(.emoji-detected), button.chat-composer-dropdown__menu-trigger.chat-composer-dropdown__trigger-btn:not(.emoji-detected)'
    ) as HTMLButtonElement | null
    if (availableChatComposerTrigger) {
      setupForceMobileMenuTriggers() // This will handle the chat composer trigger
    }
  }

  // Also check for toolbar triggers that may have been added
  const selectors = getPlatformToolbarSelectors()
  for (const selector of selectors) {
    const elements = Array.from(document.querySelectorAll(selector)) as HTMLElement[]
    for (const toolbar of elements) {
      // Check if this toolbar has any triggers without emoji-detected class
      const toolbarOptionsTriggers = Array.from(
        toolbar.querySelectorAll(
          'button.toolbar-menu__options-trigger:not(.emoji-detected), button.chat-composer-dropdown__trigger-btn:not(.emoji-detected), button.chat-composer-dropdown__menu-trigger:not(.emoji-detected), button.chat-composer-dropdown__menu-trigger.chat-composer-dropdown__trigger-btn:not(.emoji-detected)'
        )
      ) as HTMLButtonElement[]
      
      if (toolbarOptionsTriggers.length > 0) {
        setupForceMobileToolbarListeners()
        break // Found a toolbar that needs listeners, break outer loop
      }
    }
  }
}

export function stopForceMobileToolbarListenerInterval() {
  if (_forceMobileToolbarIntervalId !== null) {
    clearInterval(_forceMobileToolbarIntervalId)
    _forceMobileToolbarIntervalId = null
  }
  
  if (_domChangeCheckIntervalId !== null) {
    clearInterval(_domChangeCheckIntervalId)
    _domChangeCheckIntervalId = null
  }
  
  if (_buttonExistenceCheckIntervalId !== null) {
    clearInterval(_buttonExistenceCheckIntervalId)
    _buttonExistenceCheckIntervalId = null
  }
}

// Reset the initialization flags to allow re-initialization of triggers
export function resetTriggerInitialization() {
  toolbarOptionsTriggerInitialized = false
  chatComposerTriggerInitialized = false
  // Clear the sets that track attached triggers
  toolbarTriggersAttached.clear()
  chatComposerTriggersAttached.clear()
}

// Start all intervals for force mobile mode
export function startAllForceMobileIntervals() {
  startForceMobileToolbarListenerInterval(1000)  // 1 second
  startDomChangeCheckInterval()                  // 1 second
  startButtonExistenceCheckInterval()            // 10 seconds
}

// Check if force mobile mode with d-menu-portals is active
export function shouldSkipToolbarInjection(): boolean {
  const forceMobileMode = userscriptState.settings?.forceMobileMode || false
  if (!forceMobileMode) return false

  const portalContainer = document.querySelector('#d-menu-portals')
  return !!portalContainer
}