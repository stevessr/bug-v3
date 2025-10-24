// Shared functions for inserting text into editors
import { createEl } from './createEl'

export function insertIntoEditor(text: string) {
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

// Common function for creating modal elements with consistent styling
export function createModalElement(options: {
  title?: string
  content?: string
  className?: string
  onClose?: () => void
}) {
  const modal = createEl('div', {
    style: `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
    `,
    className: options.className
  })

  const content = createEl('div', {
    style: `
      background: var(--secondary);
      color: var(--emoji-modal-text);
      border: 1px solid var(--emoji-modal-border);
      border-radius: 8px;
      padding: 24px;
      max-width: 90%;
      max-height: 90%;
      overflow-y: auto;
      position: relative;
    `
  })

  if (options.title) {
    const titleElement = createEl('div', {
      style: `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
      `,
      innerHTML: `
        <h2 style="margin: 0; color: var(--emoji-modal-text);">${options.title}</h2>
        <button id="closeModal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999;">×</button>
      `
    })

    content.appendChild(titleElement)
    
    const closeButton = content.querySelector('#closeModal') as HTMLButtonElement
    if (closeButton && options.onClose) {
      closeButton.addEventListener('click', options.onClose)
    }
  }

  if (options.content) {
    const contentDiv = createEl('div', {
      innerHTML: options.content
    })
    content.appendChild(contentDiv)
  }

  modal.appendChild(content)
  return modal
}