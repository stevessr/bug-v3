import { DOA, createE } from '../../utils/dom/createEl'

/**
 * LinuxDo Credit 积分浮窗
 * 显示 gamification_score 与 community_balance 的差值
 * 基于 @Chenyme 的 credit.user.js 脚本
 */

const STORAGE_KEY = 'ldc_widget_pos'
const REFRESH_INTERVAL = 60000
const CACHE_KEY = 'ldc_user_info_cache'
const GAMIFICATION_CACHE_KEY = 'ldc_gamification_cache'
const CACHE_DURATION = 10 * 60 * 1000 // 10 minutes

interface CreditCache {
  data: any
  timestamp: number
}

function loadCache(key: string): CreditCache | null {
  try {
    const saved = localStorage.getItem(key)
    if (saved) return JSON.parse(saved)
  } catch (e) {
    console.warn('[LDCredit] Failed to load cache', e)
  }
  return null
}

function saveCache(key: string, data: any) {
  try {
    const cache: CreditCache = {
      data,
      timestamp: Date.now()
    }
    localStorage.setItem(key, JSON.stringify(cache))
  } catch (e) {
    console.warn('[LDCredit] Failed to save cache', e)
  }
}

interface CreditState {
  communityBalance: number | null
  gamificationScore: number | null
  username: string | null
  isDragging: boolean
  tooltipContent: string
}

const state: CreditState = {
  communityBalance: null,
  gamificationScore: null,
  username: null,
  isDragging: false,
  tooltipContent: '加载中...'
}

let shadowRoot: ShadowRoot | null = null
let refreshInterval: ReturnType<typeof setInterval> | null = null

const css = `
  :host {
    all: initial;
  }
  #ldc-mini {
    position: fixed;
    background: var(--secondary, #fff);
    border: 1px solid var(--primary-low, #ddd);
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    padding: 10px 14px;
    font-variant-numeric: tabular-nums;
    font-size: 13px;
    font-weight: 600;
    color: var(--primary, #333);
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
    background: var(--d-hover, #f5f5f5);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    transform: translateY(-1px);
  }
  #ldc-mini:active { transform: scale(0.98); }
  #ldc-mini.loading {
    min-width: 36px;
    max-width: 36px;
    padding: 10px 0;
    color: var(--primary-medium, #999);
    cursor: wait;
    border-color: transparent;
    background: var(--secondary, #fff);
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
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    border: 1px solid var(--primary-low, #ddd);
  }
  #ldc-mini.positive { color: var(--success, #4caf50); }
  #ldc-mini.negative { color: var(--danger, #f44336); }
  #ldc-mini.neutral { color: var(--primary-medium, #999); }
`

function getCsrfToken(): string {
  const meta = document.querySelector('meta[name="csrf-token"]')
  return meta ? (meta as HTMLMetaElement).content : ''
}

function loadPosition(): { bottom: string; right: string } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch (e) {
    console.warn('[LDCredit] Failed to load position', e)
  }
  return { bottom: '20px', right: '20px' }
}

function savePosition(pos: { bottom: string; right: string }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos))
  } catch (e) {
    console.warn('[LDCredit] Failed to save position', e)
  }
}

