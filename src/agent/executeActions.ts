import { executeFolderAction } from './folderAccess'
import { executeDebugAction, isDebugAction } from './debugActions'
import {
  executeTabAction,
  executeWaitAction,
  isTabAction,
  resolveActionTabId,
  waitForTabLoad
} from './tabActions'
import type {
  AgentAction,
  AgentActionResult,
  AgentActionType,
  AgentPermissions,
  AgentSettings
} from './types'

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

const ACTION_TYPE_TO_PERMISSIONS: Partial<Record<AgentActionType, Array<keyof AgentPermissions>>> =
  {
    click: ['click'],
    'click-dom': ['clickDom'],
    'double-click': ['click'],
    'right-click': ['click'],
    hover: ['click'],
    focus: ['click'],
    blur: ['click'],
    drag: ['click'],
    scroll: ['scroll'],
    touch: ['touch'],
    screenshot: ['screenshot'],
    navigate: ['navigate'],
    input: ['input'],
    key: ['input'],
    type: ['input'],
    select: ['input'],
    getDOM: ['clickDom'],
    'list-tabs': ['tabs'],
    'open-tab': ['tabs', 'navigate'],
    'activate-tab': ['tabs'],
    'close-tab': ['tabs'],
    'reload-tab': ['tabs', 'navigate'],
    'go-back': ['tabs', 'navigate'],
    'go-forward': ['tabs', 'navigate'],
    'group-tabs': ['tabs'],
    'ungroup-tabs': ['tabs'],
    'debug-start': ['debugger'],
    'read-console': ['debugger'],
    'read-network': ['debugger'],
    'debug-stop': ['debugger'],
    'list-files': ['fileAccess'],
    'read-file': ['fileAccess'],
    'write-file': ['fileAccess']
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
      if (chrome.runtime.lastError) {
        resolve({
          id: `screenshot-${Date.now()}`,
          type: 'screenshot',
          success: false,
          error: chrome.runtime.lastError.message || '截图失败'
        })
        return
      }
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

async function sendMessageToTab(tabId: number, message: unknown): Promise<any> {
  if (!chrome.tabs?.sendMessage) {
    return { success: false, error: '无法发送消息到内容脚本' }
  }
  return new Promise(resolve => {
    chrome.tabs.sendMessage(tabId, message, (response: any) => {
      if (chrome.runtime.lastError) {
        resolve({
          success: false,
          error: chrome.runtime.lastError.message || '无法连接目标页面的内容脚本'
        })
        return
      }
      resolve(response)
    })
  })
}

export async function executeAgentActions(
  actions: AgentAction[],
  permissions: AgentPermissions,
  targetTabId?: number | null,
  options?: { parallel?: boolean; settings?: AgentSettings }
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
    const requiredPermissions = ACTION_TYPE_TO_PERMISSIONS[action.type] || []
    const missingPermission = requiredPermissions.find(permission => !permissions[permission])
    if (missingPermission) {
      return {
        id: action.id,
        type: action.type,
        success: false,
        error: `权限未开启：${missingPermission}`
      }
    }

    if (
      action.type === 'list-files' ||
      action.type === 'read-file' ||
      action.type === 'write-file'
    ) {
      if (!options?.settings) {
        return {
          id: action.id,
          type: action.type,
          success: false,
          error: '缺少 Agent 设置，无法执行文件夹访问动作'
        }
      }
      return executeFolderAction(action, options.settings)
    }

    if (action.type === 'wait') {
      try {
        return {
          id: action.id,
          type: action.type,
          success: true,
          data: await executeWaitAction(action)
        }
      } catch (error: any) {
        return {
          id: action.id,
          type: action.type,
          success: false,
          error: error?.message || '等待失败'
        }
      }
    }

    if (isDebugAction(action)) {
      try {
        return {
          id: action.id,
          type: action.type,
          success: true,
          data: await executeDebugAction(chrome, action, tabId)
        }
      } catch (error: any) {
        return {
          id: action.id,
          type: action.type,
          success: false,
          error: error?.message || '开发者观测失败'
        }
      }
    }

    if (isTabAction(action)) {
      try {
        return {
          id: action.id,
          type: action.type,
          success: true,
          data: await executeTabAction(chrome, action, tabId)
        }
      } catch (error: any) {
        return {
          id: action.id,
          type: action.type,
          success: false,
          error: error?.message || '标签页操作失败'
        }
      }
    }

    const actionTabId = resolveActionTabId(action, tabId)

    if (action.type === 'navigate') {
      if (!chrome.tabs?.update || actionTabId === null) {
        return {
          id: action.id,
          type: action.type,
          success: false,
          error: '无法切换 URL'
        }
      }
      try {
        await chrome.tabs.update(actionTabId, { url: action.url })
        const data =
          action.waitForLoad === false
            ? undefined
            : await waitForTabLoad(chrome, actionTabId, action.timeoutMs)
        return { id: action.id, type: action.type, success: true, data }
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
      const res = await captureScreenshot(action.format, actionTabId ?? undefined)
      return { ...res, id: action.id }
    }

    if (action.type === 'getDOM') {
      if (actionTabId === null) {
        return {
          id: action.id,
          type: action.type,
          success: false,
          error: '未找到目标标签页'
        }
      }
      const response = await sendMessageToTab(actionTabId, {
        type: 'DOM_QUERY',
        kind: 'tree',
        selector: action.selector,
        options: normalizeDomQueryOptions(action.options)
      })
      return {
        id: action.id,
        type: action.type,
        success: response?.success === true,
        error: response?.error,
        data: response?.data
      }
    }

    if (actionTabId === null) {
      return {
        id: action.id,
        type: action.type,
        success: false,
        error: '未找到目标标签页'
      }
    }

    const response = await sendMessageToTab(actionTabId, { type: 'AGENT_ACTION', action })

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
