import { logger } from '../utils/buildFLagsV2'

import type { AddEmojiButtonData } from './types'
import { performPixivAddEmojiFlow } from './helpers'

export function setupButtonClickHandler(button: HTMLElement, data: AddEmojiButtonData) {
  let running = false

  const handle = async (origEvent: Event) => {
    try {
      origEvent.preventDefault()
      origEvent.stopPropagation()
    } catch (_e) {
      void _e
    }
    if (running) return
    running = true

    const prevPointerEvents = button.style.pointerEvents
    button.style.pointerEvents = 'none'

    const originalContent = button.innerHTML
    const originalStyle = button.style.cssText

    button.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="animation: spin 1s linear infinite;">
        <style>
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        </style>
        <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>
      </svg>
      添加中...
    `
    button.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)'

    try {
      const resp = await performPixivAddEmojiFlow(data)

      if (resp && resp.success) {
        logger.log('[PixivAddEmoji] Successfully added emoji:', resp)

        button.innerHTML = `
          <svg class="fa d-icon d-icon-check svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 1em; height: 1em; fill: currentColor; margin-right: 4px;">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>已添加
        `
        button.style.background = 'linear-gradient(135deg, #10b981, #059669)'
        button.style.color = '#ffffff'
        button.style.border = '2px solid #ffffff'
        button.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.3)'

        if (resp.source === 'opened') {
          button.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/>
            </svg>已打开
          `
          button.style.background = 'linear-gradient(135deg, #3b82f6, #2563eb)'
        }
      } else {
        const errorMessage =
          typeof resp === 'object' && resp !== null
            ? (resp as any).error || (resp as any).message || '添加表情失败'
            : '添加表情失败'
        throw new Error(String(errorMessage))
      }

      setTimeout(() => {
        button.innerHTML = originalContent
        button.style.cssText = originalStyle
        button.style.pointerEvents = prevPointerEvents
        running = false
      }, 3000)
    } catch (error) {
      logger.error('[PixivAddEmoji] 添加表情失败:', error)

      button.innerHTML = `
        <svg class="fa d-icon d-icon-times svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 1em; height: 1em; fill: currentColor; margin-right: 4px;">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>失败
      `
      button.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)'
      button.style.color = '#ffffff'
      button.style.border = '2px solid #ffffff'
      button.style.boxShadow = '0 2px 4px rgba(239, 68, 68, 0.3)'

      setTimeout(() => {
        button.innerHTML = originalContent
        button.style.cssText = originalStyle
        button.style.pointerEvents = prevPointerEvents
        running = false
      }, 3000)
    }
  }

  button.addEventListener('pointerdown', handle)
  button.addEventListener('click', handle)
}

export function createPixivEmojiButton(data: AddEmojiButtonData): HTMLElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'emoji-add-link-pixiv'
  button.style.cssText = `
    position: absolute;
    left: 12px;
    top: 12px;
    z-index: 100000;
    color: #ffffff;
    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
    border: 2px solid rgba(255,255,255,0.95);
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    pointer-events: auto;
  `
  button.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
    添加表情
  `
  button.title = '添加表情到收藏'
  try {
    button.dataset.emojiName = data.name
    button.dataset.emojiUrl = data.url
  } catch (_e) {
    void _e
  }
  setupButtonClickHandler(button, data)
  return button
}
