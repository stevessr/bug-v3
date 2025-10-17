import type { AddEmojiButtonData } from '../types'
import { findPixivOriginalInContainer, toPixivOriginalUrl } from '../utils/url'

export function setupOpenInNewTabHandler(button: HTMLElement, data: AddEmojiButtonData) {
  let running = false

  const handle = async (origEvent: Event) => {
    try {
      origEvent.preventDefault()
      origEvent.stopPropagation()
    } catch (_e) {
      void _e
    }
    if (running) return
    running = true

    // Re-read related image URL and name from DOM at click time to avoid stale data
    try {
      const closestImg = button
        .closest('article, div, figure, [role="presentation"]')
        ?.querySelector('img[src*="i.pximg.net"], img[src*="pximg.net"]') as HTMLImageElement | null
      // Try container-first resolution (prefer a[href*='/img-original/'])
      const container = button.closest('article, div, figure, [role="presentation"]')
      const resolved = findPixivOriginalInContainer(container)
      if (resolved && resolved.startsWith('http')) {
        data = { ...data, url: resolved }
      } else if (closestImg) {
        const urlFromData = (
          closestImg.getAttribute('data-src') ||
          closestImg.getAttribute('data-original') ||
          ''
        ).trim()
        const srcset = closestImg.getAttribute('srcset') || ''
        const srcCandidate =
          urlFromData || closestImg.src || (srcset.split(',')[0] || '').split(' ')[0]
        const original = toPixivOriginalUrl(srcCandidate)
        if (original && original.startsWith('http')) {
          try {
            data = { ...data, url: original }
            const derivedName =
              (closestImg.alt || closestImg.getAttribute('title') || '').trim() || data.name
            if (derivedName && derivedName.length > 0) data.name = derivedName
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore DOM read errors
    }

    // Open in new tab
    try {
      if (data && data.url && data.url.startsWith('http')) {
        const newWin = window.open(data.url, '_blank')
        try {
          newWin?.focus()
        } catch (_e) {
          void _e
        }
      } else {
        console.warn('[pixiv][open] no valid url to open', { data })
      }
    } catch (err) {
      console.error('[pixiv][open] failed to open url', err)
    }

    // small debounce to avoid double opens
    setTimeout(() => {
      running = false
    }, 300)
  }

  button.addEventListener('pointerdown', handle)
  button.addEventListener('click', handle)
}

export function createPixivOpenInNewTabButton(data: AddEmojiButtonData): HTMLElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'pixiv-open-in-newtab'
  button.style.cssText = `
    position: absolute;
    left: 12px;
    top: 12px;
    z-index: 100000;
    color: #ffffff;
    background: linear-gradient(135deg, #374151, #1f2937);
    border: 2px solid rgba(255,255,255,0.9);
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    pointer-events: auto;
  `
  button.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M14 3v2h3.59L7.76 15.83l1.41 1.41L19 6.41V10h2V3h-7z"/>
    </svg>
    在新标签页打开
  `
  button.title = '在新标签页打开图片'
  try {
    button.dataset.emojiName = data.name
    button.dataset.emojiUrl = data.url
  } catch (_e) {
    void _e
  }
  setupOpenInNewTabHandler(button, data)
  return button
}
