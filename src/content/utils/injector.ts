import { createEmojiPicker } from '../discourse/utils/picker'
import { cachedState } from '../data/state'

import { notify } from './notify'
import { autoReadAll } from './autoReadReplies'

// logger removed: replaced by direct console usage in migration
import { showImageUploadDialog } from './uploader'

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

// Quick inserts available globally (store as plain keys without [!])
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

/**
 * Insert text into the active editor used by the emoji picker / site.
 * Tries several selectors used by the site to find the textarea/contenteditable.
 */
function insertIntoEditor(text: string) {
  // Prefer the focused element if it's a text input or contenteditable
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

  // Try specific editor selectors used by site/picker
  const selectors = [
    '.d-editor-textarea-wrapper textarea',
    '.d-editor-textarea textarea',
    '.d-editor-textarea textarea',
    'textarea'
  ]

  for (const sel of selectors) {
    const el = document.querySelector(sel) as
      | HTMLTextAreaElement
      | HTMLInputElement
      | HTMLElement
      | null
    if (!el) continue
    if ((el as HTMLElement).isContentEditable) {
      const editable = el as HTMLElement
      const range = document.createRange()
      range.selectNodeContents(editable)
      range.collapse(false)
      const textNode = document.createTextNode(text)
      range.insertNode(textNode)
      const seln = window.getSelection()
      if (seln) {
        seln.removeAllRanges()
        const newRange = document.createRange()
        newRange.setStartAfter(textNode)
        newRange.setEndAfter(textNode)
        seln.addRange(newRange)
      }
      editable.dispatchEvent(new Event('input', { bubbles: true }))
      return
    }

    // treat as textarea/input
    const input = el as HTMLTextAreaElement | HTMLInputElement
    input.focus()
    const start = (input as HTMLTextAreaElement).selectionStart ?? input.value.length
    const end = (input as HTMLTextAreaElement).selectionEnd ?? start
    const value = input.value
    input.value = value.slice(0, start) + text + value.slice(end)
    const pos = start + text.length
    if ('setSelectionRange' in input) {
      try {
        ;(input as HTMLTextAreaElement).setSelectionRange(pos, pos)
      } catch (e) {
        // ignore
      }
    }
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return
  }
}

