// Toolbar injection and button management module
import { createEl } from '../utils/createEl'
import { getPlatformToolbarSelectors } from '../utils/platformDetection'
import { userscriptState } from '../state'

import { createEmojiPicker } from './emojiPicker'
import { showPopularEmojisModal } from './popularEmojis'

// Quick inserts for userscript variant
const QUICK_INSERTS: string[] = [
  'info',
  'tip',
  'faq',
  'question',
  'note',
  'abstract',
  'todo',
  'success',
  'warning',
  'failure',
  'danger',
  'bug',
  'example',
  'quote'
]

const ICONS: Record<
  string,
  {
    icon: string
    color: string
    svg: string
  }
> = {
  info: {
    icon: 'ℹ️',
    color: 'rgba(2, 122, 255, 0.1)',
    svg: '<svg class="fa d-icon d-icon-far-lightbulb svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#far-lightbulb"></use></svg>'
  },
  tip: {
    icon: '💡',
    color: 'rgba(0, 191, 188, 0.1);',
    svg: '<svg class="fa d-icon d-icon-fire-flame-curved svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#fire-flame-curved"></use></svg>'
  },
  faq: {
    icon: '❓',
    color: 'rgba(236, 117, 0, 0.1);',
    svg: '<svg class="fa d-icon d-icon-far-circle-question svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#far-circle-question"></use></svg>'
  },
  question: {
    icon: '🤔',
    color: 'rgba(236, 117, 0, 0.1);',
    svg: '<svg class="fa d-icon d-icon-far-circle-question svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#far-circle-question"></use></svg>'
  },
  note: {
    icon: '📝',
    color: 'rgba(8, 109, 221, 0.1);',
    svg: '<svg class="fa d-icon d-icon-far-pen-to-square svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#far-pen-to-square"></use></svg>'
  },
  abstract: {
    icon: '📋',
    color: 'rgba(0, 191, 188, 0.1);',
    svg: '<svg class="fa d-icon d-icon-far-clipboard svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#far-clipboard"></use></svg>'
  },
  todo: {
    icon: '☑️',
    color: 'rgba(2, 122, 255, 0.1);',
    svg: '<svg class="fa d-icon d-icon-far-circle-check svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#far-circle-check"></use></svg>'
  },
  success: {
    icon: '🎉',
    color: 'rgba(68, 207, 110, 0.1);',
    svg: '<svg class="fa d-icon d-icon-check svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#check"></use></svg>'
  },
  warning: {
    icon: '⚠️',
    color: 'rgba(236, 117, 0, 0.1);',
    svg: '<svg class="fa d-icon d-icon-triangle-exclamation svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#triangle-exclamation"></use></svg>'
  },
  failure: {
    icon: '❌',
    color: 'rgba(233, 49, 71, 0.1);',
    svg: '<svg class="fa d-icon d-icon-xmark svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#xmark"></use></svg>'
  },
  danger: {
    icon: '☠️',
    color: 'rgba(233, 49, 71, 0.1);',
    svg: '<svg class="fa d-icon d-icon-bolt svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#bolt"></use></svg>'
  },
  bug: {
    icon: '🐛',
    color: 'rgba(233, 49, 71, 0.1);',
    svg: '<svg class="fa d-icon d-icon-bug svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#bug"></use></svg>'
  },
  example: {
    icon: '🔎',
    color: 'rgba(120, 82, 238, 0.1);',
    svg: '<svg class="fa d-icon d-icon-list svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#list"></use></svg>'
  },
  quote: {
    icon: '💬',
    color: 'rgba(158, 158, 158, 0.1);',
    svg: '<svg class="fa d-icon d-icon-quote-left svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#quote-left"></use></svg>'
  }
}

