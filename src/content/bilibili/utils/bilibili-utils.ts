/**
 * Bilibili相关的工具函数
 */

export interface AddEmojiButtonData {
  name: string
  url: string
}

/**
 * 检查是否为Bilibili Opus页面
 */
export function isBilibiliOpusPage(): boolean {
  try {
    const host = window.location.hostname.toLowerCase()
    if (!host.includes('bilibili.com')) return false
    const path = window.location.pathname
    // match /opus/<digits>
    return /^\/opus\/\d+(?:\/.*)?$/.test(path)
  } catch (e) {
    void e
    return false
  }
}

/**
 * 规范化B站URL
 */
export function normalizeBiliUrl(raw: string): string | null {
  if (!raw) return null
  raw = raw.trim()
  // srcset may contain multiple entries separated by comma; take first token if so
  if (raw.includes(',')) raw = raw.split(',')[0]
  // remove descriptor after whitespace
  raw = raw.split(' ')[0]

  // ensure protocol
  if (raw.startsWith('//')) raw = 'https:' + raw
  else if (raw.startsWith('/')) raw = window.location.origin + raw

  // strip size suffix starting with @ (e.g. ...jpg@264w_...avif)
  const atIndex = raw.indexOf('@')
  if (atIndex !== -1) raw = raw.slice(0, atIndex)

  // basic validation
  if (!/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|avif)$/i.test(raw)) {
    // if extension missing but path ends with jpg before @ it was preserved; otherwise try allow no ext
    if (!/^https?:\/\/.+/.test(raw)) return null
  }

  return raw
}

/**
 * 从图片容器中提取图片URL
 */
export function extractImageUrlFromPicture(container: Element): string | null {
  // If the container itself is an <img>, use it directly
  if (container instanceof HTMLImageElement) {
    const src =
      container.getAttribute('src') || container.getAttribute('data-src') || container.src || ''
    const normalized = normalizeBiliUrl(src)
    if (normalized) return normalized
  }

  // If it's a <picture>, prefer <img> inside or <source>
  if (container instanceof HTMLPictureElement) {
    const img = container.querySelector('img') as HTMLImageElement | null
    if (img) {
      const src = img.getAttribute('src') || img.getAttribute('data-src') || img.src || ''
      const normalized = normalizeBiliUrl(src)
      if (normalized) return normalized
    }
    const source = container.querySelector(
      'source[srcset], source[src]'
    ) as HTMLSourceElement | null
    if (source) {
      const srcset = source.getAttribute('srcset') || source.getAttribute('src') || ''
      const normalized = normalizeBiliUrl(srcset)
      if (normalized) return normalized
    }
  }

  // Generic container: look for img or source inside
  const innerImg = container.querySelector('img') as HTMLImageElement | null
  if (innerImg) {
    const src =
      innerImg.getAttribute('src') || innerImg.getAttribute('data-src') || innerImg.src || ''
    const normalized = normalizeBiliUrl(src)
    if (normalized) return normalized
  }

  const innerSource = container.querySelector(
    'source[srcset], source[src]'
  ) as HTMLSourceElement | null
  if (innerSource) {
    const srcset = innerSource.getAttribute('srcset') || innerSource.getAttribute('src') || ''
    const normalized = normalizeBiliUrl(srcset)
    if (normalized) return normalized
  }

  // try data attributes on container itself
  const dataSrc = (container as HTMLElement).getAttribute('data-src')
  if (dataSrc) return normalizeBiliUrl(dataSrc)

  return null
}

/**
 * 从URL中提取文件名作为表情名称
 */
export function extractNameFromUrl(url: string): string {
  try {
    const u = new URL(url)
    const filename = u.pathname.split('/').pop() || ''
    return decodeURIComponent(filename.replace(/\.[^/.]+$/, '')) || '表情'
  } catch {
    return '表情'
  }
}