function createQuickInsertMenu(): HTMLElement {
  const menu = document.createElement('div')
  menu.className =
    'fk-d-menu toolbar-menu__options-content toolbar-popup-menu-options -animated -expanded'
  const inner = document.createElement('div')
  inner.className = 'fk-d-menu__inner-content'
  const list = document.createElement('ul')
  list.className = 'dropdown-menu'

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

  QUICK_INSERTS.forEach(item => {
    const li = document.createElement('li')
    li.className = 'dropdown-menu__item'
    const btn = document.createElement('button')
    btn.className = 'btn btn-icon-text'
    btn.type = 'button'
    // item is a plain key like 'info' — build display label and title
    const displayLabel =
      item.length > 0 ? item.charAt(0).toUpperCase() + item.slice(1).toLowerCase() : item
    btn.title = displayLabel
    btn.addEventListener('click', () => {
      // remove menu and insert into editor
      if (menu.parentElement) menu.parentElement.removeChild(menu)
      // Insert wrapped form: [!key]
      insertIntoEditor(`>[!${item}]\n`)
    })

    const emojiSpan = document.createElement('span')
    emojiSpan.textContent = ICONS[item]?.icon || '✳️'
    const color = ICONS[item]?.color
    emojiSpan.style.marginRight = '6px'
    const labelWrap = document.createElement('span')
    labelWrap.className = 'd-button-label'
    const labelText = document.createElement('span')
    if (color) btn.style.background = color
    labelText.className = 'd-button-label__text'
    labelText.textContent = displayLabel

    // Append text node first, then add svg in a separate span so the svg appears
    // to the right of the text instead of being concatenated into the text node.
    labelWrap.appendChild(labelText)
    const svgHtml = ICONS[item]?.svg || ''
    if (svgHtml) {
      const svgSpan = document.createElement('span')
      svgSpan.className = 'd-button-label__svg'
      svgSpan.innerHTML = svgHtml
      svgSpan.style.marginLeft = '6px'
      svgSpan.style.display = 'inline-flex'
      svgSpan.style.alignItems = 'center'
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

function createUploadMenu(isMobile: boolean = false): HTMLElement {
  // Build a popout-style menu matching referense/popout.html structure
  // If isMobile is true, return a modal-style container compatible with mobile popout
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
  list.appendChild(uploadLi)

  // (已移除) 旧的“自动请求绑定”菜单项已删除，使用“自动阅读所有回复”替代

  const autoReadLi = createListItem('自动阅读所有回复', '📖', async () => {
    menu.remove()
    try {
      // trigger auto read; autoReadAll will notify progress
      await autoReadAll()
    } catch (e) {
      notify('自动阅读失败: ' + (e && (e as any).message ? (e as any).message : String(e)), 'error')
    }
  })
  list.appendChild(autoReadLi)

  const generateLi = createListItem('AI 生成图片', '🎨', () => {
    menu.remove()
    try {
      window.open('https://gemini-image.smnet.studio/', '_blank')
    } catch (e) {
      window.location.href = 'https://gemini-image.smnet.studio/'
    }
  })
  list.appendChild(generateLi)

  const learnxv6 = createListItem('学习xv6', '🖥︎', () => {
    menu.remove()
    try {
      window.open('https://pwsh.edu.deal/', '_blank')
    } catch (e) {
      window.location.href = 'https://pwsh.edu.deal/'
    }
  })

  list.appendChild(learnxv6)

  const passwall = createListItem('过盾', '🛡', () => {
    // If a modal iframe already exists, don't create another
    const existing = document.querySelector(
      '.emoji-extension-passwall-iframe'
    ) as HTMLElement | null
    if (existing) return

    // Build modal container for iframe
    const modal = document.createElement('div')
    modal.className = 'emoji-extension-passwall-iframe modal-container'
    modal.style.position = 'fixed'
    modal.style.top = '0'
    modal.style.left = '0'
    modal.style.width = '100%'
    modal.style.height = '100%'
    modal.style.display = 'flex'
    modal.style.alignItems = 'center'
    modal.style.justifyContent = 'center'
    modal.style.zIndex = '100000'

    const backdrop = document.createElement('div')
    backdrop.style.position = 'absolute'
    backdrop.style.top = '0'
    backdrop.style.left = '0'
    backdrop.style.width = '100%'
    backdrop.style.height = '100%'
    backdrop.style.background = 'rgba(0,0,0,0.5)'

    const frameWrap = document.createElement('div')
    frameWrap.style.position = 'relative'
    frameWrap.style.width = '80%'
    frameWrap.style.maxWidth = '900px'
    frameWrap.style.height = '80%'
    frameWrap.style.maxHeight = '700px'
    frameWrap.style.background = '#fff'
    frameWrap.style.borderRadius = '8px'
    frameWrap.style.overflow = 'hidden'
    frameWrap.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)'

    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.textContent = '关闭'
    closeBtn.style.position = 'absolute'
    closeBtn.style.top = '8px'
    closeBtn.style.right = '8px'
    closeBtn.style.zIndex = '1001'
    closeBtn.className = 'btn btn-sm'

    const iframe = document.createElement('iframe')
    iframe.src = 'https://linux.do/challenge'
    iframe.style.width = '100%'
    iframe.style.height = '100%'
    iframe.style.border = '0'
    iframe.setAttribute('sandbox', 'allow-scripts allow-forms allow-same-origin allow-popups')

    // Close helper
    const closeModal = () => {
      if (modal.parentElement) modal.parentElement.removeChild(modal)
    }

    closeBtn.addEventListener('click', () => {
      closeModal()
    })

    // Listen for navigation and close when domain is linux.do
    iframe.addEventListener('load', () => {
      let href: string | null = null
      try {
        href =
          (iframe.contentWindow &&
            iframe.contentWindow.location &&
            iframe.contentWindow.location.href) ||
          null
      } catch (e) {
        // Cross-origin access will throw; fallback to using src or keep open
        href = iframe.src || null
      }

      if (href) {
        try {
          const url = new URL(href)
          if (url.hostname.endsWith('linux.do')) {
            // Automatically close when navigated to linux.do domain
            closeModal()
          }
        } catch (e) {
          // ignore malformed URLs
        }
      }
    })

    frameWrap.appendChild(closeBtn)
    frameWrap.appendChild(iframe)
    modal.appendChild(backdrop)
    modal.appendChild(frameWrap)
    document.body.appendChild(modal)
  })
  list.appendChild(passwall)
  // end of upload menu

  inner.appendChild(list)
  menu.appendChild(inner)

  if (isMobile) {
    // Build modal wrapper like referense/popoutmobile.html
    const modalContainer = document.createElement('div')
    modalContainer.className = 'modal-container'

    const modal = document.createElement('div')
    modal.className =
      'modal d-modal fk-d-menu-modal toolbar-menu__options-content toolbar-popup-menu-options'
    modal.setAttribute('data-keyboard', 'false')
    modal.setAttribute('aria-modal', 'true')
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('data-identifier', 'toolbar-menu__options')
    modal.setAttribute('data-content', '')

    const modalContainerInner = document.createElement('div')
    modalContainerInner.className = 'd-modal__container'

    const modalBody = document.createElement('div')
    modalBody.className = 'd-modal__body'
    modalBody.tabIndex = -1

    const grip = document.createElement('div')
    grip.className = 'fk-d-menu-modal__grip'
    grip.setAttribute('aria-hidden', 'true')

    // move our existing menu (which contains inner -> ul.dropdown-menu) into modalBody
    modalBody.appendChild(grip)
    // the 'inner' contains the ul, append it
    modalBody.appendChild(inner.querySelector('.dropdown-menu') as Node)

    modalContainerInner.appendChild(modalBody)
    modal.appendChild(modalContainerInner)

    const backdrop = document.createElement('div')
    backdrop.className = 'd-modal__backdrop'
    backdrop.addEventListener('click', () => {
      // remove modal container when backdrop clicked
      if (modalContainer.parentElement) modalContainer.parentElement.removeChild(modalContainer)
    })

    modalContainer.appendChild(modal)
    modalContainer.appendChild(backdrop)

    return modalContainer
  }

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
    // Show menu with upload options and mount it into #d-menu-portals or mobile modal container
    const forceMobile = (cachedState.settings as any)?.forceMobileMode || false
    const isMobile = forceMobile || toolbar.classList.contains('chat-composer__inner-container')
    const menu = createUploadMenu(isMobile)

    if (isMobile) {
      // Try to find existing modal container on the page and reuse it
      const modalPortal = document.querySelector('.modal-container') as HTMLElement | null
      if (!modalPortal) {
        // If no modal container exists, append to body
        document.body.appendChild(menu)
      } else {
        modalPortal.appendChild(menu)
      }
    } else {
      // Ensure portal container exists
      let portal = document.querySelector('#d-menu-portals') as HTMLElement | null
      if (!portal) {
        portal = document.createElement('div')
        portal.id = 'd-menu-portals'
        document.body.appendChild(portal)
      }

      // Append hidden first to measure size
      portal.appendChild(menu)

      // Position menu near button for non-mobile mode using fixed positioning
      const rect = uploadButton.getBoundingClientRect()
      menu.style.position = 'fixed'
      menu.style.visibility = 'hidden'
      menu.style.zIndex = '10000'
      menu.style.maxWidth = '400px'

      // Force a reflow to ensure sizes are available
      const menuRect = menu.getBoundingClientRect()

      // Calculate centered left and preferred top (above button)
      let top = rect.top - menuRect.height - 5
      let left = rect.left + rect.width / 2 - menuRect.width / 2
      let placement = 'top'

      // If there's not enough space above, place below
      if (top < 0) {
        top = rect.bottom + 5
        placement = 'bottom'
      }

      // Clamp left to viewport
      left = Math.max(8, Math.min(left, window.innerWidth - menuRect.width - 8))

      menu.style.top = `${top}px`
      menu.style.left = `${left}px`
      menu.style.visibility = 'visible'
      menu.setAttribute('data-strategy', 'absolute')
      menu.setAttribute('data-placement', placement)
    }

    // Remove/unmount menu when clicking outside
    const removeMenu = (e: Event) => {
      // If mobile, menu is modal-container; if click outside modal content, remove modal container
      if (isMobile) {
        const modalContainer =
          menu.classList && (menu as HTMLElement).classList.contains('modal-container')
            ? (menu as HTMLElement)
            : (document.querySelector('.modal-container') as HTMLElement | null)

        if (modalContainer && !modalContainer.contains(e.target as Node)) {
          if (modalContainer.parentElement) modalContainer.parentElement.removeChild(modalContainer)
          document.removeEventListener('click', removeMenu)
        }
      } else {
        if (!menu.contains(e.target as Node)) {
          if (menu.parentElement) menu.parentElement.removeChild(menu)
          document.removeEventListener('click', removeMenu)
        }
      }
    }

    setTimeout(() => {
      document.addEventListener('click', removeMenu)
    }, 100)
  })

  // Create quick-insert button
  const quickInsertButton = document.createElement('button')
  quickInsertButton.classList.add(
    'btn',
    'no-text',
    'btn-icon',
    'toolbar__button',
    'quick-insert-button'
  )
  if (isChatComposer) {
    quickInsertButton.classList.add('fk-d-menu__trigger', 'chat-composer-button', 'btn-transparent')
    quickInsertButton.setAttribute('aria-expanded', 'false')
    quickInsertButton.setAttribute('data-trigger', '')
  }
  quickInsertButton.title = '快捷输入'
  quickInsertButton.type = 'button'
  quickInsertButton.innerHTML = `⎘`

  quickInsertButton.addEventListener('click', event => {
    event.stopPropagation()
    // toggle menu
    const forceMobile = (cachedState.settings as any)?.forceMobileMode || false
    const isMobile = forceMobile || toolbar.classList.contains('chat-composer__inner-container')
    const menu = createQuickInsertMenu()

    if (isMobile) {
      const modalPortal = document.querySelector('.modal-container') as HTMLElement | null
      if (!modalPortal) {
        document.body.appendChild(menu)
      } else {
        modalPortal.appendChild(menu)
      }
    } else {
      let portal = document.querySelector('#d-menu-portals') as HTMLElement | null
      if (!portal) {
        portal = document.createElement('div')
        portal.id = 'd-menu-portals'
        document.body.appendChild(portal)
      }
      portal.appendChild(menu)
      const rect = quickInsertButton.getBoundingClientRect()
      menu.style.position = 'fixed'
      menu.style.zIndex = '10000'
      menu.style.top = `${rect.bottom + 5}px`
      menu.style.left = `${Math.max(8, Math.min(rect.left + rect.width / 2 - 150, window.innerWidth - 300))}px`
    }

    const removeMenu = (e: Event) => {
      if (!menu.contains(e.target as Node)) {
        if (menu.parentElement) menu.parentElement.removeChild(menu)
        document.removeEventListener('click', removeMenu)
      }
    }
    setTimeout(() => document.addEventListener('click', removeMenu), 100)
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
        toolbar.insertBefore(quickInsertButton, emojiPickerBtn)
        toolbar.insertBefore(emojiButton, emojiPickerBtn)
      } else {
        toolbar.appendChild(uploadButton)
        toolbar.appendChild(quickInsertButton)
        toolbar.appendChild(emojiButton)
      }
    } else {
      // For standard toolbar, append at the end
      toolbar.appendChild(uploadButton)
      toolbar.appendChild(quickInsertButton)
      toolbar.appendChild(emojiButton)
    }
  } catch (e) {
    console.error('[Emoji Extension] Failed to inject buttons (module):', e)
  }
}
