// UI Components for toolbar injection (emoji buttons, menus, etc.)
import { createEl } from '../utils/createEl'
import { createEmojiPicker } from './emojiPicker'
import { showPopularEmojisModal } from './popularEmojis'

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
    console.warn(
      '[Emoji Extension Userscript] No dropdown-menu or chat-composer-dropdown__list found in expanded menu'
    )
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

  try {
    // Try to insert in the right place
    if (isChatComposer) {
      const existingEmojiTrigger = toolbar.querySelector(
        '.emoji-picker-trigger:not(.emoji-extension-button)'
      )
      if (existingEmojiTrigger) {
        toolbar.insertBefore(button, existingEmojiTrigger)
        toolbar.insertBefore(popularButton, existingEmojiTrigger)
      } else {
        toolbar.appendChild(button)
        toolbar.appendChild(popularButton)
      }
    } else {
      toolbar.appendChild(button)
      toolbar.appendChild(popularButton)
    }
  } catch (error) {
    console.error('[Emoji Extension Userscript] Failed to inject button:', error)
  }
}
