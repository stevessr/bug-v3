import { CONSTANTS } from '../config'
import { logger } from '../utils'

/**
 * 页面检测器 - 检测是否为Pixiv相关页面
 */

// 检测是否为Pixiv主站域名
function isPixivMainDomain(hostname: string): boolean {
  return hostname.includes(CONSTANTS.PIXIV_DOMAINS.MAIN)
}

// 检测是否为Pixiv图片域名
function isPixivImageDomain(hostname: string): boolean {
  return (
    hostname.includes(CONSTANTS.PIXIV_DOMAINS.IMAGE) ||
    hostname.includes(CONSTANTS.PIXIV_DOMAINS.CDN)
  )
}

// 通过meta标签检测Pixiv页面
function detectPixivByMeta(): boolean {
  // 检查og:site_name
  const ogSite =
    document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || ''
  if (ogSite.toLowerCase().includes('pixiv')) return true

  // 检查twitter:site
  const twitterMeta =
    document.querySelector('meta[property="twitter:site"]') ||
    document.querySelector('meta[name="twitter:site"]')
  const twitterSite = (twitterMeta && twitterMeta.getAttribute('content')) || ''
  if (twitterSite.toLowerCase().includes('pixiv')) return true

  // 检查description
  const desc = document.querySelector('meta[name="description"]')?.getAttribute('content') || ''
  if (desc.toLowerCase().includes('pixiv')) return true

  // 检查og:image
  const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || ''
  if (
    ogImage.includes('pixiv.net') ||
    ogImage.includes('pximg.net') ||
    ogImage.includes('embed.pixiv.net')
  ) {
    return true
  }

  return false
}

// 主要的页面检测函数
export function isPixivPage(): boolean {
  try {
    const hostname = window.location.hostname.toLowerCase()

    // 检测图片域名
    if (isPixivImageDomain(hostname)) {
      logger.debug('检测到Pixiv图片域名:', hostname)
      return true
    }

    // 检测主站域名
    if (isPixivMainDomain(hostname)) {
      logger.debug('检测到Pixiv主站:', hostname)
      return true
    }

    // 通过meta标签检测
    if (detectPixivByMeta()) {
      logger.debug('通过meta标签检测到Pixiv页面')
      return true
    }

    return false
  } catch (error) {
    logger.error('页面检测失败', error)
    return false
  }
}

// 检测当前页面类型
export function getPageType(): 'main' | 'image' | 'unknown' {
  const hostname = window.location.hostname.toLowerCase()

  if (isPixivImageDomain(hostname)) {
    return 'image'
  } else if (isPixivMainDomain(hostname)) {
    return 'main'
  }

  return 'unknown'
}
