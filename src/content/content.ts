/**
 * Content Script Entry Point (优化版)
 * 使用动态加载减少初始体积，按需加载平台特定模块
 */

import { initializeEmojiFeature } from './utils/init'
import { postTimings } from './utils/timingsBinder'
import { autoReadAllv2 } from './utils/autoReadReplies'
import {
  detectPlatform,
  shouldInjectEmojiFeature,
  getDiscourseDomains
} from './utils/platformDetector'
import { loadPlatformModule } from './utils/platformLoader'
import { dispatchMessage } from './messageHandlers'

import { createLogger } from '@/utils/logger'

const log = createLogger('ContentScript')

log.info('Content script loaded (entry)')

// 获取 Discourse 域名列表（向后兼容）
const DISCOURSE_DOMAINS = getDiscourseDomains()

/**
 * 初始化函数 - 使用动态加载优化
 */
async function initialize(): Promise<void> {
  // 1. 检测平台
  const platformInfo = detectPlatform()
  log.info(`Platform detected: ${platformInfo.platform} (${platformInfo.hostname})`)

  // 2. 处理 Discourse 平台（最常用，保留静态加载）
  if (shouldInjectEmojiFeature()) {
    log.info('Initializing emoji feature for Discourse/forum platform')
    initializeEmojiFeature()
  }

  // 3. 动态加载其他平台模块
  if (platformInfo.shouldLoadModule && platformInfo.platform !== 'discourse') {
    try {
      await loadPlatformModule(platformInfo.platform)
      log.info(`Platform module ${platformInfo.platform} loaded successfully`)
    } catch (error) {
      log.error(`Failed to load platform module ${platformInfo.platform}:`, error)
    }
  }
}

// 执行初始化
initialize().catch(error => {
  log.error('Initialization failed:', error)
})

// Add message listener
if (chrome?.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    return dispatchMessage(message, sender, sendResponse)
  })
}

// Expose postTimings helper to page context for testing and manual triggers.
// We attach it to window only on linux.do pages to avoid polluting other sites.
try {
  if (DISCOURSE_DOMAINS.some(domain => window.location.hostname.includes(domain))) {
    // Directly bind the statically imported postTimings
    window.postTimings = postTimings
    // expose autoReadAllv2 for page scripts
    window.autoReadAllRepliesV2 = autoReadAllv2
  }
} catch (e) {
  console.warn('[Emoji Extension] failed to expose postTimings to window', e)
}

// Initialize 429 error interceptor for linux.do
// This will automatically trigger Cloudflare challenge when rate limit is hit
// antiRateLimit functionality removed; no network interception handling in content scripts
