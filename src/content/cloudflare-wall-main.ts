/**
 * linux.do Cloudflare 盾自动过盾（页面主世界版本）
 *
 * 为什么必须在 MAIN world：Discourse 应用自身的 fetch/XHR 发生在页面主世界，
 * 隔离世界（默认 content script）的 window.fetch 补丁拦不到这些请求，也就读不到
 * Cloudflare 触发盾时的特殊响应头 `cf-mitigated: challenge`（官方文档：所有
 * challenge 类型必带该头，content-type 恒为 text/html）。旧的 antiRateLimit
 * 内容脚本拦截方案因此被移除，本文件以 `world: "MAIN"` 内容脚本身份运行。
 *
 * 行为与 scripts/userjs/cloudflare-wall.user.js 保持一致：
 * - 触发盾时右下角默认只显示收起的小窗，iframe 在后台隐藏加载自动过盾
 * - 点击小窗才展开完整 challenge 窗口（再次点击可收起）
 * - 检测到过盾完成（iframe 离开 /challenge）自动关闭并刷新页面
 * - DOM id 带 emoji-ext 前缀，避免与同名用户脚本同时安装时冲突
 */

interface WallConfig {
  challengePath: string
  iframeId: string
  toastId: string
  mitigatedHeader: string
  mitigatedChallengeValue: string
  challengeStatusCodes: number[]
  cfServerKeyword: string
  docChallengeSelector: string
  docChallengeTitles: string[]
  autoTriggerIntervalMs: number
  solvePollIntervalMs: number
  solvePollMaxMs: number
  autoReloadOnSolve: boolean
  pillSize: { width: string; height: string }
  panelSize: { width: string; height: string }
}

const CONFIG: WallConfig = {
  challengePath: '/challenge',
  iframeId: 'emoji-ext-cf-challenge-iframe',
  toastId: 'emoji-ext-cf-challenge-toast',
  // Cloudflare 触发盾时的特殊响应头（'challenge' 是唯一取值）
  mitigatedHeader: 'cf-mitigated',
  mitigatedChallengeValue: 'challenge',
  // 与盾伴生的 HTTP 状态码（Managed/JS Challenge 常见 403/503，限流为 429），
  // 仅用于特殊表头被中间层剥掉时的兜底判定
  challengeStatusCodes: [403, 503, 429],
  // 兜底判定还需同时满足：Cloudflare 代理响应 + HTML 内容
  cfServerKeyword: 'cloudflare',
  // 全页 challenge 的 DOM 特征；不能宽松匹配整个 challenge-platform 路径，
  // 因为 CF 对正常页面也会注入 jsd 探测脚本
  docChallengeSelector: [
    '#challenge-form',
    '#challenge-error-text',
    '#cf-please-wait',
    '#cf-spinner-please-wait',
    'script[src*="/cdn-cgi/challenge-platform/"][src*="orchestrate"]'
  ].join(', '),
  // 全页 challenge 的标题特征（Managed/JS Challenge 均为 "Just a moment..."）
  docChallengeTitles: ['just a moment'],
  // 自动弹窗节流间隔：大量请求同时失败时避免反复弹窗打扰
  autoTriggerIntervalMs: 30 * 1000,
  // 轮询 iframe 内验证是否已通过的间隔与超时
  solvePollIntervalMs: 1000,
  solvePollMaxMs: 5 * 60 * 1000,
  // 验证通过后自动刷新页面，让之前被盾拦掉的请求重新走一遍
  autoReloadOnSolve: true,
  pillSize: { width: '170px', height: '38px' },
  panelSize: { width: '400px', height: '500px' }
}

const log = (...args: unknown[]) => {
  if (__ENABLE_LOGGING__) {
    console.info('[Emoji Extension][CF Wall]', ...args)
  }
}

interface WallState {
  lastAutoTriggerAt: number
  solveTimer: number | null
}

const state: WallState = {
  lastAutoTriggerAt: 0,
  solveTimer: null
}

type HeaderGetter = (name: string) => string | null

interface Window {
  __emojiExtCfWallInstalled?: boolean
  __emojiExtCfFetchHooked?: boolean
}

interface XMLHttpRequest {
  __emojiExtCfXhrHooked?: boolean
  __emojiExtRequestUrl?: string
}

/**
 * 检查顶层文档是否是 Cloudflare 全页 challenge（5 秒盾整页拦截）。
 * 这类页面会自行完成验证并刷新，无需（也不能）再叠一层弹窗
 */
