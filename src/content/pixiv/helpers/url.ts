import { CONSTANTS } from '../config'

/**
 * URL处理相关工具函数
 */

// 从URL中提取文件名作为表情名称
export function extractNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const filename = pathname.split('/').pop() || ''

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

// 检查是否为有效的图片URL
export function isValidImageUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    const extension = urlObj.pathname.split('.').pop()?.toLowerCase()
    return extension ? CONSTANTS.IMAGE_EXTENSIONS.includes(extension) : false
  } catch {
    return false
  }
}

// 标准化Pixiv图片URL
export function normalizePixivImageUrl(url: string): string {
  try {
    // 确保使用HTTPS
    const normalizedUrl = url.replace(/^http:/, 'https:')

    // 替换为原始图片URL（如果是缩略图）
    return normalizedUrl
      .replace(/\/c\/[^/]+\//, '/img-original/')
      .replace(/\/custom-thumb\/[^/]+\//, '/img-original/')
      .replace(/_square\.|_master\./, '.')
  } catch {
    return url
  }
}

// 清理文件名，移除不安全字符
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .trim()
}
