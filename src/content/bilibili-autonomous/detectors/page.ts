/**
 * Bilibili Page Detector
 * 页面检测器 - 检测是否为哔哩哔哩相关页面
 */

import { CONSTANTS } from '../config'
import { logger } from '../utils'
import type { PageDetectionResult } from '../types'

// 检测是否为哔哩哔哩主站域名
function isBilibiliMainDomain(hostname: string): boolean {
  return hostname.includes(CONSTANTS.BILIBILI_DOMAINS.MAIN)
}

// 检测是否为哔哩哔哩图片域名
function isBilibiliImageDomain(hostname: string): boolean {
  return hostname.includes(CONSTANTS.BILIBILI_DOMAINS.IMAGE)
}

// 检测是否为哔哩哔哩相关域名
export function isBilibiliDomain(hostname?: string): boolean {
  try {
    const host = hostname || window.location.hostname.toLowerCase()
    return isBilibiliMainDomain(host) || isBilibiliImageDomain(host)
  } catch (error) {
    logger.error('域名检测失败:', error)
    return false
  }
}

// 检测是否为Opus页面
export function isBilibiliOpusPage(): boolean {
  try {
    const hostname = window.location.hostname.toLowerCase()
    if (!hostname.includes('bilibili') && !hostname.includes('hdslb.com')) {
      return false
    }

    // Check for opus page patterns
    const pathname = window.location.pathname.toLowerCase()
    return (
      pathname.includes('/opus/') ||
      pathname.includes('/dynamic/') ||
      document.querySelector('.bili-dyn-item') !== null ||
      document.querySelector('.opus-detail') !== null
    )
  } catch (error) {
    logger.error('Opus页面检测失败:', error)
    return false
  }
}

// 检测页面类型
export function detectPageType(): 'opus' | 'dynamic' | 'unknown' {
  try {
    const pathname = window.location.pathname.toLowerCase()
    
    if (pathname.includes('/opus/')) {
      return 'opus'
    }
    
    if (pathname.includes('/dynamic/')) {
      return 'dynamic'
    }
    
    // 通过DOM元素检测
    if (document.querySelector('.opus-detail')) {
      return 'opus'
    }
    
    if (document.querySelector('.bili-dyn-item')) {
      return 'dynamic'
    }
    
    return 'unknown'
  } catch (error) {
    logger.error('页面类型检测失败:', error)
    return 'unknown'
  }
}

// 综合页面检测
export function detectPage(): PageDetectionResult {
  const isBilibiliPage = isBilibiliDomain()
  const isOpusPage = isBilibiliOpusPage()
  const pageType = detectPageType()
  
  const result: PageDetectionResult = {
    isBilibiliPage,
    isOpusPage,
    pageType
  }
  
  logger.debug('页面检测结果:', result)
  return result
}

// 检查是否应该在当前页面运行
export function shouldRunOnCurrentPage(): boolean {
  const detection = detectPage()
  return detection.isBilibiliPage && (detection.isOpusPage || detection.pageType !== 'unknown')
}
