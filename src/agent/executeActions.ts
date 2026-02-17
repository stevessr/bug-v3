import type { AgentAction, AgentActionResult, AgentPermissions } from './types'

type ActionStatus = AgentActionResult

type DomQueryOptions = {
  includeMarkdown?: boolean
  maxDepth?: number
  maxChildren?: number
  maxTextLength?: number
  textLimit?: number
  markdownLimit?: number
  maxTextBlocks?: number
}

const ACTION_TYPE_TO_PERMISSION: Record<string, keyof AgentPermissions> = {
  click: 'click',
  'click-dom': 'clickDom',
  scroll: 'scroll',
  touch: 'touch',
  screenshot: 'screenshot',
  navigate: 'navigate',
  input: 'input'
}

const clampInteger = (value: unknown, fallback: number, min: number, max: number): number => {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const rounded = Math.floor(parsed)
  if (rounded < min) return min
  if (rounded > max) return max
  return rounded
}

const normalizeDomQueryOptions = (options: unknown): DomQueryOptions => {
  if (!options || typeof options !== 'object') return {}
  const record = options as Record<string, unknown>
  const includeMarkdown =
    typeof record.includeMarkdown === 'boolean' ? record.includeMarkdown : undefined

  return {
    includeMarkdown,
    maxDepth: clampInteger(record.maxDepth, 4, 1, 8),
    maxChildren: clampInteger(record.maxChildren, 20, 1, 80),
    maxTextLength: clampInteger(record.maxTextLength, 120, 20, 500),
    textLimit: clampInteger(record.textLimit, 120, 20, 500),
    markdownLimit: clampInteger(record.markdownLimit, 4000, 400, 40000),
    maxTextBlocks: clampInteger(record.maxTextBlocks, 60, 10, 400)
  }
}

function isChromeAvailable() {
  return typeof chrome !== 'undefined' && !!chrome.tabs
}

async function captureScreenshot(
  format: 'png' | 'jpeg' = 'png',
  tabId?: number
): Promise<ActionStatus> {
  if (!chrome?.runtime?.sendMessage) {
    return { id: `screenshot-${Date.now()}`, type: 'screenshot', success: false, error: '无法截图' }
  }
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT', format, tabId }, (response: any) => {
      if (response?.success) {
        resolve({
          id: `screenshot-${Date.now()}`,
          type: 'screenshot',
          success: true,
          data: response.data
        })
      } else {
        resolve({
          id: `screenshot-${Date.now()}`,
          type: 'screenshot',
          success: false,
          error: response?.error || '截图失败'
        })
      }
    })
  })
}

async function getActiveTabId(): Promise<number | null> {
  if (!chrome?.tabs?.query) return null
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  return tabs[0]?.id ?? null
}

export async function executeAgentActions(
  actions: AgentAction[],
  permissions: AgentPermissions,
  targetTabId?: number | null,
  options?: { parallel?: boolean }
): Promise<ActionStatus[]> {
  if (!isChromeAvailable()) {
    return actions.map(action => ({
      id: action.id,
      type: action.type,
      success: false,
      error: '浏览器上下文不可用'
    }))
  }

  const tabId = targetTabId ?? (await getActiveTabId())

  const executeSingle = async (action: AgentAction): Promise<ActionStatus> => {
    const needsTarget = [
      'click',
      'click-dom',
      'touch',
      'double-click',
      'right-click',
      'hover',
      'focus',
      'blur',
      'drag'
    ].includes(action.type)
    const target = action as { selector?: string; x?: number; y?: number }
    if (needsTarget && !target.selector && (target.x === undefined || target.y === undefined)) {
      return {
        id: action.id,
        type: action.type,
        success: false,
        error: '缺少 selector 或坐标'
      }
    }
    const permissionKey = ACTION_TYPE_TO_PERMISSION[action.type]
    if (permissionKey && !permissions[permissionKey]) {
      return {
        id: action.id,
        type: action.type,
        success: false,
        error: '权限未开启'
      }
    }

    if (action.type === 'navigate') {
      if (!chrome.tabs?.update || tabId === null) {
        return {
          id: action.id,
          type: action.type,
          success: false,
          error: '无法切换 URL'
        }
      }
      try {
        await chrome.tabs.update(tabId, { url: action.url })
        return { id: action.id, type: action.type, success: true }
      } catch (error: any) {
        return {
          id: action.id,
          type: action.type,
          success: false,
          error: error?.message || '切换 URL 失败'
        }
      }
    }

    if (action.type === 'screenshot') {
      const res = await captureScreenshot(action.format, tabId ?? undefined)
      return { ...res, id: action.id }
    }

    if (action.type === 'getDOM') {
      if (tabId === null) {
        return {
          id: action.id,
          type: action.type,
          success: false,
          error: '未找到目标标签页'
        }
      }
      if (!chrome.tabs?.sendMessage) {
        return {
          id: action.id,
          type: action.type,
          success: false,
          error: '无法发送消息到内容脚本'
        }
      }
      const response = await new Promise<any>(resolve => {
        chrome.tabs.sendMessage(
          tabId,
          {
            type: 'DOM_QUERY',
            kind: 'tree',
            selector: action.selector,
            options: normalizeDomQueryOptions(action.options)
          },
          (resp: any) => resolve(resp)
        )
      })
      return {
        id: action.id,
        type: action.type,
        success: response?.success === true,
        error: response?.error,
        data: response?.data
      }
    }

    if (tabId === null) {
      return {
        id: action.id,
        type: action.type,
        success: false,
        error: '未找到目标标签页'
      }
    }

    if (!chrome.tabs?.sendMessage) {
      return {
        id: action.id,
        type: action.type,
        success: false,
        error: '无法发送消息到内容脚本'
      }
    }

    const response = await new Promise<any>(resolve => {
      chrome.tabs.sendMessage(tabId, { type: 'AGENT_ACTION', action }, (resp: any) => {
        resolve(resp)
      })
    })

    return {
      id: action.id,
      type: action.type,
      success: response?.success === true,
      error: response?.error,
      data: response?.data
    }
  }
  if (options?.parallel) {
    return Promise.all(actions.map(action => executeSingle(action)))
  }
  const results: ActionStatus[] = []
  for (const action of actions) {
    results.push(await executeSingle(action))
  }
  return results
}
