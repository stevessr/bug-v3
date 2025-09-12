import type { AddEmojiButtonData } from '../types'
import { DOM_SELECTORS } from '../config'
import { extractNameFromUrl } from '../helpers/url'
import { logger, safeExecuteSync } from '../utils'

/**
 * 元素扫描器 - 扫描和识别页面中的表情元素
 */

// 检查元素是否为Pixiv查看器
export function isPixivViewer(element: Element): boolean {
  return (
    safeExecuteSync(
      () => {
        if (!element) return false

        if (element.getAttribute && element.getAttribute('role') === 'presentation') {
          return !!element.querySelector(DOM_SELECTORS.pixivImage)
        }

        return false
      },
      '检查Pixiv查看器',
      false
    ) || false
  )
}

// 从Pixiv容器中提取表情数据
export function extractEmojiDataFromPixiv(container: Element): AddEmojiButtonData | null {
  return safeExecuteSync(
    () => {
      const img = container.querySelector(DOM_SELECTORS.pixivImage) as HTMLImageElement | null
      if (!img) return null

      let src = ''
      const anchor = img.closest('a') as HTMLAnchorElement | null

      if (anchor && anchor.href) {
        src = anchor.href
      } else if (img.src) {
        src = img.src
      }

      if (!src || !src.startsWith('http')) return null

      let name = (img?.alt || img?.getAttribute('title') || '')?.trim() || ''
      if (!name || name.length < 2) {
        name = extractNameFromUrl(src)
      }

      // 移除文件扩展名
      name = name.replace(/\.(webp|jpg|jpeg|png|gif)$/i, '').trim()
      if (name.length === 0) name = '表情'

      return { name, url: src }
    },
    '提取表情数据',
    null
  )
}

// 扫描主站的Pixiv查看器
export function scanForPixivViewer(): Element[] {
  const candidates = document.querySelectorAll(DOM_SELECTORS.presentationRole)
  const viewers: Element[] = []

  candidates.forEach(candidate => {
    if (isPixivViewer(candidate)) {
      viewers.push(candidate)
    }
  })

  logger.debug(`扫描到 ${viewers.length} 个Pixiv查看器`)
  return viewers
}

// 扫描图片页面的图片元素
export function scanForImagePage(): Element[] {
  const images = document.querySelectorAll('img')
  const pixivImages: Element[] = []

  for (const img of images) {
    if (img.src && (img.src.includes('i.pximg.net') || img.src.includes('pximg.net'))) {
      pixivImages.push(img)
    }
  }

  logger.debug(`在图片页面扫描到 ${pixivImages.length} 个Pixiv图片`)
  return pixivImages
}

// 检查容器是否已经有表情按钮
export function hasEmojiButton(container: Element): boolean {
  return !!container.querySelector(DOM_SELECTORS.emojiButton)
}

// 为容器设置相对定位
export function ensureRelativePositioning(container: Element): void {
  safeExecuteSync(() => {
    const element = container as HTMLElement
    const computed = window.getComputedStyle(element)
    if (computed.position === 'static' || !computed.position) {
      element.style.position = 'relative'
    }
  }, '设置相对定位')
}
