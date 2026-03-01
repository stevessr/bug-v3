import { getChromeAPI } from '../utils/main'

import type { BrowseStrategy } from '@/types/type'
import { DEFAULT_MCP_BRIDGE_SETTINGS, type McpBridgeSettings } from '@/agent/types'

const MCP_BRIDGE_SETTINGS_KEY = 'mcp-bridge-settings-v1'

// 连接保活配置
const HEARTBEAT_INTERVAL = 30000 // 心跳间隔：30 秒
const HEARTBEAT_TIMEOUT = 10000 // 心跳超时：10 秒
const RECONNECT_BASE_DELAY = 1000 // 重连基础延迟：1 秒
const RECONNECT_MAX_DELAY = 30000 // 重连最大延迟：30 秒
const RECONNECT_MULTIPLIER = 1.5 // 重连延迟倍数

type McpToolCallMessage = {
  type: 'MCP_TOOL_CALL'
  id: string
  tool: string
  args?: Record<string, any>
}

type McpToolResultMessage = {
  type: 'MCP_TOOL_RESULT'
  id: string
  result?: any
  error?: string
}

type McpPingMessage = {
  type: 'MCP_PING'
  timestamp: number
}

type McpPongMessage = {
  type: 'MCP_PONG'
  timestamp: number
}

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null
let disabled = false
let reconnectAttempts = 0
let lastPongTime = 0
let connectionListeners: Array<(status: McpConnectionStatus) => void> = []

export type McpConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting'
let currentStatus: McpConnectionStatus = 'disconnected'

async function getDiscourseCsrfToken(baseUrl: string): Promise<string> {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI) return ''

  let host = ''
  let origin = ''
  try {
    const parsed = new URL(baseUrl)
    host = parsed.hostname
    origin = parsed.origin
  } catch {
    return ''
  }

  try {
    if (chromeAPI.cookies?.getAll) {
      const cookies = await chromeAPI.cookies.getAll({ domain: host })
      const tokenCookie = cookies.find((cookie: any) =>
        ['csrf_token', 'XSRF-TOKEN', '_csrf'].includes(cookie.name)
      )
      if (tokenCookie?.value) return tokenCookie.value
    }
  } catch {
    // ignore cookie failures
  }

  try {
    if (chromeAPI.tabs?.query) {
      const tabs = await chromeAPI.tabs.query({ url: `${origin}/*` })
      for (const tab of tabs) {
        if (!tab.id) continue
        try {
          const resp = await chromeAPI.tabs.sendMessage(tab.id, { type: 'GET_CSRF_TOKEN' })
          if (resp?.csrfToken) return resp.csrfToken
        } catch {
          continue
        }
      }
    }
  } catch {
    // ignore tab failures
  }

  return ''
}

async function buildDiscourseHeaders(
  baseUrl: string,
  headers: Record<string, string>
): Promise<Record<string, string>> {
  const csrfToken = await getDiscourseCsrfToken(baseUrl)
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken
  return headers
}

function isDiscoursePostLiked(post: any): boolean {
  if (post?.current_user_reaction) return true
  if (Array.isArray(post?.actions_summary)) {
    const likeAction = post.actions_summary.find((a: any) => a.id === 2)
    if (likeAction?.acted) return true
  }
  return false
}

async function fetchDiscoursePost(baseUrl: string, postId: number): Promise<any> {
  const postUrl = `${baseUrl}/posts/${postId}.json`
  const postResp = await fetch(postUrl, {
    credentials: 'include',
    headers: { Accept: 'application/json' }
  })
  if (!postResp.ok) {
    throw new Error(`获取帖子失败：HTTP ${postResp.status}`)
  }
  return postResp.json()
}

async function toggleDiscourseReaction(
  baseUrl: string,
  postId: number,
  reactionId: string
): Promise<{ ok: boolean; data?: any }> {
  const url = `${baseUrl}/discourse-reactions/posts/${postId}/custom-reactions/${reactionId}/toggle.json`
  const headers = await buildDiscourseHeaders(baseUrl, {
    'X-Requested-With': 'XMLHttpRequest',
    'Content-Type': 'application/json',
    'Discourse-Logged-In': 'true'
  })
  const response = await fetch(url, {
    method: 'PUT',
    credentials: 'include',
    headers
  })
  const data = await response.json().catch(() => null)
  return { ok: response.ok, data }
}

// ============ MCP 桥接设置管理 ============

let cachedSettings: McpBridgeSettings | null = null

export async function loadMcpBridgeSettings(): Promise<McpBridgeSettings> {
  if (cachedSettings) return cachedSettings

  const chromeAPI = getChromeAPI()
  if (!chromeAPI?.storage?.local) {
    return { ...DEFAULT_MCP_BRIDGE_SETTINGS }
  }

  try {
    const result = await chromeAPI.storage.local.get(MCP_BRIDGE_SETTINGS_KEY)
    const stored = result[MCP_BRIDGE_SETTINGS_KEY]
    if (stored) {
      const merged = { ...DEFAULT_MCP_BRIDGE_SETTINGS, ...stored }
      cachedSettings = merged
      return merged
    }
  } catch {
    // ignore
  }

  return { ...DEFAULT_MCP_BRIDGE_SETTINGS }
}

export async function saveMcpBridgeSettings(settings: Partial<McpBridgeSettings>): Promise<void> {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI?.storage?.local) return

  const current = await loadMcpBridgeSettings()
  const updated = { ...current, ...settings }
  cachedSettings = updated

  try {
    await chromeAPI.storage.local.set({ [MCP_BRIDGE_SETTINGS_KEY]: updated })
  } catch {
    // ignore
  }
}

export function getMcpBridgeSettingsSync(): McpBridgeSettings {
  return cachedSettings || { ...DEFAULT_MCP_BRIDGE_SETTINGS }
}

async function getWsUrl(): Promise<string> {
  const settings = await loadMcpBridgeSettings()
  const protocol = await detectProtocol(settings)
  return `${protocol}://${settings.host}:${settings.port}${settings.path}`
}

