declare const chrome: any

interface AddEmojiButtonData {
  name: string
  url: string
}

const overlayMap = new WeakMap<Element, { btn: HTMLElement; raf?: number }>()

function normalizeUrl(raw: string): string | null {
  if (!raw) return null
  raw = raw.trim()
  const urlMatch = raw.match(/url\((?:\s*['"]?)(.*?)(?:['"]?\s*)\)/)
  if (urlMatch) raw = urlMatch[1]
  if (raw.startsWith('//')) raw = 'https:' + raw
  else if (raw.startsWith('/')) raw = window.location.origin + raw
  if (raw.includes(',')) raw = raw.split(',')[0]
  raw = raw.split(' ')[0]
  raw = raw.replace(/:large$|:orig$/i, '')
  if (!/^https?:\/\//i.test(raw)) return null
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

function hasLightbox(): boolean {
  return !!(
    document.querySelector('[role="dialog"]') || document.querySelector('[aria-modal="true"]')
  )
}

function isRectInView(r: DOMRect): boolean {
  return r.bottom >= 0 && r.top <= window.innerHeight && r.right >= 0 && r.left <= window.innerWidth
}

function extractImageUrl(el: Element): string | null {
  const style = (el as HTMLElement).style && (el as HTMLElement).style.backgroundImage
  if (style && style !== 'none') {
    const normalized = normalizeUrl(style)
    if (normalized) return normalized
  }
  const img = el.querySelector('img') as HTMLImageElement | null
  if (img) {
    const src = img.getAttribute('src') || img.getAttribute('data-src') || img.src || ''
    const normalized = normalizeUrl(src)
    if (normalized) return normalized
  }
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
      // swallow errors
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
  btn.style.position = 'absolute'
  btn.style.right = '6px'
  btn.style.top = '6px'
  btn.style.zIndex = '9999'
  btn.style.cursor = 'pointer'
  btn.style.borderRadius = '6px'
  btn.style.padding = '6px 8px'
  btn.style.background = 'rgba(0,0,0,0.8)'
  btn.style.color = '#fff'
  btn.style.border = 'none'
  btn.style.fontWeight = '700'
  btn.style.boxSizing = 'border-box'
  btn.style.opacity = '0'
  btn.style.transition = 'opacity 0.2s ease'
  btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'
  btn.style.backdropFilter = 'blur(4px)'
  btn.style.minWidth = '32px'
  btn.style.minHeight = '32px'
  btn.style.maxWidth = '48px'
  btn.style.maxHeight = '48px'
  btn.style.display = 'inline-flex'
  btn.style.alignItems = 'center'
  btn.style.justifyContent = 'center'
  btn.style.pointerEvents = 'auto'
  setupButtonClick(btn, data)
  return btn
}

export function createOverlayBtn(data: AddEmojiButtonData, target: Element) {
  const existing = overlayMap.get(target)
  if (existing) return existing.btn
  const btn = createBtn(data)
  btn.style.position = 'absolute'
  btn.style.zIndex = '2147483647'
  btn.style.background = 'rgba(0,0,0,0.6)'
  btn.style.pointerEvents = 'auto'
  document.body.appendChild(btn)

  let raf = 0
  let isHovered = false
  const showButton = () => {
    isHovered = true
    btn.style.opacity = '1'
  }
  const hideButton = () => {
    isHovered = false
    btn.style.opacity = '0'
  }
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
        cancelAnimationFrame(raf)
        if (btn.parentElement) btn.parentElement.removeChild(btn)
        ;(target as HTMLElement).removeEventListener('mouseenter', showButton)
        ;(target as HTMLElement).removeEventListener('mouseleave', hideButton)
        btn.removeEventListener('mouseenter', showButtonOnButtonHover)
        btn.removeEventListener('mouseleave', hideButtonOnButtonLeave)
        overlayMap.delete(target)
        return
      }
      const isInLightbox = hasLightbox()

      const r = (target as Element).getBoundingClientRect()
      const top = Math.max(0, window.scrollY + r.top + 6)
      const left = Math.max(0, window.scrollX + r.right - btn.offsetWidth - 6)
      btn.style.top = top + 'px'
      btn.style.left = left + 'px'

      const inView = isRectInView(r)
      btn.style.display = inView && !isInLightbox ? '' : 'none'

      if (!isHovered && !isInLightbox) {
        btn.style.opacity = '0'
      }
    } catch {
      // swallow
    }
    raf = requestAnimationFrame(update)
    overlayMap.set(target, { btn, raf })
  }

  raf = requestAnimationFrame(update)
  overlayMap.set(target, { btn, raf })
  return btn
}

function addButtonToEl(el: Element) {
  try {
    if (
      (el as Element).querySelector('.x-emoji-add-btn') ||
      (el as Element).querySelector('.x-emoji-add-btn-carousel') ||
      (el as Element).closest('.x-emoji-add-btn') ||
      (el as Element).closest('.x-emoji-add-btn-carousel')
    )
      return

    const hostCheck = window.location.hostname.toLowerCase()
    const isMediaHost =
      hostCheck === 'pbs.twimg.com' ||
      hostCheck.endsWith('.twimg.com') ||
      hostCheck.includes('twimg.com') ||
      hostCheck.includes('pbs.twimg')

    if (el instanceof HTMLImageElement && !isMediaHost) return

    const isInLightbox = hasLightbox()
    if (isInLightbox) return

    const containedImg = el.querySelector('img') as HTMLImageElement | null
    if (containedImg && containedImg.getAttribute('alt') !== '') return

    const targetContainer = el as HTMLElement
    const url = extractImageUrl(el)

    if (!url) return
    if (url.includes('profile_images')) return
    const name = extractNameFromUrl(url)
    const parent = targetContainer
    const computed = window.getComputedStyle(parent)
    const shouldUseOverlay = /hidden|auto|scroll/.test(computed.overflow || '')

    if (computed.position === 'static' || !computed.position) parent.style.position = 'relative'

    if (shouldUseOverlay) {
      createOverlayBtn({ name, url }, parent)
    } else {
      const btn = createBtn({ name, url })
      parent.appendChild(btn)

      const showButton = () => {
        btn.style.opacity = '1'
      }
      const hideButton = () => {
        btn.style.opacity = '0'
      }

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

      try {
        const r = btn.getBoundingClientRect()
        const cx = Math.round(r.left + r.width / 2)
        const cy = Math.round(r.top + r.height / 2)
        const topEl = document.elementFromPoint(cx, cy)
        if (topEl !== btn && !btn.contains(topEl)) {
          if (btn.parentElement) btn.parentElement.removeChild(btn)
          createOverlayBtn({ name, url }, parent)
        }
      } catch {
        // ignore
      }
    }
  } catch (e) {
    void e
  }
}

export function scanAndInject() {
  const selectors = [
    'div[aria-label="Image"]',
    'article div[style*="background-image"]',
    'div[style*="background-image"]'
  ]

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

  // carousel images handled by carousel module
}

export function initImages() {
  try {
    setTimeout(scanAndInject, 200)
    observe()
  } catch (e) {
    // noop
  }
}

function observe() {
  let scanTimeout: ReturnType<typeof setTimeout> | null = null
  const obs = new MutationObserver(ms => {
    let changed = false
    ms.forEach(m => {
      if (m.type === 'childList' || m.type === 'attributes') changed = true
    })
    if (changed) {
      if (scanTimeout) clearTimeout(scanTimeout)
      scanTimeout = setTimeout(() => {
        scanAndInject()
        scanTimeout = null
      }, 200)
    }
  })
  obs.observe(document.body, { childList: true, subtree: true, attributes: true })
}

export default null
