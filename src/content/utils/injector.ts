import { createEmojiPicker } from '../discourse/utils/picker'
import { cachedState } from '../data/state'

import { autoReadAll, autoReadAllv2 } from './autoReadReplies'
import { notify } from './notify'
import { createE } from './createEl'
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
      // Preferred: centered above the button
      pickerElement.style.top = buttonRect.top - pickerRect.height - 5 + 'px'
      let left = buttonRect.left + buttonRect.width / 2 - pickerRect.width / 2

      // If the picker would overflow the left edge, prefer opening to the right of the button
      const VIEWPORT_MARGIN = 8
      if (left < VIEWPORT_MARGIN) {
        // Try positioning picker to the right of the button
        left = buttonRect.right + VIEWPORT_MARGIN
      }

      // Clamp to viewport to ensure visibility on both sides
      const maxLeft = Math.max(
        VIEWPORT_MARGIN,
        window.innerWidth - pickerRect.width - VIEWPORT_MARGIN
      )
      left = Math.min(Math.max(left, VIEWPORT_MARGIN), maxLeft)

      pickerElement.style.left = left + 'px'

      // If the picker would be off the top edge, place it below the button
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
    modalContainer = createE('div', { class: 'modal-container' })
    document.body.appendChild(modalContainer)
  }

  modalContainer.innerHTML = '' // Clear any previous content

  const backdrop = createE('div', { class: 'd-modal__backdrop' })
  backdrop.addEventListener('click', () => {
    // Only remove the picker and the backdrop, keep the surrounding `.modal-container`
    if (picker.parentElement) picker.parentElement.removeChild(picker)
    if (backdrop.parentElement) backdrop.parentElement.removeChild(backdrop)
    currentPicker = null
  })

  modalContainer.appendChild(picker)
  modalContainer.appendChild(backdrop)

  // Track the picker element itself so toggling will unmount only the picker
  currentPicker = picker as HTMLElement
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
      } catch {
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
      } catch {
        // ignore
      }
    }
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return
  }
}

function createQuickInsertMenu(): HTMLElement {
  const forceMobileMode = (cachedState.settings as any)?.forceMobileMode || false

  const menu = createE('div', {
    class: 'fk-d-menu toolbar-menu__options-content toolbar-popup-menu-options -animated -expanded',
    style: 'z-index:1300;'
  })
  const inner = createE('div', { class: 'fk-d-menu__inner-content' })
  const list = createE('ul', { class: 'dropdown-menu' })

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
    const displayLabel =
      item.length > 0 ? item.charAt(0).toUpperCase() + item.slice(1).toLowerCase() : item

    const li = createE('li', { class: 'dropdown-menu__item' })
    const btn = createE('button', {
      class: 'btn btn-icon-text',
      type: 'button',
      ti: displayLabel
    }) as HTMLButtonElement
    btn.addEventListener('click', () => {
      // remove menu and insert into editor
      if (menu.parentElement) menu.parentElement.removeChild(menu)
      // Insert wrapped form: [!key]
      insertIntoEditor(`>[!${item}]+\n`)
    })

    const emojiSpan = createE('span', { text: ICONS[item]?.icon || '✳️' })
    emojiSpan.style.marginRight = '6px'
    const labelWrap = createE('span', { class: 'd-button-label' })
    const labelText = createE('span', { class: 'd-button-label__text', text: displayLabel })
    if (ICONS[item]?.color) {
      btn.style.cssText += 'background:' + ICONS[item]?.color
    }

    // Append text node first, then add svg in a separate span so the svg appears
    // to the right of the text instead of being concatenated into the text node.
    labelWrap.appendChild(labelText)
    const svgHtml = ICONS[item]?.svg || ''
    if (svgHtml) {
      const svgSpan = createE('span', {
        class: 'd-button-label__svg',
        in: svgHtml,
        style: 'margin-left:6px;display:inline-flex;align-items:center'
      })
      labelWrap.appendChild(svgSpan)
    }
    btn.appendChild(emojiSpan)
    btn.appendChild(labelWrap)
    li.appendChild(btn)
    list.appendChild(li)
  })

  inner.appendChild(list)
  menu.appendChild(inner)

  if (forceMobileMode) {
    // Wrap the menu inside a modal-like structure so it displays centered
    const modal = createE('div', {
      class:
        'modal d-modal fk-d-menu-modal toolbar-menu__options-content toolbar-popup-menu-options',
      attrs: {
        'data-keyboard': 'false',
        'aria-modal': 'true',
        role: 'dialog'
      }
    })

    const modalContainerInner = createE('div', { class: 'd-modal__container' })
    const modalBody = createE('div', { class: 'd-modal__body' })
    ;(modalBody as HTMLElement).tabIndex = -1

    const grip = createE('div', { class: 'fk-d-menu-modal__grip' })
    grip.setAttribute('aria-hidden', 'true')

    modalBody.appendChild(grip)
    // move the dropdown into the modal body
    modalBody.appendChild(inner.querySelector('.dropdown-menu') as Node)

    modalContainerInner.appendChild(modalBody)
    modal.appendChild(modalContainerInner)

    return modal
  }

  return menu
}

