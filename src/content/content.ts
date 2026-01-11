/**
 * Content Script Entry Point (优化版)
 * 使用动态加载减少初始体积，按需加载平台特定模块
 */

import { initializeEmojiFeature } from './utils/init'
import { postTimings } from './utils/timingsBinder'
import { autoReadAllv2 } from './utils/autoReadReplies'
import { DQS } from './utils/createEl'
import {
  detectPlatform,
  shouldInjectEmojiFeature,
  getDiscourseDomains
} from './utils/platformDetector'
import { loadPlatformModule } from './utils/platformLoader'
import { handleAgentAction } from './agent/actions'

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

// Add message listener for linux.do CSRF token requests
if (chrome?.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'AGENT_ACTION') {
      handleAgentAction(message.action)
        .then(result => sendResponse({ success: true, data: result }))
        .catch((error: any) =>
          sendResponse({ success: false, error: error?.message || '动作执行失败' })
        )
      return true
    }

    if (message?.type === 'GET_CSRF_TOKEN') {
      try {
        // Try to get CSRF token from meta tag
        const metaToken = DQS('meta[name="csrf-token"]') as HTMLMetaElement
        if (metaToken) {
          sendResponse({ csrfToken: metaToken.content })
          return true // 表示异步响应
        }

        // Try to get from cookie
        const match = document.cookie.match(/csrf_token=([^;]+)/)
        if (match) {
          sendResponse({ csrfToken: decodeURIComponent(match[1]) })
          return true // 表示异步响应
        }

        // Fallback - try to extract from any form
        const hiddenInput = DQS('input[name="authenticity_token"]') as HTMLInputElement
        if (hiddenInput) {
          sendResponse({ csrfToken: hiddenInput.value })
          return true // 表示异步响应
        }

        sendResponse({ csrfToken: '' })
        return true // 表示异步响应
      } catch (error) {
        console.warn('[Emoji Extension] Failed to get CSRF token:', error)
        sendResponse({ csrfToken: '' })
        return true // 表示异步响应
      }
    }

    return false // 对于其他消息类型，不处理
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
