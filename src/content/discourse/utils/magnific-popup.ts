import type { AddEmojiButtonData } from '../types/main'
import { createE, DQS, DQSA } from '../../utils/dom/createEl'

import { setupButtonClickHandler } from './emoji-button'
import { extractNameFromUrl } from './picture'

function createMfpEmojiButton(data: AddEmojiButtonData): HTMLElement {
  const button = createE('a', {
    class: 'emoji-add-link',
    style: `color:#fff;border-radius:6px;padding:4px 8px;margin:0 2px;display:inline-flex;align-items:center;font-weight:600;`,
    ti: '添加到未分组表情',
    in: '添加表情'
  })
  setupButtonClickHandler(button, data)
  return button
}

function addEmojiButtonToMfp(mfpContainer: Element) {
  // 仅处理 pswp__top-bar 结构
  const topBar =
    mfpContainer.querySelector('.pswp__top-bar') ||
    (mfpContainer.classList.contains('pswp__top-bar') ? mfpContainer : null)
  if (!topBar) return
  if (topBar.querySelector('.emoji-add-link')) return
  const originalBtn = topBar.querySelector(
    '.pswp__button--original-image'
  ) as HTMLAnchorElement | null
  const downloadBtn = topBar.querySelector(
    '.pswp__button--download-image'
  ) as HTMLAnchorElement | null
  let imgUrl = ''
  if (originalBtn && originalBtn.href) {
    imgUrl = originalBtn.href
  } else if (downloadBtn && downloadBtn.href) {
    imgUrl = downloadBtn.href
  }
  if (!imgUrl) return
  // 优先取图片标题
  let name = ''
  const captionTitle = DQS('.pswp__caption-title')
  if (captionTitle && captionTitle.textContent && captionTitle.textContent.trim().length > 0) {
    name = captionTitle.textContent.trim()
  }
  // 兜底：按钮 title 或链接名
  if (!name) {
    if (originalBtn && originalBtn.title) {
      name = originalBtn.title
    } else if (downloadBtn && downloadBtn.title) {
      name = downloadBtn.title
    }
  }
  if (!name || name.length < 2) name = extractNameFromUrl(imgUrl)
  name = name.trim() || '表情'
  const emojiData = { name, url: imgUrl }
  const addButton = createMfpEmojiButton(emojiData)
  if (downloadBtn && downloadBtn.parentElement) {
    downloadBtn.parentElement.insertBefore(addButton, downloadBtn.nextSibling)
  } else {
    topBar.appendChild(addButton)
  }
}

export function scanForMagnificPopup() {
  // 仅处理 pswp__top-bar 结构
  const topBars = DQSA('.pswp__top-bar')
  topBars.forEach(topBar => {
    addEmojiButtonToMfp(topBar)
  })
}

export function observeMagnificPopup(): MutationObserver {
  // 启动时先立即扫描一次（确保现有弹窗处理到位）
  scanForMagnificPopup()

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

  const debouncedScan = debounce(scanForMagnificPopup, 100)

  // 仅观察 pswp__top-bar 结构相关的 DOM 变更，但使用子树观察以捕获动态插入
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.type === 'childList' && (m.addedNodes.length > 0 || m.removedNodes.length > 0)) {
        // 有节点新增/删除，触发防抖扫描
        debouncedScan()
        return
      }
      // 如果需要也可以响应属性变更（比如 class）
      if (m.type === 'attributes') {
        debouncedScan()
        return
      }
    }
  })

  observer.observe(document.body, { childList: true, subtree: true, attributes: false })
  return observer
}
