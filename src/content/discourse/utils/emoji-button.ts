import type { AddEmojiButtonData } from '../types/main'

declare const chrome: typeof globalThis.chrome

export function setupButtonClickHandler(button: HTMLElement, data: AddEmojiButtonData) {
  button.addEventListener('click', async e => {
    e.preventDefault()
    e.stopPropagation()
    const originalContent = button.textContent
    const originalStyle = button.style.cssText
    const originalLabel = button.getAttribute('aria-label')
    const originalTitle = button.getAttribute('title')
    const setStatus = (icon: string, label: string, background: string) => {
      button.textContent = icon
      button.setAttribute('aria-label', label)
      button.setAttribute('title', label)
      button.style.background = background
    }
    try {
      await chrome.runtime.sendMessage({
        type: 'ADD_EMOJI_FROM_WEB',
        payload: {
          emojiData: { ...data, sourceDomain: window.location.hostname }
        }
      })
      setStatus('✓', '已添加', 'var(--success, #10b981)')
      setTimeout(() => {
        button.textContent = originalContent || ''
        button.style.cssText = originalStyle
        if (originalLabel === null) button.removeAttribute('aria-label')
        else button.setAttribute('aria-label', originalLabel)
        if (originalTitle === null) button.removeAttribute('title')
        else button.setAttribute('title', originalTitle)
      }, 2000)
    } catch (error) {
      console.error('[DiscourseOneClick] 添加表情失败：', error)
      setStatus('!', '添加失败', 'var(--danger, #ef4444)')
      setTimeout(() => {
        button.textContent = originalContent || ''
        button.style.cssText = originalStyle
        if (originalLabel === null) button.removeAttribute('aria-label')
        else button.setAttribute('aria-label', originalLabel)
        if (originalTitle === null) button.removeAttribute('title')
        else button.setAttribute('title', originalTitle)
      }, 2000)
    }
  })
}
