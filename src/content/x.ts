import { logger, chromeAPIWrapper } from '../config/buildFlags'

interface AddEmojiButtonData {
  name: string
  url: string
}

function isXPage(): boolean {
  try {
    const host = window.location.hostname.toLowerCase()
    return host === 'x.com' || host.endsWith('.twitter.com') || host.includes('twitter.com')
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
      if (chromeAPIWrapper.shouldSkip()) {
        // In userscript environment, just show success
        button.innerHTML = '已添加'
        button.style.background = 'linear-gradient(135deg,#10b981,#059669)'
        setTimeout(() => {
          button.innerHTML = orig
          button.style.cssText = origStyle
        }, 1500)
        return
      }
      
      await chromeAPIWrapper.sendMessage({ action: 'addEmojiFromWeb', emojiData: data })
      button.innerHTML = '已添加'
      button.style.background = 'linear-gradient(135deg,#10b981,#059669)'
      setTimeout(() => {
        button.innerHTML = orig
        button.style.cssText = origStyle
      }, 1500)
    } catch (err) {
      logger.error('[XOneClick] 添加失败', err)
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
  btn.style.cssText =
    'position:absolute;right:6px;top:6px;z-index:9999;cursor:pointer;border-radius:6px;padding:6px 8px;background:rgba(0,0,0,0.6);color:#fff;border:none;font-weight:700;'
  setupButtonClick(btn, data)
  return btn
}

function addButtonToEl(el: Element) {
  try {
    if ((el as Element).querySelector('.x-emoji-add-btn')) return
    const url = extractImageUrl(el)
    if (!url) return
    const name = extractNameFromUrl(url)
    const parent = el as HTMLElement
    const computed = window.getComputedStyle(parent)
    if (computed.position === 'static' || !computed.position) parent.style.position = 'relative'
    const btn = createBtn({ name, url })
    parent.appendChild(btn)
  } catch (e) {
    void e
  }
}

function scanAndInject() {
  // Use robust selectors (avoid brittle auto-generated class names).
  // We'll scan for elements that likely contain images: explicit aria-label, any element with inline background-image,
  // and generic img elements (we'll filter by host in extractImageUrl to avoid false positives).
  const selectors = [
    'div[aria-label="Image"]',
    'article div[style*="background-image"]',
    'div[style*="background-image"]',
    'img'
  ]

  const set = new Set<Element>()
  selectors.forEach(s => document.querySelectorAll(s).forEach(el => set.add(el)))
  set.forEach(el => addButtonToEl(el))

  // no batch/gallery handling for X pages — only per-image buttons
}

function observe() {
  const obs = new MutationObserver(ms => {
    let changed = false
    ms.forEach(m => {
      if (m.type === 'childList' || m.type === 'attributes') changed = true
    })
    if (changed) setTimeout(scanAndInject, 120)
  })
  obs.observe(document.body, { childList: true, subtree: true, attributes: true })
}

export function initX() {
  try {
    if (!isXPage()) {
      logger.log('[XOneClick] skipping init: not X/Twitter host')
      return
    }
    setTimeout(scanAndInject, 200)
    observe()
    logger.log('[XOneClick] initialized')
  } catch (e) {
    logger.error('[XOneClick] init failed', e)
  }
}
