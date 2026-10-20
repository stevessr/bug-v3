// ==UserScript==
// @name                 LINUX.DO CloudFlare Challenge Bypass (Iframe Mode)
// @name:zh-CN           LINUX.DO CloudFlare 5 秒盾自动弹窗
// @namespace            https://github.com/utags
// @homepageURL          https://github.com/utags/userscripts#readme
// @supportURL           https://github.com/utags/userscripts/issues
// @version              0.4.1
// @description          Detect Cloudflare challenges the way Cloudflare actually issues them: every challenge response carries the special cf-mitigated: challenge header (content-type is always text/html). Fetch/XHR hooks surface it instantly, a collapsed mini-bar appears (the challenge iframe loads hidden in the background), clicking the bar reveals the challenge window, and everything auto-closes once the check is passed
// @description:zh-CN    按 Cloudflare 真实行为识别 5 秒盾：触发盾的响应必带特殊表头 cf-mitigated: challenge（content-type 恒为 text/html）。通过 fetch/XHR 钩子实时识别后，右下角默认只显示收起的小窗（iframe 在后台隐藏加载自动过盾），点击小窗才展开 challenge 窗口，检测到过盾完成后自动关闭并刷新页面
// @author               Pipecraft (Modified by User)
// @license              MIT
// @match                https://linux.do/*
// @run-at               document-start
// @icon                 https://wsrv.nl/?w=64&h=64&url=https%3A%2F%2Ft3.gstatic.com%2FfaviconV2%3Fclient%3DSOCIAL%26type%3DFAVICON%26fallback_opts%3DTYPE%2CSIZE%2CURL%26url%3Dhttps%3A%2F%2Flinux.do%26size%3D64
// @grant                GM_registerMenuCommand
// @grant                GM_addStyle
// ==/UserScript==

