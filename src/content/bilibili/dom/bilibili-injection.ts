/**
 * Bilibili DOM注入和操作相关功能
 */

import { extractImageUrlFromPicture, extractNameFromUrl } from '../utils/bilibili-utils'
import {
  addButtonToPhotoSwipeDebounced,
  observePhotoSwipeContainer,
  resetPhotoSwipeState
} from '../utils/bilibili-preview'
import {
  createFloatingButton,
  createControlButton,
  createBatchParseButton
} from '../components/bilibili-buttons'

declare const chrome: any

/**
 * 获取当前显示的图片
 */
export function getCurrentDisplayedImage(): Element | null {
  // Try to find the currently displayed image in the viewer
  const selectors = [
    '.bili-album__watch__content img',
    '.bili-album__watch__content picture',
    '.bili-album__watch__content .bili-album__preview__picture__img',
    '.bili-album__watch__content [style*="background-image"]'
  ]

  for (const selector of selectors) {
    const element = document.querySelector(selector)
    if (element) {
      const url = extractImageUrlFromPicture(element)
      if (url) return element
    }
  }

  return null
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
  const selectors = [
    '.bili-album__preview__picture__img',
    '.bili-album__preview__picture',
    '.bili-album__watch__track__item',
    '.bili-album__watch__content img'
    // Remove .pswp__img from here to avoid conflicts
  ]
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

    mutations.forEach(m => {
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

        if (hasButtonChanges) return // 忽略按钮添加导致的变化

        // 检查是否有相关的内容变化
        const hasRelevantChanges = Array.from(m.addedNodes).some(node => {
          if (node.nodeType === 1) {
            const element = node as Element
            return (
              element.classList &&
              (element.classList.contains('bili-album') ||
                element.classList.contains('pswp__scroll-wrap') ||
                element.querySelector('.bili-album') ||
                element.querySelector('.pswp__scroll-wrap'))
            )
          }
          return false
        })

        if (hasRelevantChanges) {
          needsScan = true
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
        // 只处理PhotoSwipe相关的属性变化
        const target = m.target as Element
        if (
          target.classList &&
          target.classList.contains('pswp__item') &&
          m.attributeName === 'aria-hidden'
        ) {
          needsPswpCheck = true
        }
      }
    })

    // 防抖处理常规扫描
    if (needsScan) {
      if (scanDebounceTimer) {
        clearTimeout(scanDebounceTimer)
      }
      scanDebounceTimer = window.setTimeout(() => {
        scanAndInject()
        scanDebounceTimer = null
      }, 300)
    }

    // 立即处理PhotoSwipe变化（但有自己的防抖）
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
