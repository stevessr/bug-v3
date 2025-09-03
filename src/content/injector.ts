import { createEmojiPicker } from './picker'
import { cachedState } from './state'
import { showImageUploadDialog } from './uploader'
import { logger } from './buildFlags'

// Different toolbar selectors for different contexts
const TOOLBAR_SELECTORS = [
  '.d-editor-button-bar[role="toolbar"]', // Standard editor toolbar
  '.chat-composer__inner-container' // Chat composer
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
    document.removeEventListener('click', event => handleClickOutside(event, button))
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
    document.addEventListener('click', event => handleClickOutside(event, button))
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

function createUploadMenu(): HTMLElement {
  // Build a popout-style menu matching referense/popout.html structure
  const menu = document.createElement('div')
  menu.className =
    'fk-d-menu toolbar-menu__options-content toolbar-popup-menu-options -animated -expanded'
  menu.setAttribute('data-identifier', 'toolbar-menu__options')
  menu.setAttribute('role', 'dialog')
  // Reuse site's CSS by relying on the same class names; do not inject visual styles here.

  const inner = document.createElement('div')
  inner.className = 'fk-d-menu__inner-content'

  const list = document.createElement('ul')
  list.className = 'dropdown-menu'

  function createListItem(titleText: string, emoji: string, onClick: () => void) {
    const li = document.createElement('li')
    li.className = 'dropdown-menu__item'

    const btn = document.createElement('button')
    btn.className = 'btn btn-icon-text'
    btn.type = 'button'
    btn.title = titleText
    btn.addEventListener('click', onClick)

    const emojiSpan = document.createElement('span')
    emojiSpan.textContent = emoji

    const labelWrap = document.createElement('span')
    labelWrap.className = 'd-button-label'
    const labelText = document.createElement('span')
    labelText.className = 'd-button-label__text'
    labelText.textContent = titleText

    labelWrap.appendChild(labelText)
    btn.appendChild(emojiSpan)
    btn.appendChild(labelWrap)

    // Visual hover/active styles are provided by the page's CSS; do not inject styles here.

    li.appendChild(btn)
    return li
  }

  const uploadLi = createListItem('上传本地图片', '📁', async () => {
    menu.remove()
    await showImageUploadDialog()
  })

  const generateLi = createListItem('AI 生成图片', '🎨', () => {
    menu.remove()
    try {
      window.open('https://gemini-image.smnet.studio/', '_blank')
    } catch (e) {
      window.location.href = 'https://gemini-image.smnet.studio/'
    }
  })

  list.appendChild(uploadLi)
  list.appendChild(generateLi)
  inner.appendChild(list)
  menu.appendChild(inner)

  return menu
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
    'emoji-extension-button'
  )

  // Add chat-specific classes if needed
  if (isChatComposer) {
    emojiButton.classList.add(
      'fk-d-menu__trigger',
      'emoji-picker-trigger',
      'chat-composer-button',
      'btn-transparent',
      '-emoji'
    )
    emojiButton.setAttribute('aria-expanded', 'false')
    emojiButton.setAttribute('data-identifier', 'emoji-picker')
    emojiButton.setAttribute('data-trigger', '')
  }

  emojiButton.title = '表情包'
  emojiButton.type = 'button'
  emojiButton.innerHTML = `🐈‍⬛`

  emojiButton.addEventListener('click', async event => {
    event.stopPropagation()
    if (currentPicker) {
      currentPicker.remove()
      currentPicker = null
      document.removeEventListener('click', event => handleClickOutside(event, emojiButton))
      return
    }

    // Use cached settings instead of reading from storage directly
    const forceMobile = (cachedState.settings as any)?.forceMobileMode || false

    if (forceMobile) {
      injectMobilePicker()
    } else {
      injectDesktopPicker(emojiButton)
    }
  })

  // Create image upload button
  const uploadButton = document.createElement('button')
  uploadButton.classList.add('btn', 'no-text', 'btn-icon', 'toolbar__button', 'image-upload-button')

  // Add chat-specific classes if needed
  if (isChatComposer) {
    uploadButton.classList.add('fk-d-menu__trigger', 'chat-composer-button', 'btn-transparent')
    uploadButton.setAttribute('aria-expanded', 'false')
    uploadButton.setAttribute('data-trigger', '')
  }

  uploadButton.title = '上传图片'
  uploadButton.type = 'button'
  uploadButton.innerHTML = `📷`

  uploadButton.addEventListener('click', async event => {
    event.stopPropagation()
    // Show menu with upload options and mount it into #d-menu-portals
    const menu = createUploadMenu()

    // Ensure portal container exists
    let portal = document.querySelector('#d-menu-portals') as HTMLElement | null
    if (!portal) {
      portal = document.createElement('div')
      portal.id = 'd-menu-portals'
      document.body.appendChild(portal)
    }

    portal.appendChild(menu)

    // Position menu near button
    const rect = uploadButton.getBoundingClientRect()
    menu.style.top = rect.bottom + 5 + 'px'
    menu.style.left = rect.left + 'px'

    // Remove/unmount menu when clicking outside
    const removeMenu = (e: Event) => {
      if (!menu.contains(e.target as Node)) {
        if (menu.parentElement) menu.parentElement.removeChild(menu)
        document.removeEventListener('click', removeMenu)
      }
    }

    setTimeout(() => {
      document.addEventListener('click', removeMenu)
    }, 100)
  })

  try {
    // Insert buttons at appropriate positions
    if (isChatComposer) {
      // For chat composer, insert before the emoji picker button
      const emojiPickerBtn = toolbar.querySelector(
        '.emoji-picker-trigger:not(.emoji-extension-button)'
      )
      if (emojiPickerBtn) {
        toolbar.insertBefore(uploadButton, emojiPickerBtn)
        toolbar.insertBefore(emojiButton, emojiPickerBtn)
      } else {
        toolbar.appendChild(uploadButton)
        toolbar.appendChild(emojiButton)
      }
    } else {
      // For standard toolbar, append at the end
      toolbar.appendChild(uploadButton)
      toolbar.appendChild(emojiButton)
    }
  } catch (e) {
    logger.error('[Emoji Extension] Failed to inject buttons (module):', e)
  }
}
