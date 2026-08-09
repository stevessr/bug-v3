import type {
  AgentAction,
  AgentTabGroupColor,
  GroupTabsAction,
  ListTabsAction,
  OpenTabAction
} from './types'

const TAB_ACTION_TYPES = new Set<AgentAction['type']>([
  'list-tabs',
  'open-tab',
  'activate-tab',
  'close-tab',
  'reload-tab',
  'go-back',
  'go-forward',
  'group-tabs',
  'ungroup-tabs'
])

const DEFAULT_LOAD_TIMEOUT_MS = 15_000
const MAX_LOAD_TIMEOUT_MS = 30_000
const MAX_WAIT_MS = 30_000

export type AgentTabSnapshot = {
  id?: number
  windowId: number
  index: number
  title?: string
  url?: string
  active: boolean
  pinned: boolean
  audible?: boolean
  muted: boolean
  discarded: boolean
  status?: chrome.tabs.Tab['status']
  groupId?: number
}

export type TabLoadResult = {
  tab?: AgentTabSnapshot
  loadState: 'complete' | 'timeout' | 'unknown'
}

const clampInteger = (value: unknown, fallback: number, min: number, max: number): number => {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.floor(parsed)))
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export const isTabAction = (action: AgentAction): boolean => TAB_ACTION_TYPES.has(action.type)

export const resolveActionTabId = (
  action: AgentAction,
  fallbackTabId: number | null
): number | null => {
  if (typeof action.tabId === 'number' && Number.isInteger(action.tabId) && action.tabId >= 0) {
    return action.tabId
  }
  return fallbackTabId
}

export const toAgentTabSnapshot = (tab: chrome.tabs.Tab): AgentTabSnapshot => ({
  id: tab.id,
  windowId: tab.windowId,
  index: tab.index,
  title: tab.title,
  url: tab.url,
  active: tab.active,
  pinned: tab.pinned,
  audible: tab.audible,
  muted: Boolean(tab.mutedInfo?.muted),
  discarded: tab.discarded,
  status: tab.status,
  groupId: typeof tab.groupId === 'number' && tab.groupId >= 0 ? tab.groupId : undefined
})

/**
 * Wait until Chrome reports the tab as fully loaded. Polling is intentionally
 * used instead of keeping an onUpdated listener alive in the side panel: the
 * panel may be suspended and resumed while a navigation is in flight.
 */
export async function waitForTabLoad(
  chromeAPI: typeof chrome,
  tabId: number,
  timeoutMs?: number
): Promise<TabLoadResult> {
  if (!chromeAPI.tabs?.get) return { loadState: 'unknown' }

  const timeout = clampInteger(timeoutMs, DEFAULT_LOAD_TIMEOUT_MS, 500, MAX_LOAD_TIMEOUT_MS)
  const deadline = Date.now() + timeout
  let latest: chrome.tabs.Tab | undefined

  while (Date.now() <= deadline) {
    latest = await chromeAPI.tabs.get(tabId)
    if (latest.status === 'complete') {
      return { tab: toAgentTabSnapshot(latest), loadState: 'complete' }
    }
    await sleep(100)
  }

  return {
    tab: latest ? toAgentTabSnapshot(latest) : undefined,
    loadState: 'timeout'
  }
}

async function snapshotTab(chromeAPI: typeof chrome, tabId: number): Promise<AgentTabSnapshot> {
  if (!chromeAPI.tabs?.get) throw new Error('无法读取标签页')
  return toAgentTabSnapshot(await chromeAPI.tabs.get(tabId))
}

async function finishNavigation(
  chromeAPI: typeof chrome,
  tabId: number,
  waitForLoad: boolean | undefined,
  timeoutMs: number | undefined
): Promise<TabLoadResult> {
  if (waitForLoad === false) {
    return { tab: await snapshotTab(chromeAPI, tabId), loadState: 'unknown' }
  }
  return waitForTabLoad(chromeAPI, tabId, timeoutMs)
}

async function listTabs(chromeAPI: typeof chrome, action: ListTabsAction) {
  if (!chromeAPI.tabs?.query) throw new Error('无法获取标签页列表')
  const query: chrome.tabs.QueryInfo = {}
  if (typeof action.windowId === 'number') {
    query.windowId = action.windowId
  } else if (action.currentWindow !== false) {
    query.currentWindow = true
  }
  const tabs = await chromeAPI.tabs.query(query)
  return { tabs: tabs.map(toAgentTabSnapshot), count: tabs.length }
}

