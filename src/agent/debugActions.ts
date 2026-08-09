import { resolveActionTabId } from './tabActions'
import type { AgentAction } from './types'

const DEBUG_ACTION_TYPES = new Set<AgentAction['type']>([
  'debug-start',
  'read-console',
  'read-network',
  'debug-stop'
])

export const isDebugAction = (action: AgentAction): boolean => DEBUG_ACTION_TYPES.has(action.type)

const sendRuntimeMessage = (chromeAPI: typeof chrome, message: unknown): Promise<any> => {
  if (!chromeAPI.runtime?.sendMessage) throw new Error('无法连接后台调试服务')
  return new Promise((resolve, reject) => {
    chromeAPI.runtime.sendMessage(message, (response: any) => {
      if (chromeAPI.runtime.lastError) {
        reject(new Error(chromeAPI.runtime.lastError.message || '后台调试服务不可用'))
        return
      }
      if (!response?.success) {
        reject(new Error(response?.error || '开发者观测失败'))
        return
      }
      resolve(response.data)
    })
  })
}

export async function executeDebugAction(
  chromeAPI: typeof chrome,
  action: AgentAction,
  fallbackTabId: number | null
): Promise<unknown> {
  const tabId = resolveActionTabId(action, fallbackTabId)
  if (tabId === null) throw new Error('未找到目标标签页')

  switch (action.type) {
    case 'debug-start':
      return sendRuntimeMessage(chromeAPI, {
        type: 'AGENT_DEBUG_START',
        tabId,
        captureConsole: action.captureConsole,
        captureNetwork: action.captureNetwork,
        clear: action.clear
      })
    case 'read-console':
      return sendRuntimeMessage(chromeAPI, {
        type: 'AGENT_DEBUG_READ_CONSOLE',
        tabId,
        clear: action.clear,
        limit: action.limit
      })
    case 'read-network':
      return sendRuntimeMessage(chromeAPI, {
        type: 'AGENT_DEBUG_READ_NETWORK',
        tabId,
        clear: action.clear,
        limit: action.limit
      })
    case 'debug-stop':
      return sendRuntimeMessage(chromeAPI, { type: 'AGENT_DEBUG_STOP', tabId })
    default:
      throw new Error(`不支持的开发者观测动作：${action.type}`)
  }
}
