import { DEFAULT_MCP_BRIDGE_SETTINGS, type McpBridgeSettings } from '@/agent/types'

export type McpConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting'

let cachedSettings: McpBridgeSettings | null = null
let disabled = true

function getDisabledError() {
  return '本地 MCP 桥接在 no-browser 构建中已禁用'
}

export async function loadMcpBridgeSettings(): Promise<McpBridgeSettings> {
  if (cachedSettings) return cachedSettings
  cachedSettings = {
    ...DEFAULT_MCP_BRIDGE_SETTINGS,
    autoConnect: false,
    reconnectOnFailure: false
  }
  return cachedSettings
}

export async function saveMcpBridgeSettings(settings: Partial<McpBridgeSettings>): Promise<void> {
  const current = await loadMcpBridgeSettings()
  cachedSettings = {
    ...current,
    ...settings,
    autoConnect: false,
    reconnectOnFailure: false
  }
}

export function getMcpBridgeSettingsSync(): McpBridgeSettings {
  return (
    cachedSettings || {
      ...DEFAULT_MCP_BRIDGE_SETTINGS,
      autoConnect: false,
      reconnectOnFailure: false
    }
  )
}

export function onMcpConnectionChange(
  _listener: (status: McpConnectionStatus) => void
): () => void {
  return () => {}
}

export function setMcpBridgeDisabled(value: boolean) {
  disabled = value
}

export async function testMcpBridge(): Promise<{ ok: boolean; error?: string }> {
  if (disabled) {
    return { ok: false, error: getDisabledError() }
  }
  return { ok: false, error: getDisabledError() }
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

export async function setupMcpBridge() {
  return
}

export async function reconnectMcpBridge() {
  return
}

export function getMcpConnectionStatus(): McpConnectionStatus {
  return 'disconnected'
}