function insertIntoEditor(text: string) {
  // Priority 1: Chat composer (highest priority)
  const chatComposer = document.querySelector('textarea#channel-composer.chat-composer__input') as HTMLTextAreaElement | null
  
  // Check if chat composer is the active element or exists
  if (chatComposer) {
    const start = chatComposer.selectionStart ?? 0
    const end = chatComposer.selectionEnd ?? start
    const value = chatComposer.value
    chatComposer.value = value.slice(0, start) + text + value.slice(end)
    const pos = start + text.length
    if ('setSelectionRange' in chatComposer) {
      try {
        chatComposer.setSelectionRange(pos, pos)
      } catch (e) {
        // ignore
      }
    }
    chatComposer.dispatchEvent(new Event('input', { bubbles: true }))
    return
  }

  // Priority 2: Active textarea element
  const active = document.activeElement as HTMLElement | null
  const isTextarea = (el: Element | null) => !!el && el.tagName === 'TEXTAREA'

  if (isTextarea(active)) {
    const textarea = active as HTMLTextAreaElement
    const start = textarea.selectionStart ?? 0
    const end = textarea.selectionEnd ?? start
    const value = textarea.value
    textarea.value = value.slice(0, start) + text + value.slice(end)
    const pos = start + text.length
    if ('setSelectionRange' in textarea) {
      try {
        textarea.setSelectionRange(pos, pos)
      } catch (e) {
        // ignore
      }
    }
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    return
  }

  if (active && active.isContentEditable) {
    const sel = window.getSelection()
    if (!sel) return
    const range = sel.getRangeAt(0)
    range.deleteContents()
    const node = document.createTextNode(text)
    range.insertNode(node)
    range.setStartAfter(node)
    range.setEndAfter(node)
    sel.removeAllRanges()
    sel.addRange(range)
    active.dispatchEvent(new Event('input', { bubbles: true }))
    return
  }

  const fallback = document.querySelector('textarea') as HTMLTextAreaElement | null
  if (fallback) {
    fallback.focus()
    const start = (fallback as HTMLTextAreaElement).selectionStart ?? fallback.value.length
    const end = (fallback as HTMLTextAreaElement).selectionEnd ?? start
    const value = fallback.value
    fallback.value = value.slice(0, start) + text + value.slice(end)
    const pos = start + text.length
    if ('setSelectionRange' in fallback) {
      try {
        ;(fallback as HTMLTextAreaElement).setSelectionRange(pos, pos)
      } catch (e) {
        // ignore
      }
    }
    fallback.dispatchEvent(new Event('input', { bubbles: true }))
  }
}

function createQuickInsertMenu(): HTMLElement {
  const menu = createEl('div', {
    className:
      'fk-d-menu toolbar-menu__options-content toolbar-popup-menu-options -animated -expanded'
  }) as HTMLDivElement
  const inner = createEl('div', {
    className: 'fk-d-menu__inner-content'
  }) as HTMLDivElement
  const list = createEl('ul', {
    className: 'dropdown-menu'
  }) as HTMLUListElement

  QUICK_INSERTS.forEach(key => {
    const li = createEl('li', { className: 'dropdown-menu__item' }) as HTMLLIElement
    const btn = createEl('button', {
      className: 'btn btn-icon-text',
      type: 'button',
      title: key.charAt(0).toUpperCase() + key.slice(1),
      style: 'background: ' + (ICONS[key]?.color || 'auto')
    }) as HTMLButtonElement
    btn.addEventListener('click', () => {
      if (menu.parentElement) menu.parentElement.removeChild(menu)
      insertIntoEditor(`>[!${key}]+\n`)
    })

    const emojiSpan = createEl('span', {
      className: 'd-button-emoji',
      text: ICONS[key]?.icon || '✳️',
      style: 'margin-right: 6px;'
    }) as HTMLSpanElement
    // Add small spacing between emoji and label
    const labelWrap = createEl('span', {
      className: 'd-button-label'
    }) as HTMLSpanElement
    const labelText = createEl('span', {
      className: 'd-button-label__text',
      text: key.charAt(0).toUpperCase() + key.slice(1)
    }) as HTMLSpanElement

    // Instead of appending raw SVG into the text node, create a separate span
    // for the svg so it appears to the right of the label text.
    labelWrap.appendChild(labelText)
    const svgHtml = ICONS[key]?.svg || ''
    if (svgHtml) {
      const svgSpan = createEl('span', {
        className: 'd-button-label__svg',
        innerHTML: svgHtml,
        style: 'margin-left: 6px; display: inline-flex; align-items: center;'
      }) as HTMLSpanElement
      labelWrap.appendChild(svgSpan)
    }
    btn.appendChild(emojiSpan)
    btn.appendChild(labelWrap)
    li.appendChild(btn)
    list.appendChild(li)
  })

  inner.appendChild(list)
  menu.appendChild(inner)
  return menu
}

// Check if force mobile mode with d-menu-portals is active
export function shouldSkipToolbarInjection(): boolean {
  const forceMobileMode = userscriptState.settings?.forceMobileMode || false
  if (!forceMobileMode) return false

  const portalContainer = document.querySelector('#d-menu-portals')
  return !!portalContainer
}