async function openTab(chromeAPI: typeof chrome, action: OpenTabAction) {
  if (!chromeAPI.tabs?.create) throw new Error('无法创建标签页')
  if (!action.url?.trim()) throw new Error('缺少 url')

  const tab = await chromeAPI.tabs.create({
    url: action.url.trim(),
    active: action.active ?? true,
    pinned: action.pinned,
    index: action.index,
    windowId: action.windowId
  })
  if (typeof tab.id !== 'number') {
    return { tab: toAgentTabSnapshot(tab), loadState: 'unknown' as const }
  }
  return finishNavigation(chromeAPI, tab.id, action.waitForLoad, action.timeoutMs)
}

async function activateTab(chromeAPI: typeof chrome, tabId: number) {
  if (!chromeAPI.tabs?.update) throw new Error('无法激活标签页')
  const tab = await chromeAPI.tabs.update(tabId, { active: true })
  if (typeof tab?.windowId === 'number' && chromeAPI.windows?.update) {
    try {
      await chromeAPI.windows.update(tab.windowId, { focused: true })
    } catch {
      // The tab was activated successfully; window focusing is best effort.
    }
  }
  return { tab: tab ? toAgentTabSnapshot(tab) : await snapshotTab(chromeAPI, tabId) }
}

async function groupTabs(chromeAPI: typeof chrome, action: GroupTabsAction) {
  if (!chromeAPI.tabs?.group) throw new Error('当前浏览器不支持标签页分组')
  const tabIds = action.tabIds.filter(
    tabId => typeof tabId === 'number' && Number.isInteger(tabId) && tabId >= 0
  )
  if (tabIds.length === 0) throw new Error('缺少 tabIds')

  const groupId = await chromeAPI.tabs.group({
    tabIds: tabIds as [number, ...number[]],
    groupId: action.groupId
  })

  if ((action.title || action.color) && chromeAPI.tabGroups?.update) {
    await chromeAPI.tabGroups.update(groupId, {
      title: action.title,
      color: action.color as AgentTabGroupColor | undefined
    })
  }

  return { groupId, tabIds }
}

export async function executeTabAction(
  chromeAPI: typeof chrome,
  action: AgentAction,
  fallbackTabId: number | null
): Promise<unknown> {
  switch (action.type) {
    case 'list-tabs':
      return listTabs(chromeAPI, action)
    case 'open-tab':
      return openTab(chromeAPI, action)
    case 'activate-tab': {
      const tabId = resolveActionTabId(action, fallbackTabId)
      if (tabId === null) throw new Error('缺少 tabId')
      return activateTab(chromeAPI, tabId)
    }
    case 'close-tab': {
      const tabId = resolveActionTabId(action, fallbackTabId)
      if (tabId === null) throw new Error('缺少 tabId')
      if (!chromeAPI.tabs?.remove) throw new Error('无法关闭标签页')
      await chromeAPI.tabs.remove(tabId)
      return { tabId, closed: true }
    }
    case 'reload-tab': {
      const tabId = resolveActionTabId(action, fallbackTabId)
      if (tabId === null) throw new Error('未找到目标标签页')
      if (!chromeAPI.tabs?.reload) throw new Error('无法刷新标签页')
      await chromeAPI.tabs.reload(tabId, { bypassCache: Boolean(action.bypassCache) })
      return finishNavigation(chromeAPI, tabId, action.waitForLoad, action.timeoutMs)
    }
    case 'go-back':
    case 'go-forward': {
      const tabId = resolveActionTabId(action, fallbackTabId)
      if (tabId === null) throw new Error('未找到目标标签页')
      if (action.type === 'go-back') {
        if (!chromeAPI.tabs?.goBack) throw new Error('无法后退')
        await chromeAPI.tabs.goBack(tabId)
      } else {
        if (!chromeAPI.tabs?.goForward) throw new Error('无法前进')
        await chromeAPI.tabs.goForward(tabId)
      }
      return finishNavigation(chromeAPI, tabId, action.waitForLoad, action.timeoutMs)
    }
    case 'group-tabs':
      return groupTabs(chromeAPI, action)
    case 'ungroup-tabs': {
      if (!chromeAPI.tabs?.ungroup) throw new Error('当前浏览器不支持取消标签页分组')
      const tabIds = action.tabIds.filter(
        tabId => typeof tabId === 'number' && Number.isInteger(tabId) && tabId >= 0
      )
      if (tabIds.length === 0) throw new Error('缺少 tabIds')
      await chromeAPI.tabs.ungroup(tabIds as [number, ...number[]])
      return { tabIds, ungrouped: true }
    }
    default:
      throw new Error(`不支持的标签页动作：${action.type}`)
  }
}

export async function executeWaitAction(action: AgentAction): Promise<{ waitedMs: number }> {
  if (action.type !== 'wait') throw new Error('不是等待动作')
  const waitedMs = clampInteger(action.ms, 500, 0, MAX_WAIT_MS)
  await sleep(waitedMs)
  return { waitedMs }
}
