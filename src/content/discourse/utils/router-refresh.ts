/**
 * Discourse 路由刷新工具
 * 周期性调用 Discourse 路由刷新以优化用户体验
 */

import { requestSettingFromBackground } from '../../utils/requestSetting'
import { notify } from '../../utils/notify'

// 全局状态
let refreshTimer: ReturnType<typeof setInterval> | null = null
let isRefreshing = false

// 类型声明
declare global {
  interface Window {
    // Content script 无法直接访问 Discourse 对象，移除相关声明以避免误导
  }
}

/**
 * 注入脚本到页面上下文执行
 */
function injectRouterScript(): void {
  const script = document.createElement('script')
  script.src = chrome.runtime.getURL('js/discourse-router.js')
  script.onload = () => script.remove()
  ;(document.head || document.documentElement).appendChild(script)
}

/**
 * 检查 Discourse 路由器是否可用
 * 通过发送消息给注入的脚本来检查
 */
function checkDiscourseRouterAvailability(): Promise<boolean> {
  return new Promise(resolve => {
    const id = Math.random().toString(36).substring(7)
    let resolved = false

    const handler = (event: MessageEvent) => {
      if (
        event.source === window &&
        event.data &&
        event.data.type === 'DISCOURSE_ROUTER_PROBE_RESULT' &&
        event.data.id === id
      ) {
        window.removeEventListener('message', handler)
        if (!resolved) {
          resolved = true
          resolve(event.data.available)
        }
      }
    }

    window.addEventListener('message', handler)

    // 发送探测请求
    window.postMessage({ type: 'DISCOURSE_ROUTER_PROBE_REQUEST', id }, '*')

    // 超时处理
    setTimeout(() => {
      if (!resolved) {
        resolved = true
        window.removeEventListener('message', handler)
        resolve(false)
      }
    }, 500)
  })
}

/**
 * 检查用户是否正在进行输入操作
 * 如果正在输入，则跳过刷新以避免打断用户
 */
function isUserTyping(): boolean {
  const activeElement = document.activeElement
  if (!activeElement) return false

  const tagName = activeElement.tagName.toLowerCase()
  if (tagName === 'input' || tagName === 'textarea') {
    return true
  }

  // 检查 contenteditable 元素
  if (activeElement.getAttribute('contenteditable') === 'true') {
    return true
  }

  // 检查是否在编辑器区域内
  if (activeElement.closest('.d-editor, .composer-fields, .reply-area')) {
    return true
  }

  return false
}

/**
 * 检查是否有打开的模态框或弹窗
 */
function hasOpenModal(): boolean {
  // Discourse 常见的模态框选择器
  const modalSelectors = [
    '.modal.in',
    '.modal.show',
    '.modal-backdrop',
    '.bootbox.modal',
    '.emoji-picker.opened',
    '.user-card.show',
    '.topic-map.--expanded'
  ]

  return modalSelectors.some(selector => document.querySelector(selector) !== null)
}

/**
 * 执行路由刷新
 */
async function performRouterRefresh(): Promise<void> {
  if (isRefreshing) return

  // 检查路由器可用性
  const isAvailable = await checkDiscourseRouterAvailability()
  if (!isAvailable) {
    console.log('[DiscourseRouterRefresh] Discourse router not available, skipping')
    return
  }

  // 跳过刷新的情况
  if (isUserTyping()) {
    console.log('[DiscourseRouterRefresh] User is typing, skipping refresh')
    return
  }

  if (hasOpenModal()) {
    console.log('[DiscourseRouterRefresh] Modal is open, skipping refresh')
    return
  }

  // 检查页面是否可见
  if (document.hidden) {
    console.log('[DiscourseRouterRefresh] Page is hidden, skipping refresh')
    return
  }

  try {
    isRefreshing = true

    // 生成唯一 ID 用于关联消息
    const id = Math.random().toString(36).substring(7)

    // 监听刷新成功消息
    const handler = (event: MessageEvent) => {
      if (
        event.source === window &&
        event.data &&
        event.data.type === 'DISCOURSE_ROUTE_REFRESH_SUCCESS' &&
        event.data.id === id
      ) {
        window.removeEventListener('message', handler)
        const path = event.data.path
        console.log(`[DiscourseRouterRefresh] Refreshed route: ${path}`)
        // 显示轻量提示
        notify('已刷新页面路由', 'info', 2000)
      }
    }

    window.addEventListener('message', handler)

    // 发送刷新请求
    window.postMessage({ type: 'DISCOURSE_ROUTE_REFRESH_REQUEST', id }, '*')

    // 设置超时清理监听器
    setTimeout(() => {
      window.removeEventListener('message', handler)
    }, 5000)
  } catch (e) {
    console.warn('[DiscourseRouterRefresh] Failed to refresh route:', e)
  } finally {
    isRefreshing = false
  }
}

