/**
 * Discourse 路由刷新工具
 * 周期性调用 Discourse 路由刷新以优化用户体验
 */

import { DHA, createE } from '../../utils/dom/createEl'
import { requestSettingFromBackground } from '../../utils/core/requestSetting'
import { notify } from '../../utils/ui/notify'

// 全局状态
let refreshTimer: ReturnType<typeof setTimeout> | null = null
let isRefreshing = false
let lastPath: string = '' // 记录上次的路径
let currentInterval: number = 30000 // 当前刷新间隔
let isRunning = false // 是否正在运行

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
  const script = createE('script', {
    src: chrome.runtime.getURL('js/discourse-router.js')
  }) as HTMLScriptElement
  script.onload = () => script.remove()
  DHA(script)
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
 * 安排下一次刷新
 * 在页面加载完成后调用此函数开始新的倒计时
 */
function scheduleNextRefresh(): void {
  if (!isRunning) return

  if (refreshTimer) {
    clearTimeout(refreshTimer)
  }

  refreshTimer = setTimeout(performRouterRefresh, currentInterval)
  console.log(`[DiscourseRouterRefresh] Next refresh scheduled in ${currentInterval}ms`)
}

/**
 * 重置刷新计时器
 * 当路径变化时调用，重新开始计时
 */
function resetRefreshTimer(): void {
  if (isRunning) {
    scheduleNextRefresh()
    console.log('[DiscourseRouterRefresh] Timer reset due to path change')
  }
}

/**
 * 检查路径是否变化，如果变化则重置计时器
 * @returns 如果路径变化返回 true
 */
function checkPathChange(): boolean {
  const currentPath = window.location.pathname
  if (lastPath && lastPath !== currentPath) {
    console.log(`[DiscourseRouterRefresh] Path changed: ${lastPath} -> ${currentPath}`)
    lastPath = currentPath
    resetRefreshTimer()
    return true
  }
  lastPath = currentPath
  return false
}

/**
 * 等待页面加载完成
 * 检测 Discourse 页面的加载状态
 */
function waitForPageLoad(): Promise<void> {
  return new Promise(resolve => {
    // 检查是否有加载指示器
    const checkLoading = () => {
      const loadingIndicators = [
        '.loading-indicator',
        '.spinner',
        '.d-spinner',
        '#main-outlet.loading',
        '.topic-loading'
      ]

      const isLoading = loadingIndicators.some(
        selector => document.querySelector(selector) !== null
      )

      if (!isLoading) {
        resolve()
      } else {
        setTimeout(checkLoading, 100)
      }
    }

    // 延迟一小段时间让刷新开始
    setTimeout(checkLoading, 200)

    // 最长等待 5 秒
    setTimeout(resolve, 5000)
  })
}

/**
 * 执行路由刷新
 */
async function performRouterRefresh(): Promise<void> {
  if (isRefreshing) return

  // 检查路径是否变化，如果变化则跳过本次刷新（已重置计时器）
  if (checkPathChange()) {
    return
  }

  // 检查路由器可用性
  const isAvailable = await checkDiscourseRouterAvailability()
  if (!isAvailable) {
    console.log('[DiscourseRouterRefresh] Discourse router not available, skipping')
    scheduleNextRefresh()
    return
  }

  // 跳过刷新的情况
  if (isUserTyping()) {
    console.log('[DiscourseRouterRefresh] User is typing, skipping refresh')
    scheduleNextRefresh()
    return
  }

  if (hasOpenModal()) {
    console.log('[DiscourseRouterRefresh] Modal is open, skipping refresh')
    scheduleNextRefresh()
    return
  }

  // 检查页面是否可见
  if (document.hidden) {
    console.log('[DiscourseRouterRefresh] Page is hidden, skipping refresh')
    scheduleNextRefresh()
    return
  }

  try {
    isRefreshing = true

    // 生成唯一 ID 用于关联消息
    const id = Math.random().toString(36).substring(7)

    // 使用 Promise 等待刷新完成
    const refreshComplete = new Promise<boolean>(resolve => {
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
          notify('已刷新页面路由', 'info', 2000)
          resolve(true)
        }
      }

      window.addEventListener('message', handler)

      // 超时处理
      setTimeout(() => {
        window.removeEventListener('message', handler)
        resolve(false)
      }, 5000)
    })

    // 发送刷新请求
    window.postMessage({ type: 'DISCOURSE_ROUTE_REFRESH_REQUEST', id }, '*')

    // 等待刷新完成
    const success = await refreshComplete

    if (success) {
      // 等待页面加载完成后再安排下一次刷新
      await waitForPageLoad()
      console.log('[DiscourseRouterRefresh] Page load complete, scheduling next refresh')
    }
  } catch (e) {
    console.warn('[DiscourseRouterRefresh] Failed to refresh route:', e)
  } finally {
    isRefreshing = false
    // 安排下一次刷新
    scheduleNextRefresh()
  }
}

/**
 * 启动周期性路由刷新
 * @param interval 刷新间隔（毫秒）
 */
function startRouterRefresh(interval: number): void {
  if (isRunning) {
    console.log('[DiscourseRouterRefresh] Already running, stopping previous timer')
    stopRouterRefresh()
  }

  // 确保间隔至少为 10 秒，避免过于频繁的刷新
  const safeInterval = Math.max(interval, 10000)
  currentInterval = safeInterval // 保存当前间隔

  // 初始化路径记录
  lastPath = window.location.pathname
  isRunning = true

  console.log(`[DiscourseRouterRefresh] Starting with interval: ${safeInterval}ms`)

  // 安排第一次刷新
  scheduleNextRefresh()

  // 监听页面可见性变化，在页面重新可见时执行一次刷新
  document.addEventListener('visibilitychange', handleVisibilityChange)
}

/**
 * 处理页面可见性变化
 */
function handleVisibilityChange(): void {
  if (!document.hidden && isRunning) {
    // 页面变为可见时，重置计时器
    scheduleNextRefresh()
  }
}

/**
 * 停止周期性路由刷新
 */
function stopRouterRefresh(): void {
  isRunning = false
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
    console.log('[DiscourseRouterRefresh] Stopped')
  }
  lastPath = '' // 清理路径记录
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
