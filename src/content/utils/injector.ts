import { createEmojiPicker } from '../discourse/utils/picker'
import { cachedState } from '../data/state'

import { autoReadAll, autoReadAllv2 } from './autoReadReplies'
import { notify } from './notify'
import { createE, DQSA, DQS, DOA, DAEL } from './createEl'
import { showImageUploadDialog } from './uploader'
import { createAndShowIframeModal, createAndShowSideIframeModal } from './iframe'
import { animateEnter, animateExit, ANIMATION_DURATION } from './animation'

import { ICONS } from '@/content/data/callout'

// Different toolbar selectors for different contexts
const TOOLBAR_SELECTORS = [
  '.d-editor-button-bar', // Standard editor toolbar (no [role] constraint for mobile compatibility)
  '.chat-composer__inner-container' // Chat composer
]

export function findToolbar(): Element | null {
  for (const selector of TOOLBAR_SELECTORS) {
    const toolbar = DQS(selector)
    if (toolbar) {
      return toolbar
    }
  }
  return null
}

export function findAllToolbars(): Element[] {
  const toolbars: Element[] = []
  for (const selector of TOOLBAR_SELECTORS) {
    const elements = DQSA(selector)
    toolbars.push(...Array.from(elements))
  }
  return toolbars
}

let currentPicker: HTMLElement | null = null
// 使用 AbortController 来管理事件监听器，解决泄漏问题
let clickOutsideController: AbortController | null = null
// 防止动画期间重复点击的锁
let isAnimating = false

function cleanupClickOutsideListener() {
  if (clickOutsideController) {
    clickOutsideController.abort()
    clickOutsideController = null
  }
}

function createClickOutsideHandler(button: HTMLElement) {
  return (e: Event) => {
    if (currentPicker && !currentPicker.contains(e.target as Node) && e.target !== button) {
      closeDesktopPicker()
    }
  }
}

function closeDesktopPicker(onComplete?: () => void) {
  if (!currentPicker || isAnimating) return

  isAnimating = true
  const pickerToClose = currentPicker
  // 立即重置状态，防止竞争条件
  currentPicker = null
  cleanupClickOutsideListener()

  // 调用 picker 的 cleanup 方法清理悬浮预览等资源
  if (typeof (pickerToClose as any).__cleanup === 'function') {
    ;(pickerToClose as any).__cleanup()
  }

  animateExit(pickerToClose, 'picker', () => {
    isAnimating = false
    onComplete?.()
  })
}

function closeMobilePicker(onComplete?: () => void) {
  if (!currentPicker || isAnimating) return

  isAnimating = true
  const pickerToClose = currentPicker
  // 立即重置状态，防止竞争条件
  currentPicker = null

  const modalContainer = DQS('.modal-container')
  if (modalContainer) {
    const backdrop = modalContainer.querySelector('.d-modal__backdrop') as HTMLElement | null
    if (backdrop) {
      animateExit(backdrop, 'backdrop')
    }
  }

  animateExit(pickerToClose, 'modal', () => {
    isAnimating = false
    onComplete?.()
  })
}

async function injectDesktopPicker(button: HTMLElement) {
  // 防止动画期间重复创建
  if (isAnimating) return

  currentPicker = await createEmojiPicker(false)
  const buttonRect = button.getBoundingClientRect()
  const pickerElement = currentPicker
  if (pickerElement) DOA(pickerElement)

  // Use adaptive positioning to keep picker inside viewport
  pickerElement.style.position = 'fixed'
  const margin = 8
  const vpWidth = window.innerWidth
  const vpHeight = window.innerHeight

  // Temporarily place below button to measure
  pickerElement.style.top = buttonRect.bottom + margin + 'px'
  pickerElement.style.left = buttonRect.left + 'px'

  // Measure after appended
  const pickerRect = pickerElement.getBoundingClientRect()
  const spaceBelow = vpHeight - buttonRect.bottom
  const neededHeight = pickerRect.height + margin
  let top = buttonRect.bottom + margin

  if (spaceBelow < neededHeight) {
    // Not enough space below, place above the button
    top = Math.max(margin, buttonRect.top - pickerRect.height - margin)
  }

  // Keep left within viewport
  let left = buttonRect.left
  if (left + pickerRect.width + margin > vpWidth) {
    left = Math.max(margin, vpWidth - pickerRect.width - margin)
  }
  if (left < margin) left = margin

  pickerElement.style.top = top + 'px'
  pickerElement.style.left = left + 'px'

  // Trigger enter animation
  animateEnter(pickerElement, 'picker')

  // 使用 AbortController 管理事件监听器
  cleanupClickOutsideListener()
  clickOutsideController = new AbortController()
  const handler = createClickOutsideHandler(button)

  setTimeout(() => {
    document.addEventListener('click', handler, { signal: clickOutsideController?.signal })
  }, 100)
}

async function injectMobilePicker() {
  // 防止动画期间重复创建
  if (isAnimating) return

  // picker is created with animation already set up in mobile.ts
  const picker = await createEmojiPicker(true)

  let modalContainer = DQS('.modal-container')
  if (!modalContainer) {
    modalContainer = createE('div', { class: 'modal-container' })
    DOA(modalContainer)
  }

  modalContainer.innerHTML = '' // Clear any previous content

  // Create backdrop with initial animation class
  const backdrop = createE('div', { class: 'd-modal__backdrop emoji-backdrop-enter' })
  backdrop.addEventListener('click', () => {
    // 使用统一的关闭函数
    closeMobilePicker()
  })

  modalContainer.appendChild(picker)
  modalContainer.appendChild(backdrop)

  // Trigger backdrop animation
  requestAnimationFrame(() => {
    void (backdrop as HTMLElement).offsetHeight
    backdrop.classList.remove('emoji-backdrop-enter')
    backdrop.classList.add('emoji-backdrop-enter-active')
    setTimeout(() => {
      backdrop.classList.remove('emoji-backdrop-enter-active')
    }, ANIMATION_DURATION)
  })

  // Track the picker element itself so toggling will unmount only the picker
  currentPicker = picker as HTMLElement
}

