import type { AddEmojiButtonData } from '../types/main'
import { createE, DQSA } from '../../utils/createEl'

import { setupButtonClickHandler } from './emoji-button'
import { extractNameFromUrl } from './picture'

declare const chrome: any

// ========== 选择器 ==========
// 检查元素是否为包含图片的 cooked 内容
function isCookedContent(element: Element): boolean {
  return element.classList.contains('cooked') && element.querySelector('.lightbox-wrapper') !== null
}

// ========== 解析器 ==========
// 从 lightbox-wrapper 中提取表情数据
function extractEmojiDataFromLightbox(lightboxWrapper: Element): AddEmojiButtonData[] {
  const results: AddEmojiButtonData[] = []
  const anchor = lightboxWrapper.querySelector('a.lightbox') as HTMLAnchorElement | null
  const img = lightboxWrapper.querySelector('img') as HTMLImageElement | null
  if (!anchor || !img) return results

  // 提取图片信息
  const title = anchor.getAttribute('title') || ''
  const originalUrl = anchor.getAttribute('href') || ''
  const downloadUrl = anchor.getAttribute('data-download-href') || ''
  const imgSrc = img.getAttribute('src') || ''

  // 确定表情名称
  let name = title || img.getAttribute('alt') || ''
  if (!name || name.length < 2) name = extractNameFromUrl(originalUrl || downloadUrl || imgSrc)
  name = name.replace(/\.(webp|jpg|jpeg|png|gif)$/i, '').trim() || '表情'

  // 确定使用的 URL
  const urlToUse = originalUrl || downloadUrl || imgSrc
  if (urlToUse && urlToUse.startsWith('http')) results.push({ name, url: urlToUse })

  return results
}

// ========== 注入位置：单个表情按钮 ==========
// 为每个 lightbox-wrapper 添加单独的表情按钮
function createSingleEmojiButton(data: AddEmojiButtonData): HTMLElement {
  const button = createE('a', {
    class: 'emoji-add-link-single',
    style: `
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      color: #fff;
      border-radius: 6px;
      padding: 4px 8px;
      margin: 4px 0;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
    `,
    ti: '添加到未分组表情',
    in: '📥 添加表情'
  })
  setupButtonClickHandler(button, data)
  return button
}

// 为单个 lightbox-wrapper 添加表情按钮
function addEmojiButtonToLightbox(lightboxWrapper: Element) {
  // 避免重复添加
  if (lightboxWrapper.querySelector('.emoji-add-link-single')) return

  const emojiDataList = extractEmojiDataFromLightbox(lightboxWrapper)
  if (emojiDataList.length === 0) return

  const emojiData = emojiDataList[0] // 通常一个 lightbox 只有一张图
  const button = createSingleEmojiButton(emojiData)

  // 注入位置：在 lightbox-wrapper 内部的最后
  lightboxWrapper.appendChild(button)
}

// ========== 注入位置：批量处理按钮 ==========
// 为整个 cooked 内容区域创建批量解析按钮
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

  // 为每个 lightbox 添加单独的表情按钮
  lightboxWrappers.forEach(wrapper => {
    addEmojiButtonToLightbox(wrapper)
  })

  // 在内容顶部添加批量解析按钮（如果有多张图片）
  const button = createBatchParseButton(cookedElement)
  const firstChild = cookedElement.firstChild
  if (firstChild) cookedElement.insertBefore(button, firstChild)
  else cookedElement.appendChild(button)
}

// ========== 扫描和观察 ==========
// 立即扫描页面上所有的 cooked 内容
export function scanForCookedContent() {
  const cookedElements = DQSA('.cooked')
  cookedElements.forEach(el => {
    if (isCookedContent(el)) addBatchParseButtonToCooked(el)
  })
}

// 观察 DOM 变化，自动处理新增的 cooked 内容
export function observeCookedContent(): MutationObserver {
  // 启动时先立即扫描一次
  scanForCookedContent()

  // 简单防抖，聚合短时间内的多次 DOM 变更
  function debounce<T extends (...args: any[]) => void>(fn: T, wait = 100) {
    let timer: number | null = null
    return (...args: Parameters<T>) => {
      if (timer !== null) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        timer = null
        fn(...args)
      }, wait)
    }
  }

  const debouncedScan = debounce(scanForCookedContent, 100)

  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.type === 'childList' && (m.addedNodes.length > 0 || m.removedNodes.length > 0)) {
        // 检查是否有 cooked 相关的节点变化
        const hasRelevantChange = Array.from(m.addedNodes).some(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element
            return element.classList?.contains('cooked') || element.querySelector?.('.cooked')
          }
          return false
        })
        if (hasRelevantChange) {
          debouncedScan()
          return
        }
      }
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })
  return observer
}
