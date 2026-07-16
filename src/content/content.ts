/**
 * Content Script Entry Point (优化版)
 * 使用动态加载减少初始体积，按需加载平台特定模块
 */

import { detectPlatform, getDiscourseDomains } from './utils/core/platformDetector'

import type { ContentMessage } from './messageHandlers/types'

const logInfo = (...args: unknown[]) => {
  if (__ENABLE_LOGGING__) console.info('[Emoji Extension]', ...args)
}
const logError = (...args: unknown[]) => console.error('[Emoji Extension]', ...args)

logInfo('Content script bootstrap loaded')

const CONTENT_MESSAGE_TYPES = new Set<ContentMessage['type']>([
  'AGENT_ACTION',
  'DOM_QUERY',
  'GET_CSRF_TOKEN',
  'GET_LINUX_DO_USER',
  'PAGE_FETCH',
  'PAGE_UPLOAD',
  'FETCH_IMAGE',
  'SETTINGS_UPDATED'
])

let messageDispatcherPromise: Promise<typeof import('./messageHandlers')> | null = null

const loadMessageDispatcher = () => {
  messageDispatcherPromise ??= import('./messageHandlers')
  return messageDispatcherPromise
}

/**
 * 初始化函数 - 使用动态加载优化
 */
async function initialize(): Promise<void> {
  // 1. 检测平台
  const platformInfo = detectPlatform()
  logInfo(`Platform detected: ${platformInfo.platform} (${platformInfo.hostname})`)

  // 2. Discourse is feature-rich, so none of its picker/storage code is
  // parsed on unrelated pages even though the manifest matches <all_urls>.
  if (platformInfo.platform === 'discourse') {
    logInfo('Initializing emoji feature for Discourse/forum platform')
    try {
      const { initializeEmojiFeature } = await import('./utils/init')
      await initializeEmojiFeature()

      // 仅在确认是 Discourse 域名时才暴露测试辅助工具
      try {
        const domains = getDiscourseDomains()
        if (domains.some(domain => window.location.hostname.includes(domain))) {
          window.postTimings = async (topicId, timings) => {
            const { postTimings } = await import('./discourse/utils/timingsBinder')
            return postTimings(topicId, timings)
          }
          window.autoReadAllRepliesV2 = async () => {
            const { autoReadAllv2 } = await import('./discourse/utils/autoReadReplies')
            return autoReadAllv2()
          }
        }
      } catch (e) {
        console.warn('[Emoji Extension] failed to expose postTimings to window', e)
      }
    } catch (error) {
      logError('Failed to initialize Discourse emoji feature:', error)
    }
  }

  // 3. 动态加载其他平台模块
  if (platformInfo.shouldLoadModule && platformInfo.platform !== 'discourse') {
    try {
      const { loadPlatformModule } = await import('./utils/core/platformLoader')
      await loadPlatformModule(platformInfo.platform)
      logInfo(`Platform module ${platformInfo.platform} loaded successfully`)
    } catch (error) {
      logError(`Failed to load platform module ${platformInfo.platform}:`, error)
    }
  }
}

// 执行初始化
initialize().catch(error => {
  logError('Initialization failed:', error)
})

// Add message listener
if (chrome?.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (
      !message ||
      typeof message !== 'object' ||
      !CONTENT_MESSAGE_TYPES.has((message as ContentMessage).type)
    ) {
      return false
    }

    void loadMessageDispatcher()
      .then(({ dispatchMessage }) => {
        const handled = dispatchMessage(message as ContentMessage, sender, sendResponse)
        if (!handled) {
          sendResponse({ success: false, error: 'Unknown content message type' })
        }
      })
      .catch(error => {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        })
      })

    // The handler module is loaded on first use, so keep the response channel
    // alive across the dynamic import.
    return true
  })
}

// Initialize 429 error interceptor for linux.do
// This will automatically trigger Cloudflare challenge when rate limit is hit
// antiRateLimit functionality removed; no network interception handling in content scripts