function createUploadMenu(isMobile: boolean = false): HTMLElement {
  // Build a popout-style menu matching referense/popout.html structure
  // If isMobile is true, return a modal-style container compatible with mobile popout
  const menu = createE('div', {
    class: 'fk-d-menu toolbar-menu__options-content toolbar-popup-menu-options -animated -expanded',
    attrs: { 'data-identifier': 'toolbar-menu__options', role: 'dialog' }
  })

  const inner = createE('div', { class: 'fk-d-menu__inner-content' })

  const list = createE('ul', { class: 'dropdown-menu' })

  function createListItem(titleText: string, emoji: string, onClick: () => void) {
    const li = createE('li', { class: 'dropdown-menu__item' })

    const btn = createE('button', {
      class: 'btn btn-icon-text',
      type: 'button',
      ti: titleText
    }) as HTMLButtonElement
    btn.addEventListener('click', onClick)

    const emojiSpan = createE('span', { text: emoji })

    const labelWrap = createE('span', { class: 'd-button-label' })
    const labelText = createE('span', { class: 'd-button-label__text', text: titleText })

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
    } catch (error) {
      notify(
        '自动阅读失败：' +
          (error && (error as any).message ? (error as any).message : String(error)),
        'error'
      )
    }
  })
  list.appendChild(autoReadLi)
  const autoReadLi2 = createListItem('全自动自动阅读所有帖子', '📖', async () => {
    menu.remove()
    try {
      // trigger auto read; autoReadAll will notify progress
      await autoReadAllv2()
    } catch (error) {
      notify(
        '自动阅读失败：' +
          (error && (error as any).message ? (error as any).message : String(error)),
        'error'
      )
    }
  })
  list.appendChild(autoReadLi2)

  const generateLi = createListItem('AI 生成图片', '🎨', () => {
    menu.remove()
    try {
      window.open('https://gemini-image.smnet.studio/', '_blank')
    } catch {
      window.location.href = 'https://gemini-image.smnet.studio/'
    }
  })
  list.appendChild(generateLi)

  const learnxv6 = createListItem('学习 xv6', '🖥︎', () => {
    menu.remove()
    try {
      window.open('https://pwsh.edu.deal/', '_blank')
    } catch {
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

    // Build draggable floating window for iframe (no backdrop)
    const frameWrap = createE('div', {
      class: 'emoji-extension-passwall-iframe',
      style:
        'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:80%;max-width:900px;height:80%;max-height:700px;border-radius:8px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.3);z-index:100000;cursor:move'
    })

    // Create draggable title bar
    const titleBar = createE('div', {
      style:
        'position:absolute;top:0;left:0;width:100%;height:40px;border-bottom:1px solid #ccc;display:flex;align-items:center;justify-content:space-between;padding:0 10px;cursor:move;user-select:none'
    })

    const title = createE('span', {
      text: '过盾',
      style: 'font-weight:bold;color:#333'
    })

    const closeBtn = createE('button', {
      class: 'btn btn-sm',
      type: 'button',
      text: '✕',
      style:
        'background:transparent;border:none;font-size:20px;color:#666;cursor:pointer;padding:0;width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:4px'
    }) as HTMLButtonElement

    // Add hover effect to close button
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = '#ff4444'
      closeBtn.style.color = '#fff'
    })
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'transparent'
      closeBtn.style.color = '#666'
    })

    titleBar.appendChild(title)
    titleBar.appendChild(closeBtn)

    const iframeContainer = createE('div', {
      style: 'position:absolute;top:40px;left:0;width:100%;height:calc(100% - 40px);overflow:hidden'
    })

    const iframe = createE('iframe', {
      src: 'https://linux.do/challenge',
      style: 'width:100%;height:100%;border:0',
      attrs: { sandbox: 'allow-scripts allow-forms allow-same-origin allow-popups' }
    }) as HTMLIFrameElement

    // Close helper
    const closeModal = () => {
      if (frameWrap.parentElement) frameWrap.parentElement.removeChild(frameWrap)
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
      } catch {
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
        } catch {
          // ignore malformed URLs
        }
      }
    })

    // Dragging functionality
    let isDragging = false
    let currentX = 0
    let currentY = 0
    let initialX = 0
    let initialY = 0

    const dragStart = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return // Don't drag when clicking close button

      isDragging = true
      initialX = e.clientX - currentX
      initialY = e.clientY - currentY
      frameWrap.style.cursor = 'grabbing'
    }

    const drag = (e: MouseEvent) => {
      if (!isDragging) return

      e.preventDefault()
      currentX = e.clientX - initialX
      currentY = e.clientY - initialY

      frameWrap.style.transform = `translate(calc(-50% + ${currentX}px), calc(-50% + ${currentY}px))`
    }

    const dragEnd = () => {
      isDragging = false
      frameWrap.style.cursor = 'move'
    }

    titleBar.addEventListener('mousedown', dragStart)
    document.addEventListener('mousemove', drag)
    document.addEventListener('mouseup', dragEnd)

    // Cleanup event listeners when modal is closed
    const originalClose = closeModal
    const closeModalWithCleanup = () => {
      document.removeEventListener('mousemove', drag)
      document.removeEventListener('mouseup', dragEnd)
      originalClose()
    }
    closeBtn.removeEventListener('click', closeModal)
    closeBtn.addEventListener('click', closeModalWithCleanup)

    iframeContainer.appendChild(iframe)
    frameWrap.appendChild(titleBar)
    frameWrap.appendChild(iframeContainer)
    document.body.appendChild(frameWrap)
  })
  list.appendChild(passwall)
  // end of upload menu

  inner.appendChild(list)
  menu.appendChild(inner)

  if (isMobile) {
    // Build modal wrapper like referense/popoutmobile.html
    const modalContainer = createE('div', { class: 'modal-container' })

    const modal = createE('div', {
      class:
        'modal d-modal fk-d-menu-modal toolbar-menu__options-content toolbar-popup-menu-options',
      attrs: {
        'data-keyboard': 'false',
        'aria-modal': 'true',
        role: 'dialog',
        'data-identifier': 'toolbar-menu__options',
        'data-content': ''
      }
    })

    const modalContainerInner = createE('div', { class: 'd-modal__container' })

    const modalBody = createE('div', { class: 'd-modal__body' })
    modalBody.tabIndex = -1

    const grip = createE('div', { class: 'fk-d-menu-modal__grip' })
    grip.setAttribute('aria-hidden', 'true')

    // move our existing menu (which contains inner -> ul.dropdown-menu) into modalBody
    modalBody.appendChild(grip)
    // the 'inner' contains the ul, append it
    modalBody.appendChild(inner.querySelector('.dropdown-menu') as Node)

    modalContainerInner.appendChild(modalBody)
    modal.appendChild(modalContainerInner)

    const backdrop = createE('div', { class: 'd-modal__backdrop' })
    backdrop.addEventListener('click', () => {
      // Clear modal contents when backdrop clicked but keep the surrounding `.modal-container`
      modalContainer.innerHTML = ''
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
  const emojiButton = createE('button', {
    class: 'btn no-text btn-icon toolbar__button nacho-emoji-picker-button emoji-extension-button',
    ti: '表情包',
    type: 'button',
    in: '🐈‍⬛'
  }) as HTMLButtonElement

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
  const uploadButton = createE('button', {
    class: 'btn no-text btn-icon toolbar__button image-upload-button',
    ti: '上传图片',
    type: 'button',
    in: '📷'
  }) as HTMLButtonElement

  // Add chat-specific classes if needed
  if (isChatComposer) {
    uploadButton.classList.add('fk-d-menu__trigger', 'chat-composer-button', 'btn-transparent')
    uploadButton.setAttribute('aria-expanded', 'false')
    uploadButton.setAttribute('data-trigger', '')
  }

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
        portal = createE('div', { id: 'd-menu-portals' }) as HTMLDivElement
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
          // Clear children inside the modal container rather than removing the container element
          try {
            modalContainer.innerHTML = ''
          } catch {
            try {
              if (modalContainer.parentElement) {
                modalContainer.parentElement.removeChild(modalContainer)
              }
            } catch {
              // ignore
            }
          }
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
  const quickInsertButton = createE('button', {
    class: 'btn no-text btn-icon toolbar__button quick-insert-button',
    ti: '快捷输入',
    type: 'button',
    in: '⎘'
  }) as HTMLButtonElement
  if (isChatComposer) {
    quickInsertButton.classList.add('fk-d-menu__trigger', 'chat-composer-button', 'btn-transparent')
    quickInsertButton.setAttribute('aria-expanded', 'false')
    quickInsertButton.setAttribute('data-trigger', '')
  }

  quickInsertButton.addEventListener('click', event => {
    event.stopPropagation()
    // toggle menu
    const forceMobile = (cachedState.settings as any)?.forceMobileMode || false
    const isMobile = forceMobile || toolbar.classList.contains('chat-composer__inner-container')
    const menu = createQuickInsertMenu()

    if (isMobile) {
      // Inject into a shared modal container like the emoji picker does
      let modalPortal = document.querySelector('.modal-container') as HTMLElement | null
      if (!modalPortal) {
        modalPortal = createE('div', { class: 'modal-container' }) as HTMLElement
        document.body.appendChild(modalPortal)
      }

      // Clear any previous content and mount our menu + backdrop
      modalPortal.innerHTML = ''
      const backdrop = createE('div', { class: 'd-modal__backdrop' })
      backdrop.addEventListener('click', () => {
        // Clear modal contents but keep the container element
        if (modalPortal) modalPortal.innerHTML = ''
        currentPicker = null
      })
      modalPortal.appendChild(menu)
      modalPortal.appendChild(backdrop)

      // Track the menu element itself so toggling will unmount only the menu
      currentPicker = menu as HTMLElement
    } else {
      let portal = document.querySelector('#d-menu-portals') as HTMLElement | null
      if (!portal) {
        portal = createE('div', { id: 'd-menu-portals' }) as HTMLDivElement
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
      if (isMobile) {
        const modalContainer =
          menu.classList && (menu as HTMLElement).classList.contains('modal-container')
            ? (menu as HTMLElement)
            : (document.querySelector('.modal-container') as HTMLElement | null)

        if (modalContainer && !modalContainer.contains(e.target as Node)) {
          try {
            modalContainer.innerHTML = ''
          } catch {
            try {
              if (modalContainer.parentElement) {
                modalContainer.parentElement.removeChild(modalContainer)
              }
            } catch {
              // ignore
            }
          }
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
  } catch (error) {
    console.error('[Emoji Extension] Failed to inject buttons (module):', error)
  }
}
