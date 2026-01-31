/**
 * Bilibili PhotoSwipe 预览器相关工具函数
 */

import { createFloatingButton, createPhotoSwipeButton } from './bilibili-buttons'
import { extractImageUrlFromPicture, extractNameFromUrl } from './bilibili-helper'

import { DQS } from '@/content/utils/dom/createEl'
// 防抖和状态管理
let isProcessingPhotoSwipe = false
let photoSwipeDebounceTimer: number | null = null
let lastProcessedImageUrl = ''

/**
 * 重置 PhotoSwipe 处理状态
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
 * 检查 PhotoSwipe 预览器是否存在
 * 支持两种容器格式：.pswp__scroll-wrap 和 #pswp__items
 */
function isPhotoSwipeActive(): boolean {
  return !!(DQS('.pswp__scroll-wrap') || DQS('#pswp__items'))
}

/**
 * 获取当前活动的 PhotoSwipe 图片项
 * 支持两种容器格式
 */
function getCurrentPhotoSwipeItem(): Element | null {
  // 尝试标准 PhotoSwipe 容器
  const pswpContainer = DQS('.pswp__scroll-wrap')
  if (pswpContainer) {
    return pswpContainer.querySelector('.pswp__item[aria-hidden="false"]')
  }

  // 尝试 opus 页面的 #pswp__items 容器
  const pswpItems = DQS('#pswp__items')
  if (pswpItems) {
    // 在 opus 页面，活动项可能没有 aria-hidden 属性
    // 直接查找包含 pswp__img 的 div
    const itemsWithImg = pswpItems.querySelectorAll('div > div > img.pswp__img')
    for (const img of itemsWithImg) {
      // 返回包含图片的最近 pswp__item 容器
      const item = img.closest('.pswp__item') || img.parentElement?.parentElement
      if (item) return item
    }
    // 如果没有找到带类名的，返回第一个有图片的 div
    const firstImg = pswpItems.querySelector('img.pswp__img')
    if (firstImg) {
      return firstImg.parentElement?.parentElement || firstImg.parentElement
    }
  }

  return null
}

/**
 * 获取当前活动 PhotoSwipe 项中的图片元素
 */
function getCurrentPhotoSwipeImage(): HTMLImageElement | null {
  const activeItem = getCurrentPhotoSwipeItem()
  if (!activeItem) return null

  return activeItem.querySelector('.pswp__img') as HTMLImageElement
}

/**
 * 检查 PhotoSwipe 按钮是否已存在
 */
function hasPhotoSwipeButton(): boolean {
  // Check in top bar
  const topBar = DQS('.pswp__top-bar')
  if (topBar && topBar.querySelector('.bili-emoji-add-btn')) return true

  // Check in active item
  const activeItem = getCurrentPhotoSwipeItem()
  if (activeItem && activeItem.querySelector('.bili-emoji-add-btn')) return true

  // Check in #pswp__items container (opus pages)
  const pswpItems = DQS('#pswp__items')
  if (pswpItems && pswpItems.querySelector('.bili-emoji-add-btn')) return true

  return false
}

/**
 * 向 PhotoSwipe 顶部栏添加按钮，定位在关闭按钮旁边
 */
function addButtonToPhotoSwipeTopBar(name: string, url: string): boolean {
  const topBar = DQS('.pswp__top-bar')
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
 * 向 PhotoSwipe 图片上添加浮动按钮（用于 opus 页面的 #pswp__items）
 */
function addButtonToPhotoSwipeImage(): boolean {
  // 查找 #pswp__items 中的图片
  const pswpItems = DQS('#pswp__items')
  if (!pswpItems) return false

  // 查找所有 pswp__img 图片
  const pswpImages = pswpItems.querySelectorAll('img.pswp__img')
  let addedCount = 0

  for (const img of pswpImages) {
    const parent = img.parentElement
    if (!parent) continue

    // 检查是否已经有按钮
    if (parent.querySelector('.bili-emoji-add-btn')) continue

    // 获取这个图片的 URL
    const imgUrl = (img as HTMLImageElement).src
    if (!imgUrl) continue

    const imgName = extractNameFromUrl(imgUrl)

    // 确保父元素有定位
    const parentEl = parent as HTMLElement
    const computed = window.getComputedStyle(parentEl)
    if (computed.position === 'static' || !computed.position) {
      parentEl.style.position = 'relative'
    }

    // 创建浮动按钮
    const btn = createFloatingButton({ name: imgName, url: imgUrl })
    btn.style.cssText +=
      'position: absolute; right: 16px; top: 16px; z-index: 10010; background: rgba(0,0,0,0.8);'
    parent.appendChild(btn)
    addedCount++
  }

  return addedCount > 0
}

/**
 * 向 PhotoSwipe 缩放区域添加浮动按钮
 */
function addFloatingButtonToPhotoSwipe(name: string, url: string): boolean {
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
 * 向 PhotoSwipe 预览器添加表情按钮
 */
function addButtonToPhotoSwipe(): boolean {
  try {
    // 防止重复处理
    if (isProcessingPhotoSwipe) return false

    if (!isPhotoSwipeActive()) return false

    // 优先处理 opus 页面的 #pswp__items 容器
    const pswpItems = DQS('#pswp__items')
    if (pswpItems) {
      // 检查是否已有按钮
      if (pswpItems.querySelector('.bili-emoji-add-btn')) return false

      isProcessingPhotoSwipe = true

      // 直接向图片上添加按钮
      const success = addButtonToPhotoSwipeImage()

      // 重置处理状态
      setTimeout(() => {
        isProcessingPhotoSwipe = false
      }, 100)

      return success
    }

    // 标准 PhotoSwipe 处理逻辑
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
 * 带防抖的 PhotoSwipe 按钮添加函数
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
 * 创建 PhotoSwipe 特定的 DOM 观察器
 */
function createPhotoSwipeObserver(callback: () => void): MutationObserver {
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
 * 监听 PhotoSwipe 容器的变化
 * 支持两种容器格式：.pswp__scroll-wrap 和 #pswp__items
 */
export function observePhotoSwipeContainer(callback: () => void): MutationObserver | null {
  // 尝试标准容器
  let pswpContainer: Element | null = DQS('.pswp__scroll-wrap')

  // 如果没有标准容器，尝试 opus 页面容器
  if (!pswpContainer) {
    pswpContainer = DQS('#pswp__items')
  }

  if (!pswpContainer) return null

  const observer = createPhotoSwipeObserver(callback)
  observer.observe(pswpContainer, {
    childList: true,
    subtree: true, // 对于 #pswp__items 需要监听子树变化
    attributes: true,
    attributeFilter: ['aria-hidden', 'src', 'style'] // 监听 src 变化以检测图片切换
  })

  return observer
}
