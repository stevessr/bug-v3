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

/**
 * debugger 是 Chromium 必需清单权限；在启动 debug 动作前检查 API 和安装授权。
 */
async function ensureDebuggerPermissionGranted(chromeAPI: typeof chrome): Promise<void> {
  const has = await sendRuntimeMessage(chromeAPI, { type: 'AGENT_DEBUG_HAS_PERMISSION' })
  if (has?.granted) return

  const granted = await sendRuntimeMessage(chromeAPI, { type: 'AGENT_DEBUG_ENSURE_PERMISSION' })
  if (!granted?.granted) {
    throw new Error('开发者观测需要 Chromium 的 debugger 安装权限；请重新加载扩展并确认授权')
  }
}

export async function executeDebugAction(
  chromeAPI: typeof chrome,
  action: AgentAction,
  fallbackTabId: number | null
): Promise<unknown> {
  const tabId = resolveActionTabId(action, fallbackTabId)
  if (tabId === null) throw new Error('未找到目标标签页')

  // 安装授权与 Agent 功能开关分离，启动前检查权限。
  if (action.type === 'debug-start') {
    await ensureDebuggerPermissionGranted(chromeAPI)
  }

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
