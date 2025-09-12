

import type { AddEmojiButtonData } from './types'
import { extractNameFromUrl } from './helpers'
import { createPixivEmojiButton } from './button'

function isPixivViewer(element: Element): boolean {
  try {
    if (!element) return false
    if (element.getAttribute && element.getAttribute('role') === 'presentation') {
      return !!element.querySelector('img[src*="i.pximg.net"]')
    }
    return false
  } catch (_e) {
    return false
  }
}

function extractEmojiDataFromPixiv(container: Element): AddEmojiButtonData | null {
  const img = container.querySelector('img[src*="i.pximg.net"]') as HTMLImageElement | null
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
  if (!name || name.length < 2) name = extractNameFromUrl(src)
  name = name.replace(/\.(webp|jpg|jpeg|png|gif)$/i, '').trim()
  if (name.length === 0) name = '表情'
  return { name, url: src }
}

function addEmojiButtonToPixiv(pixivContainer: Element) {
  if (!pixivContainer) return
  if (pixivContainer.querySelector('.emoji-add-link-pixiv')) return
  const emojiData = extractEmojiDataFromPixiv(pixivContainer)
  if (!emojiData) return
  const addButton = createPixivEmojiButton(emojiData)
  try {
    const parentEl = pixivContainer as HTMLElement
    const computed = window.getComputedStyle(parentEl)
    if (computed.position === 'static' || !computed.position) parentEl.style.position = 'relative'
  } catch (_e) {
    // ignore
  }

  pixivContainer.appendChild(addButton)
}

function scanForPixivViewer() {
  const candidates = document.querySelectorAll('[role="presentation"]')
  candidates.forEach(c => {
    if (isPixivViewer(c)) addEmojiButtonToPixiv(c)
  })
}

function scanForImagePage() {
  const hostname = window.location.hostname.toLowerCase()
  if (!hostname.includes('i.pximg.net') && !hostname.includes('pximg.net')) {
    return
  }

  console.log('[PixivAddEmoji] Scanning image page:', window.location.href)

  const images = document.querySelectorAll('img')

  for (const img of images) {
    if (img.parentElement?.querySelector('.emoji-add-link-pixiv')) {
      continue
    }

    if (img.src && (img.src.includes('i.pximg.net') || img.src.includes('pximg.net'))) {
      const imageUrl = img.src
      const imageName = extractNameFromUrl(imageUrl)

      console.log('[PixivAddEmoji] Found image on image page:', { url: imageUrl, name: imageName })

      const emojiData: AddEmojiButtonData = {
        name: imageName,
        url: imageUrl
      }

      const button = createPixivEmojiButton(emojiData)

      const imgContainer = img.parentElement || document.body
      const computedStyle = window.getComputedStyle(imgContainer)
      if (computedStyle.position === 'static') {
        ;(imgContainer as HTMLElement).style.position = 'relative'
      }

      imgContainer.appendChild(button)

      console.log('[PixivAddEmoji] Added button to image page')
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

export function isPixivPage(): boolean {
  try {
    const hostname = window.location.hostname.toLowerCase()

    if (hostname.includes('i.pximg.net') || hostname.includes('pximg.net')) {
      console.log('[PixivAddEmoji] Detected Pixiv image domain:', hostname)
      return true
    }

    if (hostname.includes('pixiv.net')) {
      console.log('[PixivAddEmoji] Detected Pixiv main site:', hostname)
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
      console.log('[PixivAddEmoji] skipping init: not a Pixiv page')
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

// expose init to window for content wrapper
;(window as any).__emoji_pixiv_init = initPixiv
