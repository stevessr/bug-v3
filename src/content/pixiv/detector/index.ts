import type { AddEmojiButtonData } from '../types'
import { extractNameFromUrl } from '../core/helpers'
import { createPixivEmojiButton } from '../ui/button'
import { findPixivOriginalInContainer, toPixivOriginalUrl } from '../utils/url'

// isPixivViewer: no longer used for scanning outer containers; we now work per-image.

function extractEmojiDataFromPixiv(container: Element): AddEmojiButtonData | null {
  const img = container.querySelector('img[src*="i.pximg.net"], img[src*="pximg.net"]') as HTMLImageElement | null
  if (!img) return null

  // 优先容器推断
  let src = findPixivOriginalInContainer(container) || ''
  if (!src) {
    const anchor = img.closest('a') as HTMLAnchorElement | null
    if (anchor?.href) src = anchor.href
    else if (img.src) src = img.src
    src = toPixivOriginalUrl(src)
  }

  if (!src || !src.startsWith('http')) return null

  let name = (img?.alt || img?.getAttribute('title') || '')?.trim() || ''
  if (!name || name.length < 2) name = extractNameFromUrl(src)
  name = name.replace(/\.(webp|jpg|jpeg|png|gif)$/i, '').trim()
  if (name.length === 0) name = '表情'
  return { name, url: src }
}

function addEmojiButtonToPixiv(pixivContainer: Element) {
  if (!pixivContainer) return
  // 避免重复注入：两类按钮任取其一即视为已存在，或已打标
  if (
    (pixivContainer as HTMLElement).dataset.oneclickPixivInjected === '1' ||
    pixivContainer.querySelector('.emoji-add-link-pixiv') ||
    pixivContainer.querySelector('.pixiv-open-in-newtab')
  )
    return
  const emojiData = extractEmojiDataFromPixiv(pixivContainer)
  if (!emojiData) return
  const addButton = createPixivEmojiButton(emojiData)
  try {
    const parentEl = pixivContainer as HTMLElement
    const computed = window.getComputedStyle(parentEl)
    if (computed.position === 'static' || !computed.position) parentEl.style.position = 'relative'
    // 标记已注入，避免后续 MutationObserver 重复注入
    parentEl.dataset.oneclickPixivInjected = '1'
  } catch {
    // ignore
  }

  pixivContainer.appendChild(addButton)
}

function scanForPixivViewer() {
  // 以图片为单位扫描，给每张图片注入到其最近的 [role=presentation] 容器
  const imgs = document.querySelectorAll('img[src*="i.pximg.net"], img[src*="pximg.net"]')
  imgs.forEach(img => {
    const container = img.closest('div[role="presentation"]') as Element | null
    if (container) addEmojiButtonToPixiv(container)
  })
}

function scanForImagePage() {
  const hostname = window.location.hostname.toLowerCase()
  if (!hostname.includes('i.pximg.net') && !hostname.includes('pximg.net')) {
    return
  }

  const images = document.querySelectorAll('img')

  for (const img of images) {
    const parent = img.closest('div[role="presentation"]') as HTMLElement | null
    if (!parent) continue
    if (
      parent.dataset.oneclickPixivInjected === '1' ||
      parent.querySelector('.emoji-add-link-pixiv') ||
      parent.querySelector('.pixiv-open-in-newtab')
    ) {
      continue
    }

    if (img.src && (img.src.includes('i.pximg.net') || img.src.includes('pximg.net'))) {
      const imageUrl = toPixivOriginalUrl(img.src)
      const imageName = extractNameFromUrl(imageUrl)

      const emojiData: AddEmojiButtonData = {
        name: imageName,
        url: imageUrl
      }

      const button = createPixivEmojiButton(emojiData)

      const imgContainer = parent || document.body
      const computedStyle = window.getComputedStyle(imgContainer)
      if (computedStyle.position === 'static') {
        ;(imgContainer as HTMLElement).style.position = 'relative'
      }

      imgContainer.appendChild(button)
      ;(imgContainer as HTMLElement).dataset.oneclickPixivInjected = '1'

      break
    }
  }
}

function observePixivViewer() {
  const hostname = window.location.hostname.toLowerCase()
  const isImageDomain = hostname.includes('i.pximg.net') || hostname.includes('pximg.net')

  const observer = new MutationObserver(mutations => {
    let shouldScan = false
    mutations.forEach(m => {
      if (m.type === 'childList') {
        m.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element

            if (isImageDomain) {
              if (el.tagName === 'IMG' || (el.querySelector && el.querySelector('img'))) {
                shouldScan = true
              }
            } else {
              if (el.getAttribute && el.getAttribute('role') === 'presentation') {
                shouldScan = true
              } else if (el.querySelector && el.querySelector('img[src*="i.pximg.net"]')) {
                shouldScan = true
              }
            }
          }
        })
      }
    })

    if (shouldScan) {
      setTimeout(() => {
        if (isImageDomain) {
          scanForImagePage()
        } else {
          scanForPixivViewer()
        }
      }, 120)
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })
}

function isPixivPage(): boolean {
  try {
    const hostname = window.location.hostname.toLowerCase()

    if (hostname.includes('i.pximg.net') || hostname.includes('pximg.net')) {
      return true
    }

    if (hostname.includes('pixiv.net')) {
      return true
    }

    const ogSite =
      document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || ''
    if (ogSite.toLowerCase().includes('pixiv')) return true

    const twitterMeta =
      document.querySelector('meta[property="twitter:site"]') ||
      document.querySelector('meta[name="twitter:site"]')
    const twitterSite = (twitterMeta && twitterMeta.getAttribute('content')) || ''
    if (twitterSite.toLowerCase().includes('pixiv')) return true

    const desc = document.querySelector('meta[name="description"]')?.getAttribute('content') || ''
    if (desc.toLowerCase().includes('pixiv')) return true

    const ogImage =
      document.querySelector('meta[property="og:image"]')?.getAttribute('content') || ''
    if (
      ogImage.includes('pixiv.net') ||
      ogImage.includes('pximg.net') ||
      ogImage.includes('embed.pixiv.net')
    ) {
      return true
    }

    return false
  } catch (e) {
    console.error('[PixivAddEmoji] isPixivPage check failed', e)
    return false
  }
}

export function initPixiv() {
  try {
    if (!isPixivPage()) {
      return
    }

    const hostname = window.location.hostname.toLowerCase()
    const isImageDomain = hostname.includes('i.pximg.net') || hostname.includes('pximg.net')

    if (isImageDomain) {
      setTimeout(scanForImagePage, 100)
    } else {
      setTimeout(scanForPixivViewer, 100)
    }

    observePixivViewer()
  } catch (e) {
    console.error('[PixivAddEmoji] init failed', e)
  }
}
