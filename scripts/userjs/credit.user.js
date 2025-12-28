// ==UserScript==
// @name         LINUX DO Credit 积分 (Card API + Headers Fix)
// @namespace    http://tampermonkey.net/
// @version      1.1.3
// @description  LINUX DO Credit 实时收入
// @author       @Chenyme
// @license      MIT
// @match        https://linux.do/*
// @match        https://credit.linux.do/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      credit.linux.do
// @connect      linux.do
// @run-at       document-idle
// ==/UserScript==

;(function () {
  'use strict'

  GM_addStyle(`
        #ldc-mini {
            position: fixed;
            background: var(--secondary); 
            border: 1px solid var(--primary-low);
            border-radius: 8px;
            box-shadow: var(--shadow-card);
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            padding: 10px 14px;
            font-variant-numeric: tabular-nums;
            font-size: 13px;
            font-weight: 600;
            color: var(--primary);
            display: flex;
            align-items: center;
            justify-content: center;
            width: fit-content;
            min-width: 36px;
            max-width: 200px;
            white-space: nowrap;
            overflow: hidden;
            transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
            cursor: move;
            user-select: none;
        }
        #ldc-mini:hover {
            background: var(--d-hover);
            box-shadow: var(--shadow-dropdown);
            transform: translateY(-1px);
        }
        #ldc-mini:active { transform: scale(0.98); }
        #ldc-mini.loading {
            min-width: 36px;
            max-width: 36px;
            padding: 10px 0;
            color: var(--primary-medium);
            cursor: wait;
            border-color: transparent;
            background: var(--secondary);
            opacity: 0.8;
        }
        #ldc-tooltip {
            position: fixed;
            background: var(--primary-very-high, #002B36);
            color: var(--secondary, #FCF6E1);
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            line-height: 1.5;
            z-index: 10001;
            pointer-events: none;
            white-space: pre;
            opacity: 0;
            transition: opacity 0.15s ease;
            backdrop-filter: blur(4px);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-variant-numeric: tabular-nums;
            box-shadow: var(--shadow-dropdown);
            border: 1px solid var(--primary-low);
        }
        #ldc-mini.positive { color: var(--success); }
        #ldc-mini.negative { color: var(--danger); }
        #ldc-mini.neutral { color: var(--primary-medium); }
    `)

  let communityBalance = null
  let gamificationScore = null
  let username = null
  let isDragging = false
  let tooltipContent = '加载中...'

  // 获取页面上的 CSRF Token
  function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]')
    return meta ? meta.content : ''
  }

  function createWidget() {
    const widget = document.createElement('div')
    widget.id = 'ldc-mini'
    widget.className = 'loading'
    widget.textContent = '···'
    const tooltip = document.createElement('div')
    tooltip.id = 'ldc-tooltip'
    document.body.appendChild(tooltip)
    const savedPos = GM_getValue('ldc_pos', { bottom: '20px', right: '20px' })
    Object.assign(widget.style, savedPos)
    document.body.appendChild(widget)

    widget.addEventListener('mouseenter', () => {
      if (isDragging) return
      const rect = widget.getBoundingClientRect()
      tooltip.textContent = tooltipContent
      const tooltipHeight = 80
      if (rect.top > tooltipHeight + 10) {
        tooltip.style.top = 'auto'
        tooltip.style.bottom = window.innerHeight - rect.top + 8 + 'px'
      } else {
        tooltip.style.bottom = 'auto'
        tooltip.style.top = rect.bottom + 8 + 'px'
      }
      tooltip.style.left = 'auto'
      tooltip.style.right = window.innerWidth - rect.right + 'px'
      tooltip.style.opacity = '1'
    })
    widget.addEventListener('mouseleave', () => (tooltip.style.opacity = '0'))

    let startX, startY, startRight, startBottom
    widget.addEventListener('mousedown', e => {
      if (e.button !== 0) return
      isDragging = false
      startX = e.clientX
      startY = e.clientY
      const rect = widget.getBoundingClientRect()
      startRight = window.innerWidth - rect.right
      startBottom = window.innerHeight - rect.bottom
      e.preventDefault()
      tooltip.style.opacity = '0'
      const onMouseMove = moveEvent => {
        isDragging = true
        const deltaX = startX - moveEvent.clientX
        const deltaY = startY - moveEvent.clientY
        widget.style.right = `${Math.max(0, Math.min(window.innerWidth - rect.width, startRight + deltaX))}px`
        widget.style.bottom = `${Math.max(0, Math.min(window.innerHeight - rect.height, startBottom + deltaY))}px`
        widget.style.top = 'auto'
        widget.style.left = 'auto'
      }
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        if (isDragging) {
          GM_setValue('ldc_pos', { right: widget.style.right, bottom: widget.style.bottom })
          setTimeout(() => (isDragging = false), 50)
        }
      }
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    })
    widget.addEventListener('click', () => {
      if (!isDragging) {
        widget.className = 'loading'
        widget.textContent = '···'
        tooltipContent = '刷新中...'
        const t = document.getElementById('ldc-tooltip')
        if (t.style.opacity === '1') t.textContent = tooltipContent
        fetchData()
      }
    })
  }

  function updateDisplay() {
    const widget = document.getElementById('ldc-mini')
    const tooltip = document.getElementById('ldc-tooltip')
    if (!widget) return
    if (gamificationScore !== null && communityBalance !== null) {
      const diff = gamificationScore - communityBalance
      const sign = diff >= 0 ? '+' : ''
      widget.textContent = `${sign}${diff.toFixed(2)}`
      tooltipContent = `仅供参考，可能有误差！\n当前分：${gamificationScore.toFixed(2)}\n基准值：${communityBalance.toFixed(2)}`
      if (tooltip && tooltip.style.opacity === '1') tooltip.textContent = tooltipContent
      widget.className = diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'neutral'
      widget.style.removeProperty('cursor')
    } else if (communityBalance !== null) {
      widget.textContent = '·'
      widget.className = 'loading'
      tooltipContent = '仅供参考，可能有误差！\n正在获取实时积分...'
    }
  }

  async function request(url) {
    const isTargetLinuxDo = url.includes('linux.do')
    const isTargetCredit = url.includes('credit.linux.do')

    // 构建 Headers
    const headers = {
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest' // 关键：模拟 AJAX
    }

    // 如果在 linux.do 站内，尝试获取 CSRF Token
    const csrfToken = getCsrfToken()
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken
    }

    // 设置 Referer
    if (isTargetLinuxDo) {
      headers['Referer'] = 'https://linux.do/'
      headers['Discourse-Logged-In'] = 'true'
    } else if (isTargetCredit) {
      headers['Referer'] = 'https://credit.linux.do/home'
    }

    const isSameOrigin = url.startsWith(window.location.origin)

    // 优先尝试原生 fetch (Same Origin)
    if (isSameOrigin) {
      try {
        const res = await fetch(url, {
          headers: headers,
          credentials: 'include'
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return await res.json()
      } catch (e) {
        // console.log('Fetch failed, falling back to GM');
      }
    }

    // 跨域或 Fetch 失败时使用 GM_xmlhttpRequest
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: url,
        withCredentials: true,
        headers: headers,
        timeout: 15000,
        onload: res => {
          if (res.status === 200) {
            try {
              resolve(JSON.parse(res.responseText))
            } catch (e) {
              reject(e)
            }
          } else {
            reject(new Error(`HTTP ${res.status}`))
          }
        },
        ontimeout: () => reject(new Error('Timeout')),
        onerror: err => reject(err)
      })
    })
  }

  async function fetchData() {
    try {
      // 1. 获取 Credit 余额
      const creditData = await request('https://credit.linux.do/api/v1/oauth/user-info')
      if (creditData?.data) {
        communityBalance = parseFloat(
          creditData.data['community-balance'] || creditData.data.community_balance || 0
        )
        username = creditData.data.username || creditData.data.nickname
        updateDisplay()
        if (username) await fetchGamificationByUsername()
      }
    } catch (e) {
      console.error('LDC: Fetch balance error', e)
      handleError('Credit API 异常')
    }
  }

  function handleError(msg) {
    const widget = document.getElementById('ldc-mini')
    if (widget) {
      widget.textContent = '!'
      tooltipContent = `出错啦！\n${msg}\n(请检查是否已登录相关站点)`
      widget.classList.add('negative')
      if (widget.classList.contains('loading')) widget.classList.remove('loading')
    }
  }

  async function fetchGamificationByUsername() {
    if (!username) return
    try {
      // 尝试 1: Card 接口 (更轻量)
      const cardData = await request(`https://linux.do/u/${username}/card.json`)
      if (cardData?.user?.gamification_score !== undefined) {
        gamificationScore = parseFloat(cardData.user.gamification_score)
        updateDisplay()
        return
      }
      // 尝试 2: 完整用户资料接口 (兜底)
      // console.log('LDC: card.json fallback...');
      const profileData = await request(`https://linux.do/u/${username}.json`)
      if (profileData?.user?.gamification_score !== undefined) {
        gamificationScore = parseFloat(profileData.user.gamification_score)
        updateDisplay()
      }
    } catch (e) {
      console.error('LDC: Fetch gamification error', e)
    }
  }

  function init() {
    createWidget()
    setTimeout(fetchData, 500)
    setInterval(fetchData, 60000)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