function looksLikeFullPageChallenge(): boolean {
  try {
    const chlOpt = (window as unknown as Record<string, unknown>)._cf_chl_opt
    const cType =
      chlOpt && typeof chlOpt === 'object' && 'cType' in chlOpt ? String(chlOpt.cType ?? '') : ''
    if (cType && cType !== 'jsd') {
      return true
    }

    const title = (document.title || '').toLowerCase()
    if (CONFIG.docChallengeTitles.some(t => title.includes(t))) {
      return true
    }

    return Boolean(document.querySelector(CONFIG.docChallengeSelector))
  } catch (error) {
    log('检测全页 challenge 时出错：', error)
    return false
  }
}

/**
 * 检查顶层文档是否是 Cloudflare 拦截页（1020/WAF block 等，无法通过过盾解决）
 */
function looksLikeCloudflareBlockPage(): boolean {
  try {
    const title = (document.title || '').toLowerCase()
    if (title.includes('attention required')) {
      return true
    }
    return Boolean(document.getElementById('cf-error-details'))
  } catch (error) {
    log('检测拦截页时出错：', error)
    return false
  }
}

/**
 * 按 Cloudflare 真实行为检查单个响应：
 * 1. 官方特征：响应头 cf-mitigated: challenge（所有 challenge 类型必带，content-type 恒为 text/html）
 * 2. 兜底特征：403/503/429 + server: cloudflare + text/html（特殊表头被剥掉时）
 */
function inspectResponse(
  source: string,
  url: string,
  status: number,
  getHeader: HeaderGetter
): void {
  try {
    const mitigated = String(getHeader(CONFIG.mitigatedHeader) || '').toLowerCase()

    if (mitigated === CONFIG.mitigatedChallengeValue) {
      log(`[${source}] 命中特殊表头 cf-mitigated: challenge`, status, url)
      triggerChallengePopup('cf-mitigated-header')
      return
    }

    if (mitigated) {
      // 其他取值（如 WAF 拦截页）无法通过过盾解决，只记录不弹窗
      log(`[${source}] cf-mitigated=${mitigated}，非 challenge，跳过`, status, url)
      return
    }

    const contentType = String(getHeader('content-type') || '').toLowerCase()
    const server = String(getHeader('server') || '').toLowerCase()

    if (
      CONFIG.challengeStatusCodes.includes(status) &&
      server.includes(CONFIG.cfServerKeyword) &&
      contentType.includes('text/html')
    ) {
      log(`[${source}] 疑似 challenge 响应（${status} + ${contentType}）`, url)
      triggerChallengePopup('suspected-html-response')
    }
  } catch (error) {
    log('检查响应头时出错：', error)
  }
}

/**
 * 自动触发小窗（带节流与全页 challenge 保护）
 */
function triggerChallengePopup(reason: string): void {
  // 顶层文档本身就是全页盾时会自行完成验证并刷新，不能再叠一层弹窗
  if (looksLikeFullPageChallenge()) {
    log('当前是 Cloudflare 全页 challenge，跳过弹窗：', reason)
    return
  }

  const now = Date.now()
  if (now - state.lastAutoTriggerAt < CONFIG.autoTriggerIntervalMs) {
    log('自动触发过于频繁，跳过：', reason)
    return
  }

  state.lastAutoTriggerAt = now
  log('触发 Challenge 小窗：', reason)
  showChallengePanel()
}

/**
 * 包装 window.fetch，在响应返回后检查特殊表头
 */
function hookFetch(): void {
  try {
    if (typeof window.fetch !== 'function' || window.__emojiExtCfFetchHooked) {
      return
    }

    const originalFetch = window.fetch.bind(window)
    const patchedFetch = function (this: unknown, input: RequestInfo | URL) {
      const promise = originalFetch.apply(this, arguments as unknown as Parameters<typeof fetch>)
      try {
        promise
          .then(response => {
            const url =
              typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
            inspectResponse('fetch', url, response ? response.status : 0, name => {
              try {
                return response && response.headers ? response.headers.get(name) : null
              } catch {
                return null
              }
            })
          })
          .catch(() => {})
      } catch (error) {
        log('监听 fetch 响应失败：', error)
      }
      return promise
    }

    window.fetch = patchedFetch as typeof window.fetch
    if (window.fetch === (patchedFetch as unknown as typeof window.fetch)) {
      window.__emojiExtCfFetchHooked = true
      log('已挂载 fetch 钩子')
    }
  } catch (error) {
    log('挂载 fetch 钩子失败：', error)
  }
}

