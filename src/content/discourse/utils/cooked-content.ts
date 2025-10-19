import type { AddEmojiButtonData } from '../types/main'
import { createE } from '../../utils/createEl'

import { extractNameFromUrl } from './picture'

declare const chrome: any

function isCookedContent(element: Element): boolean {
  return element.classList.contains('cooked') && element.querySelector('.lightbox-wrapper') !== null
}

function extractEmojiDataFromLightbox(lightboxWrapper: Element): AddEmojiButtonData[] {
  const results: AddEmojiButtonData[] = []
  const anchor = lightboxWrapper.querySelector('a.lightbox') as HTMLAnchorElement | null
  const img = lightboxWrapper.querySelector('img') as HTMLImageElement | null
  if (!anchor || !img) return results
  const title = anchor.getAttribute('title') || ''
  const originalUrl = anchor.getAttribute('href') || ''
  const downloadUrl = anchor.getAttribute('data-download-href') || ''
  const imgSrc = img.getAttribute('src') || ''
  let name = title || img.getAttribute('alt') || ''
  if (!name || name.length < 2) name = extractNameFromUrl(originalUrl || downloadUrl || imgSrc)
  name = name.replace(/\.(webp|jpg|jpeg|png|gif)$/i, '').trim() || '表情'
  const urlToUse = originalUrl || downloadUrl || imgSrc
  if (urlToUse && urlToUse.startsWith('http')) results.push({ name, url: urlToUse })
  return results
}

function createBatchParseButton(cookedElement: Element): HTMLElement {
  const button = createE('button', {
    class: 'emoji-batch-parse-button',
    style: `
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: linear-gradient(135deg,#f59e0b,#d97706);
    color: #fff;
    border-radius: 8px;
    padding: 8px 12px;
    margin: 10px 0;
    font-weight: 600;
    `,
    in: '一键解析并添加所有图片',
    ti: '解析当前内容中的所有图片并添加到未分组表情',
    on: {
      click: async (e: Event) => {
        e.preventDefault()
        e.stopPropagation()
        const originalContent = button.innerHTML
        const originalStyle = button.style.cssText
        try {
          button.innerHTML = '正在解析...'
          button.style.background = 'linear-gradient(135deg,#6b7280,#4b5563)'
          button.disabled = true
          const lightboxWrappers = cookedElement.querySelectorAll('.lightbox-wrapper')
          const allEmojiData: AddEmojiButtonData[] = []
          lightboxWrappers.forEach(wrapper => {
            const items = extractEmojiDataFromLightbox(wrapper)
            allEmojiData.push(...items)
          })
          if (allEmojiData.length === 0) throw new Error('未找到可解析的图片')
          let successCount = 0
          for (const emojiData of allEmojiData) {
            try {
              await chrome.runtime.sendMessage({
                action: 'addEmojiFromWeb',
                emojiData: { ...emojiData, sourceDomain: window.location.hostname }
              })
              successCount++
            } catch (e) {
              console.error('[DiscourseOneClick] 添加图片失败', emojiData.name, e)
            }
          }
          button.innerHTML = `已处理 ${successCount}/${allEmojiData.length} 张图片`
          button.style.background = 'linear-gradient(135deg,#10b981,#059669)'
          setTimeout(() => {
            button.innerHTML = originalContent
            button.style.cssText = originalStyle
            button.disabled = false
          }, 3000)
        } catch (error) {
          console.error('[DiscourseOneClick] 批量解析失败：', error)
          button.innerHTML = '解析失败'
          button.style.background = 'linear-gradient(135deg,#ef4444,#dc2626)'
          setTimeout(() => {
            button.innerHTML = originalContent
            button.style.cssText = originalStyle
            button.disabled = false
          }, 3000)
        }
      }
    }
  })
  return button
}

function addBatchParseButtonToCooked(cookedElement: Element) {
  if (cookedElement.querySelector('.emoji-batch-parse-button')) return
  const lightboxWrappers = cookedElement.querySelectorAll('.lightbox-wrapper')
  if (lightboxWrappers.length === 0) return
  const button = createBatchParseButton(cookedElement)
  const firstChild = cookedElement.firstChild
  if (firstChild) cookedElement.insertBefore(button, firstChild)
  else cookedElement.appendChild(button)
}

export function scanForCookedContent() {
  const cookedElements = document.querySelectorAll('.cooked')
  cookedElements.forEach(el => {
    if (isCookedContent(el)) addBatchParseButtonToCooked(el)
  })
}

export function observeCookedContent() {
  const observer = new MutationObserver(mutations => {
    let shouldScan = false
    mutations.forEach(m => {
      if (m.type === 'childList') {
        m.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element
            if (element.classList && element.classList.contains('cooked')) shouldScan = true
            else if (element.querySelector && element.querySelector('.cooked')) shouldScan = true
          }
        })
      }
    })
    if (shouldScan) setTimeout(scanForCookedContent, 100)
  })
  observer.observe(document.body, { childList: true, subtree: true })
}
