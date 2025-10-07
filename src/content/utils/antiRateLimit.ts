/**
 * 拦截 429 错误并自动触发过盾功能（仅限 linux.do）
 * 
 * 功能说明：
 * 1. 拦截所有 fetch 和 XMLHttpRequest 请求
 * 2. 检测 429 (Too Many Requests) 响应
 * 3. 自动触发 Cloudflare 盾验证
 */

// 标记是否已经在处理 429 错误，避免重复触发
let isHandling429 = false
// 记录最后一次触发时间，避免频繁触发
let lastTriggerTime = 0
// 冷却时间（毫秒）
const COOLDOWN_MS = 30000 // 30 秒

/**
 * 触发 Cloudflare 盾验证
 * 通过创建一个隐藏的 iframe 重新加载当前页面来触发验证
 */
function triggerCloudflareChallenge() {
  const now = Date.now()
  
  // 检查冷却时间
  if (now - lastTriggerTime < COOLDOWN_MS) {
    console.log('[Anti-RateLimit] 冷却中，跳过触发')
    return
  }

  if (isHandling429) {
    console.log('[Anti-RateLimit] 已在处理 429 错误')
    return
  }

  isHandling429 = true
  lastTriggerTime = now

  console.log('[Anti-RateLimit] 检测到 429 错误，准备触发过盾...')

  try {
    // 方案 1: 显示提示并刷新页面（最简单有效）
    const shouldRefresh = confirm(
      '检测到访问频率限制 (429)，是否刷新页面以触发 Cloudflare 验证？'
    )
    
    if (shouldRefresh) {
      console.log('[Anti-RateLimit] 用户确认，刷新页面触发验证')
      window.location.reload()
    } else {
      console.log('[Anti-RateLimit] 用户取消')
      isHandling429 = false
    }
  } catch (error) {
    console.error('[Anti-RateLimit] 触发过盾失败：', error)
    isHandling429 = false
  }
}

/**
 * 拦截 fetch API
 */
function interceptFetch() {
  // Fetch interception has been disabled to avoid global fetch replacement.
  // If you need to re-enable, implement a safe wrapper that does not overwrite window.fetch globally.
  console.log('[Anti-RateLimit] Fetch API 拦截已被禁用（不再替换 window.fetch）')
}

/**
 * 拦截 XMLHttpRequest
 */
function interceptXHR() {
  const originalOpen = XMLHttpRequest.prototype.open
  const originalSend = XMLHttpRequest.prototype.send

  XMLHttpRequest.prototype.open = function (
    _method: string,
    url: string | URL,
    _async?: boolean,
    _username?: string | null,
    _password?: string | null
  ) {
    // 保存 URL 用于日志
    // @ts-ignore
    this._requestURL = url
    return originalOpen.apply(this, arguments as any)
  }

  XMLHttpRequest.prototype.send = function (_body?: Document | XMLHttpRequestBodyInit | null) {
    // 添加状态变化监听
    this.addEventListener('readystatechange', function () {
      if (this.readyState === 4 && this.status === 429) {
        // @ts-ignore
        console.warn('[Anti-RateLimit] XHR 请求返回 429:', this._requestURL)
        triggerCloudflareChallenge()
      }
    })

    return originalSend.apply(this, arguments as any)
  }

  console.log('[Anti-RateLimit] XMLHttpRequest 拦截已启用')
}

/**
 * 初始化 429 错误拦截器（仅限 linux.do）
 */
export function initAntiRateLimit() {
  const hostname = window.location.hostname.toLowerCase()
  
  // 仅在 linux.do 启用
  if (!hostname.includes('linux.do')) {
    console.log('[Anti-RateLimit] 非 linux.do 域名，跳过初始化')
    return
  }

  console.log('[Anti-RateLimit] 初始化 429 错误拦截器 for linux.do')
  
  try {
    interceptFetch()
    interceptXHR()
    console.log('[Anti-RateLimit] ✅ 拦截器启动成功')
  } catch (error) {
    console.error('[Anti-RateLimit] ❌ 拦截器启动失败：', error)
  }
}

/**
 * 手动触发过盾（用于测试或手动调用）
 */
export function manualTriggerChallenge() {
  console.log('[Anti-RateLimit] 手动触发过盾')
  triggerCloudflareChallenge()
}

// 将手动触发函数暴露到 window 对象供调试使用
if (window.location.hostname.includes('linux.do')) {
  try {
    // @ts-ignore
    window.triggerCloudflareChallenge = manualTriggerChallenge
    console.log('[Anti-RateLimit] 已暴露 window.triggerCloudflareChallenge() 用于手动测试')
  } catch (e) {
    console.warn('[Anti-RateLimit] 无法暴露到 window 对象', e)
  }
}

// 导出一个处理来自后台的 429 通知的函数，供 content script 消息处理调用
export function handleBackground429(url?: string) {
  console.log('[Anti-RateLimit] handleBackground429 called for', url)
  triggerCloudflareChallenge()
}
