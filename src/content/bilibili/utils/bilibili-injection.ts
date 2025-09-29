/**
 * Bilibili DOM注入和操作相关功能
 */

import { extractImageUrlFromPicture, extractNameFromUrl } from './bilibili-helper'
import {
  addButtonToPhotoSwipeDebounced,
  observePhotoSwipeContainer,
  resetPhotoSwipeState
} from './bilibili-preview'
import getSelectorsForCurrentUrl from './selectors-by-url'
import {
  createFloatingButton,
  createControlButton,
  createBatchParseButton
} from './bilibili-buttons'

/**
 * 获取当前显示的图片 - 改进URL解析
 */
export function getCurrentDisplayedImage(): Element | null {
  // 扩展选择器列表以覆盖更多场景
  const selectors = [
    // 主要图片查看器内容
    '.bili-album__watch__content img',
    '.bili-album__watch__content picture',
    '.bili-album__watch__content .bili-album__preview__picture__img',
    '.bili-album__watch__content [style*="background-image"]',

    // 当前活动的图片项
    '.bili-album__watch__track__item.active img',
    '.bili-album__watch__track__item.active picture',

    // 图片预览区域
    '.bili-album__preview__picture img',
    '.bili-album__preview__picture picture',

    // 大图显示区域
    '.bili-album__watch__main img',
    '.bili-album__watch__main picture',

    // 备用选择器
    '.bili-album img[src*="i0.hdslb.com"]',
    '.bili-album img[src*="i1.hdslb.com"]',
    '.bili-album img[src*="i2.hdslb.com"]',
    'img[src*="hdslb.com"]'
  ]

  // 首先尝试找到最相关的图片
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector)
    for (const element of elements) {
      const url = extractImageUrlFromPicture(element)
      if (url) {
        // 验证URL是否为有效的图片URL
        if (isValidImageUrl(url)) {
          return element
        }
      }
    }
  }

  return null
}

/**
 * 验证是否为有效的图片URL
 */
function isValidImageUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    // 检查是否为B站的图片域名
    const validDomains = ['i0.hdslb.com', 'i1.hdslb.com', 'i2.hdslb.com', 'hdslb.com']
    const isValidDomain = validDomains.some(domain => urlObj.hostname.includes(domain))

    // 检查是否为图片文件扩展名
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif']
    const hasValidExtension = validExtensions.some(ext =>
      urlObj.pathname.toLowerCase().includes(ext)
    )

    return isValidDomain && (hasValidExtension || urlObj.pathname.includes('/'))
  } catch {
    return false
  }
}

/**
 * 向控制区域添加按钮
 */
export function addButtonToControlSection(controlSection: Element) {
  try {
    // Check if button already exists
    if (controlSection.querySelector('.add-emoji')) return

    // Find the currently displayed image
    const currentImage = getCurrentDisplayedImage()
    if (!currentImage) return

    const url = extractImageUrlFromPicture(currentImage)
    if (!url) return

    const name = extractNameFromUrl(url)
    const btn = createControlButton({ name, url })

    // Add the button to the control section
    controlSection.appendChild(btn)
  } catch (e) {
    void e
  }
}

/**
 * 向图片添加浮动按钮
 */
export function addButtonToPicture(pictureEl: Element) {
  try {
    // avoid double-inserting
    if (
      (pictureEl as Element).querySelector &&
      (pictureEl as Element).querySelector('.bili-emoji-add-btn')
    )
      return

    // Handle PhotoSwipe (pswp) displayed images specially
    let imgEl: HTMLImageElement | null = null
    if (pictureEl instanceof HTMLImageElement) {
      imgEl = pictureEl
    } else if ((pictureEl as Element).querySelector) {
      imgEl = (pictureEl as Element).querySelector('img') as HTMLImageElement | null
    }

    if (imgEl && imgEl.classList && imgEl.classList.contains('pswp__img')) {
      // Use dedicated PhotoSwipe handler
      addButtonToPhotoSwipeDebounced()
      return
    }

    // Default behavior for other picture containers
    const url = extractImageUrlFromPicture(pictureEl)
    if (!url) return
    const name = extractNameFromUrl(url)

    const parent = pictureEl as HTMLElement
    // ensure parent is positioned relative so absolute button positions correctly
    const computed = window.getComputedStyle(parent)
    if (computed.position === 'static' || !computed.position) parent.style.position = 'relative'

    const btn = createFloatingButton({ name, url })
    parent.appendChild(btn)
  } catch (e) {
    void e
  }
}

/**
 * 添加批量解析按钮到相册容器
 */
