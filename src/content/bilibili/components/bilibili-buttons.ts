/**
 * Bilibili按钮组件创建和处理
 */

import type { AddEmojiButtonData } from '../utils/bilibili-utils'
import { extractImageUrlFromPicture, extractNameFromUrl } from '../utils/bilibili-utils'
// Import utility functions dynamically to avoid circular dependencies

declare const chrome: any

/**
 * 设置按钮点击处理器
 */
export function setupButtonClickHandler(button: HTMLElement, data: AddEmojiButtonData) {
  button.addEventListener('click', async e => {
    e.preventDefault()
    e.stopPropagation()
    const originalContent = button.innerHTML
    const originalStyle = button.style.cssText
    try {
      await chrome.runtime.sendMessage({ action: 'addEmojiFromWeb', emojiData: data })
      button.innerHTML = '已添加'
      button.style.background = 'linear-gradient(135deg, #10b981, #059669)'
      setTimeout(() => {
        button.innerHTML = originalContent
        button.style.cssText = originalStyle
      }, 1500)
    } catch (error) {
      console.error('[哔哩哔哩] 添加表情失败:', error)
      button.innerHTML = '失败'
      button.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)'
      setTimeout(() => {
        button.innerHTML = originalContent
        button.style.cssText = originalStyle
      }, 1500)
    }
  })
}

/**
 * 创建浮动按钮
 */
export function createFloatingButton(data: AddEmojiButtonData): HTMLElement {
  const btn = document.createElement('button')
  btn.className = 'bili-emoji-add-btn'
  btn.type = 'button'
  btn.title = '添加到未分组表情'
  btn.innerHTML = '➕'
  // minimal inline styles to ensure visibility; page CSS may override but keep simple
  btn.style.cssText = `position:absolute;right:6px;top:6px;z-index:9999;cursor:pointer;border-radius:6px;padding:6px 8px;background:rgba(0,0,0,0.6);color:#fff;border:none;font-weight:700;`
  setupButtonClickHandler(btn, data)
  return btn
}

/**
 * 创建控制按钮 - 修复样式一致性问题
 */
export function createControlButton(data: AddEmojiButtonData): HTMLElement {
  const btn = document.createElement('div')
  btn.className = 'bili-album__watch__control__option add-emoji'
  btn.title = '添加到未分组表情'

  // 移除过多的内联样式，让 Bilibili 的原生 CSS 类处理样式
  // 只保留必要的样式以确保功能正常
  btn.style.cssText = 'cursor: pointer;'

  // Create the emoji icon (14x14px smiley face SVG)
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  icon.setAttribute('width', '14')
  icon.setAttribute('height', '14')
  icon.setAttribute('viewBox', '0 0 14 14')
  icon.setAttribute('fill', 'currentColor')
  icon.innerHTML = `
    <path d="M7 0C3.134 0 0 3.134 0 7s3.134 7 7 7 7-3.134 7-7-3.134-7-7-7zM5.5 4.5c.552 0 1 .448 1 1s-.448 1-1 1-1-.448-1-1 .448-1 1-1zm3 0c.552 0 1 .448 1 1s-.448 1-1 1-1-.448-1-1 .448-1 1-1zM7 11c-1.657 0-3-1.343-3-3h6c0 1.657-1.343 3-3 3z"/>
  `

  // Create the text label
  const text = document.createElement('span')
  text.textContent = '添加表情'

  btn.appendChild(icon)
  btn.appendChild(text)

  // 移除自定义悬停效果，让 Bilibili 的原生样式处理
  // 这样可以确保与其他控制按钮的行为一致

  setupButtonClickHandler(btn, data)
  return btn
}

/**
 * 创建PhotoSwipe样式的按钮（用于顶部栏）
 */
export function createPhotoSwipeButton(data: AddEmojiButtonData): HTMLElement {
  const btn = document.createElement('button')
  btn.className = 'pswp__button bili-emoji-add-btn'
  btn.type = 'button'
  btn.title = '添加到未分组表情'

  // PhotoSwipe button styling to match existing buttons
  btn.style.cssText = `
    position: relative;
    display: block;
    width: 44px;
    height: 44px;
    background: none;
    border: none;
    cursor: pointer;
    overflow: visible;
    appearance: none;
    box-shadow: none;
    opacity: 0.75;
    transition: opacity 0.2s;
    color: #fff;
    font-size: 18px;
    line-height: 44px;
    text-align: center;
  `

  // Add emoji icon
  btn.innerHTML = '➕'

  // Hover effect
  btn.addEventListener('mouseenter', () => {
    btn.style.opacity = '1'
  })
  btn.addEventListener('mouseleave', () => {
    btn.style.opacity = '0.75'
  })

  setupButtonClickHandler(btn, data)
  return btn
}

/**
 * 创建批量解析按钮
 */
export function createBatchParseButton(container: Element): HTMLElement {
  const btn = document.createElement('button')
  btn.className = 'bili-emoji-batch-parse'
  btn.type = 'button'
  btn.title = '解析并添加所有图片到未分组表情'
  btn.innerHTML = '一键解析并添加所有图片'
  btn.style.cssText =
    'display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border-radius:8px;padding:8px 12px;margin:8px 0;font-weight:600;'

  btn.addEventListener('click', async e => {
    e.preventDefault()
    e.stopPropagation()
    const original = btn.innerHTML
    btn.innerHTML = '正在解析...'
    btn.disabled = true
    try {
      const pics: Element[] = []
      container
        .querySelectorAll('.bili-album__preview__picture__img, .bili-album__preview__picture')
        .forEach(p => pics.push(p))
      let success = 0
      for (const p of pics) {
        const url = extractImageUrlFromPicture(p)
        if (!url) continue
        const name = extractNameFromUrl(url)
        try {
          await chrome.runtime.sendMessage({
            action: 'addEmojiFromWeb',
            emojiData: { name, url }
          })
          success++
        } catch (err) {
          console.error('[哔哩哔哩] 批量添加失败', url, err)
        }
      }
      btn.innerHTML = `已处理 ${success}/${pics.length} 张图片`
      setTimeout(() => {
        btn.innerHTML = original
        btn.disabled = false
      }, 2000)
    } catch (err) {
      console.error('[哔哩哔哩] 批量解析失败', err)
      btn.innerHTML = '解析失败'
      setTimeout(() => {
        btn.innerHTML = original
        btn.disabled = false
      }, 2000)
    }
  })

  return btn
}
