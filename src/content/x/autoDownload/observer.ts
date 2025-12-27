/**
 * 图片 MutationObserver
 * 监听页面变化并检查新图片
 */

import { getAutoDownloadManager } from './manager'

let observer: MutationObserver | null = null

export function startImageObserver(): void {
  if (observer) return

  const manager = getAutoDownloadManager()

  observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            // Element
            manager.checkForImages(node as Element)
          }
        })
      } else if (
        mutation.type === 'attributes' &&
        (mutation.target as HTMLElement).tagName === 'IMG'
      ) {
        manager.checkImage(mutation.target as HTMLImageElement)
      }
    }
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src']
  })

  // 初始扫描
  manager.checkForImages(document.body)
}

export function stopImageObserver(): void {
  if (observer) {
    observer.disconnect()
    observer = null
  }
}
