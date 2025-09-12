

import { initVideoCopy } from './videoCopy'
import { scanAndInjectCarousel } from './carousel'

declare const chrome: any

interface AddEmojiButtonData {
  name: string
  url: string
}

// Track overlay buttons attached to body so we can reposition / remove them when target is gone
const overlayMap = new WeakMap<Element, { btn: HTMLElement; raf?: number }>()

function isXPage(): boolean {
  try {
    const host = window.location.hostname.toLowerCase()
    // Treat X/Twitter and common media hosts (pbs.twimg.com / *.twimg.com) as X pages
    return (
      host === 'x.com' ||
      host.endsWith('.twitter.com') ||
      host.includes('twitter.com') ||
      host === 'pbs.twimg.com' ||
      host.endsWith('.twimg.com') ||
      host.includes('twimg.com') ||
      host.includes('pbs.twimg')
    )
  } catch {
    return false
  }
}

function normalizeUrl(raw: string): string | null {
  if (!raw) return null
  raw = raw.trim()
  // remove surrounding url("...") if present
  const urlMatch = raw.match(/url\((?:\s*['"]?)(.*?)(?:['"]?\s*)\)/)
  if (urlMatch) raw = urlMatch[1]
  // remove query params that are not needed? Keep them; some images require params
  // ensure protocol
  if (raw.startsWith('//')) raw = 'https:' + raw
  else if (raw.startsWith('/')) raw = window.location.origin + raw

  if (raw.includes(',')) raw = raw.split(',')[0]
  raw = raw.split(' ')[0]

  // strip known size suffixes like :large or ?format=jpg&name=large - we keep query but try to strip common suffix markers
  raw = raw.replace(/:large$|:orig$/i, '')

  // validation
  // validation: ensure starts with http(s)
  if (!/^https?:\/\//i.test(raw)) return null

  // optional host whitelist for X/Twitter images to avoid false positives
  try {
    const u = new URL(raw)
    const host = u.hostname.toLowerCase()
    const allowed = ['pbs.twimg.com', 'twimg.com', 'twitter.com', 'x.com', 'pbs.twimg']
    const ok = allowed.some(a => host.endsWith(a) || host.includes(a))
    if (!ok) return null
  } catch {
    return null
  }

  return raw
}

function extractImageUrl(el: Element): string | null {
  // background-image inline style
  const style = (el as HTMLElement).style && (el as HTMLElement).style.backgroundImage
  if (style && style !== 'none') {
    const normalized = normalizeUrl(style)
    if (normalized) return normalized
  }

  // find img tag inside
  const img = el.querySelector('img') as HTMLImageElement | null
  if (img) {
    const src = img.getAttribute('src') || img.getAttribute('data-src') || img.src || ''
    const normalized = normalizeUrl(src)
    if (normalized) return normalized
  }

  // direct src attribute on element
  const elSrc = (el as HTMLImageElement).src
  if (elSrc) return normalizeUrl(elSrc)

  return null
}

function extractNameFromUrl(url: string): string {
  try {
    const u = new URL(url)
    const filename = u.pathname.split('/').pop() || ''
    return decodeURIComponent(filename.replace(/\.[^/.]+$/, '')) || '表情'
  } catch {
    return '表情'
  }
}

function setupButtonClick(button: HTMLElement, data: AddEmojiButtonData) {
  button.addEventListener('click', async e => {
    e.preventDefault()
    e.stopPropagation()
    const orig = button.innerHTML
    const origStyle = button.style.cssText
    try {
      await chrome.runtime.sendMessage({ action: 'addEmojiFromWeb', emojiData: data })
      button.innerHTML = '已添加'
      button.style.background = 'linear-gradient(135deg,#10b981,#059669)'
      setTimeout(() => {
        button.innerHTML = orig
        button.style.cssText = origStyle
      }, 1500)
    } catch (err) {
      console.error('[XOneClick] 添加失败', err)
      button.innerHTML = '失败'
      button.style.background = 'linear-gradient(135deg,#ef4444,#dc2626)'
      setTimeout(() => {
        button.innerHTML = orig
        button.style.cssText = origStyle
      }, 1500)
    }
  })
}

function createBtn(data: AddEmojiButtonData) {
  const btn = document.createElement('button')
  btn.className = 'x-emoji-add-btn'
  btn.type = 'button'
  btn.title = '添加到未分组表情'
  btn.innerHTML = '➕'
  // Regular images start hidden and show on hover - improved visibility
  btn.style.cssText = `position:absolute;right:6px;top:6px;z-index:9999;cursor:pointer;border-radius:6px;padding:6px 8px;background:rgba(0,0,0,0.8);color:#fff;border:none;font-weight:700;width:auto;height:auto;min-width:32px;min-height:32px;max-width:48px;max-height:48px;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;opacity:0;transition:opacity 0.2s ease;box-shadow:0 2px 8px rgba(0,0,0,0.3);backdrop-filter:blur(4px);`
  // ensure it can receive pointer events even if parent has odd styles
  btn.style.pointerEvents = 'auto'
  setupButtonClick(btn, data)
  return btn
}

function createOverlayBtn(data: AddEmojiButtonData, target: Element) {
  // If we already created an overlay for this element, return it
  const existing = overlayMap.get(target)
  if (existing) return existing.btn

  const btn = createBtn(data)
  // Base styles for overlayed button appended to body
  btn.style.position = 'absolute'
  btn.style.zIndex = '2147483647' // very large to avoid clipping by site styles
  btn.style.background = 'rgba(0,0,0,0.6)'
  btn.style.pointerEvents = 'auto'
  // ensure body-level pointer handling
  document.body.appendChild(btn)

  let raf = 0
  let isHovered = false

  // Add hover detection for the target element and button
  const showButton = () => {
    isHovered = true
    btn.style.opacity = '1'
  }
  const hideButton = () => {
    isHovered = false
    btn.style.opacity = '0'
  }

  // Keep button visible when hovering over the button itself
  const showButtonOnButtonHover = () => {
    isHovered = true
    btn.style.opacity = '1'
  }
  const hideButtonOnButtonLeave = () => {
    isHovered = false
    btn.style.opacity = '0'
  }

  ;(target as HTMLElement).addEventListener('mouseenter', showButton)
  ;(target as HTMLElement).addEventListener('mouseleave', hideButton)
  btn.addEventListener('mouseenter', showButtonOnButtonHover)
  btn.addEventListener('mouseleave', hideButtonOnButtonLeave)

  const update = () => {
    try {
      if (!document.body.contains(target)) {
        // target removed — cleanup
        cancelAnimationFrame(raf)
        if (btn.parentElement) btn.parentElement.removeChild(btn)
        ;(target as HTMLElement).removeEventListener('mouseenter', showButton)
        ;(target as HTMLElement).removeEventListener('mouseleave', hideButton)
        btn.removeEventListener('mouseenter', showButtonOnButtonHover)
        btn.removeEventListener('mouseleave', hideButtonOnButtonLeave)
        overlayMap.delete(target)
        return
      }

      // Check if we're in lightbox mode and hide button if so
      const isInLightbox =
        document.querySelector('[role="dialog"]') ||
        document.querySelector('.r-1d2f490[style*="position: fixed"]') ||
        document.querySelector('[aria-modal="true"]')

      const r = (target as Element).getBoundingClientRect()
      // place button at top-right inside the target rect with some padding
      const top = Math.max(0, window.scrollY + r.top + 6)
      const left = Math.max(0, window.scrollX + r.right - btn.offsetWidth - 6)
      btn.style.top = top + 'px'
      btn.style.left = left + 'px'

      // hide if offscreen or in lightbox
      const inView =
        r.bottom >= 0 && r.top <= window.innerHeight && r.right >= 0 && r.left <= window.innerWidth
      btn.style.display = inView && !isInLightbox ? '' : 'none'

      // Reset opacity if not hovered and not in lightbox
      if (!isHovered && !isInLightbox) {
        btn.style.opacity = '0'
      }
    } catch {
      // swallow positioning errors
    }
    raf = requestAnimationFrame(update)
    overlayMap.set(target, { btn, raf })
  }

  // start loop
  raf = requestAnimationFrame(update)
  overlayMap.set(target, { btn, raf })
  return btn
}

function addButtonToEl(el: Element) {
  try {
    // 更严格的重复检查 - 检查元素本身和父容器
    if (
      (el as Element).querySelector('.x-emoji-add-btn') ||
      (el as Element).querySelector('.x-emoji-add-btn-carousel') ||
      (el as Element).closest('.x-emoji-add-btn') ||
      (el as Element).closest('.x-emoji-add-btn-carousel')
    )
      return

    // Determine if this is a direct Twitter media host (pbs.twimg.com / *.twimg.com)
    const hostCheck = window.location.hostname.toLowerCase()
    const isMediaHost =
      hostCheck === 'pbs.twimg.com' ||
      hostCheck.endsWith('.twimg.com') ||
      hostCheck.includes('twimg.com') ||
      hostCheck.includes('pbs.twimg')

    // Skip img elements on regular pages — but on media hosts the top-level <img> should be handled
    if (el instanceof HTMLImageElement && !isMediaHost) return

    // Check if we're in a lightbox/modal view (large image display)
    const isInLightbox =
      document.querySelector('[role="dialog"]') ||
      document.querySelector('.r-1d2f490[style*="position: fixed"]') ||
      document.querySelector('[aria-modal="true"]')
    if (isInLightbox) return // Don't add buttons in lightbox mode

    // This is a div or other container element (not img)
    const containedImg = el.querySelector('img') as HTMLImageElement | null
    if (containedImg && containedImg.getAttribute('alt') !== '') {
      return
    }

    const targetContainer = el as HTMLElement
    const url = extractImageUrl(el)

    if (!url) return
    if (url.includes('profile_images')) return
    const name = extractNameFromUrl(url)
    const parent = targetContainer
    const computed = window.getComputedStyle(parent)
    // If parent can clip children (overflow) or has position that might cause stacking issues,
    // render the button as a body-level overlay positioned over the element to avoid being covered.
    const shouldUseOverlay = /hidden|auto|scroll/.test(computed.overflow || '')

    if (computed.position === 'static' || !computed.position) parent.style.position = 'relative'

    if (shouldUseOverlay) {
      createOverlayBtn({ name, url }, parent)
    } else {
      const btn = createBtn({ name, url })
      parent.appendChild(btn)

      // Add hover effect to show/hide button
      const showButton = () => {
        btn.style.opacity = '1'
      }
      const hideButton = () => {
        btn.style.opacity = '0'
      }

      // Keep button visible when hovering over the button itself
      const showButtonOnButtonHover = () => {
        btn.style.opacity = '1'
      }
      const hideButtonOnButtonLeave = () => {
        btn.style.opacity = '0'
      }

      parent.addEventListener('mouseenter', showButton)
      parent.addEventListener('mouseleave', hideButton)
      btn.addEventListener('mouseenter', showButtonOnButtonHover)
      btn.addEventListener('mouseleave', hideButtonOnButtonLeave)

      // Quick runtime check: ensure the button is actually on top and receives pointer events.
      // Use the center of the button's bounding box to test elementFromPoint.
      try {
        const r = btn.getBoundingClientRect()
        const cx = Math.round(r.left + r.width / 2)
        const cy = Math.round(r.top + r.height / 2)
        const topEl = document.elementFromPoint(cx, cy)
        if (topEl !== btn && !btn.contains(topEl)) {
          // Not topmost — replace with overlay so clicks work
          if (btn.parentElement) btn.parentElement.removeChild(btn)
          createOverlayBtn({ name, url }, parent)
        }
      } catch {
        // ignore elementFromPoint errors on cross-origin or other odd pages
      }
    }
  } catch (e) {
    void e
  }
}

function scanAndInject() {
  // Use robust selectors for non-carousel images (background-image containers only)
  // img elements are handled by the carousel module
  const selectors = [
    'div[aria-label="Image"]',
    'article div[style*="background-image"]',
    'div[style*="background-image"]'
  ]

  // If this is a direct Twitter media host, include img elements in the scan
  const hostScan = window.location.hostname.toLowerCase()
  if (
    hostScan === 'pbs.twimg.com' ||
    hostScan.endsWith('.twimg.com') ||
    hostScan.includes('twimg.com') ||
    hostScan.includes('pbs.twimg')
  ) {
    selectors.push('img')
  }

  const set = new Set<Element>()
  selectors.forEach(s => document.querySelectorAll(s).forEach(el => set.add(el)))
  set.forEach(el => addButtonToEl(el))

  // Handle carousel images separately
  scanAndInjectCarousel()

  console.log(`[XOneClick] Processed ${set.size} regular elements`)
}

function observe() {
  let scanTimeout: ReturnType<typeof setTimeout> | null = null
  const obs = new MutationObserver(ms => {
    let changed = false
    ms.forEach(m => {
      if (m.type === 'childList' || m.type === 'attributes') changed = true
    })
    if (changed) {
      // 防止多次快速触发，使用防抖
      if (scanTimeout) clearTimeout(scanTimeout)
      scanTimeout = setTimeout(() => {
        scanAndInject()
        scanTimeout = null
      }, 200) // 增加延迟以减少重复触发
    }
  })
  obs.observe(document.body, { childList: true, subtree: true, attributes: true })
}

export function initX() {
  try {
    if (!isXPage()) {
      console.log('[XOneClick] skipping init: not X/Twitter host')
      return
    }
    setTimeout(scanAndInject, 200)
    observe()
    // video copy feature lives in separate module
    // direct import instead of lazy import to avoid ESM issues
    initVideoCopy()
    console.log('[XOneClick] initialized')
  } catch (e) {
    console.error('[XOneClick] init failed', e)
  }
}