export function addBatchParseButtonToAlbum(container: Element) {
  if ((container as Element).querySelector('.bili-emoji-batch-parse')) return

  const btn = createBatchParseButton(container)

  // insert at top of album container
  const first = container.firstChild
  if (first) container.insertBefore(btn, first)
  else container.appendChild(btn)
}

/**
 * 扫描页面并注入按钮
 */
export function scanAndInject() {
  // Check for PhotoSwipe previews first (with debouncing)
  const pswpContainer = document.querySelector('.pswp__scroll-wrap')
  if (pswpContainer) {
    addButtonToPhotoSwipeDebounced()
  }
  // picture containers
  const selectors = getSelectorsForCurrentUrl()
  const set = new Set<Element>()
  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => set.add(el))
  })

  set.forEach(el => addButtonToPicture(el))

  // Add button to control sections (image viewer controls)
  const controlSections = document.querySelectorAll('.bili-album__watch__control')
  controlSections.forEach(controlSection => {
    addButtonToControlSection(controlSection)
  })

  // Add batch parse button for full album container
  const albumContainers = document.querySelectorAll('.bili-album')
  albumContainers.forEach(container => {
    addBatchParseButtonToAlbum(container)
  })
}

/**
 * Return selector list based on current URL (prioritize opus selectors on opus/t pages)
 */
// getSelectorsForCurrentUrl is provided by ./selectors-by-url

// 防抖定时器和状态管理
let scanDebounceTimer: number | null = null
let pswpObserverInstance: MutationObserver | null = null

/**
 * 观察DOM变化并重新注入按钮
 */
export function observeMutations() {
  // 重置PhotoSwipe状态
  resetPhotoSwipeState()

  // General mutation observer with strict filtering
  const observer = new MutationObserver(mutations => {
    let needsScan = false
    let needsPswpCheck = false

    for (const m of mutations) {
      // 避免处理我们自己添加的按钮导致的变化
      if (m.type === 'childList') {
        const hasButtonChanges = Array.from(m.addedNodes).some(node => {
          if (node.nodeType === 1) {
            const element = node as Element
            return (
              element.classList &&
              (element.classList.contains('bili-emoji-add-btn') ||
                element.classList.contains('add-emoji') ||
                element.classList.contains('bili-emoji-batch-parse'))
            )
          }
          return false
        })

        if (hasButtonChanges) continue // 忽略按钮添加导致的变化

        // Only trigger if added nodes contain an <img> or a container that has one
        const hasImg = Array.from(m.addedNodes).some(node => {
          if (node.nodeType !== 1) return false
          const el = node as Element
          if (el.tagName === 'IMG') return true
          try {
            return !!el.querySelector && !!el.querySelector('img')
          } catch {
            return false
          }
        })

        if (hasImg) {
          needsScan = true
          // If any added node is a pswp container, schedule PhotoSwipe check
          if (
            Array.from(m.addedNodes).some(node => {
              if (node.nodeType === 1) {
                const element = node as Element
                return element.classList && element.classList.contains('pswp__scroll-wrap')
              }
              return false
            })
          ) {
            needsPswpCheck = true
          }
        }
      } else if (m.type === 'attributes') {
        // Keep PhotoSwipe attribute handling
        const target = m.target as Element
        if (
          target.classList &&
          target.classList.contains('pswp__item') &&
          m.attributeName === 'aria-hidden'
        ) {
          needsPswpCheck = true
        }

        // If attributes changed on an element that is or contains an <img>, trigger scan
        try {
          const tgt = m.target as Element
          if (tgt.tagName === 'IMG' || (tgt.querySelector && tgt.querySelector('img'))) {
            needsScan = true
          }
        } catch {
          /* ignore */
        }
      }
    }

    // Debounced scan for general image additions/changes
    if (needsScan) {
      if (scanDebounceTimer) {
        clearTimeout(scanDebounceTimer)
      }
      scanDebounceTimer = window.setTimeout(() => {
        scanAndInject()
        scanDebounceTimer = null
      }, 300)
    }

    // Immediate PhotoSwipe handling
    if (needsPswpCheck) {
      addButtonToPhotoSwipeDebounced()
    }
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-hidden', 'class']
  })

  // 设置PhotoSwipe专用观察器，但避免重复设置
  const setupPhotoSwipeObserver = () => {
    if (pswpObserverInstance) {
      pswpObserverInstance.disconnect()
      pswpObserverInstance = null
    }

    pswpObserverInstance = observePhotoSwipeContainer(addButtonToPhotoSwipeDebounced)

    if (!pswpObserverInstance) {
      // 如果PhotoSwipe容器还不存在，稍后再试
      setTimeout(setupPhotoSwipeObserver, 2000)
    }
  }

  // 延迟设置PhotoSwipe观察器
  setTimeout(setupPhotoSwipeObserver, 1000)
}
