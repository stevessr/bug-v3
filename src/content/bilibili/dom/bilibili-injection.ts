/**
 * Bilibili DOM注入和操作相关功能
 */

import { extractImageUrlFromPicture, extractNameFromUrl } from '../utils/bilibili-utils'
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
      // Prefer injecting into the top bar if available
      const topBar = document.querySelector('.pswp__top-bar')
      if (topBar && !topBar.querySelector('.add-emoji')) {
        const url = extractImageUrlFromPicture(imgEl)
        if (!url) return
        const name = extractNameFromUrl(url)
        const btn = createControlButton({ name, url })
        topBar.appendChild(btn)
        return
      }

      // Fallback: overlay a floating button inside the zoom-wrap
      const zoomWrap = imgEl.closest('.pswp__zoom-wrap') as HTMLElement | null
      if (zoomWrap && !zoomWrap.querySelector('.bili-emoji-add-btn')) {
        const url = extractImageUrlFromPicture(imgEl)
        if (!url) return
        const name = extractNameFromUrl(url)
        const btn = createFloatingButton({ name, url })
        // ensure button sits above pswp transforms
        btn.style.position = 'absolute'
        btn.style.right = '16px'
        btn.style.top = '16px'
        btn.style.zIndex = '10010'
        zoomWrap.appendChild(btn)
        return
      }
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
  // picture containers
  const selectors = [
    '.bili-album__preview__picture__img',
    '.bili-album__preview__picture',
    '.bili-album__watch__track__item',
    '.bili-album__watch__content img'
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

/**
 * 观察DOM变化并重新注入按钮
 */
export function observeMutations() {
  const observer = new MutationObserver(mutations => {
    let changed = false
    mutations.forEach(m => {
      if (m.type === 'childList') changed = true
      else if (m.type === 'attributes') changed = true
    })
    if (changed) setTimeout(scanAndInject, 100)
  })
  observer.observe(document.body, { childList: true, subtree: true, attributes: true })
}
