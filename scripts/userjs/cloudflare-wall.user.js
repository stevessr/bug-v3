// ==UserScript==
// @name                 LINUX.DO CloudFlare Challenge Bypass (Iframe Mode)
// @name:zh-CN           LINUX.DO CloudFlare 5 秒盾自动弹窗
// @namespace            https://github.com/utags
// @homepageURL          https://github.com/utags/userscripts#readme
// @supportURL           https://github.com/utags/userscripts/issues
// @version              0.5.0
// @description          Opt-in (disabled by default) Cloudflare challenge helper for linux.do: detects challenges via the cf-mitigated: challenge header, shows a collapsed mini-bar that expands on click, styles itself with the site's Discourse theme variables, and auto-closes and reloads once the challenge is passed
// @description:zh-CN    手动开启、默认关闭的 linux.do 过盾辅助：按 Cloudflare 真实行为（cf-mitigated: challenge 特殊表头）识别盾，右下角默认只显示收起小窗（iframe 后台隐藏加载），点击展开；样式使用 Discourse 站点提供的主题变量自动适配深浅色；检测到过盾完成后自动关闭并刷新页面
// @author               Pipecraft (Modified by User)
// @license              MIT
// @match                https://linux.do/*
// @run-at               document-start
// @icon                 https://wsrv.nl/?w=64&h=64&url=https%3A%2F%2Ft3.gstatic.com%2FfaviconV2%3Fclient%3DSOCIAL%26type%3DFAVICON%26fallback_opts%3DTYPE%2CSIZE%2CURL%26url%3Dhttps%3A%2F%2Flinux.do%26size%3D64
// @grant                GM_registerMenuCommand
// @grant                GM_unregisterMenuCommand
// @grant                GM_addStyle
// @grant                GM_getValue
// @grant                GM_setValue
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
    MANUAL_MENU_TEXT: '手动触发 Challenge 窗口',
    // 自动开关的存储键（GM 存储，localStorage 兜底）
    STORAGE_KEY: 'linuxdoCfWallAutoEnabled',
    // iframe 容器 ID
    IFRAME_ID: 'linuxdo-cf-challenge-iframe',
    // 其他实现（插件版）的弹窗 ID：已存在时不重复弹，避免双重触发
    COEXISTING_WALL_IDS: ['emoji-ext-cf-challenge-iframe'],
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
    // /challenge 路由本身不是真实页面：过盾完成（或本就无需验证）后 CF 会放行，
    // 渲染出 Discourse 的 404 页。出现该文案即视为验证已通过
    // （与插件背景层 handleLinuxDoChallengeRequest 的判定一致）
    CHALLENGE_DONE_TEXTS: ['该页面不存在或者是一个不公开页面'],
    // 自动弹窗节流间隔：大量请求同时失败时避免反复弹窗打扰
    AUTO_TRIGGER_INTERVAL_MS: 30 * 1000,
    // 轮询 iframe 内验证是否已通过的间隔与超时
    SOLVE_POLL_INTERVAL_MS: 1000,
    SOLVE_POLL_MAX_MS: 5 * 60 * 1000,
    // 验证通过后自动刷新页面，让之前被盾拦掉的请求重新走一遍
    AUTO_RELOAD_ON_SOLVE: true
    // 弹窗尺寸（收起 170x38 / 展开 400x500）在下方 WALL_CSS 中定义
  }

  /**
   * 弹窗样式：颜色、圆角、阴影全部取自 Discourse 站点提供的 CSS 主题变量
   * （--primary/--secondary/--danger 等），自动跟随站点深浅色主题；
   * var() 的第二参数为降级默认值，站点变量缺失时仍可正常显示
   */
  const WALL_CSS = `
#${CONFIG.IFRAME_ID} {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 2147483647;
  display: flex;
  flex-direction: column;
  width: 170px;
  height: 38px;
  background-color: var(--secondary, #fff);
  color: var(--primary, #222);
  border: 1px solid var(--primary-low, #ccc);
  border-radius: var(--d-border-radius, 8px);
  box-shadow: var(--shadow-modal, 0 8px 60px rgba(0, 0, 0, 0.35));
  overflow: hidden;
  cursor: pointer;
  transition: width 0.2s, height 0.2s;
}
#${CONFIG.IFRAME_ID}.expanded {
  width: 400px;
  height: 500px;
  cursor: default;
}
#${CONFIG.IFRAME_ID} .cf-wall-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  background-color: var(--primary-very-low, #f8f9fa);
  border-bottom: 1px solid var(--primary-low, #eee);
  font-size: 14px;
  font-weight: bold;
  color: var(--primary, #333);
  white-space: nowrap;
}
#${CONFIG.IFRAME_ID} .cf-wall-close {
  border: none;
  background-color: var(--danger, #ff4d4f);
  color: var(--secondary, #fff);
  border-radius: 4px;
  padding: 2px 8px;
  cursor: pointer;
  font-size: 12px;
}
#${CONFIG.IFRAME_ID} .cf-wall-panel-body {
  display: none;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  background-color: var(--secondary, #fff);
}
#${CONFIG.IFRAME_ID}.expanded .cf-wall-panel-body {
  display: flex;
}
#${CONFIG.IFRAME_ID} .cf-wall-panel-body iframe {
  flex: 1;
  width: 100%;
  border: none;
  background-color: var(--secondary, #fff);
}
#${CONFIG.TOAST_ID} {
  position: fixed;
  bottom: 30px;
  right: 30px;
  z-index: 2147483647;
  max-width: 70vw;
  background-color: var(--primary, #222);
  color: var(--secondary, #fff);
  padding: 10px 16px;
  border-radius: var(--d-border-radius, 6px);
  font-size: 14px;
}
`

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
    // 自动过盾开关（手动开启，默认关闭，持久化存储）
    autoEnabled: false,
    // 上次自动触发弹窗的时间戳
    lastAutoTriggerAt: 0,
    // iframe 通过验证的轮询定时器
    solveTimer: null,
    // 站点主题样式是否已注入
    styleInjected: false,
    // DOM 就绪检查是否已排程
    domChecksScheduled: false,
    // DOM 变化观察器（dialog 报错兜底）
    observer: null,
    // 自动开关菜单命令 ID
    autoCommandId: null,
    // 已挂载的网络钩子（用于关闭开关时还原）
    hooks: null
  }

  /**
   * 读取自动过盾开关（GM 存储优先，localStorage 兜底），默认关闭
   * @returns {boolean}
   */
  function readAutoEnabled() {
    try {
      if (typeof GM_getValue === 'function') {
        return GM_getValue(CONFIG.STORAGE_KEY, false) === true
      }
    } catch (error) {
      log('读取自动过盾开关失败：', error)
    }
    try {
      return localStorage.getItem(CONFIG.STORAGE_KEY) === '1'
    } catch (error) {
      return false
    }
  }

  /**
   * 写入自动过盾开关
   * @param {boolean} value
   */
  function writeAutoEnabled(value) {
    try {
      if (typeof GM_setValue === 'function') {
        GM_setValue(CONFIG.STORAGE_KEY, value)
        return
      }
    } catch (error) {
      log('写入自动过盾开关失败：', error)
    }
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, value ? '1' : '0')
    } catch (error) {
      log('写入自动过盾开关（localStorage）失败：', error)
    }
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
   * 注入弹窗样式（幂等）。颜色全部使用 Discourse 站点提供的主题变量
   */
  function ensureStyles() {
    if (state.styleInjected) return
    try {
      GM_addStyle(WALL_CSS)
      state.styleInjected = true
    } catch (error) {
      log('注入样式失败：', error)
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
   * 挂载 fetch / XHR 钩子以读取响应头，并记录原始引用便于还原。
   * Discourse 的请求都发生在页面主世界，沙箱环境优先挂到 unsafeWindow；
   * 全部包在 try/catch 中，任何失败都不影响页面原有逻辑
   */
  function installNetworkHooks() {
    if (state.hooks) return

    const hooks = { fetch: [], xhr: [] }
    const targets = []
    if (typeof unsafeWindow !== 'undefined' && unsafeWindow) {
      targets.push(unsafeWindow)
    }
    if (!targets.includes(window)) {
      targets.push(window)
    }

    for (const target of targets) {
      try {
        if (target && typeof target.fetch === 'function' && !target.__linuxdoCfFetchHooked) {
          const originalFetch = target.fetch
          const patchedFetch = function (input) {
            const promise = originalFetch.apply(this, arguments)
            try {
              promise
                .then(response => {
                  const url = typeof input === 'string' ? input : (input && input.url) || ''
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
            hooks.fetch.push({ target, original: originalFetch, patched: patchedFetch })
            log('已挂载 fetch 钩子')
          }
        }
      } catch (error) {
        log('挂载 fetch 钩子失败：', error)
      }

      try {
        if (target && typeof target.XMLHttpRequest === 'function') {
          const proto = target.XMLHttpRequest.prototype
          if (!proto.__linuxdoCfXhrHooked) {
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
            hooks.xhr.push({ proto, open: originalOpen, send: originalSend })
            log('已挂载 XHR 钩子')
          }
        }
      } catch (error) {
        log('挂载 XHR 钩子失败：', error)
      }
    }

    state.hooks = hooks
  }

  /**
   * 还原网络钩子（关闭自动过盾开关时调用）
   */
  function uninstallNetworkHooks() {
    const hooks = state.hooks
    if (!hooks) return

    for (const item of hooks.fetch) {
      try {
        if (item.target.fetch === item.patched) {
          item.target.fetch = item.original
          item.target.__linuxdoCfFetchHooked = false
          log('已卸载 fetch 钩子')
        }
      } catch (error) {
        log('卸载 fetch 钩子失败：', error)
      }
    }

    for (const item of hooks.xhr) {
      try {
        item.proto.open = item.open
        item.proto.send = item.send
        item.proto.__linuxdoCfXhrHooked = false
        log('已卸载 XHR 钩子')
      } catch (error) {
        log('卸载 XHR 钩子失败：', error)
      }
    }

    state.hooks = null
  }

  /**
   * 应用自动过盾开关：开启时挂载钩子并排程 DOM 检查，关闭时还原钩子
   */
  function applyAutoEnabled() {
    if (state.autoEnabled) {
      installNetworkHooks()
      scheduleDomChecks()
    } else {
      uninstallNetworkHooks()
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

    // 插件版过盾弹窗已存在时不重复弹（防双重/嵌套触发）
    const coexistingId = CONFIG.COEXISTING_WALL_IDS.find(id => document.getElementById(id))
    if (coexistingId) {
      log('检测到插件版过盾弹窗，跳过重复创建：', coexistingId)
      return
    }

    ensureStyles()
    log('正在创建 Challenge 弹窗...')

    const redirectUrl = `${CONFIG.CHALLENGE_PATH}?redirect=${encodeURIComponent(window.location.href)}`

    // 创建容器（尺寸与配色见 WALL_CSS，使用 Discourse 站点主题变量）
    const container = document.createElement('div')
    container.id = CONFIG.IFRAME_ID
    container.title = '点击展开/收起安全验证窗口'

    // 创建标题栏
    const header = document.createElement('div')
    header.className = 'cf-wall-header'

    // 标题文本（收起时用短文案）
    const title = document.createElement('span')
    title.innerText = '🛡️ 安全验证'

    // 关闭按钮
    const closeBtn = document.createElement('button')
    closeBtn.className = 'cf-wall-close'
    closeBtn.innerText = '✕'
    closeBtn.title = '关闭'
    closeBtn.onclick = event => {
      event.stopPropagation()
      container.remove()
      log('用户关闭了弹窗')
    }

    header.appendChild(title)
    header.appendChild(closeBtn)

    // iframe 外层容器：收起时隐藏，iframe 仍在后台加载以自动过盾
    const panelBody = document.createElement('div')
    panelBody.className = 'cf-wall-panel-body'

    // 创建 Iframe
    const iframe = document.createElement('iframe')
    iframe.src = redirectUrl
    panelBody.appendChild(iframe)

    // 组装
    container.appendChild(header)
    container.appendChild(panelBody)
    document.body.appendChild(container)

    // 展开/收起状态（尺寸与显隐由 .expanded 类控制）
    let expanded = Boolean(options.autoExpand)
    const applyExpanded = () => {
      container.classList.toggle('expanded', expanded)
      title.innerText = expanded ? '🛡️ LINUX.DO 安全验证' : '🛡️ 安全验证'
    }

    // 点击标题条切换展开/收起（✕ 关闭除外）
    container.addEventListener('click', event => {
      if (event.target === closeBtn) return
      expanded = !expanded
      applyExpanded()
      log(expanded ? '已展开 Challenge 窗口' : '已收起 Challenge 窗口')
    })

    applyExpanded()

    // 过盾完成后自动关闭：创建即开始监视 iframe（不依赖 load 事件），
    // 收起状态下也能检测到通过；iframe 每次加载完成再确认一次
    watchChallengeSolved(container, iframe)
    iframe.addEventListener('load', () => {
      watchChallengeSolved(container, iframe)
    })

    log(expanded ? 'Challenge 窗口已创建（展开）' : 'Challenge 小窗已创建（收起，点击展开）')
  }

  /**
   * 检查 iframe 内的 /challenge 页是否已经渲染出 Discourse 404 页：
   * /challenge 路由本身不是真实页面，过盾完成（或本就无需验证）后 CF 放行，
   * 页面出现「该页面不存在或者是一个不公开页面」即代表验证已通过
   * @param {HTMLIFrameElement} iframe - challenge iframe
   * @returns {boolean}
   */
  function isChallengeDoneInIframe(iframe) {
    try {
      const doc = iframe.contentDocument
      const text = (doc && doc.body && doc.body.innerText) || ''
      return CONFIG.CHALLENGE_DONE_TEXTS.some(doneText => text.includes(doneText))
    } catch (error) {
      return false
    }
  }

  /**
   * 轮询 iframe：仍在 /challenge 且未出现 404 文案说明验证未完成；
   * URL 离开 /challenge（redirect 生效时）或渲染出 404 页（常见情形）
   * 说明已通过，收掉弹窗并提示刷新
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
          let path = ''
          try {
            path = iframe.contentWindow.location.pathname
          } catch (error) {
            // 读取 iframe 地址失败（尚未导航完成等），交给内容判定兜底
          }
          solved =
            (Boolean(path) && !path.startsWith(CONFIG.CHALLENGE_PATH)) ||
            isChallengeDoneInIframe(iframe)
        }
      } catch (error) {
        // 读取 iframe 状态失败，继续等待下次轮询
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
   * 显示短暂提示条（样式见 WALL_CSS，使用 Discourse 主题变量）
   * @param {string} message - 提示文本
   */
  function showToast(message) {
    try {
      if (!document.body) return

      ensureStyles()

      const existing = document.getElementById(CONFIG.TOAST_ID)
      if (existing) {
        existing.remove()
      }

      const toast = document.createElement('div')
      toast.id = CONFIG.TOAST_ID
      toast.innerText = message
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
   * 检查并处理 CloudFlare 失败（仅在自动过盾开启时生效）
   * @param {MutationObserver} [observer] - 可选的观察者实例
   */
  function checkAndRedirect(observer) {
    if (!state.autoEnabled) return false
    if (isChallengeFailure()) {
      // 注意：这里我们不断开 observer，因为用户可能关闭弹窗后再次触发错误
      // 如果需要防止频繁触发，可以在 showChallengeIframe 里做状态管理
      showChallengeIframe()
      return true
    }
    return false
  }

  /**
   * 手动触发（不受自动开关影响）
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
   * 注册/刷新自动过盾开关菜单项（标签随状态变化）
   */
  function refreshAutoMenuCommand() {
    const label = state.autoEnabled ? '🛡️ 自动过盾：开（点击关闭）' : '🛡️ 自动过盾：关（点击开启）'
    try {
      if (state.autoCommandId != null && typeof GM_unregisterMenuCommand === 'function') {
        GM_unregisterMenuCommand(state.autoCommandId)
      }
    } catch (error) {
      log('注销菜单命令失败：', error)
    }
    try {
      state.autoCommandId = GM_registerMenuCommand(label, toggleAutoEnabled)
    } catch (error) {
      log('注册菜单命令失败：', error)
    }
  }

  /**
   * 切换自动过盾开关（持久化，立即生效）
   */
  function toggleAutoEnabled() {
    state.autoEnabled = !state.autoEnabled
    writeAutoEnabled(state.autoEnabled)
    applyAutoEnabled()
    refreshAutoMenuCommand()
    showToast(state.autoEnabled ? '✅ 自动过盾已开启' : '⛔ 自动过盾已关闭')
    log('自动过盾开关已切换为：', state.autoEnabled)
  }

  /**
   * 注册油猴菜单：自动过盾开关 + 手动触发
   */
  function registerMenus() {
    try {
      refreshAutoMenuCommand()
    } catch (error) {
      log('注册自动过盾开关菜单失败：', error)
    }
    try {
      GM_registerMenuCommand(CONFIG.MANUAL_MENU_TEXT, manualTrigger)
    } catch (error) {
      log('注册菜单命令时出错：', error)
    }
  }

  /**
   * DOM 就绪后的检查（仅在自动过盾开启时执行）：
   * 初始 dialog 兜底检查 + 挂 MutationObserver 观察后续报错
   */
  function runDomChecks() {
    if (!state.autoEnabled) return

    log('初始化脚本')

    // challenge 页面（linux.do 自己的 /challenge 路径）自身无需再弹窗
    if (window.location.pathname.startsWith(CONFIG.CHALLENGE_PATH)) {
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

    // 观察 DOM 变化（幂等，开关反复切换不会重复挂载）
    if (state.observer) return
    try {
      state.observer = new MutationObserver((mutations, obs) => {
        checkAndRedirect(obs)
      })

      state.observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      })

      log('DOM 观察器已启动')
    } catch (error) {
      log('启动 DOM 观察器时出错：', error)
    }
  }

  /**
   * 排程 DOM 就绪检查（幂等）
   */
  function scheduleDomChecks() {
    if (state.domChecksScheduled) return
    state.domChecksScheduled = true

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runDomChecks)
    } else {
      runDomChecks()
    }
  }

  /**
   * 启动：读取开关（默认关闭）→ 注入菜单 → 仅在开启时挂载网络钩子与 DOM 检查
   */
  function boot() {
    // 防嵌套触发：本脚本 @match linux.do/*，过盾弹窗的 iframe 里会再跑一个实例。
    // 嵌套窗口（window.top !== window）与 /challenge 页面（含过盾完成后渲染的 404 页）
    // 一律不运行任何逻辑——不装钩子、不挂观察器、不注册菜单，
    // 从根上杜绝「iframe 里再装钩子 / iframe 里再弹一层窗」的嵌套触发
    try {
      if (window.top !== window) {
        log('嵌套窗口（iframe）内不运行')
        return
      }
    } catch (error) {
      // top 不可访问时按嵌套窗口处理
      log('top 不可访问，按嵌套窗口处理：', error)
      return
    }
    if (isChallengePage()) {
      log('challenge 页面内不运行')
      return
    }

    state.autoEnabled = readAutoEnabled()
    log('自动过盾开关：', state.autoEnabled ? '开' : '关（可在油猴菜单开启）')

    registerMenus()

    if (state.autoEnabled) {
      applyAutoEnabled()
    }
  }

  boot()
})()
