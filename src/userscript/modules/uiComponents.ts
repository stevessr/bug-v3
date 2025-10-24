// UI Components for toolbar injection (emoji buttons, menus, etc.)
import { createEl } from '../utils/createEl'
import { createEmojiPicker } from './emojiPicker'
import { showPopularEmojisModal } from './popularEmojis'
import { getIcon } from '../utils/sharedIcons'
import { insertIntoEditor } from '../utils/editorUtils'

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
      style: 'background: ' + (getIcon(key)?.color || 'auto')
    }) as HTMLButtonElement
    btn.addEventListener('click', () => {
      if (menu.parentElement) menu.parentElement.removeChild(menu)
      insertIntoEditor(`>[!${key}]+\n`)
    })

    const emojiSpan = createEl('span', {
      className: 'd-button-emoji',
      text: getIcon(key)?.icon || '✳️',
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
    const svgHtml = getIcon(key)?.svg || ''
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

// Current picker management
let currentPicker: HTMLElement | null = null

export function closeCurrentPicker() {
  if (currentPicker) {
    currentPicker.remove()
    currentPicker = null
  }
}

// Inject custom buttons into expanded menu
export function injectCustomMenuButtons(menu: HTMLElement) {
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
      <svg class="fa d-icon d-icon-smile svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#far-face-smile"></use></svg>
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