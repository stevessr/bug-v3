import { cachedState } from '../data/state'

import { createE, DQS } from './dom'

import { ICONS } from '@/content/data/callout'

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

  const selectors = [
    '.d-editor-textarea-wrapper textarea',
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
  const forceMobileMode = cachedState.settings.forceMobileMode || false

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
      if (menu.parentElement) menu.parentElement.removeChild(menu)
      insertIntoEditor(`>[!${item}]+\n`)
    })

    const emojiSpan = createE('span', { text: ICONS[item]?.icon || '✳️' })
    emojiSpan.style.marginRight = '6px'
    const labelWrap = createE('span', { class: 'd-button-label' })
    const labelText = createE('span', { class: 'd-button-label__text', text: displayLabel })
    if (ICONS[item]?.color) {
      btn.style.cssText += 'background:' + ICONS[item]?.color
    }

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
    modalBody.appendChild(inner.querySelector('.dropdown-menu') as Node)

    modalContainerInner.appendChild(modalBody)
    modal.appendChild(modalContainerInner)

    return modal
  }

  return menu
}
