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
    // match /opus/<digits> anywhere in the path (covers /opus/... and variants)
    return /\/opus\/\d+/.test(path)
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
 * 从图片容器中提取图片URL - 改进版本
 */
export function extractImageUrlFromPicture(container: Element): string | null {
  // 尝试多种方式获取图片URL
  const urlSources: (() => string | null)[] = [
    // 1. 如果容器本身是 <img>
    () => {
      if (container instanceof HTMLImageElement) {
        return (
          container.getAttribute('src') ||
          container.getAttribute('data-src') ||
          container.getAttribute('data-original') ||
          container.src ||
          null
        )
      }
      return null
    },

    // 2. 如果是 <picture> 元素
    () => {
      if (container instanceof HTMLPictureElement) {
        const img = container.querySelector('img') as HTMLImageElement | null
        if (img) {
          return (
            img.getAttribute('src') ||
            img.getAttribute('data-src') ||
            img.getAttribute('data-original') ||
            img.src ||
            null
          )
        }

        const source = container.querySelector(
          'source[srcset], source[src]'
        ) as HTMLSourceElement | null
        if (source) {
          return source.getAttribute('srcset') || source.getAttribute('src') || null
        }
      }
      return null
    },

    // 3. 查找容器内的 img 元素
    () => {
      const innerImg = container.querySelector('img') as HTMLImageElement | null
      if (innerImg) {
        return (
          innerImg.getAttribute('src') ||
          innerImg.getAttribute('data-src') ||
          innerImg.getAttribute('data-original') ||
          innerImg.src ||
          null
        )
      }
      return null
    },

    // 4. 查找容器内的 source 元素
    () => {
      const innerSource = container.querySelector(
        'source[srcset], source[src]'
      ) as HTMLSourceElement | null
      if (innerSource) {
        return innerSource.getAttribute('srcset') || innerSource.getAttribute('src') || null
      }
      return null
    },

    // 5. 检查容器的 data 属性
    () => {
      const element = container as HTMLElement
      return (
        element.getAttribute('data-src') ||
        element.getAttribute('data-original') ||
        element.getAttribute('data-url') ||
        null
      )
    },

    // 6. 检查背景图片样式
    () => {
      const element = container as HTMLElement
      const style = element.style.backgroundImage || getComputedStyle(element).backgroundImage
      if (style && style !== 'none') {
        const match = style.match(/url\(['"]?([^'"]+)['"]?\)/)
        return match ? match[1] : null
      }
      return null
    }
  ]

  // 尝试每种方法，返回第一个有效的URL
  for (const getUrl of urlSources) {
    try {
      const rawUrl = getUrl()
      if (rawUrl) {
        const normalized = normalizeBiliUrl(rawUrl)
        if (normalized) return normalized
      }
    } catch {
      // 忽略单个方法的错误，继续尝试下一个
      continue
    }
  }

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
