import type { AddEmojiButtonData } from '../pixiv/types'

// create a minimal floating button that sends the direct URL to background
function createRedditFloatingButton(data: AddEmojiButtonData): HTMLElement {
  const btn = document.createElement('button')
  btn.className = 'reddit-emoji-add-btn'
  btn.type = 'button'
  btn.title = '添加到未分组表情'
  btn.innerHTML = '➕'
  btn.style.cssText = `position:absolute;right:8px;top:8px;z-index:100000;cursor:pointer;border-radius:6px;padding:6px 8px;background:rgba(0,0,0,0.6);color:#fff;border:none;font-weight:700;`

  const handler = async (ev: Event) => {
    try {
      ev.preventDefault()
      ev.stopPropagation()
    } catch (_e) {
      void _e
    }

    try {
      const chromeAPI = (window as any).chrome
      if (!chromeAPI || !chromeAPI.runtime || !chromeAPI.runtime.sendMessage) {
        console.error('[RedditAddEmoji] Chrome runtime not available')
        return
      }

      // send direct URL to background to avoid converting to base64 in content
      chromeAPI.runtime.sendMessage({ action: 'addEmojiFromWeb', emojiData: data }, (resp: any) => {
        try {
          if (resp && resp.success) {
            btn.innerHTML = '已添加'
            btn.style.background = 'linear-gradient(135deg, #10b981, #059669)'
            setTimeout(() => {
              btn.innerHTML = '➕'
              btn.style.cssText = `position:absolute;right:8px;top:8px;z-index:100000;cursor:pointer;border-radius:6px;padding:6px 8px;background:rgba(0,0,0,0.6);color:#fff;border:none;font-weight:700;`
            }, 1500)
          } else {
            btn.innerHTML = '失败'
            btn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)'
            setTimeout(() => {
              btn.innerHTML = '➕'
              btn.style.cssText = `position:absolute;right:8px;top:8px;z-index:100000;cursor:pointer;border-radius:6px;padding:6px 8px;background:rgba(0,0,0,0.6);color:#fff;border:none;font-weight:700;`
            }, 1500)
          }
        } catch (_e) {
          void _e
        }
      })
    } catch (e) {
      console.error('[RedditAddEmoji] sendMessage failed', e)
    }
  }

  btn.addEventListener('click', handler)
  btn.addEventListener('pointerdown', handler)
  return btn
}

function isRedditImageContainer(el: Element | null): boolean {
  try {
    if (!el) return false
    // Reddit often uses role="presentation" on its lightbox container
    if (el.getAttribute && el.getAttribute('role') === 'presentation') {
      return !!el.querySelector('img')
    }

    // Post thumbnails / previews may have specific classes - best-effort match
    const className = (el.className || '') as string
    if (className.includes('media-lightbox-img') || className.includes('preview-img')) {
      return !!el.querySelector('img')
    }

    return false
  } catch {
    return false
  }
}

function extractEmojiDataFromReddit(container: Element): AddEmojiButtonData | null {
  try {
    const img = container.querySelector('img') as HTMLImageElement | null
    if (!img || !img.src) return null

    let src = img.getAttribute('src') || img.src || ''
    // prefer the largest candidate from srcset if available
    const srcset = img.getAttribute('srcset') || ''
    if ((!src || src.startsWith('data:')) && srcset) {
      const first = srcset.split(',').pop() || ''
      src = (first.split(' ')[0] || '').trim() || src
    }

    if (!src || !src.startsWith('http')) return null

    let name = (img.getAttribute('alt') || img.getAttribute('title') || '')?.trim() || ''
    if (!name || name.length < 2) name = 'reddit-emoji'

    return { name, url: src }
  } catch {
    return null
  }
}

function addEmojiButtonToContainer(container: Element) {
  try {
    if (!container) return
    if (
      container.querySelector('.reddit-emoji-add-btn') ||
      container.querySelector('.emoji-add-link-pixiv')
    )
      return

    const data = extractEmojiDataFromReddit(container)
    if (!data) return

    const btn = createRedditFloatingButton(data)

    try {
      const parentEl = container as HTMLElement
      const computed = window.getComputedStyle(parentEl)
      if (computed.position === 'static' || !computed.position) parentEl.style.position = 'relative'
    } catch (_e) {
      void _e
    }

    container.appendChild(btn)
  } catch (e) {
    console.error('[RedditAddEmoji] addEmojiButtonToContainer failed', e)
  }
}

function scanForRedditImages() {
  try {
    const candidates = Array.from(
      document.querySelectorAll('[role="presentation"], .media-lightbox-img, .preview-img')
    )
    candidates.forEach(c => {
      if (isRedditImageContainer(c)) addEmojiButtonToContainer(c)
    })

    // fallback: scan images in posts
    const imgs = Array.from(document.querySelectorAll('img'))
    for (const img of imgs) {
      const parent = img.parentElement
      if (!parent) continue
      if (
        parent.querySelector('.reddit-emoji-add') ||
        parent.querySelector('.emoji-add-link-pixiv')
      )
        continue
      const className = (parent.className || '') as string
      if (
        className.includes('media-lightbox-img') ||
        className.includes('preview-img') ||
        parent.getAttribute('data-test-id') === 'post-content'
      ) {
        addEmojiButtonToContainer(parent)
      }
    }
  } catch (e) {
    console.error('[RedditAddEmoji] scan failed', e)
  }
}

function observeReddit() {
  const observer = new MutationObserver(ms => {
    let shouldScan = false
    ms.forEach(m => {
      if (m.type === 'childList') {
        m.addedNodes.forEach(node => {
          if (node.nodeType !== Node.ELEMENT_NODE) return
          const el = node as Element
          if (isRedditImageContainer(el)) shouldScan = true
          else if (el.querySelector && el.querySelector('img')) shouldScan = true
        })
      }
    })
    if (shouldScan) {
      setTimeout(scanForRedditImages, 120)
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })
}

export function initReddit() {
  try {
    const host = window.location.hostname.toLowerCase()
    if (!host.includes('reddit.com') && !host.includes('redd.it')) return
    setTimeout(scanForRedditImages, 200)
    observeReddit()
    console.log('[RedditAddEmoji] initialized')
  } catch (e) {
    console.error('[RedditAddEmoji] init failed', e)
  }
}