;(function () {
  'use strict'

  // 配置常量
  const CONFIG = {
    // 需要检测的错误文本
    ERROR_TEXTS: [
      '403 error',
      '该回应是很久以前创建的',
      'reaction was created too long ago',
      '我们无法加载该话题'
    ],
    // 要查找的元素选择器
    DIALOG_SELECTOR: '.dialog-body',
    // 重定向路径
    CHALLENGE_PATH: '/challenge',
    // 调试模式
    DEBUG: false,
    // 菜单文本
    MENU_TEXT: '手动触发 Challenge 弹窗',
    // iframe 容器 ID
    IFRAME_ID: 'linuxdo-cf-challenge-iframe',
    // 提示条 ID
    TOAST_ID: 'linuxdo-cf-challenge-toast',
    // Cloudflare 触发盾时的特殊响应头（官方文档：所有 challenge 类型都会带该头，
    // 且 'challenge' 是唯一取值，challenge 响应的 content-type 恒为 text/html）
    MITIGATED_HEADER: 'cf-mitigated',
    MITIGATED_CHALLENGE_VALUE: 'challenge',
    // 与盾伴生的 HTTP 状态码（Managed/JS Challenge 常见 403/503，限流为 429），
    // 仅用于特殊表头被中间层剥掉时的兜底判定
    CHALLENGE_STATUS_CODES: [403, 503, 429],
    // 兜底判定还需同时满足：Cloudflare 代理响应 + HTML 内容（Discourse 自己的 JSON 403 不会误报）
    CF_SERVER_KEYWORD: 'cloudflare',
    // Cloudflare 全页 challenge（interstitial）的 DOM 特征。
    // 注意：所有经 CF 代理的页面都可能注入 challenge-platform 的 jsd 探测脚本，
    // 因此只匹配 orchestrate 脚本与 challenge 表单，不能宽松匹配整个 challenge-platform 路径
    DOC_CHALLENGE_SELECTOR: [
      '#challenge-form',
      '#challenge-error-text',
      '#cf-please-wait',
      '#cf-spinner-please-wait',
      'script[src*="/cdn-cgi/challenge-platform/"][src*="orchestrate"]'
    ].join(', '),
    // 全页 challenge 的标题特征（Managed/JS Challenge 均为 "Just a moment..."）
    DOC_CHALLENGE_TITLES: ['just a moment'],
    // 自动弹窗节流间隔：大量请求同时失败时避免反复弹窗打扰
    AUTO_TRIGGER_INTERVAL_MS: 30 * 1000,
    // 轮询 iframe 内验证是否已通过的间隔与超时
    SOLVE_POLL_INTERVAL_MS: 1000,
    SOLVE_POLL_MAX_MS: 5 * 60 * 1000,
    // 验证通过后自动刷新页面，让之前被盾拦掉的请求重新走一遍
    AUTO_RELOAD_ON_SOLVE: true,
    // 弹窗尺寸：默认收起为小窗（仅标题条，iframe 隐藏加载），点击小窗展开
    PILL_SIZE: { width: '170px', height: '38px' },
    PANEL_SIZE: { width: '400px', height: '500px' }
  }

  /**
   * 日志函数，仅在调试模式下输出
   * @param {...any} args - 要记录的参数
   */
  const log = (...args) => {
    if (CONFIG.DEBUG) {
      console.log('[LINUX.DO Auto Challenge]', ...args)
    }
  }

  /**
   * 脚本内部状态
   */
  const state = {
    // 上次自动触发弹窗的时间戳
    lastAutoTriggerAt: 0,
    // iframe 通过验证的轮询定时器
    solveTimer: null
  }

  /**
   * 读取页面主世界的全局变量（沙箱环境下 window 可能是代理）
   * @param {string} name - 变量名
   * @returns {any}
   */
  function getGlobal(name) {
    try {
      if (typeof unsafeWindow !== 'undefined' && unsafeWindow && unsafeWindow[name] !== undefined) {
        return unsafeWindow[name]
      }
    } catch (error) {
      log('读取全局变量失败：', name, error)
    }
    try {
      return window[name]
    } catch (error) {
      return undefined
    }
  }

  /**
   * 检查当前页面是否是 challenge 页面（linux.do 自己的 /challenge 路径）
   * @returns {boolean}
   */
  function isChallengePage() {
    return window.location.pathname.startsWith(CONFIG.CHALLENGE_PATH)
  }

  /**
   * 检查顶层文档是否是 Cloudflare 全页 challenge（5 秒盾整页拦截）。
   * 这类页面会自行完成验证并刷新，无需（也不能）再叠一层弹窗
   * @returns {boolean}
   */
  function looksLikeFullPageChallenge() {
    try {
      // _cf_chl_opt 由 challenge 页面内联脚本写入；CF 对正常页面注入的 jsd 探测也会写，
      // 但其 cType 为 'jsd'，必须排除，否则所有页面都会被误判为全页盾
      const chlOpt = getGlobal('_cf_chl_opt')
      const cType = chlOpt && chlOpt.cType ? String(chlOpt.cType) : ''
      if (cType && cType !== 'jsd') {
        return true
      }

      const title = (document.title || '').toLowerCase()
      if (CONFIG.DOC_CHALLENGE_TITLES.some(t => title.includes(t))) {
        return true
      }

      return Boolean(document.querySelector(CONFIG.DOC_CHALLENGE_SELECTOR))
    } catch (error) {
      log('检测全页 challenge 时出错：', error)
      return false
    }
  }

  /**
   * 检查顶层文档是否是 Cloudflare 拦截页（1020/WAF block 等，无法通过过盾解决）
   * @returns {boolean}
   */
  function looksLikeCloudflareBlockPage() {
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
   * 检查当前页面是否是 CloudFlare challenge 失败页面
   * @returns {boolean}
   */
  function isChallengeFailure() {
    if (isChallengePage()) return false

    try {
      const dialogElement = document.querySelector(CONFIG.DIALOG_SELECTOR)
      if (!dialogElement) return false

      const text = dialogElement.innerText || ''
      return CONFIG.ERROR_TEXTS.some(errorText => text.includes(errorText))
    } catch (error) {
      log('检测失败页面时出错：', error)
      return false
    }
  }

  /**
   * 按 Cloudflare 真实行为检查单个响应：
   * 1. 官方特征：响应头 cf-mitigated: challenge（所有 challenge 类型必带，content-type 恒为 text/html）
   * 2. 兜底特征：403/503/429 + server: cloudflare + text/html（特殊表头被剥掉时）
   * @param {string} source - 来源标记（fetch/xhr）
   * @param {string} url - 请求地址
   * @param {number} status - HTTP 状态码
   * @param {(name: string) => string|null} getHeader - 响应头读取函数
   */
  function inspectResponse(source, url, status, getHeader) {
    try {
      const mitigated = String(getHeader(CONFIG.MITIGATED_HEADER) || '').toLowerCase()

      if (mitigated === CONFIG.MITIGATED_CHALLENGE_VALUE) {
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
        CONFIG.CHALLENGE_STATUS_CODES.includes(status) &&
        server.includes(CONFIG.CF_SERVER_KEYWORD) &&
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
   * 自动触发弹窗（带节流与全页 challenge 保护；菜单手动触发不经过这里）
   * @param {string} reason - 触发原因
   */
  function triggerChallengePopup(reason) {
    // 顶层文档本身就是全页盾时会自行完成验证并刷新，不能再叠一层弹窗
    if (looksLikeFullPageChallenge()) {
      log('当前是 Cloudflare 全页 challenge，跳过弹窗：', reason)
      return
    }

    const now = Date.now()
    if (now - state.lastAutoTriggerAt < CONFIG.AUTO_TRIGGER_INTERVAL_MS) {
      log('自动触发过于频繁，跳过：', reason)
      return
    }

    state.lastAutoTriggerAt = now
    log('触发 Challenge 弹窗：', reason)
    showChallengeIframe()
  }

  /**
   * 挂载 fetch / XHR 钩子以读取响应头。
   * Discourse 的请求都发生在页面主世界，沙箱环境优先挂到 unsafeWindow；
   * 全部包在 try/catch 中，任何失败都不影响页面原有逻辑
   */
  function installNetworkHooks() {
    const targets = []
    if (typeof unsafeWindow !== 'undefined' && unsafeWindow) {
      targets.push(unsafeWindow)
    }
    if (!targets.includes(window)) {
      targets.push(window)
    }

    for (const target of targets) {
      hookFetch(target)
      hookXHR(target)
    }
  }

  /**
   * 包装 window.fetch，在响应返回后检查特殊表头
   * @param {Window} target - 目标 window
   */
  function hookFetch(target) {
    try {
      if (!target || typeof target.fetch !== 'function' || target.__linuxdoCfFetchHooked) {
        return
      }

      const originalFetch = target.fetch
      const patchedFetch = function (input) {
        const promise = originalFetch.apply(this, arguments)
        try {
          promise
            .then(response => {
              const url = (input && input.url) || (typeof input === 'string' ? input : '')
              inspectResponse('fetch', url, response ? response.status : 0, name => {
                try {
                  return response && response.headers ? response.headers.get(name) : null
                } catch (error) {
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

      target.fetch = patchedFetch
      if (target.fetch === patchedFetch) {
        target.__linuxdoCfFetchHooked = true
        log('已挂载 fetch 钩子')
      }
    } catch (error) {
      log('挂载 fetch 钩子失败：', error)
    }
  }

  /**
   * 包装 XMLHttpRequest，在 loadend 后检查特殊表头
   * @param {Window} target - 目标 window
   */
  function hookXHR(target) {
    try {
      if (!target || typeof target.XMLHttpRequest !== 'function') {
        return
      }

      const proto = target.XMLHttpRequest.prototype
      if (proto.__linuxdoCfXhrHooked) {
        return
      }

      const originalOpen = proto.open
      const originalSend = proto.send

      proto.open = function (method, url) {
        try {
          this.__linuxdoRequestUrl = typeof url === 'string' ? url : String(url || '')
        } catch (error) {
          // 记录 URL 失败不影响请求本身
        }
        return originalOpen.apply(this, arguments)
      }

      proto.send = function () {
        try {
          const xhr = this
          xhr.addEventListener('loadend', () => {
            inspectResponse('xhr', xhr.__linuxdoRequestUrl || '', xhr.status, name => {
              try {
                return xhr.getResponseHeader(name)
              } catch (error) {
                return null
              }
            })
          })
        } catch (error) {
          log('监听 XHR 响应失败：', error)
        }
        return originalSend.apply(this, arguments)
      }

      proto.__linuxdoCfXhrHooked = true
      log('已挂载 XHR 钩子')
    } catch (error) {
      log('挂载 XHR 钩子失败：', error)
    }
  }

  /**
   * 创建并显示 Challenge 弹窗。
   * 默认收起为右下角小窗（仅标题条），iframe 在后台隐藏加载以便自动过盾；
   * 用户点击小窗时才展开完整 challenge 窗口，检测到过盾完成后自动关闭
   * @param {{ autoExpand?: boolean }} [options] - 手动触发时可传 autoExpand 直接展开
   */
  function showChallengeIframe(options = {}) {
    // 防止在 challenge 页面弹窗
    if (isChallengePage()) return

    if (!document.body) return

    // 如果弹窗已存在，不重复创建
    if (document.getElementById(CONFIG.IFRAME_ID)) {
      log('Challenge 弹窗已存在')
      return
    }

    log('正在创建 Challenge 弹窗...')

    const redirectUrl = `${CONFIG.CHALLENGE_PATH}?redirect=${encodeURIComponent(window.location.href)}`

    // 创建容器
    const container = document.createElement('div')
    container.id = CONFIG.IFRAME_ID
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
    let expanded = Boolean(options.autoExpand)
    const applyExpanded = () => {
      const size = expanded ? CONFIG.PANEL_SIZE : CONFIG.PILL_SIZE
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
   * @param {HTMLElement} container - 弹窗容器
   * @param {HTMLIFrameElement} iframe - challenge iframe
   */
  function watchChallengeSolved(container, iframe) {
    if (state.solveTimer) {
      // 已有弹窗在监视，避免重复轮询
      return
    }

    const startedAt = Date.now()
    const timer = setInterval(() => {
      let solved = false
      let alive = false

      try {
        if (iframe.isConnected && container.isConnected) {
          alive = true
          const path = iframe.contentWindow.location.pathname
          solved = Boolean(path) && !path.startsWith(CONFIG.CHALLENGE_PATH)
        }
      } catch (error) {
        // 读取 iframe 状态失败（尚未导航完成等），继续等待下次轮询
      }

      if (solved) {
        clearInterval(timer)
        state.solveTimer = null
        container.remove()
        showToast(CONFIG.AUTO_RELOAD_ON_SOLVE ? '✅ 验证已通过，正在刷新页面…' : '✅ 验证已通过')
        if (CONFIG.AUTO_RELOAD_ON_SOLVE) {
          setTimeout(() => {
            window.location.reload()
          }, 800)
        }
        return
      }

      if (!alive || Date.now() - startedAt > CONFIG.SOLVE_POLL_MAX_MS) {
        clearInterval(timer)
        state.solveTimer = null
      }
    }, CONFIG.SOLVE_POLL_INTERVAL_MS)

    state.solveTimer = timer
  }

  /**
   * 显示短暂提示条
   * @param {string} message - 提示文本
   */
  function showToast(message) {
    try {
      if (!document.body) return

      const existing = document.getElementById(CONFIG.TOAST_ID)
      if (existing) {
        existing.remove()
      }

      const toast = document.createElement('div')
      toast.id = CONFIG.TOAST_ID
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
        } catch (error) {
          // 元素已不存在，忽略
        }
      }, 4000)
    } catch (error) {
      log('显示提示失败：', error)
    }
  }

  /**
   * 检查并处理 CloudFlare 失败
   * @param {MutationObserver} [observer] - 可选的观察者实例
   */
  function checkAndRedirect(observer) {
    if (isChallengeFailure()) {
      // 注意：这里我们不断开 observer，因为用户可能关闭弹窗后再次触发错误
      // 如果需要防止频繁触发，可以在 showChallengeIframe 里做状态管理
      showChallengeIframe()
      return true
    }
    return false
  }

  /**
   * 手动触发
   */
  function manualTrigger() {
    log('手动触发 Challenge 弹窗')
    if (isChallengePage()) {
      alert('已在 Challenge 页面')
      return
    }
    // 手动触发视为明确意图，直接展开窗口
    showChallengeIframe({ autoExpand: true })
  }

  /**
   * 初始化脚本（DOM 就绪后执行；网络钩子在 boot 中更早安装）
   */
  function initScript() {
    log('初始化脚本')

    if (isChallengePage()) {
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

    // 初始检查
    checkAndRedirect()

    // 观察 DOM 变化
    try {
      const observer = new MutationObserver((mutations, obs) => {
        checkAndRedirect(obs)
      })

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      })

      log('DOM 观察器已启动')
    } catch (error) {
      log('启动 DOM 观察器时出错：', error)
    }

    // 注册菜单命令
    try {
      GM_registerMenuCommand(CONFIG.MENU_TEXT, manualTrigger)
    } catch (error) {
      log('注册菜单命令时出错：', error)
    }
  }

  /**
   * 启动：@run-at document-start 下尽早挂载网络钩子（赶在应用发起请求前读取特殊表头），
   * DOM 相关检查等 DOMContentLoaded
   */
  function boot() {
    installNetworkHooks()

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initScript)
    } else {
      initScript()
    }
  }

  boot()
})()