// Find toolbars where we can inject buttons using platform-specific selectors
export function findAllToolbars(): HTMLElement[] {
  // Skip toolbar injection if force mobile mode with d-menu-portals is active
  if (shouldSkipToolbarInjection()) {
    console.log('[Emoji Extension Userscript] Force mobile mode with #d-menu-portals detected, skipping toolbar injection')
    return []
  }

  const toolbars: HTMLElement[] = []
  const selectors = getPlatformToolbarSelectors()

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector)
    toolbars.push(...(Array.from(elements) as HTMLElement[]))
  }
  return toolbars
}

// Setup listeners for force mobile mode menu triggers
let menuTriggersInitialized = false

function setupForceMobileMenuTriggers() {
  if (menuTriggersInitialized) return

  const forceMobileMode = userscriptState.settings?.forceMobileMode || false
  if (!forceMobileMode) return

  // Check for d-menu-portals container
  const portalContainer = document.querySelector('#d-menu-portals')
  if (!portalContainer) {
    console.log('[Emoji Extension Userscript] #d-menu-portals not found, skipping force mobile menu triggers')
    return
  }

  console.log('[Emoji Extension Userscript] Force mobile mode enabled, setting up menu triggers')

  // Find toolbar options trigger button
  const toolbarOptionsTrigger = document.querySelector(
    'button.toolbar-menu__options-trigger[data-identifier="toolbar-menu__options"]'
  ) as HTMLButtonElement | null

  // Find chat composer dropdown trigger button (try multiple selectors)
  const chatComposerTrigger = document.querySelector(
    'button.chat-composer-dropdown__trigger-btn[data-identifier="chat-composer-dropdown__menu"], button.chat-composer-dropdown__menu-trigger[data-identifier="chat-composer-dropdown__menu"]'
  ) as HTMLButtonElement | null

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

          // Check for modal container with toolbar menu
          if (element.classList.contains('modal-container')) {
            // Try to find menu immediately
            const modalMenu = element.querySelector(
              '.toolbar-menu__options-content[data-identifier="toolbar-menu__options"]'
            ) as HTMLElement | null
            
            if (modalMenu) {
              console.log('[Emoji Extension Userscript] Modal menu detected (immediate), injecting custom buttons')
              injectCustomMenuButtons(modalMenu)
            } else {
              // If menu not found immediately, observe the modal container for menu appearance
              const modalContentObserver = new MutationObserver(() => {
                const delayedMenu = element.querySelector(
                  '.toolbar-menu__options-content[data-identifier="toolbar-menu__options"]'
                ) as HTMLElement | null
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

  // Also add click listeners to trigger buttons to ensure we catch the menu
  if (toolbarOptionsTrigger) {
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
    console.log('[Emoji Extension Userscript] Toolbar options trigger listener added')
  }

  if (chatComposerTrigger) {
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
    console.log('[Emoji Extension Userscript] Chat composer trigger listener added')
  }

  menuTriggersInitialized = true
}

// Inject custom buttons into expanded menu
function injectCustomMenuButtons(menu: HTMLElement) {
  // Check if already injected
  if (menu.querySelector('.emoji-extension-menu-item')) {
    return
  }

  // Try multiple selectors for different menu types
  let dropdownMenu = menu.querySelector('ul.dropdown-menu')
  if (!dropdownMenu) {
    dropdownMenu = menu.querySelector('ul.chat-composer-dropdown__list')
  }
  if (!dropdownMenu) {
    console.warn('[Emoji Extension Userscript] No dropdown-menu or chat-composer-dropdown__list found in expanded menu')
    return
  }

  // Determine menu type for appropriate styling
  const isChatComposerMenu = dropdownMenu.classList.contains('chat-composer-dropdown__list')
  const itemClassName = isChatComposerMenu 
    ? 'chat-composer-dropdown__item emoji-extension-menu-item'
    : 'dropdown-menu__item emoji-extension-menu-item'
  const btnClassName = isChatComposerMenu
    ? 'btn btn-icon-text chat-composer-dropdown__action-btn btn-transparent'
    : 'btn btn-icon-text'

  // Create emoji picker menu item
  const emojiPickerItem = createEl('li', {
    className: itemClassName
  }) as HTMLLIElement

  const emojiPickerBtn = createEl('button', {
    className: btnClassName,
    type: 'button',
    title: '表情包选择器',
    innerHTML: `
      <svg class="fa d-icon d-icon-smile svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#far-smile"></use></svg>
      <span class="d-button-label">表情包选择器</span>
    `
  }) as HTMLButtonElement

  emojiPickerBtn.addEventListener('click', async e => {
    e.stopPropagation()
    // Close the menu
    if (menu.parentElement) {
      menu.remove()
    }

    // Open emoji picker
    if (currentPicker) {
      closeCurrentPicker()
      return
    }

    currentPicker = await createEmojiPicker()
    if (!currentPicker) return

    document.body.appendChild(currentPicker)

    // Position as modal for force mobile mode
    currentPicker.style.position = 'fixed'
    currentPicker.style.top = '0'
    currentPicker.style.left = '0'
    currentPicker.style.right = '0'
    currentPicker.style.bottom = '0'
    currentPicker.style.zIndex = '999999'

    // Close on outside click
    setTimeout(() => {
      const handleClick = (e: Event) => {
        if (currentPicker && !currentPicker.contains(e.target as Node)) {
          closeCurrentPicker()
          document.removeEventListener('click', handleClick)
        }
      }
      document.addEventListener('click', handleClick)
    }, 100)
  })

  emojiPickerItem.appendChild(emojiPickerBtn)
  dropdownMenu.appendChild(emojiPickerItem)

  // Create quick insert menu item
  const quickInsertItem = createEl('li', {
    className: itemClassName
  }) as HTMLLIElement

  const quickInsertBtn = createEl('button', {
    className: btnClassName,
    type: 'button',
    title: '快捷输入',
    innerHTML: `
      <svg class="fa d-icon d-icon-list svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#list"></use></svg>
      <span class="d-button-label">快捷输入</span>
    `
  }) as HTMLButtonElement

  quickInsertBtn.addEventListener('click', e => {
    e.stopPropagation()
    // Close the current menu
    if (menu.parentElement) {
      menu.remove()
    }

    // Show quick insert menu
    const quickMenu = createQuickInsertMenu()
    const portal = document.querySelector('#d-menu-portals') || document.body
    ;(portal as HTMLElement).appendChild(quickMenu)

    const rect = quickInsertBtn.getBoundingClientRect()
    quickMenu.style.position = 'fixed'
    quickMenu.style.zIndex = '10000'
    quickMenu.style.top = `${rect.bottom + 5}px`
    quickMenu.style.left = `${Math.max(8, Math.min(rect.left + rect.width / 2 - 150, window.innerWidth - 300))}px`

    const removeMenu = (ev: Event) => {
      if (!quickMenu.contains(ev.target as Node)) {
        if (quickMenu.parentElement) quickMenu.parentElement.removeChild(quickMenu)
        document.removeEventListener('click', removeMenu)
      }
    }
    setTimeout(() => document.addEventListener('click', removeMenu), 100)
  })

  quickInsertItem.appendChild(quickInsertBtn)
  dropdownMenu.appendChild(quickInsertItem)

  console.log('[Emoji Extension Userscript] Custom menu buttons injected')
}

// Current picker management
let currentPicker: HTMLElement | null = null

export function closeCurrentPicker() {
  if (currentPicker) {
    currentPicker.remove()
    currentPicker = null
  }
}

// Insert a floating emoji button into the header panel as a fallback when no toolbar
export function injectHeaderFloatingButton(): boolean {
  try {
    // Prefer header-buttons span inside .panel, else fall back to .icons.d-header-icons
    const panel = document.querySelector('.panel') as HTMLElement | null
    let target: HTMLElement | null = null

    if (panel) {
      const headerButtons = panel.querySelector('.header-buttons') as HTMLElement | null
      if (headerButtons) target = headerButtons
    }

    if (!target) {
      target = document.querySelector('.icons.d-header-icons') as HTMLElement | null
    }

    if (!target) return false

    // Avoid duplicating button
    if (target.querySelector('.emoji-extension-header-button')) return false

    const wrapper = createEl('li', { className: 'header-dropdown-toggle emoji-extension-header-item' }) as HTMLLIElement
    const btn = createEl('button', {
      className: 'btn no-text icon btn-flat emoji-extension-header-button',
      title: '表情包',
      type: 'button',
      innerHTML: '🐈‍⬛'
    }) as HTMLButtonElement

    btn.addEventListener('click', async (e: Event) => {
      e.stopPropagation()
      if (currentPicker) {
        closeCurrentPicker()
        return
      }
      currentPicker = await createEmojiPicker()
      if (!currentPicker) return
      document.body.appendChild(currentPicker)
      // position as floating near header
      currentPicker.style.position = 'fixed'
      currentPicker.style.top = '56px'
      currentPicker.style.right = '16px'
      currentPicker.style.zIndex = '999999'

      setTimeout(() => {
        const handleClick = (ev: Event) => {
          if (currentPicker && !currentPicker.contains(ev.target as Node) && ev.target !== btn) {
            closeCurrentPicker()
            document.removeEventListener('click', handleClick)
          }
        }
        document.addEventListener('click', handleClick)
      }, 50)
    })

    wrapper.appendChild(btn)

    // Many header lists are <ul class="icons d-header-icons"> with <li> children
    if (target.tagName.toLowerCase() === 'ul') {
      ;(target as HTMLElement).appendChild(wrapper)
    } else {
      // header-buttons span: append as child
      target.appendChild(wrapper)
    }

    console.log('[Emoji Extension Userscript] Header floating button injected')
    return true
  } catch (error) {
    console.warn('[Emoji Extension Userscript] Failed to inject header floating button', error)
    return false
  }
}

// Inject emoji button into toolbar
export function injectEmojiButton(toolbar: HTMLElement) {
  if (toolbar.querySelector('.emoji-extension-button')) {
    return // Already injected
  }

  const isChatComposer = toolbar.classList.contains('chat-composer__inner-container')

  // Create main emoji picker button
  const button = createEl('button', {
    className:
      'btn no-text btn-icon toolbar__button nacho-emoji-picker-button emoji-extension-button',
    title: '表情包',
    type: 'button',
    innerHTML: '🐈‍⬛'
  }) as HTMLButtonElement

  // Create popular emojis button
  const popularButton = createEl('button', {
    className:
      'btn no-text btn-icon toolbar__button nacho-emoji-popular-button emoji-extension-button',
    title: '常用表情',
    type: 'button',
    innerHTML: '⭐'
  }) as HTMLButtonElement

  if (isChatComposer) {
    button.classList.add(
      'fk-d-menu__trigger',
      'emoji-picker-trigger',
      'chat-composer-button',
      'btn-transparent',
      '-emoji'
    )
    button.setAttribute('aria-expanded', 'false')
    button.setAttribute('data-identifier', 'emoji-picker')
    button.setAttribute('data-trigger', '')

    popularButton.classList.add(
      'fk-d-menu__trigger',
      'popular-emoji-trigger',
      'chat-composer-button',
      'btn-transparent',
      '-popular'
    )
    popularButton.setAttribute('aria-expanded', 'false')
    popularButton.setAttribute('data-identifier', 'popular-emoji')
    popularButton.setAttribute('data-trigger', '')
  }

  // Main emoji picker button click handler
  button.addEventListener('click', async e => {
    e.stopPropagation()

    if (currentPicker) {
      closeCurrentPicker()
      return
    }

    currentPicker = await createEmojiPicker()
    if (!currentPicker) return

    document.body.appendChild(currentPicker)

    const buttonRect = button.getBoundingClientRect()
    // If mobile-style modal (full-screen) then keep default modal behavior.
    const isModal =
      currentPicker.classList.contains('modal') || currentPicker.className.includes('d-modal')

    if (isModal) {
      // Ensure modal fills or centers appropriately (modal CSS should handle layout)
      currentPicker.style.position = 'fixed'
      currentPicker.style.top = '0'
      currentPicker.style.left = '0'
      currentPicker.style.right = '0'
      currentPicker.style.bottom = '0'
      currentPicker.style.zIndex = '999999'
    } else {
      // Floating picker: position adaptively. Keep it inside viewport and prefer below button.
      currentPicker.style.position = 'fixed'
      // give the browser one paint to compute size
      const margin = 8
      const vpWidth = window.innerWidth
      const vpHeight = window.innerHeight

      // temporary place below to measure
      currentPicker.style.top = buttonRect.bottom + margin + 'px'
      currentPicker.style.left = buttonRect.left + 'px'

      // Measure after appended
      const pickerRect = currentPicker.getBoundingClientRect()
      const spaceBelow = vpHeight - buttonRect.bottom
      const neededHeight = pickerRect.height + margin
      let top = buttonRect.bottom + margin
      if (spaceBelow < neededHeight) {
        // place above the button
        top = Math.max(margin, buttonRect.top - pickerRect.height - margin)
      }
      // Keep left within viewport
      let left = buttonRect.left
      if (left + pickerRect.width + margin > vpWidth) {
        left = Math.max(margin, vpWidth - pickerRect.width - margin)
      }
      if (left < margin) left = margin

      currentPicker.style.top = top + 'px'
      currentPicker.style.left = left + 'px'
    }

    // Close on outside click
    setTimeout(() => {
      const handleClick = (e: Event) => {
        if (currentPicker && !currentPicker.contains(e.target as Node) && e.target !== button) {
          closeCurrentPicker()
          document.removeEventListener('click', handleClick)
        }
      }
      document.addEventListener('click', handleClick)
    }, 100)
  })

  // Popular emojis button click handler
  popularButton.addEventListener('click', e => {
    e.stopPropagation()
    closeCurrentPicker() // Close emoji picker if open
    showPopularEmojisModal()
  })

  // Note: auto-read floating/menu button removed — only emoji and quick-insert remain

  // Create quick-insert button
  const quickInsertButton = createEl('button', {
    className: 'btn no-text btn-icon toolbar__button quick-insert-button',
    title: '快捷输入',
    type: 'button',
    innerHTML: '⎘'
  }) as HTMLButtonElement

  if (isChatComposer) {
    quickInsertButton.classList.add('fk-d-menu__trigger', 'chat-composer-button', 'btn-transparent')
    quickInsertButton.setAttribute('aria-expanded', 'false')
    quickInsertButton.setAttribute('data-trigger', '')
  }

  quickInsertButton.addEventListener('click', e => {
    e.stopPropagation()
    const menu = createQuickInsertMenu()
    const portal = document.querySelector('#d-menu-portals') || document.body
    ;(portal as HTMLElement).appendChild(menu)
    const rect = quickInsertButton.getBoundingClientRect()
    menu.style.position = 'fixed'
    menu.style.zIndex = '10000'
    menu.style.top = `${rect.bottom + 5}px`
    menu.style.left = `${Math.max(8, Math.min(rect.left + rect.width / 2 - 150, window.innerWidth - 300))}px`

    const removeMenu = (ev: Event) => {
      if (!menu.contains(ev.target as Node)) {
        if (menu.parentElement) menu.parentElement.removeChild(menu)
        document.removeEventListener('click', removeMenu)
      }
    }
    setTimeout(() => document.addEventListener('click', removeMenu), 100)
  })

  try {
    // Try to insert in the right place
    if (isChatComposer) {
      const existingEmojiTrigger = toolbar.querySelector(
        '.emoji-picker-trigger:not(.emoji-extension-button)'
      )
      if (existingEmojiTrigger) {
        toolbar.insertBefore(button, existingEmojiTrigger)
        toolbar.insertBefore(quickInsertButton, existingEmojiTrigger)
        toolbar.insertBefore(popularButton, existingEmojiTrigger)
      } else {
        toolbar.appendChild(button)
        toolbar.appendChild(quickInsertButton)
        toolbar.appendChild(popularButton)
      }
    } else {
      toolbar.appendChild(button)
      toolbar.appendChild(quickInsertButton)
      toolbar.appendChild(popularButton)
    }
  } catch (error) {
    console.error('[Emoji Extension Userscript] Failed to inject button:', error)
  }
}

// Injection attempt function
export function attemptInjection() {
  const toolbars = findAllToolbars()
  let injectedCount = 0

  toolbars.forEach(toolbar => {
    if (!toolbar.querySelector('.emoji-extension-button')) {
      console.log('[Emoji Extension Userscript] Toolbar found, injecting button.')
      injectEmojiButton(toolbar)
      injectedCount++
    }
  })

  // Setup force mobile mode menu triggers if enabled
  setupForceMobileMenuTriggers()

  // Fallback: if no toolbars found and not in force mobile mode, try header panel injection
  try {
    const forceMobile = userscriptState.settings?.forceMobileMode || false
    // Only inject header floating button as a fallback when force mobile mode is active
    if (injectedCount === 0 && forceMobile) {
      const headerInserted = injectHeaderFloatingButton()
      if (headerInserted) injectedCount++
    }
  } catch (e) {
    // ignore
  }

  return { injectedCount, totalToolbars: toolbars.length }
}

// Periodic toolbar checking
export function startPeriodicInjection() {
  setInterval(() => {
    const toolbars = findAllToolbars()
    toolbars.forEach(toolbar => {
      if (!toolbar.querySelector('.emoji-extension-button')) {
        console.log('[Emoji Extension Userscript] New toolbar found, injecting button.')
        injectEmojiButton(toolbar)
      }
    })

    // Also check for force mobile mode menu triggers
    setupForceMobileMenuTriggers()
  }, 30000)
}
