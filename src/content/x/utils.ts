// X/Twitter utility functions - inlined implementation

export interface AddEmojiButtonData {
  name: string
  url: string
}

export function isXMainHost(): boolean {
  try {
    const host = window.location.hostname.toLowerCase()
    return host === 'x.com' || host.endsWith('.x.com') || host.includes('twitter.com')
  } catch {
    return false
  }
}

export function isXMediaHost(): boolean {
  try {
    const host = window.location.hostname.toLowerCase()
    return (
      host === 'pbs.twimg.com' ||
      host.endsWith('.twimg.com') ||
      host.includes('twimg.com') ||
      host.includes('pbs.twimg')
    )
  } catch {
    return false
  }
}

export function isXHost(): boolean {
  return isXMainHost() || isXMediaHost()
}

export function normalizeUrl(raw: string): string | null {
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

export function extractImageUrl(el: Element): string | null {
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

export function extractNameFromUrl(url: string): string {
  try {
    const u = new URL(url)
    const filename = u.pathname.split('/').pop() || ''
    return decodeURIComponent(filename.replace(/\.[^/.]+$/, '')) || '表情'
  } catch {
    return '表情'
  }
}

export function setupButtonClick(button: HTMLElement, data: AddEmojiButtonData) {
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
      console.error('[XUtils] 添加失败', err)
      button.innerHTML = '失败'
      button.style.background = 'linear-gradient(135deg,#ef4444,#dc2626)'
      setTimeout(() => {
        button.innerHTML = orig
        button.style.cssText = origStyle
      }, 1500)
    }
  })
}