/**
 * 启动周期性路由刷新
 * @param interval 刷新间隔（毫秒）
 */
function startRouterRefresh(interval: number): void {
  if (refreshTimer) {
    console.log('[DiscourseRouterRefresh] Already running, stopping previous timer')
    stopRouterRefresh()
  }

  // 确保间隔至少为 10 秒，避免过于频繁的刷新
  const safeInterval = Math.max(interval, 10000)

  console.log(`[DiscourseRouterRefresh] Starting with interval: ${safeInterval}ms`)

  refreshTimer = setInterval(performRouterRefresh, safeInterval)

  // 监听页面可见性变化，在页面重新可见时执行一次刷新
  document.addEventListener('visibilitychange', handleVisibilityChange)
}

/**
 * 处理页面可见性变化
 */
function handleVisibilityChange(): void {
  if (!document.hidden && refreshTimer) {
    // 页面变为可见时，延迟一小段时间后刷新
    setTimeout(performRouterRefresh, 500)
  }
}

/**
 * 停止周期性路由刷新
 */
function stopRouterRefresh(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
    console.log('[DiscourseRouterRefresh] Stopped')
  }
  document.removeEventListener('visibilitychange', handleVisibilityChange)
}

/**
 * 初始化 Discourse 路由刷新功能
 */
export async function initDiscourseRouterRefresh(): Promise<void> {
  try {
    const enabled = await requestSettingFromBackground('enableDiscourseRouterRefresh')
    if (enabled !== true) {
      console.log('[DiscourseRouterRefresh] Disabled by user setting')
      return
    }

    // 获取刷新间隔配置
    let interval = 30000 // 默认 30 秒
    try {
      const configuredInterval = await requestSettingFromBackground(
        'discourseRouterRefreshInterval'
      )
      if (typeof configuredInterval === 'number' && configuredInterval > 0) {
        interval = configuredInterval
      }
    } catch (e) {
      console.warn('[DiscourseRouterRefresh] Failed to get interval setting, using default:', e)
    }

    // 注入路由器操作脚本
    injectRouterScript()

    // 等待 Discourse 路由器可用
    let attempts = 0
    const maxAttempts = 10
    const checkInterval = 1000

    const waitForRouter = (): Promise<void> => {
      return new Promise(resolve => {
        const check = async () => {
          attempts++
          if (await checkDiscourseRouterAvailability()) {
            resolve()
          } else if (attempts < maxAttempts) {
            setTimeout(check, checkInterval)
          } else {
            console.warn('[DiscourseRouterRefresh] Discourse router not found after max attempts')
            resolve()
          }
        }
        check()
      })
    }

    await waitForRouter()

    if (await checkDiscourseRouterAvailability()) {
      startRouterRefresh(interval)
      console.log('[DiscourseRouterRefresh] Initialized successfully')
    }
  } catch (e) {
    console.error('[DiscourseRouterRefresh] Initialization failed:', e)
  }
}

/**
 * 清理路由刷新功能
 */
export function cleanupDiscourseRouterRefresh(): void {
  stopRouterRefresh()
}
