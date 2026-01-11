import type { AgentAction, AgentActionResult, AgentPermissions } from './types'

type ActionStatus = AgentActionResult

const ACTION_TYPE_TO_PERMISSION: Record<string, keyof AgentPermissions> = {
  click: 'click',
  'click-dom': 'clickDom',
  scroll: 'scroll',
  touch: 'touch',
  screenshot: 'screenshot',
  navigate: 'navigate',
  input: 'input'
}

function isChromeAvailable() {
  return typeof chrome !== 'undefined' && !!chrome.tabs
}

async function captureScreenshot(format: 'png' | 'jpeg' = 'png'): Promise<ActionStatus> {
  if (!chrome?.runtime?.sendMessage) {
    return { id: `screenshot-${Date.now()}`, type: 'screenshot', success: false, error: '无法截图' }
  }
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT', format }, (response: any) => {
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
  permissions: AgentPermissions
): Promise<ActionStatus[]> {
  if (!isChromeAvailable()) {
    return actions.map(action => ({
      id: action.id,
      type: action.type,
      success: false,
      error: '浏览器上下文不可用'
    }))
  }

  const results: ActionStatus[] = []
  const tabId = await getActiveTabId()

  for (const action of actions) {
    const permissionKey = ACTION_TYPE_TO_PERMISSION[action.type]
    if (permissionKey && !permissions[permissionKey]) {
      results.push({
        id: action.id,
        type: action.type,
        success: false,
        error: '权限未开启'
      })
      continue
    }

    if (action.type === 'navigate') {
      if (!chrome.tabs?.update || tabId === null) {
        results.push({
          id: action.id,
          type: action.type,
          success: false,
          error: '无法切换 URL'
        })
        continue
      }
      try {
        await chrome.tabs.update(tabId, { url: action.url })
        results.push({ id: action.id, type: action.type, success: true })
      } catch (error: any) {
        results.push({
          id: action.id,
          type: action.type,
          success: false,
          error: error?.message || '切换 URL 失败'
        })
      }
      continue
    }

    if (action.type === 'screenshot') {
      const res = await captureScreenshot(action.format)
      results.push({ ...res, id: action.id })
      continue
    }

    if (tabId === null) {
      results.push({
        id: action.id,
        type: action.type,
        success: false,
        error: '未找到活动标签页'
      })
      continue
    }

    if (!chrome.tabs?.sendMessage) {
      results.push({
        id: action.id,
        type: action.type,
        success: false,
        error: '无法发送消息到内容脚本'
      })
      continue
    }

    const response = await new Promise<any>(resolve => {
      chrome.tabs.sendMessage(tabId, { type: 'AGENT_ACTION', action }, (resp: any) => {
        resolve(resp)
      })
    })

    results.push({
      id: action.id,
      type: action.type,
      success: response?.success === true,
      error: response?.error,
      data: response?.data
    })
  }

  return results
}
