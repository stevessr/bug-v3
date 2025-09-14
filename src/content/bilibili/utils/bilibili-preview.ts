/**
 * Bilibili PhotoSwipe 预览器相关工具函数
 */

import { createFloatingButton, createPhotoSwipeButton } from './bilibili-buttons'

import { extractImageUrlFromPicture, extractNameFromUrl } from './bilibili-helper'

// 防抖和状态管理
let isProcessingPhotoSwipe = false
let photoSwipeDebounceTimer: number | null = null
let lastProcessedImageUrl = ''

/**
 * 重置PhotoSwipe处理状态
 */
export function resetPhotoSwipeState(): void {
  isProcessingPhotoSwipe = false
  lastProcessedImageUrl = ''
  if (photoSwipeDebounceTimer) {
    clearTimeout(photoSwipeDebounceTimer)
    photoSwipeDebounceTimer = null
  }
}

/**
 * 检查PhotoSwipe预览器是否存在
 */
export function isPhotoSwipeActive(): boolean {
  return !!document.querySelector('.pswp__scroll-wrap')
}

/**
 * 获取当前活动的PhotoSwipe图片项
 */
export function getCurrentPhotoSwipeItem(): Element | null {
  const pswpContainer = document.querySelector('.pswp__scroll-wrap')
  if (!pswpContainer) return null

  return pswpContainer.querySelector('.pswp__item[aria-hidden="false"]')
}

/**
 * 获取当前活动PhotoSwipe项中的图片元素
 */
export function getCurrentPhotoSwipeImage(): HTMLImageElement | null {
  const activeItem = getCurrentPhotoSwipeItem()
  if (!activeItem) return null

  return activeItem.querySelector('.pswp__img') as HTMLImageElement
}

/**
 * 检查PhotoSwipe按钮是否已存在
 */
export function hasPhotoSwipeButton(): boolean {
  // Check in top bar
  const topBar = document.querySelector('.pswp__top-bar')
  if (topBar && topBar.querySelector('.bili-emoji-add-btn')) return true

  // Check in active item
  const activeItem = getCurrentPhotoSwipeItem()
  if (activeItem && activeItem.querySelector('.bili-emoji-add-btn')) return true

  return false
}

/**
 * 向PhotoSwipe顶部栏添加按钮，定位在关闭按钮旁边
 */
export function addButtonToPhotoSwipeTopBar(name: string, url: string): boolean {
  const topBar = document.querySelector('.pswp__top-bar')
  if (!topBar || topBar.querySelector('.bili-emoji-add-btn')) return false

  // Find the close button to position our button next to it
  const closeButton = topBar.querySelector('.pswp__button--close')
  if (!closeButton) return false

  // Create a PhotoSwipe-style button instead of using the control button
  const btn = createPhotoSwipeButton({ name, url })

  // Insert the button right before the close button
  topBar.insertBefore(btn, closeButton)
  return true
}

/**
 * 向PhotoSwipe缩放区域添加浮动按钮
 */
export function addFloatingButtonToPhotoSwipe(name: string, url: string): boolean {
  const activeItem = getCurrentPhotoSwipeItem()
  if (!activeItem) return false

  const zoomWrap = activeItem.querySelector('.pswp__zoom-wrap') as HTMLElement
  if (!zoomWrap || zoomWrap.querySelector('.bili-emoji-add-btn')) return false

  const btn = createFloatingButton({ name, url })
  btn.style.cssText +=
    'position: absolute; right: 16px; top: 16px; z-index: 10010; background: rgba(0,0,0,0.8);'
  zoomWrap.appendChild(btn)
  return true
}

/**
 * 向PhotoSwipe预览器添加表情按钮
 */
export function addButtonToPhotoSwipe(): boolean {
  try {
    // 防止重复处理
    if (isProcessingPhotoSwipe) return false

    if (!isPhotoSwipeActive()) return false

    const imgEl = getCurrentPhotoSwipeImage()
    if (!imgEl) return false

    // Check if button already exists
    if (hasPhotoSwipeButton()) return false

    const url = extractImageUrlFromPicture(imgEl)
    if (!url) return false

    // 防止处理相同的图片
    if (url === lastProcessedImageUrl) return false

    // 设置处理状态
    isProcessingPhotoSwipe = true
    lastProcessedImageUrl = url

    const name = extractNameFromUrl(url)

    // Try to add button to top bar first
    let success = false
    if (addButtonToPhotoSwipeTopBar(name, url)) {
      success = true
    } else {
      // Fallback: overlay floating button on image
      success = addFloatingButtonToPhotoSwipe(name, url)
    }

    // 重置处理状态
    setTimeout(() => {
      isProcessingPhotoSwipe = false
    }, 100)

    return success
  } catch (e) {
    isProcessingPhotoSwipe = false
    void e
    return false
  }
}

/**
 * 带防抖的PhotoSwipe按钮添加函数
 */
export function addButtonToPhotoSwipeDebounced(): void {
  // 清除之前的定时器
  if (photoSwipeDebounceTimer) {
    clearTimeout(photoSwipeDebounceTimer)
  }

  // 设置新的防抖定时器
  photoSwipeDebounceTimer = window.setTimeout(() => {
    addButtonToPhotoSwipe()
    photoSwipeDebounceTimer = null
  }, 150) // 150ms 防抖延迟
}

/**
 * 创建PhotoSwipe特定的DOM观察器
 */
export function createPhotoSwipeObserver(callback: () => void): MutationObserver {
  let observerDebounceTimer: number | null = null

  return new MutationObserver(() => {
    // 防抖处理
    if (observerDebounceTimer) {
      clearTimeout(observerDebounceTimer)
    }

    observerDebounceTimer = window.setTimeout(() => {
      callback()
      observerDebounceTimer = null
    }, 200)
  })
}

/**
 * 监听PhotoSwipe容器的变化
 */
export function observePhotoSwipeContainer(callback: () => void): MutationObserver | null {
  const pswpContainer = document.querySelector('.pswp__scroll-wrap')
  if (!pswpContainer) return null

  const observer = createPhotoSwipeObserver(callback)
  observer.observe(pswpContainer, {
    childList: true,
    subtree: false, // 不要监听所有子树变化，减少触发频率
    attributes: true,
    attributeFilter: ['aria-hidden'] // 只监听aria-hidden变化
  })

  return observer
}

/**
 * 检查DOM变化是否与PhotoSwipe相关
 */
export function isPhotoSwipeRelatedMutation(mutation: MutationRecord): boolean {
  if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
    return Array.from(mutation.addedNodes).some(node => {
      if (node.nodeType === 1) {
        const element = node as Element
        return (
          element.classList &&
          (element.classList.contains('pswp__scroll-wrap') ||
            element.closest('.pswp__scroll-wrap') ||
            element.querySelector('.pswp__scroll-wrap'))
        )
      }
      return false
    })
  }

  if (mutation.type === 'attributes') {
    const target = mutation.target as Element
    return (
      target.classList &&
      target.classList.contains('pswp__item') &&
      mutation.attributeName === 'aria-hidden'
    )
  }

  return false
}