/**
 * 包装 XMLHttpRequest，在 loadend 后检查特殊表头
 */
function hookXHR(): void {
  try {
    const proto = window.XMLHttpRequest.prototype
    if (proto.__emojiExtCfXhrHooked) {
      return
    }

    const originalOpen = proto.open
    const originalSend = proto.send

    proto.open = function (this: XMLHttpRequest, _method: string, url: string | URL) {
      try {
        this.__emojiExtRequestUrl = typeof url === 'string' ? url : String(url || '')
      } catch {
        // 记录 URL 失败不影响请求本身
      }
      return originalOpen.apply(this, arguments as never)
    }

    proto.send = function (this: XMLHttpRequest) {
      try {
        const xhr = this
        xhr.addEventListener('loadend', () => {
          inspectResponse('xhr', xhr.__emojiExtRequestUrl || '', xhr.status, name => {
            try {
              return xhr.getResponseHeader(name)
            } catch {
              return null
            }
          })
        })
      } catch (error) {
        log('监听 XHR 响应失败：', error)
      }
      return originalSend.apply(this, arguments as never)
    }

    proto.__emojiExtCfXhrHooked = true
    log('已挂载 XHR 钩子')
  } catch (error) {
    log('挂载 XHR 钩子失败：', error)
  }
}

/**
 * 创建并显示 Challenge 弹窗。
 * 默认收起为右下角小窗（仅标题条），iframe 在后台隐藏加载以便自动过盾；
 * 用户点击小窗时才展开完整 challenge 窗口，检测到过盾完成后自动关闭
 */
function showChallengePanel(): void {
  // 防止在 challenge 页面（linux.do 自己的 /challenge 路径）弹窗
  if (window.location.pathname.startsWith(CONFIG.challengePath)) return

  if (!document.body) return

  // 如果弹窗已存在，不重复创建
  if (document.getElementById(CONFIG.iframeId)) {
    log('Challenge 弹窗已存在')
    return
  }

  log('正在创建 Challenge 弹窗...')

  const redirectUrl = `${CONFIG.challengePath}?redirect=${encodeURIComponent(window.location.href)}`

  // 创建容器
  const container = document.createElement('div')
  container.id = CONFIG.iframeId
  container.title = '点击展开/收起安全验证窗口'
  Object.assign(container.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: '2147483647', // Max Z-Index
    backgroundColor: '#fff',
    boxShadow: '0 0 20px rgba(0,0,0,0.5)',
    borderRadius: '8px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid #ccc',
    transition: 'width 0.2s, height 0.2s'
  })

  // 创建标题栏
  const header = document.createElement('div')
  Object.assign(header.style, {
    padding: '8px 10px',
    backgroundColor: '#f8f9fa',
    borderBottom: '1px solid #eee',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#333',
    whiteSpace: 'nowrap'
  })

  // 标题文本（收起时用短文案）
  const title = document.createElement('span')
  title.innerText = '🛡️ 安全验证'

  // 关闭按钮
  const closeBtn = document.createElement('button')
  closeBtn.innerText = '✕'
  closeBtn.title = '关闭'
  Object.assign(closeBtn.style, {
    border: 'none',
    background: '#ff4d4f',
    color: 'white',
    borderRadius: '4px',
    padding: '2px 8px',
    cursor: 'pointer',
    fontSize: '12px'
  })
  closeBtn.onclick = event => {
    event.stopPropagation()
    container.remove()
    log('用户关闭了弹窗')
  }

  header.appendChild(title)
  header.appendChild(closeBtn)

  // iframe 外层容器：收起时 display:none，iframe 仍在后台加载以自动过盾
  const panelBody = document.createElement('div')
  Object.assign(panelBody.style, {
    display: 'none',
    flex: '1',
    flexDirection: 'column',
    overflow: 'hidden'
  })

  // 创建 Iframe
  const iframe = document.createElement('iframe')
  iframe.src = redirectUrl
  Object.assign(iframe.style, {
    flex: '1',
    width: '100%',
    border: 'none',
    backgroundColor: '#fff'
  })
  panelBody.appendChild(iframe)

  // 组装
  container.appendChild(header)
  container.appendChild(panelBody)
  document.body.appendChild(container)

  // 展开/收起状态
  let expanded = false
  const applyExpanded = () => {
    const size = expanded ? CONFIG.panelSize : CONFIG.pillSize
    Object.assign(container.style, {
      width: size.width,
      height: size.height,
      cursor: expanded ? 'default' : 'pointer'
    })
    title.innerText = expanded ? '🛡️ LINUX.DO 安全验证' : '🛡️ 安全验证'
    panelBody.style.display = expanded ? 'flex' : 'none'
  }

  // 点击标题条切换展开/收起（✕ 关闭除外）
  container.addEventListener('click', event => {
    if (event.target === closeBtn) return
    expanded = !expanded
    applyExpanded()
    log(expanded ? '已展开 Challenge 窗口' : '已收起 Challenge 窗口')
  })

  applyExpanded()

  // 过盾完成后自动关闭：创建即开始监视 iframe 地址（不依赖 load 事件），
  // 收起状态下也能检测到通过；iframe 每次加载完成再确认一次
  watchChallengeSolved(container, iframe)
  iframe.addEventListener('load', () => {
    watchChallengeSolved(container, iframe)
  })

  log(expanded ? 'Challenge 窗口已创建（展开）' : 'Challenge 小窗已创建（收起，点击展开）')
}

