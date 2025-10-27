import {
  extractImageUrl,
  extractNameFromUrl,
  setupButtonClick,
  AddEmojiButtonData
} from '../x/utils'
import { DQSA, createE } from '../utils/createEl'

function isXhsPage(): boolean {
  try {
    const host = window.location.hostname.toLowerCase()
    return host.includes('xiaohongshu') || host.includes('xhs')
  } catch {
    return false
  }
}

function createXhsBtn(data: AddEmojiButtonData) {
  const btn = createE('button', {
    class: 'xhs-emoji-add-btn',
    type: 'button',
    ti: '添加到未分组表情',
    in: '添加到未分组表情',
    style: `
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
  })
  setupButtonClick(btn, data)
  return btn
}

function addButtonToXhsImage(img: HTMLImageElement) {
  try {
    const parent = img.parentElement || (img as Element)
    if (!parent) return

    // Skip duplicate swiper slides (Swiper creates duplicate slides for infinite loop)
    let element: Element | null = parent
    while (element && element !== document.body) {
      if (element.classList && element.classList.contains('swiper-slide-duplicate')) {
        console.log('[XHSOneClick] Skipping duplicate swiper slide')
        return
      }
      element = element.parentElement
    }

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
  const selectors = ['img.note-slider-img', '.img-container img']
  const set = new Set<HTMLImageElement>()

  selectors.forEach(sel => {
    try {
      DQSA(sel).forEach(el => {
        if (el instanceof HTMLImageElement) {
          set.add(el)
        } else {
          const img = (el as Element).querySelector('img') as HTMLImageElement | null
          if (img) set.add(img)
        }
      })
    } catch (e) {
      console.warn(`[XHSOneClick] selector ${sel} failed:`, e)
    }
  })

  console.log(`[XHSOneClick] scanAndInjectXhs found ${set.size} images`)

  // 如果没有找到图片，尝试查找所有图片
  if (set.size === 0) {
    console.log('[XHSOneClick] No images found with specific selectors, trying all images')
    DQSA('img').forEach(img => {
      if (img instanceof HTMLImageElement && img.src) {
        console.log('[XHSOneClick] Found image:', img.src, 'class:', img.className)
      }
    })
  }

  set.forEach(img => addButtonToXhsImage(img))
}

let obs: MutationObserver | null = null
let debounceTimer: number | null = null

function observeXhs() {
  if (obs) {
    console.log('[XHSOneClick] observeXhs already running')
    return obs
  }
  console.log('[XHSOneClick] observeXhs starting')
  obs = new MutationObserver(ms => {
    let needs = false
    for (const m of ms) {
      if (m.type === 'childList') {
        for (const n of Array.from(m.addedNodes)) {
          if (n.nodeType !== 1) continue
          const el = n as Element

          // 检查是否是图片或包含图片
          if (el.tagName === 'IMG') {
            needs = true
            console.log('[XHSOneClick] observeXhs detected IMG element')
            break
          }

          try {
            if (el.querySelector && el.querySelector('img')) {
              needs = true
              console.log('[XHSOneClick] observeXhs detected element with img')
              break
            }
          } catch {
            /* ignore */
          }
        }
      } else if (m.type === 'attributes') {
        const tgt = m.target as Element
        if (tgt.tagName === 'IMG') {
          needs = true
          console.log('[XHSOneClick] observeXhs detected attribute change on IMG')
        }
      }
      if (needs) break
    }
    if (needs) {
      console.log('[XHSOneClick] observeXhs triggering scan')
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(() => {
        scanAndInjectXhs()
        debounceTimer = null
      }, 250)
    }
  })
  try {
    obs.observe(document.body, { childList: true, subtree: true, attributes: true })
    console.log('[XHSOneClick] observeXhs observer attached to body')
  } catch (e) {
    console.error('[XHSOneClick] observeXhs failed to attach observer', e)
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
