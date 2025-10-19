import type { AddEmojiButtonData } from '../types/main'
import { createE } from '../../utils/createEl'

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
  const topBar = mfpContainer.querySelector('.pswp__top-bar') || (mfpContainer.classList.contains('pswp__top-bar') ? mfpContainer : null)
  if (!topBar) return
  if (topBar.querySelector('.emoji-add-link')) return
  const originalBtn = topBar.querySelector('.pswp__button--original-image') as HTMLAnchorElement | null
  const downloadBtn = topBar.querySelector('.pswp__button--download-image') as HTMLAnchorElement | null
  let imgUrl = ''
  if (originalBtn && originalBtn.href) {
    imgUrl = originalBtn.href
  } else if (downloadBtn && downloadBtn.href) {
    imgUrl = downloadBtn.href
  }
  if (!imgUrl) return
  // 优先取图片标题
  let name = ''
  const captionTitle = document.querySelector('.pswp__caption-title')
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
  const topBars = document.querySelectorAll('.pswp__top-bar')
  topBars.forEach(topBar => {
    addEmojiButtonToMfp(topBar)
  })
}

export function observeMagnificPopup() {
  // 仅观察 pswp__top-bar 结构
  const observer = new MutationObserver(mutations => {
    mutations.forEach(m => {
      if (m.type === 'childList') {
        m.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element
            if (el.classList && el.classList.contains('pswp__top-bar')) {
              addEmojiButtonToMfp(el)
            }
          }
        })
      }
    })
  })
  observer.observe(document.body, { childList: true, subtree: true })
}
