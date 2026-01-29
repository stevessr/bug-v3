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
import { getDomTree, getDomTreeAtPoint } from './agent/dom'
import { notify } from './utils/notify'

import { createLogger } from '@/utils/logger'

const log = createLogger('ContentScript')

log.info('Content script loaded (entry)')

// 获取 Discourse 域名列表（向后兼容）
const DISCOURSE_DOMAINS = getDiscourseDomains()

function getCsrfTokenFromPage(): string {
  // Try to get CSRF token from meta tag
  const metaToken = DQS('meta[name="csrf-token"]') as HTMLMetaElement
  if (metaToken) {
    return metaToken.content
  }

  // Try to get from cookie
  const match = document.cookie.match(/csrf_token=([^;]+)/)
  if (match) {
    return decodeURIComponent(match[1])
  }

  // Fallback - try to extract from any form
  const hiddenInput = DQS('input[name="authenticity_token"]') as HTMLInputElement
  if (hiddenInput) {
    return hiddenInput.value
  }

  return ''
}

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

    if (message?.type === 'DOM_QUERY') {
      try {
        if (message.kind === 'tree') {
          const data = getDomTree(message.selector, message.options || {})
          sendResponse({ success: true, data })
          return true
        }
        if (message.kind === 'at-point') {
          const data = getDomTreeAtPoint(message.x, message.y, message.options || {})
          sendResponse({ success: true, data })
          return true
        }
        sendResponse({ success: false, error: '未知 DOM 查询类型' })
        return true
      } catch (error: any) {
        sendResponse({ success: false, error: error?.message || 'DOM 查询失败' })
        return true
      }
    }

    if (message?.type === 'GET_CSRF_TOKEN') {
      try {
        sendResponse({ csrfToken: getCsrfTokenFromPage() })
        return true // 表示异步响应
      } catch (error) {
        console.warn('[Emoji Extension] Failed to get CSRF token:', error)
        sendResponse({ csrfToken: '' })
        return true // 表示异步响应
      }
    }

    if (message?.type === 'GET_LINUX_DO_USER') {
      try {
        const preloaded = document.getElementById('data-preloaded') as HTMLElement | null
        if (preloaded?.dataset?.preloaded) {
          const data = JSON.parse(preloaded.dataset.preloaded || '{}')
          if (data.currentUser) {
            const user = JSON.parse(data.currentUser)
            sendResponse({
              success: true,
              user: {
                username: user?.username || '',
                trustLevel: user?.trust_level
              }
            })
            return true
          }
        }
      } catch (error) {
        console.warn('[Emoji Extension] Failed to read current user:', error)
      }
      sendResponse({ success: false, error: 'No current user' })
      return true
    }

    if (message?.type === 'PAGE_FETCH') {
      const opts = message?.options || {}
      const url = opts.url
      if (!url) {
        sendResponse({ success: false, error: 'Missing url' })
        return true
      }

      const responseType = opts.responseType === 'text' ? 'text' : 'json'
      fetch(url, {
        method: opts.method || 'GET',
        headers: opts.headers || {},
        body: opts.body,
        credentials: 'include'
      })
        .then(async res => {
          const data =
            responseType === 'text' ? await res.text() : await res.json().catch(() => null)
          sendResponse({ success: true, status: res.status, ok: res.ok, data })
        })
        .catch((error: any) => {
          sendResponse({ success: false, error: error?.message || 'Page fetch failed' })
        })
      return true
    }

    if (message?.type === 'PAGE_UPLOAD') {
      const opts = message?.options || {}
      const url = opts.url
      if (!url) {
        sendResponse({ success: false, error: 'Missing url' })
        return true
      }

      if (!Array.isArray(opts.fileData) || opts.fileData.length === 0) {
        sendResponse({ success: false, error: 'Missing file data' })
        return true
      }

      try {
        const buffer = new Uint8Array(opts.fileData)
        const blob = new Blob([buffer], { type: opts.mimeType || 'application/octet-stream' })
        const file = new File([blob], opts.fileName || 'image', { type: blob.type })

        const form = new FormData()
        form.append('upload_type', 'composer')
        form.append('relativePath', 'null')
        form.append('name', file.name)
        form.append('type', file.type)
        if (opts.sha1) form.append('sha1_checksum', opts.sha1)
        form.append('file', file, file.name)

        const headers: Record<string, string> = {}
        const csrfToken = getCsrfTokenFromPage()
        if (csrfToken) headers['X-Csrf-Token'] = csrfToken

        fetch(url, {
          method: 'POST',
          headers,
          body: form,
          credentials: 'include'
        })
          .then(async res => {
            const data = await res.json().catch(async () => {
              try {
                return { message: await res.text() }
              } catch {
                return null
              }
            })
            sendResponse({ success: true, status: res.status, ok: res.ok, data })
          })
          .catch((error: any) => {
            sendResponse({ success: false, error: error?.message || 'Page upload failed' })
          })
      } catch (error: any) {
        sendResponse({ success: false, error: error?.message || 'Page upload failed' })
      }

      return true
    }

    // Handle FETCH_IMAGE - fetch image as blob and return as array buffer
    if (message?.type === 'FETCH_IMAGE') {
      const url = message?.url
      if (!url) {
        sendResponse({ success: false, error: 'Missing url' })
        return true
      }

      // 提取文件名用于显示
      let displayName = 'image'
      try {
        const u = new URL(url)
        const pathname = u.pathname
        const name = pathname.split('/').pop()
        if (name) displayName = name.length > 20 ? name.slice(0, 20) + '...' : name
      } catch {
        /* ignore */
      }

      // 显示通知：正在帮助插件获取图片
      notify(`正在获取：${displayName}`, 'info', 2000)

      fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'image/*,*/*'
        }
      })
        .then(async res => {
          if (!res.ok) {
            sendResponse({ success: false, error: `HTTP ${res.status}: ${res.statusText}` })
            return
          }
          const blob = await res.blob()
          const arrayBuffer = await blob.arrayBuffer()
          sendResponse({
            success: true,
            data: Array.from(new Uint8Array(arrayBuffer)),
            mimeType: blob.type,
            size: blob.size
          })
        })
        .catch((error: any) => {
          sendResponse({ success: false, error: error?.message || 'Image fetch failed' })
        })
      return true
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
