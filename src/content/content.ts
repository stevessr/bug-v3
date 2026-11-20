/**
 * Content Script Entry Point (优化版)
 * 使用动态加载减少初始体积，按需加载平台特定模块
 */

import { detectPlatform, getDiscourseDomains } from './utils/core/platformDetector'
import type { ContentMessage } from './messageHandlers/types'
import { requestSettingFromBackground } from './utils/core/requestSetting'
import {
  CLOUDFLARE_WALL_BRIDGE_SOURCE,
  publishCloudflareWallEnabled
} from './utils/cloudflareWallSettingsBridge'

const logInfo = (...args: unknown[]) => {
  if (__ENABLE_LOGGING__) console.info('[Emoji Extension]', ...args)
}
const logError = (...args: unknown[]) => console.error('[Emoji Extension]', ...args)

// MAIN-world 过盾脚本无法调用扩展模块；通过同源 window message 将成功提示交给
// 隔离世界，再复用扩展已有的 notify success notice。
const CLOUDFLARE_WALL_NOTICE_SOURCE = CLOUDFLARE_WALL_BRIDGE_SOURCE
window.addEventListener('message', event => {
  if (event.source !== window || event.origin !== window.location.origin) return
  const data = event.data as { source?: unknown; type?: unknown }
  if (data?.source !== CLOUDFLARE_WALL_NOTICE_SOURCE || data.type !== 'challenge-solved') {
    return
  }

  void import('./utils/ui/notify')
    .then(({ notify }) => notify('✅ 验证已通过', 'success'))
    .catch(error => logError('Failed to show challenge success notice:', error))
})

logInfo('Content script bootstrap loaded')

const CONTENT_MESSAGE_TYPES = new Set<ContentMessage['type']>([
  'AGENT_ACTION',
  'AGENT_RECORDING_SET_STATE',
  'DOM_QUERY',
  'GET_CSRF_TOKEN',
  'GET_LINUX_DO_USER',
  'GET_DISCOURSE_SITE_SETTINGS',
  'GET_DISCOURSE_ICON_SPRITE',
  'PAGE_FETCH',
  'PAGE_UPLOAD',
  'FETCH_IMAGE',
  'SETTINGS_UPDATED'
])

let messageDispatcherPromise: Promise<typeof import('./messageHandlers')> | null = null

const loadMessageDispatcher = () => {
  if (!messageDispatcherPromise) {
    messageDispatcherPromise = import('./messageHandlers').catch(error => {
      messageDispatcherPromise = null
      throw error
    })
  }
  return messageDispatcherPromise
}

/**
 * 初始化函数 - 使用动态加载优化
 */
async function initialize(): Promise<void> {
  // 1. 检测平台
  const platformInfo = detectPlatform()
  logInfo(`Platform detected: ${platformInfo.platform} (${platformInfo.hostname})`)

  if (window.location.hostname === 'linux.do') {
    void requestSettingFromBackground('enableLinuxDoAutoChallenge').then(enabled => {
      publishCloudflareWallEnabled(enabled !== false)
    })
  }

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
          window.postTimings = async (
            topicId: number,
            timings: Record<number, number> | number[]
          ) => {
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

// A recording session lives in background storage so it survives navigations.
// Ask the service worker whether this newly loaded document should resume capture,
// and only load workflowRecorder when a recording session is actually active.
if (
  typeof chrome !== 'undefined' &&
  chrome.runtime?.id &&
  typeof chrome.runtime?.sendMessage === 'function'
) {
  void (async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'AGENT_RECORDING_CONTENT_READY' })
      if (response?.success === true && response?.data?.active === true) {
        const { setWorkflowRecordingEnabled } = await import('./agent/workflowRecorder')
        setWorkflowRecordingEnabled(true)
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      if (/Extension context invalidated|Receiving end does not exist/i.test(msg)) {
        logInfo('Recording state check skipped:', msg)
      } else {
        logError('Failed to check workflow recording state:', error)
      }
    }
  })()
}

// Cloudflare 盾自动过盾由独立的主世界内容脚本处理（js/cloudflare-wall-main.js，
// 源码 src/content/cloudflare-wall-main.ts，world: 'MAIN'）。它在页面主世界拦截
// fetch/XHR 响应（仅凭状态码 + content-type 兜底判定，不读取非 CORS 暴露
// 响应头）并自动弹出/收起过盾小窗；
// 隔离世界内容脚本不做网络拦截（拦不到页面自身的请求）。