// 检测应该使用的协议
async function detectProtocol(settings: McpBridgeSettings): Promise<'ws' | 'wss'> {
  // 如果明确指定了协议，直接使用
  if (settings.protocol === 'ws') return 'ws'
  if (settings.protocol === 'wss') return 'wss'

  // auto 模式：根据主机判断默认协议
  const isLocalhost =
    settings.host === 'localhost' ||
    settings.host === '127.0.0.1' ||
    settings.host === '::1' ||
    settings.host.endsWith('.local')

  // 本地连接默认使用 ws，远程连接默认使用 wss
  const defaultProtocol = isLocalhost ? 'ws' : 'wss'
  const fallbackProtocol = isLocalhost ? 'wss' : 'ws'

  // 尝试探测默认协议是否可用
  const testUrl = `${defaultProtocol === 'ws' ? 'http' : 'https'}://${settings.host}:${settings.port}/health`

  try {
    const response = await fetch(testUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(2000)
    })
    if (response.ok) {
      console.log(`[MCP] Protocol auto-detected: ${defaultProtocol}`)
      return defaultProtocol
    }
  } catch {
    // 默认协议不可用，尝试回退协议
    console.log(`[MCP] Default protocol ${defaultProtocol} failed, trying ${fallbackProtocol}`)
  }

  // 尝试回退协议
  const fallbackTestUrl = `${fallbackProtocol === 'ws' ? 'http' : 'https'}://${settings.host}:${settings.port}/health`

  try {
    const response = await fetch(fallbackTestUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(2000)
    })
    if (response.ok) {
      console.log(`[MCP] Protocol auto-detected (fallback): ${fallbackProtocol}`)
      return fallbackProtocol
    }
  } catch {
    // 回退协议也不可用
  }

  // 都不可用时返回默认协议
  console.log(`[MCP] Protocol detection failed, using default: ${defaultProtocol}`)
  return defaultProtocol
}

function updateStatus(status: McpConnectionStatus) {
  if (currentStatus !== status) {
    currentStatus = status
    console.log('[MCP] Status changed:', status)
    connectionListeners.forEach(listener => {
      try {
        listener(status)
      } catch {
        // ignore listener errors
      }
    })
  }
}

export function onMcpConnectionChange(listener: (status: McpConnectionStatus) => void): () => void {
  connectionListeners.push(listener)
  // 立即通知当前状态
  listener(currentStatus)
  return () => {
    connectionListeners = connectionListeners.filter(l => l !== listener)
  }
}

function clearReconnectTimer() {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

function clearHeartbeatTimers() {
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
  if (heartbeatTimeoutTimer !== null) {
    clearTimeout(heartbeatTimeoutTimer)
    heartbeatTimeoutTimer = null
  }
}

function calculateReconnectDelay(): number {
  const delay = Math.min(
    RECONNECT_BASE_DELAY * Math.pow(RECONNECT_MULTIPLIER, reconnectAttempts),
    RECONNECT_MAX_DELAY
  )
  return delay + Math.random() * 1000 // 添加随机抖动
}

function scheduleReconnect() {
  if (reconnectTimer !== null || disabled) return

  const delay = calculateReconnectDelay()
  reconnectAttempts++
  updateStatus('reconnecting')

  console.log(`[MCP] Scheduling reconnect in ${Math.round(delay)}ms (attempt ${reconnectAttempts})`)

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connect()
  }, delay)
}

function startHeartbeat() {
  clearHeartbeatTimers()
  lastPongTime = Date.now()

  heartbeatTimer = setInterval(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      clearHeartbeatTimers()
      return
    }

    // 发送心跳
    const ping: McpPingMessage = {
      type: 'MCP_PING',
      timestamp: Date.now()
    }

    try {
      ws.send(JSON.stringify(ping))
      console.log('[MCP] Heartbeat ping sent')
    } catch (error) {
      console.warn('[MCP] Failed to send heartbeat:', error)
      handleConnectionLost()
      return
    }

    // 设置心跳超时检测
    heartbeatTimeoutTimer = setTimeout(() => {
      const timeSinceLastPong = Date.now() - lastPongTime
      if (timeSinceLastPong > HEARTBEAT_INTERVAL + HEARTBEAT_TIMEOUT) {
        console.warn('[MCP] Heartbeat timeout, connection may be dead')
        handleConnectionLost()
      }
    }, HEARTBEAT_TIMEOUT)
  }, HEARTBEAT_INTERVAL)
}

function handlePong(message: McpPongMessage) {
  lastPongTime = Date.now()
  const latency = lastPongTime - message.timestamp
  console.log(`[MCP] Heartbeat pong received, latency: ${latency}ms`)

  if (heartbeatTimeoutTimer) {
    clearTimeout(heartbeatTimeoutTimer)
    heartbeatTimeoutTimer = null
  }
}

function handleConnectionLost() {
  clearHeartbeatTimers()

  if (ws) {
    try {
      ws.close()
    } catch {
      // ignore
    }
    ws = null
  }

  updateStatus('disconnected')
  scheduleReconnect()
}

export function setMcpBridgeDisabled(value: boolean) {
  disabled = value
  if (disabled) {
    clearReconnectTimer()
    clearHeartbeatTimers()
    if (ws) {
      try {
        ws.close()
      } catch {
        // ignore
      }
      ws = null
    }
    updateStatus('disconnected')
    reconnectAttempts = 0
  }
}

