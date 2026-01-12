import { getChromeAPI } from '../utils/main'

const HOST_NAME = 'com.bugv3.mcp'
const DEFAULT_PORT = 7465

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

type McpConfigMessage = {
  type: 'MCP_CONFIG'
  port: number
}

type McpHelloMessage = {
  type: 'MCP_HELLO'
  extensionId: string
  version: string
}

let port: chrome.runtime.Port | null = null
let reconnectTimer: number | null = null
let disabled = false

function clearReconnectTimer() {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

function scheduleReconnect() {
  if (reconnectTimer !== null || disabled) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connect()
  }, 2000)
}

export function setMcpBridgeDisabled(value: boolean) {
  disabled = value
  if (disabled && port) {
    try {
      port.disconnect()
    } catch {
      // ignore
    }
    port = null
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

async function sendActionToTab(
  chromeAPI: typeof chrome,
  tabId: number,
  action: any
): Promise<any> {
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

async function sendQueryToTab(
  chromeAPI: typeof chrome,
  tabId: number,
  payload: any
): Promise<any> {
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
    chromeAPI.tabs.captureVisibleTab(windowId, { format }, dataUrl => {
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
      await chromeAPI.tabs.highlight({ tabIds, windowId })
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
      const groupId = await chromeAPI.tabs.group({ tabIds, groupId: args.groupId })
      return { groupId }
    }

    case 'chrome.tab_ungroup': {
      if (!chromeAPI.tabs?.ungroup) throw new Error('无法取消分组标签页')
      const tabIds = Array.isArray(args.tabIds) ? args.tabIds : []
      if (tabIds.length === 0) throw new Error('缺少 tabIds')
      await chromeAPI.tabs.ungroup(tabIds)
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
      const window = await chromeAPI.windows.get(args.windowId, { populate: Boolean(args.populate) })
      return mapWindow(window)
    }

    case 'chrome.window_current': {
      if (!chromeAPI.windows?.getCurrent) throw new Error('无法获取当前窗口')
      const window = await chromeAPI.windows.getCurrent({ populate: Boolean(args.populate) })
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

    default:
      throw new Error(`未知工具: ${message.tool}`)
  }
}

function postConfig(port: chrome.runtime.Port, chromeAPI: typeof chrome) {
  const config: McpConfigMessage = {
    type: 'MCP_CONFIG',
    port: DEFAULT_PORT
  }
  port.postMessage(config)

  const hello: McpHelloMessage = {
    type: 'MCP_HELLO',
    extensionId: chromeAPI.runtime.id,
    version: chromeAPI.runtime.getManifest().version
  }
  port.postMessage(hello)
}

async function connect() {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI?.runtime?.connectNative) return
  if (disabled) return

  clearReconnectTimer()
  try {
    port = chromeAPI.runtime.connectNative(HOST_NAME)
  } catch (error) {
    console.warn('[MCP] failed to connect native host', error)
    setMcpBridgeDisabled(true)
    return
  }

  if (!port) return

  postConfig(port, chromeAPI)

  port.onMessage.addListener(async (message: McpToolCallMessage) => {
    if (!message || message.type !== 'MCP_TOOL_CALL') return
    const response: McpToolResultMessage = {
      type: 'MCP_TOOL_RESULT',
      id: message.id
    }
    try {
      response.result = await handleToolCall(chromeAPI, message)
    } catch (error: any) {
      response.error = error?.message || 'Tool call failed'
    }
    try {
      port?.postMessage(response)
    } catch (error) {
      console.warn('[MCP] failed to send tool response', error)
    }
  })

  port.onDisconnect.addListener(() => {
    if (chromeAPI.runtime.lastError) {
      setMcpBridgeDisabled(true)
    }
    port = null
    scheduleReconnect()
  })
}

export function setupMcpBridge() {
  void connect()
}
