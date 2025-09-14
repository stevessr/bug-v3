import {
  extractImageUrl,
  extractNameFromUrl,
  setupButtonClick,
  AddEmojiButtonData
} from '../x/utils'

declare const chrome: any

function isXhsPage(): boolean {
  try {
    const host = window.location.hostname.toLowerCase()
    return host.includes('xiaohongshu') || host.includes('xhs')
  } catch {
    return false
  }
}

function createXhsBtn(data: AddEmojiButtonData) {
  const btn = document.createElement('button')
  btn.className = 'xhs-emoji-add-btn'
  btn.type = 'button'
  btn.title = '添加到未分组表情'
  // Use visible text so it always fits; increase padding and min-width
  btn.innerText = '添加到未分组表情'
  btn.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 2147483647;
    background: rgba(0,0,0,0.7);
    color: #fff;
    border: none;
    padding: 8px 12px;
    min-width: 110px;
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.25);
  `
  setupButtonClick(btn, data)
  return btn
}

function addButtonToXhsImage(img: HTMLImageElement) {
  try {
    const parent = img.parentElement || (img as Element)
    if (!parent) return
    // avoid double-inserting
    if (
      (parent as Element).querySelector &&
      (parent as Element).querySelector('.xhs-emoji-add-btn')
    )
      return

    // ensure parent positioned
    const p = parent as HTMLElement
    const computed = window.getComputedStyle(p)
    if (computed.position === 'static' || !computed.position) p.style.position = 'relative'

    // Prefer direct img.src for xhs CDN images because the shared
    // normalizeUrl/extractImageUrl logic limits allowed hosts to twitter/x domains.
    // Use raw src as a fallback to ensure buttons are created for xhs images.
    const rawSrc = img.getAttribute('src') || (img as HTMLImageElement).src || ''
    const url = rawSrc || extractImageUrl(img as Element)
    if (!url) return
    const name = extractNameFromUrl(url)
    const btn = createXhsBtn({ name, url })
    p.appendChild(btn)
  } catch (e) {
    void e
  }
}

export function scanAndInjectXhs() {
  const selectors = ['img.note-slider-img', '.img-container img', '.swiper-slide img']
  const set = new Set<HTMLImageElement>()
  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      if (el instanceof HTMLImageElement) set.add(el)
      else {
        const img = (el as Element).querySelector('img') as HTMLImageElement | null
        if (img) set.add(img)
      }
    })
  })
  set.forEach(img => addButtonToXhsImage(img))
}

let obs: MutationObserver | null = null
let debounceTimer: number | null = null

export function observeXhs() {
  if (obs) return obs
  obs = new MutationObserver(ms => {
    let needs = false
    for (const m of ms) {
      if (m.type === 'childList') {
        for (const n of Array.from(m.addedNodes)) {
          if (n.nodeType !== 1) continue
          const el = n as Element
          if (el.tagName === 'IMG' && el.classList.contains('note-slider-img')) {
            needs = true
            break
          }
          try {
            if (el.querySelector && el.querySelector('img.note-slider-img')) {
              needs = true
              break
            }
          } catch (e) {
            /* ignore */
          }
        }
      } else if (m.type === 'attributes') {
        const tgt = m.target as Element
        if (
          tgt.tagName === 'IMG' &&
          (tgt as HTMLImageElement).classList.contains('note-slider-img')
        )
          needs = true
      }
      if (needs) break
    }
    if (needs) {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(() => {
        scanAndInjectXhs()
        debounceTimer = null
      }, 250)
    }
  })
  try {
    obs.observe(document.body, { childList: true, subtree: true, attributes: true })
  } catch (e) {
    void e
  }
  return obs
}

export function initXhs() {
  try {
    const host = window.location.hostname
    console.log('[XHSOneClick] initXhs called on host:', host)
    if (!isXhsPage()) {
      console.log('[XHSOneClick] skipping init: not xhs host')
      return
    }
    setTimeout(() => {
      scanAndInjectXhs()
      observeXhs()
    }, 200)
    console.log('[XHSOneClick] initialized')
  } catch (e) {
    console.error('[XHSOneClick] init failed', e)
  }
}