// Quick inserts available globally (store as plain keys without [!])
export const QUICK_INSERTS: string[] = [
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
export function insertIntoEditor(text: string) {
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
    const el = DQS(sel) as HTMLTextAreaElement | HTMLInputElement | HTMLElement | null
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

export function createQuickInsertMenu(): HTMLElement {
  const forceMobileMode = (cachedState.settings as any)?.forceMobileMode || false

  const menu = createE('div', {
    class: 'fk-d-menu toolbar-menu__options-content toolbar-popup-menu-options -animated -expanded',
    style: 'z-index:1300;'
  })
  const inner = createE('div', { class: 'fk-d-menu__inner-content' })
  const list = createE('ul', { class: 'dropdown-menu' })

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

  const autoReadLi = createListItem('自动阅读所有回复', '📖', async () => {
    menu.remove()
    try {
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

  const challengeLi = createListItem('过盾', '🛡️', () => {
    menu.remove()
    createAndShowIframeModal(
      'https://linux.do/challenge',
      href => {
        try {
          const u = new URL(href)
          return u.hostname === 'linux.do' && u.pathname === '/'
        } catch {
          return false
        }
      },
      {
        title: 'Cloudflare Challenge',
        className: 'cf-challenge-modal',
        style:
          'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:400px;height:300px;border-radius:8px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.3);z-index:100000;background:white;'
      }
    )
  })
  list.appendChild(challengeLi)

  const makeitem = (text: string, icon: string, url: string) =>
    createListItem(text, icon, () => {
      menu.remove()
      try {
        window.open(url, '_blank')
      } catch {
        window.location.href = url
      }
    })

  const autoList = (text: string, icon: string, url: string) =>
    list.appendChild(makeitem(text, icon, url))

  // Merge backend-provided uploadMenuItems with centralized defaults so
  // a single source of truth controls default items. If backend does not
  const backendUploadConfig = (cachedState.settings as any)?.uploadMenuItems || {}
  const merged = {
    autoItems: Array.isArray(backendUploadConfig.autoItems) ? backendUploadConfig.autoItems : null,
    iframes: Array.isArray(backendUploadConfig.iframes) ? backendUploadConfig.iframes : null,
    sides: Array.isArray(backendUploadConfig.sides) ? backendUploadConfig.sides : null
  }

  merged.autoItems.forEach(([text, icon, url]: any) => autoList(text, icon, url))

  const createiframe = (text: string, icon: string, url: string, className: string) =>
    createListItem(text, icon, () => {
      const existing = DQS(`.${className}`) as HTMLElement | null
      if (existing) return
      createAndShowIframeModal(
        url,
        href => {
          try {
            const url = new URL(href)
            return url.hostname.endsWith('linux.do')
          } catch {
            return false
          }
        },
        {
          title: text,
          className: className,
          style:
            'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:80%;max-width:900px;height:80%;max-height:700px;border-radius:8px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.3);z-index:100000;cursor:move'
        }
      )
    })

  const createside = (text: string, icon: string, url: string, className: string) =>
    createListItem(text, icon, () => {
      // If a modal iframe already exists, don't create another
      const existing = DQS(`.${className}`) as HTMLElement | null
      if (existing) return
      createAndShowSideIframeModal(
        url,
        _herf => {
          return false
        },
        {
          title: text,
          className: className,
          icon: icon
        }
      )
    })

  // Append side items first (keeps previous order)
  merged.sides.forEach(([text, icon, url, className]: any) =>
    list.appendChild(createside(text, icon, url, className as string))
  )

  // Then append iframe modal items
  merged.iframes.forEach(([text, icon, url, className]: any) =>
    list.appendChild(createiframe(text, icon, url, className as string))
  )

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

export function injectButton(toolbar: Element, skipIfSubmenuInjectorEnabled: boolean = false) {
  // 如果启用了子菜单注入，则跳过工具栏按钮注入
  if (skipIfSubmenuInjectorEnabled) {
    return
  }

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

    // 防止动画期间重复点击
    if (isAnimating) return

    if (currentPicker) {
      // Determine if mobile modal or desktop picker based on class
      const isMobileModal = currentPicker.classList.contains('d-modal')
      if (isMobileModal) {
        closeMobilePicker()
      } else {
        closeDesktopPicker()
      }
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
      const modalPortal = DQS('.modal-container') as HTMLElement | null
      if (!modalPortal) {
        // If no modal container exists, append to body
        DOA(menu)
      } else {
        modalPortal.appendChild(menu)
      }
    } else {
      // Ensure portal container exists
      let portal = DQS('#d-menu-portals') as HTMLElement | null
      if (!portal) {
        portal = createE('div', { id: 'd-menu-portals' }) as HTMLDivElement
        DOA(portal)
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
            : (DQS('.modal-container') as HTMLElement | null)

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
      DAEL('click', removeMenu)
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
      let modalPortal = DQS('.modal-container') as HTMLElement | null
      if (!modalPortal) {
        modalPortal = createE('div', { class: 'modal-container' }) as HTMLElement
        DOA(modalPortal)
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
      let portal = DQS('#d-menu-portals') as HTMLElement | null
      if (!portal) {
        portal = createE('div', { id: 'd-menu-portals' }) as HTMLDivElement
        DOA(portal)
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
            : (DQS('.modal-container') as HTMLElement | null)

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
      DAEL('click', removeMenu)
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