export async function testMcpBridge(): Promise<{ ok: boolean; error?: string }> {
  if (disabled) {
    return { ok: false, error: 'MCP 桥接已关闭' }
  }

  // Test HTTP health endpoint
  try {
    const settings = await loadMcpBridgeSettings()
    const protocol = await detectProtocol(settings)
    const httpProtocol = protocol === 'wss' ? 'https' : 'http'
    const healthUrl = `${httpProtocol}://${settings.host}:${settings.port}/health`
    const response = await fetch(healthUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    })

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` }
    }

    const data = await response.json()
    return { ok: data.ok === true, error: data.ok ? undefined : 'MCP Server 未就绪' }
  } catch (error: any) {
    return { ok: false, error: error?.message || '连接失败' }
  }
}

export async function testMcpServer(options: {
  url: string
  headers?: Record<string, string>
  transport?: string
}): Promise<{ ok: boolean; error?: string; status?: number }> {
  if (!options.url) return { ok: false, error: '缺少服务地址' }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 4000)
  try {
    const headers = new Headers(options.headers || {})
    if (options.transport === 'sse' && !headers.has('Accept')) {
      headers.set('Accept', 'text/event-stream')
    }
    const resp = await fetch(options.url, {
      method: 'GET',
      headers,
      signal: controller.signal,
      redirect: 'follow',
      credentials: 'omit'
    })
    clearTimeout(timeout)
    if (!resp.ok) {
      return { ok: false, status: resp.status, error: `HTTP ${resp.status}` }
    }
    return { ok: true, status: resp.status }
  } catch (error: any) {
    clearTimeout(timeout)
    return { ok: false, error: error?.message || '连接失败' }
  }
}

async function getActiveTabId(chromeAPI: typeof chrome): Promise<number | null> {
  if (!chromeAPI.tabs?.query) return null
  const tabs = await chromeAPI.tabs.query({ active: true, currentWindow: true })
  return tabs[0]?.id ?? null
}

async function getTabId(chromeAPI: typeof chrome, tabId?: number): Promise<number | null> {
  if (typeof tabId === 'number') return tabId
  return getActiveTabId(chromeAPI)
}

async function sendActionToTab(chromeAPI: typeof chrome, tabId: number, action: any): Promise<any> {
  if (!chromeAPI.tabs?.sendMessage) {
    throw new Error('无法发送消息到内容脚本')
  }
  return new Promise((resolve, reject) => {
    chromeAPI.tabs.sendMessage(tabId, { type: 'AGENT_ACTION', action }, response => {
      if (chromeAPI.runtime.lastError) {
        reject(new Error(chromeAPI.runtime.lastError.message))
        return
      }
      if (!response?.success) {
        reject(new Error(response?.error || '动作执行失败'))
        return
      }
      resolve(response?.data)
    })
  })
}

async function sendQueryToTab(chromeAPI: typeof chrome, tabId: number, payload: any): Promise<any> {
  if (!chromeAPI.tabs?.sendMessage) {
    throw new Error('无法发送消息到内容脚本')
  }
  return new Promise((resolve, reject) => {
    chromeAPI.tabs.sendMessage(tabId, payload, response => {
      if (chromeAPI.runtime.lastError) {
        reject(new Error(chromeAPI.runtime.lastError.message))
        return
      }
      if (!response?.success) {
        reject(new Error(response?.error || 'DOM 查询失败'))
        return
      }
      resolve(response?.data)
    })
  })
}
async function captureScreenshot(
  chromeAPI: typeof chrome,
  tabId?: number,
  format: 'png' | 'jpeg' = 'png'
): Promise<any> {
  if (!chromeAPI.tabs?.captureVisibleTab) {
    throw new Error('无法截图')
  }
  let windowId: number | undefined
  if (typeof tabId === 'number' && chromeAPI.tabs?.get) {
    try {
      const tab = await chromeAPI.tabs.get(tabId)
      windowId = tab?.windowId
    } catch {
      windowId = undefined
    }
  }

  return new Promise((resolve, reject) => {
    const targetWindowId = typeof windowId === 'number' ? windowId : undefined
    chromeAPI.tabs.captureVisibleTab(targetWindowId as number, { format }, dataUrl => {
      if (chromeAPI.runtime.lastError) {
        reject(new Error(chromeAPI.runtime.lastError.message))
        return
      }
      resolve({ dataUrl })
    })
  })
}

async function listTabs(chromeAPI: typeof chrome) {
  if (!chromeAPI.tabs?.query) return []
  const tabs = await chromeAPI.tabs.query({})
  return tabs.map(tab => ({
    id: tab.id,
    title: tab.title,
    url: tab.url,
    active: tab.active,
    windowId: tab.windowId
  }))
}

function mapWindow(window: chrome.windows.Window) {
  return {
    id: window.id,
    focused: window.focused,
    incognito: window.incognito,
    state: window.state,
    type: window.type,
    left: window.left,
    top: window.top,
    width: window.width,
    height: window.height,
    tabs: window.tabs
      ? window.tabs.map(tab => ({
          id: tab.id,
          title: tab.title,
          url: tab.url,
          active: tab.active,
          windowId: tab.windowId
        }))
      : undefined
  }
}

async function handleToolCall(chromeAPI: typeof chrome, message: McpToolCallMessage) {
  const args = message.args || {}
  switch (message.tool) {
    case 'chrome.list_tabs':
      return listTabs(chromeAPI)

    case 'chrome.get_active_tab': {
      const tabId = await getActiveTabId(chromeAPI)
      if (!tabId) throw new Error('未找到活动标签页')
      const tab = await chromeAPI.tabs.get(tabId)
      return {
        id: tab.id,
        title: tab.title,
        url: tab.url,
        active: tab.active,
        windowId: tab.windowId
      }
    }

    case 'chrome.tab_create': {
      if (!chromeAPI.tabs?.create) throw new Error('无法创建标签页')
      const tab = await chromeAPI.tabs.create({
        url: args.url,
        active: args.active,
        index: args.index,
        windowId: args.windowId,
        pinned: args.pinned
      })
      return {
        id: tab.id,
        title: tab.title,
        url: tab.url,
        active: tab.active,
        windowId: tab.windowId
      }
    }

    case 'chrome.tab_focus': {
      if (typeof args.tabId !== 'number') throw new Error('缺少 tabId')
      if (!chromeAPI.tabs?.update) throw new Error('无法激活标签页')
      await chromeAPI.tabs.update(args.tabId, { active: true })
      return { success: true }
    }

    case 'chrome.tab_close': {
      if (!chromeAPI.tabs?.remove) throw new Error('无法关闭标签页')
      if (typeof args.tabId !== 'number') throw new Error('缺少 tabId')
      await chromeAPI.tabs.remove(args.tabId)
      return { success: true }
    }

    case 'chrome.tab_reload': {
      if (!chromeAPI.tabs?.reload) throw new Error('无法刷新标签页')
      const tabId = await getTabId(chromeAPI, args.tabId)
      if (!tabId) throw new Error('未找到活动标签页')
      await chromeAPI.tabs.reload(tabId, { bypassCache: Boolean(args.bypassCache) })
      return { success: true }
    }

    case 'chrome.tab_back': {
      if (!chromeAPI.tabs?.goBack) throw new Error('无法后退')
      const tabId = await getTabId(chromeAPI, args.tabId)
      if (!tabId) throw new Error('未找到活动标签页')
      await chromeAPI.tabs.goBack(tabId)
      return { success: true }
    }

    case 'chrome.tab_forward': {
      if (!chromeAPI.tabs?.goForward) throw new Error('无法前进')
      const tabId = await getTabId(chromeAPI, args.tabId)
      if (!tabId) throw new Error('未找到活动标签页')
      await chromeAPI.tabs.goForward(tabId)
      return { success: true }
    }

    case 'chrome.tab_duplicate': {
      if (!chromeAPI.tabs?.duplicate) throw new Error('无法复制标签页')
      if (typeof args.tabId !== 'number') throw new Error('缺少 tabId')
      const tab = await chromeAPI.tabs.duplicate(args.tabId)
      return {
        id: tab?.id,
        title: tab?.title,
        url: tab?.url,
        active: tab?.active,
        windowId: tab?.windowId
      }
    }

    case 'chrome.tab_move': {
      if (!chromeAPI.tabs?.move) throw new Error('无法移动标签页')
      if (typeof args.tabId !== 'number') throw new Error('缺少 tabId')
      if (typeof args.index !== 'number') throw new Error('缺少 index')
      const tab = await chromeAPI.tabs.move(args.tabId, {
        index: args.index,
        windowId: args.windowId
      })
      return {
        id: Array.isArray(tab) ? tab[0]?.id : tab?.id,
        title: Array.isArray(tab) ? tab[0]?.title : tab?.title,
        url: Array.isArray(tab) ? tab[0]?.url : tab?.url,
        active: Array.isArray(tab) ? tab[0]?.active : tab?.active,
        windowId: Array.isArray(tab) ? tab[0]?.windowId : tab?.windowId
      }
    }

    case 'chrome.tab_pin': {
      if (!chromeAPI.tabs?.update) throw new Error('无法固定标签页')
      if (typeof args.tabId !== 'number') throw new Error('缺少 tabId')
      await chromeAPI.tabs.update(args.tabId, { pinned: true })
      return { success: true }
    }

    case 'chrome.tab_unpin': {
      if (!chromeAPI.tabs?.update) throw new Error('无法取消固定标签页')
      if (typeof args.tabId !== 'number') throw new Error('缺少 tabId')
      await chromeAPI.tabs.update(args.tabId, { pinned: false })
      return { success: true }
    }

    case 'chrome.tab_mute': {
      if (!chromeAPI.tabs?.update) throw new Error('无法静音标签页')
      if (typeof args.tabId !== 'number') throw new Error('缺少 tabId')
      await chromeAPI.tabs.update(args.tabId, { muted: true })
      return { success: true }
    }

    case 'chrome.tab_unmute': {
      if (!chromeAPI.tabs?.update) throw new Error('无法取消静音标签页')
      if (typeof args.tabId !== 'number') throw new Error('缺少 tabId')
      await chromeAPI.tabs.update(args.tabId, { muted: false })
      return { success: true }
    }

    case 'chrome.tab_highlight': {
      if (!chromeAPI.tabs?.highlight) throw new Error('无法高亮标签页')
      const tabIds = Array.isArray(args.tabIds) ? args.tabIds : []
      if (tabIds.length === 0) throw new Error('缺少 tabIds')
      const windowId = typeof args.windowId === 'number' ? args.windowId : undefined
      await chromeAPI.tabs.highlight({ tabs: tabIds, windowId })
      return { success: true }
    }

    case 'chrome.tab_zoom_get': {
      if (!chromeAPI.tabs?.getZoom) throw new Error('无法获取缩放比例')
      const tabId = await getTabId(chromeAPI, args.tabId)
      if (!tabId) throw new Error('未找到活动标签页')
      const zoom = await chromeAPI.tabs.getZoom(tabId)
      return { zoomFactor: zoom }
    }

    case 'chrome.tab_zoom_set': {
      if (!chromeAPI.tabs?.setZoom) throw new Error('无法设置缩放比例')
      const tabId = await getTabId(chromeAPI, args.tabId)
      if (!tabId) throw new Error('未找到活动标签页')
      if (typeof args.zoomFactor !== 'number') throw new Error('缺少 zoomFactor')
      await chromeAPI.tabs.setZoom(tabId, args.zoomFactor)
      return { success: true }
    }

    case 'chrome.tab_group': {
      if (!chromeAPI.tabs?.group) throw new Error('无法分组标签页')
      const tabIds = Array.isArray(args.tabIds) ? args.tabIds : []
      if (tabIds.length === 0) throw new Error('缺少 tabIds')
      const groupId = await chromeAPI.tabs.group({
        tabIds: tabIds as [number, ...number[]],
        groupId: args.groupId
      })
      return { groupId }
    }

    case 'chrome.tabs_group': {
      if (!chromeAPI.tabs?.group) throw new Error('无法分组标签页')
      const tabIds = Array.isArray(args.tabIds) ? args.tabIds : []
      if (tabIds.length === 0) throw new Error('缺少 tabIds')
      const groupId = await chromeAPI.tabs.group({
        tabIds: tabIds as [number, ...number[]],
        groupId: args.groupId
      })
      if (chromeAPI.tabGroups?.update && (args.title || args.color)) {
        await chromeAPI.tabGroups.update(groupId, {
          title: args.title,
          color: args.color
        })
      }
      return { groupId }
    }

    case 'chrome.tab_ungroup': {
      if (!chromeAPI.tabs?.ungroup) throw new Error('无法取消分组标签页')
      const tabIds = Array.isArray(args.tabIds) ? args.tabIds : []
      if (tabIds.length === 0) throw new Error('缺少 tabIds')
      await chromeAPI.tabs.ungroup(tabIds as [number, ...number[]])
      return { success: true }
    }

    case 'chrome.window_list': {
      if (!chromeAPI.windows?.getAll) throw new Error('无法获取窗口列表')
      const populate = Boolean(args.populate)
      const windows = await chromeAPI.windows.getAll({ populate })
      return windows.map(mapWindow)
    }

    case 'chrome.window_get': {
      if (!chromeAPI.windows?.get) throw new Error('无法获取窗口')
      if (typeof args.windowId !== 'number') throw new Error('缺少 windowId')
      const window = await chromeAPI.windows.get(args.windowId, {
        populate: Boolean(args.populate)
      })
      if (!window) throw new Error('无法获取窗口')
      return mapWindow(window)
    }

    case 'chrome.window_current': {
      if (!chromeAPI.windows?.getCurrent) throw new Error('无法获取当前窗口')
      const window = await chromeAPI.windows.getCurrent({ populate: Boolean(args.populate) })
      if (!window) throw new Error('无法获取当前窗口')
      return mapWindow(window)
    }

    case 'chrome.window_create': {
      if (!chromeAPI.windows?.create) throw new Error('无法创建窗口')
      const window = await chromeAPI.windows.create({
        url: args.url,
        focused: args.focused,
        incognito: args.incognito,
        state: args.state,
        left: args.left,
        top: args.top,
        width: args.width,
        height: args.height
      })
      if (!window) throw new Error('无法创建窗口')
      return mapWindow(window)
    }

    case 'chrome.window_update': {
      if (!chromeAPI.windows?.update) throw new Error('无法更新窗口')
      if (typeof args.windowId !== 'number') throw new Error('缺少 windowId')
      const window = await chromeAPI.windows.update(args.windowId, {
        focused: args.focused,
        state: args.state,
        left: args.left,
        top: args.top,
        width: args.width,
        height: args.height
      })
      if (!window) throw new Error('无法更新窗口')
      return mapWindow(window)
    }

    case 'chrome.window_focus': {
      if (!chromeAPI.windows?.update) throw new Error('无法更新窗口')
      if (typeof args.windowId !== 'number') throw new Error('缺少 windowId')
      const window = await chromeAPI.windows.update(args.windowId, { focused: true })
      if (!window) throw new Error('无法更新窗口')
      return mapWindow(window)
    }

    case 'chrome.window_close': {
      if (!chromeAPI.windows?.remove) throw new Error('无法关闭窗口')
      if (typeof args.windowId !== 'number') throw new Error('缺少 windowId')
      await chromeAPI.windows.remove(args.windowId)
      return { success: true }
    }

    case 'chrome.activate_tab': {
      if (typeof args.tabId !== 'number') throw new Error('缺少 tabId')
      if (!chromeAPI.tabs?.update) throw new Error('无法激活标签页')
      await chromeAPI.tabs.update(args.tabId, { active: true })
      return { success: true }
    }

    case 'chrome.navigate': {
      const url = String(args.url || '')
      if (!url) throw new Error('缺少 url')
      if (!chromeAPI.tabs?.update) throw new Error('无法切换 URL')
      const tabId = await getTabId(chromeAPI, args.tabId)
      if (!tabId) throw new Error('未找到活动标签页')
      await chromeAPI.tabs.update(tabId, { url })
      return { success: true }
    }

    case 'chrome.click':
    case 'chrome.click_dom': {
      const tabId = await getTabId(chromeAPI, args.tabId)
      if (!tabId) throw new Error('未找到活动标签页')
      const action = {
        type: message.tool === 'chrome.click_dom' ? 'click-dom' : 'click',
        selector: args.selector,
        x: typeof args.x === 'number' ? args.x : undefined,
        y: typeof args.y === 'number' ? args.y : undefined
      }
      return sendActionToTab(chromeAPI, tabId, action)
    }

    case 'chrome.double_click':
    case 'chrome.right_click':
    case 'chrome.hover':
    case 'chrome.focus':
    case 'chrome.blur': {
      const tabId = await getTabId(chromeAPI, args.tabId)
      if (!tabId) throw new Error('未找到活动标签页')
      const typeMap: Record<string, string> = {
        'chrome.double_click': 'double-click',
        'chrome.right_click': 'right-click',
        'chrome.hover': 'hover',
        'chrome.focus': 'focus',
        'chrome.blur': 'blur'
      }
      const action = {
        type: typeMap[message.tool],
        selector: args.selector,
        x: typeof args.x === 'number' ? args.x : undefined,
        y: typeof args.y === 'number' ? args.y : undefined
      }
      return sendActionToTab(chromeAPI, tabId, action)
    }

    case 'chrome.scroll': {
      const tabId = await getTabId(chromeAPI, args.tabId)
      if (!tabId) throw new Error('未找到活动标签页')
      const action = {
        type: 'scroll',
        x: typeof args.x === 'number' ? args.x : undefined,
        y: typeof args.y === 'number' ? args.y : undefined,
        behavior: args.behavior
      }
      return sendActionToTab(chromeAPI, tabId, action)
    }

    case 'chrome.key': {
      const tabId = await getTabId(chromeAPI, args.tabId)
      if (!tabId) throw new Error('未找到活动标签页')
      const action = {
        type: 'key',
        key: String(args.key || ''),
        code: args.code,
        ctrlKey: Boolean(args.ctrlKey),
        altKey: Boolean(args.altKey),
        shiftKey: Boolean(args.shiftKey),
        metaKey: Boolean(args.metaKey),
        repeat: Boolean(args.repeat)
      }
      return sendActionToTab(chromeAPI, tabId, action)
    }

    case 'chrome.type': {
      const tabId = await getTabId(chromeAPI, args.tabId)
      if (!tabId) throw new Error('未找到活动标签页')
      const action = {
        type: 'type',
        selector: args.selector,
        text: String(args.text ?? ''),
        clear: Boolean(args.clear),
        delayMs: typeof args.delayMs === 'number' ? args.delayMs : undefined
      }
      return sendActionToTab(chromeAPI, tabId, action)
    }

    case 'chrome.drag': {
      const tabId = await getTabId(chromeAPI, args.tabId)
      if (!tabId) throw new Error('未找到活动标签页')
      const action = {
        type: 'drag',
        selector: args.selector,
        x: typeof args.x === 'number' ? args.x : undefined,
        y: typeof args.y === 'number' ? args.y : undefined,
        targetSelector: args.targetSelector,
        toX: typeof args.toX === 'number' ? args.toX : undefined,
        toY: typeof args.toY === 'number' ? args.toY : undefined
      }
      return sendActionToTab(chromeAPI, tabId, action)
    }

    case 'chrome.select': {
      const tabId = await getTabId(chromeAPI, args.tabId)
      if (!tabId) throw new Error('未找到活动标签页')
      const action = {
        type: 'select',
        selector: args.selector,
        value: args.value,
        label: args.label
      }
      return sendActionToTab(chromeAPI, tabId, action)
    }

    case 'chrome.input': {
      const tabId = await getTabId(chromeAPI, args.tabId)
      if (!tabId) throw new Error('未找到活动标签页')
      const action = {
        type: 'input',
        selector: args.selector,
        text: String(args.text ?? ''),
        clear: Boolean(args.clear)
      }
      return sendActionToTab(chromeAPI, tabId, action)
    }

    case 'chrome.touch': {
      const tabId = await getTabId(chromeAPI, args.tabId)
      if (!tabId) throw new Error('未找到活动标签页')
      const action = {
        type: 'touch',
        selector: args.selector,
        x: typeof args.x === 'number' ? args.x : undefined,
        y: typeof args.y === 'number' ? args.y : undefined
      }
      return sendActionToTab(chromeAPI, tabId, action)
    }

    case 'chrome.screenshot': {
      const format = args.format === 'jpeg' ? 'jpeg' : 'png'
      const result = await captureScreenshot(chromeAPI, args.tabId, format)
      return result
    }

    case 'chrome.dom_tree': {
      const tabId = await getTabId(chromeAPI, args.tabId)
      if (!tabId) throw new Error('未找到活动标签页')
      return sendQueryToTab(chromeAPI, tabId, {
        type: 'DOM_QUERY',
        kind: 'tree',
        selector: args.selector,
        options: args.options || {}
      })
    }

    case 'chrome.dom_at_point': {
      const tabId = await getTabId(chromeAPI, args.tabId)
      if (!tabId) throw new Error('未找到活动标签页')
      if (typeof args.x !== 'number' || typeof args.y !== 'number') {
        throw new Error('缺少坐标')
      }
      return sendQueryToTab(chromeAPI, tabId, {
        type: 'DOM_QUERY',
        kind: 'at-point',
        x: args.x,
        y: args.y,
        options: args.options || {}
      })
    }

    case 'chrome.wait': {
      const ms = Number(args.ms || 0)
      await new Promise(resolve => setTimeout(resolve, ms))
      return { success: true, waitedMs: ms }
    }

    // ========== Discourse 工具 ==========

    case 'discourse.like_post': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const postId = Number(args.postId)
      if (!postId) throw new Error('缺少 postId')
      const reactionId = String(args.reactionId || 'heart')

      const url = `${baseUrl}/discourse-reactions/posts/${postId}/custom-reactions/${reactionId}/toggle.json`
      const headers = await buildDiscourseHeaders(baseUrl, {
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json',
        'Discourse-Logged-In': 'true'
      })
      const response = await fetch(url, {
        method: 'PUT',
        credentials: 'include',
        headers
      })

      if (!response.ok) {
        throw new Error(`点赞失败：HTTP ${response.status}`)
      }

      const data = await response.json()
      return { success: true, data }
    }

    case 'discourse.get_topic_list': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const strategy = (args.strategy || 'latest') as BrowseStrategy
      const page = Number(args.page || 0)

      const endpoints: Record<string, string> = {
        latest: '/latest.json',
        new: '/new.json',
        unread: '/unread.json',
        top: '/top.json'
      }

      const endpoint = endpoints[strategy] || endpoints.latest
      const url = `${baseUrl}${endpoint}?page=${page}`

      const response = await fetch(url, {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      })

      if (!response.ok) {
        throw new Error(`获取话题列表失败：HTTP ${response.status}`)
      }

      const data = await response.json()
      const topics = data.topic_list?.topics || []
      return {
        topics: topics.map((t: any) => ({
          id: t.id,
          title: t.title,
          slug: t.slug,
          posts_count: t.posts_count,
          views: t.views,
          like_count: t.like_count,
          created_at: t.created_at,
          last_posted_at: t.last_posted_at
        }))
      }
    }

    case 'discourse.get_topic': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const topicId = Number(args.topicId)
      if (!topicId) throw new Error('缺少 topicId')

      const url = `${baseUrl}/t/${topicId}.json`
      const response = await fetch(url, {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      })

      if (!response.ok) {
        throw new Error(`获取话题失败：HTTP ${response.status}`)
      }

      const data = await response.json()
      return {
        id: data.id,
        title: data.title,
        slug: data.slug,
        posts_count: data.posts_count,
        views: data.views,
        like_count: data.like_count,
        posts:
          data.post_stream?.posts?.map((p: any) => ({
            id: p.id,
            post_number: p.post_number,
            username: p.username,
            created_at: p.created_at,
            cooked: p.cooked,
            liked: !!(
              p.current_user_reaction || p.actions_summary?.find((a: any) => a.id === 2 && a.acted)
            )
          })) || []
      }
    }

    case 'discourse.get_post': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const postId = Number(args.postId)
      const includeRaw = Boolean(args.includeRaw)
      if (!postId) throw new Error('缺少 postId')

      const data = await fetchDiscoursePost(baseUrl, postId)
      return {
        id: data.id,
        topic_id: data.topic_id,
        post_number: data.post_number,
        username: data.username,
        created_at: data.created_at,
        cooked: data.cooked,
        raw: includeRaw ? data.raw : undefined,
        liked: isDiscoursePostLiked(data)
      }
    }

    case 'discourse.get_topic_posts': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const topicId = Number(args.topicId)
      const includeRaw = Boolean(args.includeRaw)
      const postNumbers = Array.isArray(args.postNumbers) ? args.postNumbers : []

      if (!topicId) throw new Error('缺少 topicId')
      if (postNumbers.length === 0) throw new Error('缺少 postNumbers')

      const requests = postNumbers.map(async (postNumber: number) => {
        const topicUrl = new URL(`${baseUrl}/t/${topicId}.json`)
        topicUrl.searchParams.set('post_number', String(postNumber))
        if (includeRaw) topicUrl.searchParams.set('include_raw', '1')

        const response = await fetch(topicUrl.toString(), {
          credentials: 'include',
          headers: { Accept: 'application/json' }
        })
        if (!response.ok) {
          throw new Error(`获取楼层 ${postNumber} 失败：HTTP ${response.status}`)
        }
        const data = await response.json()
        const post = (data.post_stream?.posts || []).find((p: any) => p.post_number === postNumber)
        if (!post) return null
        return {
          id: post.id,
          post_number: post.post_number,
          username: post.username,
          created_at: post.created_at,
          cooked: post.cooked,
          raw: includeRaw ? post.raw : undefined,
          liked: isDiscoursePostLiked(post)
        }
      })

      const posts = (await Promise.all(requests)).filter(Boolean)
      return { success: true, topicId, posts }
    }

    case 'discourse.get_category_list': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const url = `${baseUrl}/categories.json`
      const response = await fetch(url, {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      })
      if (!response.ok) {
        throw new Error(`获取分类失败：HTTP ${response.status}`)
      }
      const data = await response.json()
      const categories = data.category_list?.categories || []
      return {
        categories: categories.map((c: any) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          topic_count: c.topic_count,
          post_count: c.post_count
        }))
      }
    }

    case 'discourse.get_tag_list': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const url = `${baseUrl}/tags.json`
      const response = await fetch(url, {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      })
      if (!response.ok) {
        throw new Error(`获取标签失败：HTTP ${response.status}`)
      }
      const data = await response.json()
      const tags = data.tags || []
      return {
        tags: tags.map((t: any) => ({
          id: t.id,
          name: t.name,
          topic_count: t.topic_count
        }))
      }
    }

    case 'discourse.search_user': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const term = String(args.term || '').trim()
      if (!term) throw new Error('缺少 term')

      const url = `${baseUrl}/u/search/users.json?term=${encodeURIComponent(term)}`
      const response = await fetch(url, {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      })
      if (!response.ok) {
        throw new Error(`搜索用户失败：HTTP ${response.status}`)
      }
      const data = await response.json()
      const users = data.users || []
      return {
        users: users.map((u: any) => ({
          id: u.id,
          username: u.username,
          name: u.name,
          avatar_template: u.avatar_template
        }))
      }
    }

    case 'discourse.get_notifications': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const page = Number(args.page || 0)
      const url = new URL(`${baseUrl}/notifications.json`)
      if (page > 0) url.searchParams.set('page', String(page))
      const response = await fetch(url.toString(), {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      })
      if (!response.ok) {
        throw new Error(`获取通知失败：HTTP ${response.status}`)
      }
      const data = await response.json()
      return { notifications: data.notifications || [] }
    }

    case 'discourse.get_bookmarks': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const page = Number(args.page || 0)
      const url = new URL(`${baseUrl}/bookmarks.json`)
      if (page > 0) url.searchParams.set('page', String(page))
      const response = await fetch(url.toString(), {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      })
      if (!response.ok) {
        throw new Error(`获取书签失败：HTTP ${response.status}`)
      }
      const data = await response.json()
      return { bookmarks: data.bookmarks || [] }
    }

    case 'discourse.get_post_context': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const postId = Number(args.postId)
      const includeRaw = Boolean(args.includeRaw)
      let topicId = Number(args.topicId || 0)
      let postNumber = Number(args.postNumber || 0)

      if (!postId) throw new Error('缺少 postId')

      if (!topicId || !postNumber) {
        const postUrl = `${baseUrl}/posts/${postId}.json`
        const postResp = await fetch(postUrl, {
          credentials: 'include',
          headers: { Accept: 'application/json' }
        })
        if (!postResp.ok) {
          throw new Error(`获取帖子失败：HTTP ${postResp.status}`)
        }
        const postData = await postResp.json()
        topicId = Number(postData.topic_id || 0)
        postNumber = Number(postData.post_number || 0)
        if (!topicId || !postNumber) {
          throw new Error('无法解析 topicId 或 postNumber')
        }
      }

      const topicUrl = new URL(`${baseUrl}/t/${topicId}.json`)
      topicUrl.searchParams.set('post_number', String(postNumber))
      if (includeRaw) topicUrl.searchParams.set('include_raw', '1')

      const topicResp = await fetch(topicUrl.toString(), {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      })

      if (!topicResp.ok) {
        throw new Error(`获取上下文失败：HTTP ${topicResp.status}`)
      }

      const data = await topicResp.json()
      const posts = data.post_stream?.posts || []
      return {
        success: true,
        topic: {
          id: data.id,
          title: data.title,
          slug: data.slug,
          posts_count: data.posts_count
        },
        anchor: { postId, postNumber, topicId },
        posts: posts.map((p: any) => ({
          id: p.id,
          post_number: p.post_number,
          username: p.username,
          created_at: p.created_at,
          cooked: p.cooked,
          raw: includeRaw ? p.raw : undefined,
          liked: !!(
            p.current_user_reaction || p.actions_summary?.find((a: any) => a.id === 2 && a.acted)
          )
        }))
      }
    }

    case 'discourse.send_timings': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const topicId = Number(args.topicId)
      const timeMs = Number(args.timeMs || 10000)
      const postNumbers = Array.isArray(args.postNumbers) ? args.postNumbers : [1]

      if (!topicId) throw new Error('缺少 topicId')

      const timings: Record<string, number> = {}
      postNumbers.forEach((pn: number) => {
        timings[String(pn)] = timeMs
      })

      const url = `${baseUrl}/topics/timings`
      const headers = await buildDiscourseHeaders(baseUrl, {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        'Discourse-Logged-In': 'true'
      })
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: new URLSearchParams({
          topic_id: String(topicId),
          topic_time: String(timeMs),
          timings: JSON.stringify(timings)
        }).toString()
      })

      return { success: response.ok }
    }

    case 'discourse.create_post': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const topicId = Number(args.topicId)
      const raw = String(args.raw || '')
      const replyToPostNumber = args.replyToPostNumber ? Number(args.replyToPostNumber) : undefined

      if (!topicId) throw new Error('缺少 topicId')
      if (!raw.trim()) throw new Error('缺少回复内容 raw')

      const url = `${baseUrl}/posts.json`
      const body: Record<string, any> = {
        topic_id: topicId,
        raw: raw
      }
      if (replyToPostNumber) {
        body.reply_to_post_number = replyToPostNumber
      }

      const headers = await buildDiscourseHeaders(baseUrl, {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'Discourse-Logged-In': 'true'
      })
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.errors?.join(', ') || `回复失败：HTTP ${response.status}`)
      }

      const data = await response.json()
      return {
        success: true,
        post: {
          id: data.id,
          post_number: data.post_number,
          topic_id: data.topic_id,
          created_at: data.created_at
        }
      }
    }

    case 'discourse.like_topic': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const topicId = Number(args.topicId)
      const reactionId = String(args.reactionId || 'heart')
      if (!topicId) throw new Error('缺少 topicId')

      const topicUrl = `${baseUrl}/t/${topicId}.json`
      const topicResponse = await fetch(topicUrl, {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      })
      if (!topicResponse.ok) {
        throw new Error(`获取话题失败：HTTP ${topicResponse.status}`)
      }

      const topicData = await topicResponse.json()
      const firstPost = topicData.post_stream?.posts?.[0]
      if (!firstPost?.id) throw new Error('未找到首帖')

      if (isDiscoursePostLiked(firstPost)) {
        return { success: true, liked: true, alreadyLiked: true, postId: firstPost.id }
      }

      const result = await toggleDiscourseReaction(baseUrl, firstPost.id, reactionId)
      if (!result.ok) {
        throw new Error('点赞失败')
      }
      return { success: true, liked: true, postId: firstPost.id, data: result.data }
    }

    case 'discourse.unlike_post': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const postId = Number(args.postId)
      const reactionId = String(args.reactionId || 'heart')
      if (!postId) throw new Error('缺少 postId')

      const postData = await fetchDiscoursePost(baseUrl, postId)
      if (!isDiscoursePostLiked(postData)) {
        return { success: true, liked: false, alreadyUnliked: true }
      }

      const result = await toggleDiscourseReaction(baseUrl, postId, reactionId)
      if (!result.ok) {
        throw new Error('取消点赞失败')
      }
      return { success: true, liked: false, data: result.data }
    }

    case 'discourse.bookmark_post': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const postId = Number(args.postId)
      const name = args.name ? String(args.name) : undefined
      if (!postId) throw new Error('缺少 postId')

      const headers = await buildDiscourseHeaders(baseUrl, {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'Discourse-Logged-In': 'true'
      })

      const response = await fetch(`${baseUrl}/bookmarks.json`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ post_id: postId, name })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.errors?.join(', ') || `书签失败：HTTP ${response.status}`)
      }

      const data = await response.json()
      return { success: true, bookmark: data }
    }

    case 'discourse.unbookmark_post': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const postId = Number(args.postId)
      if (!postId) throw new Error('缺少 postId')

      const postData = await fetchDiscoursePost(baseUrl, postId)
      const bookmarkId = postData?.bookmark_id
      if (!bookmarkId) {
        return { success: true, alreadyUnbookmarked: true }
      }

      const headers = await buildDiscourseHeaders(baseUrl, {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'Discourse-Logged-In': 'true'
      })

      const response = await fetch(`${baseUrl}/bookmarks/${bookmarkId}.json`, {
        method: 'DELETE',
        credentials: 'include',
        headers
      })

      if (!response.ok) {
        throw new Error(`取消书签失败：HTTP ${response.status}`)
      }

      return { success: true }
    }

    case 'discourse.get_user_activity': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const username = String(args.username || '')
      const filter = String(args.filter || '4,5')
      const limit = Number(args.limit || 20)
      const offset = Number(args.offset || 0)

      if (!username) throw new Error('缺少 username')

      const url = new URL(`${baseUrl}/user_actions.json`)
      url.searchParams.set('username', username)
      url.searchParams.set('filter', filter)
      url.searchParams.set('limit', String(limit))
      if (offset > 0) url.searchParams.set('offset', String(offset))
      const response = await fetch(url, {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      })

      if (!response.ok) {
        throw new Error(`获取用户活动失败：HTTP ${response.status}`)
      }

      const data = await response.json()
      return {
        success: true,
        offset,
        limit,
        user_actions: (data.user_actions || []).map((a: any) => ({
          post_id: a.post_id,
          post_number: a.post_number,
          topic_id: a.topic_id,
          topic_title: a.title,
          action_type: a.action_type,
          created_at: a.created_at
        }))
      }
    }

    case 'discourse.browse_topic': {
      // 综合浏览话题：获取详情 + 发送阅读时间 + 可选点赞
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const topicId = Number(args.topicId)
      const readTimeMs = Number(args.readTimeMs || 10000)
      const shouldLike = Boolean(args.like)

      if (!topicId) throw new Error('缺少 topicId')

      // 获取话题详情
      const topicUrl = `${baseUrl}/t/${topicId}.json`
      const topicResponse = await fetch(topicUrl, {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      })

      if (!topicResponse.ok) {
        throw new Error(`获取话题失败：HTTP ${topicResponse.status}`)
      }

      const topicData = await topicResponse.json()
      const posts = topicData.post_stream?.posts || []
      const postNumbers = posts.map((p: any) => p.post_number)

      // 发送阅读时间
      const timings: Record<string, number> = {}
      postNumbers.forEach((pn: number) => {
        timings[String(pn)] = readTimeMs
      })

      const timingsHeaders = await buildDiscourseHeaders(baseUrl, {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        'Discourse-Logged-In': 'true'
      })
      await fetch(`${baseUrl}/topics/timings`, {
        method: 'POST',
        credentials: 'include',
        headers: timingsHeaders,
        body: new URLSearchParams({
          topic_id: String(topicId),
          topic_time: String(readTimeMs),
          timings: JSON.stringify(timings)
        }).toString()
      })

      let liked = false
      if (shouldLike && posts.length > 0) {
        // 找一个未点赞的帖子
        const unlikedPost = posts.find((p: any) => {
          if (p.current_user_reaction) return false
          if (Array.isArray(p.actions_summary)) {
            const likeAction = p.actions_summary.find((a: any) => a.id === 2)
            if (likeAction?.acted) return false
          }
          return true
        })

        if (unlikedPost) {
          const likeUrl = `${baseUrl}/discourse-reactions/posts/${unlikedPost.id}/custom-reactions/heart/toggle.json`
          const likeHeaders = await buildDiscourseHeaders(baseUrl, {
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/json',
            'Discourse-Logged-In': 'true'
          })
          const likeResponse = await fetch(likeUrl, {
            method: 'PUT',
            credentials: 'include',
            headers: likeHeaders
          })
          liked = likeResponse.ok
        }
      }

      return {
        success: true,
        topic: {
          id: topicData.id,
          title: topicData.title,
          posts_count: topicData.posts_count
        },
        readTimeMs,
        liked
      }
    }

    case 'discourse.search': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const query = String(args.q || args.query || '').trim()
      const page = Number(args.page || 0)
      const type = args.type ? String(args.type) : ''

      if (!query) throw new Error('缺少搜索关键词 q')

      const searchUrl = new URL(`${baseUrl}/search.json`)
      searchUrl.searchParams.set('q', query)
      if (page > 0) searchUrl.searchParams.set('page', String(page))
      if (type) searchUrl.searchParams.set('type', type)

      const response = await fetch(searchUrl.toString(), {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      })

      if (!response.ok) {
        throw new Error(`搜索失败：HTTP ${response.status}`)
      }

      const data = await response.json()
      const topics = (data.topics || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        slug: t.slug,
        posts_count: t.posts_count,
        views: t.views,
        like_count: t.like_count,
        created_at: t.created_at,
        last_posted_at: t.last_posted_at
      }))
      const posts = (data.posts || []).map((p: any) => ({
        id: p.id,
        topic_id: p.topic_id,
        post_number: p.post_number,
        username: p.username,
        created_at: p.created_at,
        blurb: p.blurb
      }))

      return {
        success: true,
        query,
        page,
        topics,
        posts
      }
    }

    default:
      throw new Error(`未知工具：${message.tool}`)
  }
}

async function connect() {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI) return
  if (disabled) return

  clearReconnectTimer()
  clearHeartbeatTimers()
  updateStatus('connecting')

  // Close existing connection if any
  if (ws) {
    try {
      ws.close()
    } catch {
      // ignore
    }
    ws = null
  }

  const wsUrl = await getWsUrl()
  console.log('[MCP] Connecting to WebSocket:', wsUrl)

  try {
    ws = new WebSocket(wsUrl)
  } catch (error) {
    console.warn('[MCP] Failed to create WebSocket connection', error)
    updateStatus('disconnected')
    scheduleReconnect()
    return
  }

  ws.onopen = () => {
    console.log('[MCP] WebSocket connected')
    reconnectAttempts = 0 // 重置重连计数
    updateStatus('connected')
    startHeartbeat() // 启动心跳
  }

  ws.onmessage = async event => {
    try {
      const message = JSON.parse(event.data)

      // 处理心跳响应
      if (message.type === 'MCP_PONG') {
        handlePong(message as McpPongMessage)
        return
      }

      // 处理工具调用
      if (message.type === 'MCP_TOOL_CALL') {
        console.log('[MCP] Received tool call:', message.tool)

        const response: McpToolResultMessage = {
          type: 'MCP_TOOL_RESULT',
          id: message.id
        }

        try {
          response.result = await handleToolCall(chromeAPI, message as McpToolCallMessage)
        } catch (error: any) {
          response.error = error?.message || 'Tool call failed'
          console.warn('[MCP] Tool call error:', response.error)
        }

        try {
          ws?.send(JSON.stringify(response))
        } catch (error) {
          console.warn('[MCP] Failed to send tool response', error)
        }
      }
    } catch (error) {
      console.warn('[MCP] Failed to parse WebSocket message', error)
    }
  }

  ws.onclose = event => {
    console.log('[MCP] WebSocket disconnected, code:', event.code, 'reason:', event.reason)
    clearHeartbeatTimers()
    ws = null
    updateStatus('disconnected')
    scheduleReconnect()
  }

  ws.onerror = error => {
    console.warn('[MCP] WebSocket error:', error)
  }
}

export function setupMcpBridge() {
  void connect()
}

export function reconnectMcpBridge() {
  reconnectAttempts = 0
  clearReconnectTimer()
  void connect()
}

export function getMcpConnectionStatus(): McpConnectionStatus {
  return currentStatus
}
