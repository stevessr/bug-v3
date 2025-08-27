import { createEmojiPicker, isMobile } from './picker'
import { cachedState } from './state'

// Different toolbar selectors for different contexts
const TOOLBAR_SELECTORS = [
  '.d-editor-button-bar[role="toolbar"]', // Standard editor toolbar
  '.chat-composer__inner-container', // Chat composer
]

export function findToolbar(): Element | null {
  for (const selector of TOOLBAR_SELECTORS) {
    const toolbar = document.querySelector(selector)
    if (toolbar) {
      return toolbar
    }
  }
  return null
}

export function findAllToolbars(): Element[] {
  const toolbars: Element[] = []
  for (const selector of TOOLBAR_SELECTORS) {
    const elements = document.querySelectorAll(selector)
    toolbars.push(...Array.from(elements))
  }
  return toolbars
}

let currentPicker: HTMLElement | null = null

function handleClickOutside(e: Event, button: HTMLElement) {
  if (currentPicker && !currentPicker.contains(e.target as Node) && e.target !== button) {
    currentPicker.remove()
    currentPicker = null
    document.removeEventListener('click', (event) => handleClickOutside(event, button))
  }
}

async function injectDesktopPicker(button: HTMLElement) {
  currentPicker = await createEmojiPicker(false)
  const buttonRect = button.getBoundingClientRect()
  const pickerElement = currentPicker
  if (pickerElement) document.body.appendChild(pickerElement)

  const editorWrapper = document.querySelector('.d-editor-textarea-wrapper')
  if (editorWrapper) {
    const editorRect = editorWrapper.getBoundingClientRect()
    const replyControl = document.querySelector('#reply-control')
    const isMinireply = replyControl?.className.includes('hide-preview') && window.innerWidth < 1600
    pickerElement.style.position = 'fixed'
    if (isMinireply) {
      pickerElement.style.bottom = window.innerHeight - editorRect.top + 10 + 'px'
      pickerElement.style.left = editorRect.left + editorRect.width / 2 - 200 + 'px'
    } else {
      const pickerRect = pickerElement.getBoundingClientRect()
      pickerElement.style.top = buttonRect.top - pickerRect.height - 5 + 'px'
      pickerElement.style.left =
        buttonRect.left + buttonRect.width / 2 - pickerRect.width / 2 + 'px'
      if (pickerElement.getBoundingClientRect().top < 0) {
        pickerElement.style.top = buttonRect.bottom + 5 + 'px'
      }
    }
  } else {
    pickerElement.style.position = 'fixed'
    pickerElement.style.top = buttonRect.bottom + 5 + 'px'
    pickerElement.style.left = buttonRect.left + 'px'
  }

  setTimeout(() => {
    document.addEventListener('click', (event) => handleClickOutside(event, button))
  }, 100)
}

async function injectMobilePicker() {
  const picker = await createEmojiPicker(true)

  let modalContainer = document.querySelector('.modal-container')
  if (!modalContainer) {
    modalContainer = document.createElement('div')
    modalContainer.className = 'modal-container'
    document.body.appendChild(modalContainer)
  }

  modalContainer.innerHTML = '' // Clear any previous content

  const backdrop = document.createElement('div')
  backdrop.className = 'd-modal__backdrop'
  backdrop.addEventListener('click', () => {
    modalContainer.remove()
    currentPicker = null
  })

  modalContainer.appendChild(picker)
  modalContainer.appendChild(backdrop)

  currentPicker = modalContainer as HTMLElement
}

export function injectButton(toolbar: Element) {
  // Check if we already injected buttons in this toolbar
  if (
    toolbar.querySelector('.emoji-extension-button') ||
    toolbar.querySelector('.image-upload-button')
  ) {
    return
  }

  const isChatComposer = toolbar.classList.contains('chat-composer__inner-container')

  // Create emoji button
  const emojiButton = document.createElement('button')
  emojiButton.classList.add(
    'btn',
    'no-text',
    'btn-icon',
    'toolbar__button',
    'nacho-emoji-picker-button',
    'emoji-extension-button',
  )

  // Add chat-specific classes if needed
  if (isChatComposer) {
    emojiButton.classList.add(
      'fk-d-menu__trigger',
      'emoji-picker-trigger',
      'chat-composer-button',
      'btn-transparent',
      '-emoji',
    )
    emojiButton.setAttribute('aria-expanded', 'false')
    emojiButton.setAttribute('data-identifier', 'emoji-picker')
    emojiButton.setAttribute('data-trigger', '')
  }

  emojiButton.title = '表情包'
  emojiButton.type = 'button'
  emojiButton.innerHTML = `🐈‍⬛`

  emojiButton.addEventListener('click', async (event) => {
    event.stopPropagation()
    if (currentPicker) {
      currentPicker.remove()
      currentPicker = null
      document.removeEventListener('click', (event) => handleClickOutside(event, emojiButton))
      return
    }

    // Use cached settings - updated to use MobileMode instead of forceMobileMode
    const forceMobile = cachedState.settings.MobileMode || false

    if (forceMobile) {
      injectMobilePicker()
    } else {
      injectDesktopPicker(emojiButton)
    }
  })

  try {
    // Insert buttons at appropriate positions
    if (isChatComposer) {
      // For chat composer, insert before the emoji picker button
      const emojiPickerBtn = toolbar.querySelector(
        '.emoji-picker-trigger:not(.emoji-extension-button)',
      )
      if (emojiPickerBtn) {
        toolbar.insertBefore(emojiButton, emojiPickerBtn)
      } else {
        toolbar.appendChild(emojiButton)
      }
    } else {
      // For standard toolbar, append at the end
      toolbar.appendChild(emojiButton)
    }
  } catch (e) {
    console.error('[Mr Emoji] Failed to inject buttons (module):', e)
  }
}