/**
 * 轮询 iframe 地址：仍在 /challenge 说明验证未完成；
 * 离开 /challenge（跳回 redirect 目标）说明已通过，收掉弹窗并提示刷新
 */
function watchChallengeSolved(container: HTMLElement, iframe: HTMLIFrameElement): void {
  if (state.solveTimer) {
    // 已有弹窗在监视，避免重复轮询
    return
  }

  const startedAt = Date.now()
  // window. 前缀走 DOM 类型（返回 number），与 WallState.solveTimer 的具体类型一致
  const timer = window.setInterval(() => {
    let solved = false
    let alive = false

    try {
      if (iframe.isConnected && container.isConnected) {
        alive = true
        const path = iframe.contentWindow?.location.pathname || ''
        solved = Boolean(path) && !path.startsWith(CONFIG.challengePath)
      }
    } catch {
      // 读取 iframe 状态失败（尚未导航完成等），继续等待下次轮询
    }

    if (solved) {
      window.clearInterval(timer)
      state.solveTimer = null
      container.remove()
      showToast(CONFIG.autoReloadOnSolve ? '✅ 验证已通过，正在刷新页面…' : '✅ 验证已通过')
      if (CONFIG.autoReloadOnSolve) {
        setTimeout(() => {
          window.location.reload()
        }, 800)
      }
      return
    }

    if (!alive || Date.now() - startedAt > CONFIG.solvePollMaxMs) {
      window.clearInterval(timer)
      state.solveTimer = null
    }
  }, CONFIG.solvePollIntervalMs)

  state.solveTimer = timer
}

/**
 * 显示短暂提示条
 */
function showToast(message: string): void {
  try {
    if (!document.body) return

    const existing = document.getElementById(CONFIG.toastId)
    if (existing) {
      existing.remove()
    }

    const toast = document.createElement('div')
    toast.id = CONFIG.toastId
    toast.innerText = message
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '30px',
      right: '30px',
      zIndex: '2147483647',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: '#fff',
      padding: '10px 16px',
      borderRadius: '6px',
      fontSize: '14px'
    })
    document.body.appendChild(toast)

    setTimeout(() => {
      try {
        toast.remove()
      } catch {
        // 元素已不存在，忽略
      }
    }, 4000)
  } catch (error) {
    log('显示提示失败：', error)
  }
}

/**
 * 初始化脚本（DOM 就绪后执行；网络钩子在 boot 中更早安装）
 */
function initWall(): void {
  log('初始化过盾脚本')

  // challenge 页面（linux.do 自己的 /challenge 路径）自身无需再弹窗
  if (window.location.pathname.startsWith(CONFIG.challengePath)) {
    return
  }

  // 顶层文档本身就是全页盾 / 拦截页时，不再挂 DOM 观察与弹窗逻辑
  if (looksLikeFullPageChallenge()) {
    log('当前是 Cloudflare 全页 challenge，等待页面自行完成验证')
    return
  }
  if (looksLikeCloudflareBlockPage()) {
    log('当前是 Cloudflare 拦截页（无法通过过盾解决）')
    return
  }
}

/**
 * 启动：document_start 下尽早挂载网络钩子（赶在应用发起请求前读取特殊表头）
 */
function bootWall(): void {
  const globalWindow = window as unknown as { __emojiExtCfWallInstalled?: boolean }
  if (globalWindow.__emojiExtCfWallInstalled) {
    return
  }
  globalWindow.__emojiExtCfWallInstalled = true

  hookFetch()
  hookXHR()

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWall)
  } else {
    initWall()
  }
}

bootWall()
