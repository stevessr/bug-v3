import type { AddEmojiButtonData } from '../types/main'

declare const chrome: typeof globalThis.chrome

export function setupButtonClickHandler(button: HTMLElement, data: AddEmojiButtonData) {
  button.addEventListener('click', async e => {
    e.preventDefault()
    e.stopPropagation()
    const originalContent = button.textContent
    const originalStyle = button.style.cssText
    try {
      await chrome.runtime.sendMessage({
        action: 'addEmojiFromWeb',
        emojiData: { ...data, sourceDomain: window.location.hostname }
      })
      button.textContent = '已添加'
      button.style.background = 'linear-gradient(135deg, #10b981, #059669)'
      setTimeout(() => {
        button.textContent = originalContent || ''
        button.style.cssText = originalStyle
      }, 2000)
    } catch (error) {
      console.error('[DiscourseOneClick] 添加表情失败：', error)
      button.textContent = '失败'
      button.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)'
      setTimeout(() => {
        button.textContent = originalContent || ''
        button.style.cssText = originalStyle
      }, 2000)
    }
  })
}
