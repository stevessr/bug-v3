/**
 * Bilibili URL Processor
 * URL处理器 - 处理哔哩哔哩图片URL的规范化和解析
 */

import { CONSTANTS } from '../config'
import { logger } from '../utils'
import type { UrlProcessResult } from '../types'

/**
 * 规范化B站URL - 处理协议、尺寸参数等
 */
export function normalizeBiliUrl(raw: string): string | null {
  if (!raw) return null
  
  try {
    raw = raw.trim()
    
    // srcset may contain multiple entries separated by comma; take first token if so
    if (raw.includes(',')) {
      raw = raw.split(',')[0]
    }
    
    // remove descriptor after whitespace
    raw = raw.split(' ')[0]

    // ensure protocol - 处理//开头的URL
    if (raw.startsWith('//')) {
      raw = 'https:' + raw
    } else if (raw.startsWith('/')) {
      raw = window.location.origin + raw
    }

    // strip size suffix starting with @ (e.g. ...jpg@264w_...avif)
    // 去除@后面的尺寸参数获取原图URL
    const atIndex = raw.indexOf('@')
    if (atIndex !== -1) {
      raw = raw.slice(0, atIndex)
    }

    // basic validation
    if (!/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|avif)$/i.test(raw)) {
      // if extension missing but path ends with jpg before @ it was preserved; otherwise try allow no ext
      if (!/^https?:\/\/.+/.test(raw)) {
        return null
      }
    }

    return raw
  } catch (error) {
    logger.error('URL规范化失败:', error, { raw })
    return null
  }
}

/**
 * 从图片容器中提取图片URL - 改进版本
 */
export function extractImageUrlFromPicture(container: Element): string | null {
  try {
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
      
      // 2. 查找内部的 <img> 元素
      () => {
        const img = container.querySelector('img')
        if (img) {
          return (
            img.getAttribute('src') ||
            img.getAttribute('data-src') ||
            img.getAttribute('data-original') ||
            img.src ||
            null
          )
        }
        return null
      },
      
      // 3. 查找 <source> 元素的 srcset
      () => {
        const sources = container.querySelectorAll('source')
        for (const source of sources) {
          const srcset = source.getAttribute('srcset')
          if (srcset) {
            // Extract first URL from srcset
            const match = srcset.match(/^([^\s,]+)/)
            if (match) return match[1]
          }
        }
        return null
      },
      
      // 4. 查找 data-* 属性
      () => {
        const element = container as HTMLElement
        return (
          element.getAttribute('data-src') ||
          element.getAttribute('data-original') ||
          element.getAttribute('data-lazy') ||
          null
        )
      },
      
      // 5. 查找嵌套的picture元素
      () => {
        const picture = container.querySelector('picture')
        if (picture) {
          return extractImageUrlFromPicture(picture)
        }
        return null
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
          if (normalized) {
            return normalized
          }
        }
      } catch (e) {
        // 忽略单个方法的错误，继续尝试下一个
        continue
      }
    }

    return null
  } catch (error) {
    logger.error('图片URL提取失败:', error)
    return null
  }
}

/**
 * 从URL中提取文件名作为表情名称
 */
export function extractNameFromUrl(url: string): string {
  try {
    const u = new URL(url)
    const filename = u.pathname.split('/').pop() || ''
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')
    const decoded = decodeURIComponent(nameWithoutExt)
    
    // 如果是哈希值或太短，返回默认名称
    if (/^[0-9a-f]{8,}$/i.test(decoded) || decoded.length < 2) {
      return CONSTANTS.DEFAULTS.EMOJI_NAME
    }
    
    return decoded || CONSTANTS.DEFAULTS.EMOJI_NAME
  } catch {
    return CONSTANTS.DEFAULTS.EMOJI_NAME
  }
}

/**
 * 检查是否为有效的图片URL
 */
export function isValidImageUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    const extension = urlObj.pathname.split('.').pop()?.toLowerCase()
    return extension ? CONSTANTS.IMAGE_EXTENSIONS.includes(extension) : false
  } catch {
    return false
  }
}

/**
 * 处理URL的完整流程
 */
export function processUrl(rawUrl: string): UrlProcessResult {
  const originalUrl = rawUrl
  const normalizedUrl = normalizeBiliUrl(rawUrl)
  
  // 生成展示URL（保留尺寸参数用于展示）
  let displayUrl = rawUrl
  if (rawUrl.includes('@') && normalizedUrl) {
    displayUrl = rawUrl // 保持原始URL作为展示URL
  } else {
    displayUrl = normalizedUrl || rawUrl
  }
  
  const isValid = normalizedUrl !== null && isValidImageUrl(normalizedUrl)
  
  return {
    originalUrl,
    normalizedUrl,
    displayUrl,
    isValid
  }
}