async function request<T>(url: string): Promise<T> {
  const urlObj = new URL(url, window.location.href)
  const isSameOrigin = urlObj.origin === window.location.origin

  const headers: Record<string, string> = {
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'X-Requested-With': 'XMLHttpRequest'
  }

  const csrfToken = getCsrfToken()
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken
  }

  if (urlObj.hostname.includes('linux.do')) {
    headers['Referer'] = 'https://linux.do/'
    headers['Discourse-Logged-In'] = 'true'
  } else if (urlObj.hostname.includes('credit.linux.do')) {
    headers['Referer'] = 'https://credit.linux.do/home'
  }

  if (isSameOrigin) {
    const res = await fetch(url, {
      headers: headers,
      credentials: 'include'
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }

  // 跨域请求通过 background 代理，避免 CORS
  const chromeAPI = (window as any).chrome
  if (chromeAPI?.runtime?.sendMessage) {
    const data = await new Promise<T>((resolve, reject) => {
      chromeAPI.runtime.sendMessage(
        {
          type: 'PROXY_FETCH',
          options: {
            url,
            method: 'GET',
            headers,
            includeCookies: true,
            cookieDomain: urlObj.hostname,
            responseType: 'json'
          }
        },
        (resp: any) => {
          if (resp?.success && resp?.ok !== false) {
            resolve(resp.data as T)
          } else {
            reject(new Error(resp?.error || `Proxy fetch failed: ${resp?.status || 'unknown'}`))
          }
        }
      )
    })
    return data
  }

  const res = await fetch(url, {
    headers: headers,
    credentials: 'include'
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function updateDisplay() {
  if (!shadowRoot) return
  const widget = shadowRoot.getElementById('ldc-mini')
  const tooltip = shadowRoot.getElementById('ldc-tooltip')
  if (!widget) return

  if (state.gamificationScore !== null && state.communityBalance !== null) {
    const diff = state.gamificationScore - state.communityBalance
    const sign = diff >= 0 ? '+' : ''
    widget.textContent = `${sign}${diff.toFixed(2)}`
    state.tooltipContent = `仅供参考，可能有误差！\n当前分：${state.gamificationScore.toFixed(2)}\n基准值：${state.communityBalance.toFixed(2)}`
    if (tooltip && tooltip.style.opacity === '1') tooltip.textContent = state.tooltipContent
    widget.className = diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'neutral'
    widget.style.removeProperty('cursor')
  } else if (state.communityBalance !== null) {
    widget.textContent = '·'
    widget.className = 'loading'
    state.tooltipContent = '仅供参考，可能有误差！\n正在获取实时积分...'
  }
}

function handleError(msg: string) {
  if (!shadowRoot) return
  const widget = shadowRoot.getElementById('ldc-mini')
  if (widget) {
    widget.textContent = '!'
    state.tooltipContent = `出错啦！\n${msg}\n(请检查是否已登录相关站点)`
    widget.classList.add('negative')
    if (widget.classList.contains('loading')) widget.classList.remove('loading')
  }
}

async function fetchGamificationByUsername(forceRefresh = false) {
  if (!state.username) return

  // 检查缓存
  const cache = loadCache(GAMIFICATION_CACHE_KEY)
  const now = Date.now()

  // 如果缓存有效，且非强制刷新，且缓存的用户名匹配
  if (
    !forceRefresh &&
    cache &&
    now - cache.timestamp < CACHE_DURATION &&
    cache.data?.username === state.username &&
    cache.data?.score !== undefined
  ) {
    state.gamificationScore = cache.data.score
    updateDisplay()
    return
  }

  try {
    // 尝试 Card 接口
    const cardData = await request<{ user?: { gamification_score?: number } }>(
      `https://linux.do/u/${state.username}/card.json`
    )
    if (cardData?.user?.gamification_score !== undefined) {
      state.gamificationScore = cardData.user.gamification_score
      updateDisplay()
      saveCache(GAMIFICATION_CACHE_KEY, {
        username: state.username,
        score: state.gamificationScore
      })
      return
    }
    // 兜底：完整用户资料接口
    const profileData = await request<{ user?: { gamification_score?: number } }>(
      `https://linux.do/u/${state.username}.json`
    )
    if (profileData?.user?.gamification_score !== undefined) {
      state.gamificationScore = profileData.user.gamification_score
      updateDisplay()
      saveCache(GAMIFICATION_CACHE_KEY, {
        username: state.username,
        score: state.gamificationScore
      })
    }
  } catch (e) {
    console.error('[LDCredit] Fetch gamification error', e)
    // 错误时尝试使用过期缓存
    if (cache && cache.data?.username === state.username && cache.data?.score !== undefined) {
      console.warn('[LDCredit] Gamification API failed, using expired cache')
      state.gamificationScore = cache.data.score
      updateDisplay()
    }
  }
}

async function fetchData(forceRefresh = false) {
  try {
    let creditData: any

    // 检查缓存
    const cache = loadCache(CACHE_KEY)
    const now = Date.now()

    if (!forceRefresh && cache && now - cache.timestamp < CACHE_DURATION) {
      console.log('[LDCredit] Using cached data')
      creditData = cache.data
    } else {
      console.log('[LDCredit] Fetching new data')
      creditData = await request<{
        data?: {
          'community-balance'?: string | number
          community_balance?: string | number
          username?: string
          nickname?: string
        }
      }>('https://credit.linux.do/api/v1/oauth/user-info')

      if (creditData?.data) {
        saveCache(CACHE_KEY, creditData)
      }
    }

    if (creditData?.data) {
      state.communityBalance = parseFloat(
        String(creditData.data['community-balance'] || creditData.data.community_balance || 0)
      )
      state.username = creditData.data.username || creditData.data.nickname || null
      updateDisplay()
      if (state.username) await fetchGamificationByUsername(forceRefresh)
    }
  } catch (e) {
    console.error('[LDCredit] Fetch balance error', e)
    // 如果请求失败且有缓存，尝试使用缓存（即使过期）
    const cache = loadCache(CACHE_KEY)
    if (cache) {
      console.warn('[LDCredit] API failed, using expired cache')
      const creditData = cache.data
      if (creditData?.data) {
        state.communityBalance = parseFloat(
          String(creditData.data['community-balance'] || creditData.data.community_balance || 0)
        )
        state.username = creditData.data.username || creditData.data.nickname || null
        updateDisplay()
        if (state.username) await fetchGamificationByUsername(forceRefresh)
        return
      }
    }
    handleError('Credit API 异常')
  }
}

function createWidget() {
  // 创建 Shadow DOM host
  const host = createE('div', { id: 'ldc-credit-host' })
  DOA(host)

  shadowRoot = host.attachShadow({ mode: 'open' })

  // 注入样式
  const style = createE('style', { text: css })
  shadowRoot.appendChild(style)

  // 创建 widget
  const widget = createE('div', {
    id: 'ldc-mini',
    class: 'loading',
    text: '···'
  })

  // 创建 tooltip
  const tooltip = createE('div', { id: 'ldc-tooltip' })

  // 设置位置
  const savedPos = loadPosition()
  Object.assign(widget.style, savedPos)

  shadowRoot.appendChild(widget)
  shadowRoot.appendChild(tooltip)

  // Tooltip 显示/隐藏
  widget.addEventListener('mouseenter', () => {
    if (state.isDragging) return
    const rect = widget.getBoundingClientRect()
    tooltip.textContent = state.tooltipContent
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

  widget.addEventListener('mouseleave', () => {
    tooltip.style.opacity = '0'
  })

  // 拖拽功能
  let startX: number, startY: number, startRight: number, startBottom: number

  widget.addEventListener('mousedown', e => {
    if (e.button !== 0) return
    state.isDragging = false
    startX = e.clientX
    startY = e.clientY
    const rect = widget.getBoundingClientRect()
    startRight = window.innerWidth - rect.right
    startBottom = window.innerHeight - rect.bottom
    e.preventDefault()
    tooltip.style.opacity = '0'

    const onMouseMove = (moveEvent: MouseEvent) => {
      state.isDragging = true
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
      if (state.isDragging) {
        savePosition({ right: widget.style.right, bottom: widget.style.bottom })
        setTimeout(() => (state.isDragging = false), 50)
      }
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  })

  // 点击刷新
  widget.addEventListener('click', () => {
    if (!state.isDragging) {
      widget.className = 'loading'
      widget.textContent = '···'
      state.tooltipContent = '刷新中...'
      const t = shadowRoot?.getElementById('ldc-tooltip')
      if (t && t.style.opacity === '1') t.textContent = state.tooltipContent
      fetchData(true) // 强制刷新
    }
  })
}

let creditInitialized = false

export async function initLinuxDoCredit() {
  // 检查是否在 linux.do 或 credit.linux.do 域名
  const hostname = window.location.hostname
  if (!hostname.includes('linux.do')) {
    return
  }

  if (creditInitialized || document.getElementById('ldc-credit-host')) {
    console.warn('[LDCredit] Already initialized, skip')
    return
  }
  creditInitialized = true

  createWidget()

  // 延迟首次获取
  setTimeout(fetchData, 500)

  // 定期刷新
  refreshInterval = setInterval(fetchData, REFRESH_INTERVAL)

  console.log('[LDCredit] Initialized')
}

export function destroyLinuxDoCredit() {
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }
  const host = document.getElementById('ldc-credit-host')
  if (host) host.remove()
  creditInitialized = false
  shadowRoot = null
  console.log('[LDCredit] Destroyed')
}
