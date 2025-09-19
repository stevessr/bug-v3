// Toolbar injection and button management module
import { createEl } from '../utils/createEl'
import { getPlatformToolbarSelectors } from '../utils/platformDetection'

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

// Find toolbars where we can inject buttons using platform-specific selectors
export function findAllToolbars(): HTMLElement[] {
  const toolbars: HTMLElement[] = []
  const selectors = getPlatformToolbarSelectors()

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector)
    toolbars.push(...(Array.from(elements) as HTMLElement[]))
  }
  return toolbars
}

// Current picker management
let currentPicker: HTMLElement | null = null

export function closeCurrentPicker() {
  if (currentPicker) {
    currentPicker.remove()
    currentPicker = null
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

  // Create auto-read button (userscript variant)
  const autoReadButton = createEl('button', {
    className: 'btn no-text btn-icon toolbar__button emoji-extension-auto-read',
    title: '像插件一样自动阅读话题 (Auto-read topics)',
    type: 'button',
    innerHTML: '📖'
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

  // Auto-read button click handler (userscript-specific)
  autoReadButton.addEventListener('click', async e => {
    e.stopPropagation()
    try {
      // Prefer userscript wrapper then page-level binding
      // @ts-ignore
      const caller = (window as any).callAutoReadRepliesV2 || (window as any).autoReadAllRepliesV2
      if (caller && typeof caller === 'function') {
        await caller()
        console.log('[Userscript] autoRead triggered via toolbar button')
      } else {
        console.warn('[Userscript] autoRead function not available on this page')
      }
    } catch (err) {
      console.error('[Userscript] autoRead failed', err)
    }
  })

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

  // Insert auto-read button next to popular button
  if (isChatComposer) {
    // keep consistent ordering for chat composer
    popularButton.after(autoReadButton)
  } else {
    // for regular toolbars, append autoReadButton near the emoji button
    button.after(autoReadButton)
  }

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
  }, 30000)
}
