/**
 * MCP Client - 工具发现和调用
 * 通过 MCP 协议自动发现可用工具，并以结构化方式调用
 */

import type { McpServerConfig } from './types'

export interface McpTool {
  name: string
  description?: string
  inputSchema?: {
    type: string
    properties?: Record<string, unknown>
    required?: string[]
  }
}

export interface McpToolsCache {
  serverId: string
  serverName: string
  tools: McpTool[]
  fetchedAt: number
}

// 工具缓存，避免重复请求
const toolsCache = new Map<string, McpToolsCache>()
const toolNameMap = new Map<string, { serverId: string; toolName: string }>()
const initCache = new Map<string, number>()
const legacySseSessions = new Map<string, LegacySseSession>()
const legacyTransportServerIds = new Set<string>()
const CACHE_TTL = 5 * 60 * 1000 // 5 分钟缓存
const INIT_TTL = 5 * 60 * 1000
const REQUEST_TIMEOUT = 10000 // 10 秒超时

type JsonRpcResponse = {
  result?: unknown
  error?: { code: number; message: string }
}

type SseEvent = {
  event: string
  data: string
}

type LegacySsePending = {
  resolve: (value: JsonRpcResponse) => void
  reject: (error: Error) => void
  timeoutId: ReturnType<typeof setTimeout>
}

type LegacySseSession = {
  serverId: string
  endpointUrl: string
  reader: ReadableStreamDefaultReader<Uint8Array>
  decoder: TextDecoder
  buffer: string
  queuedEvents: SseEvent[]
  pending: Map<string, LegacySsePending>
  initialized: boolean
  pump: Promise<void>
}

const MCP_INITIALIZE_PARAMS = {
  protocolVersion: '2024-11-05',
  capabilities: {},
  clientInfo: {
    name: 'bug-v3-agent',
    version: '1.0.0'
  }
}

const shouldInit = (serverId: string) => {
  const last = initCache.get(serverId)
  return !last || Date.now() - last > INIT_TTL
}

const markInitialized = (serverId: string) => {
  initCache.set(serverId, Date.now())
}

/**
 * 发送 JSON-RPC 请求到 MCP 服务
 */
async function sendJsonRpc(
  server: McpServerConfig,
  method: string,
  params?: Record<string, unknown>
): Promise<JsonRpcResponse> {
  if (server.transport === 'sse' || legacyTransportServerIds.has(server.id)) {
    return sendLegacySseJsonRpc(server, method, params)
  }

  const fallbackPayload = {
    jsonrpc: '2.0',
    id: Date.now().toString(),
    method,
    params: params || {}
  }
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  try {
    const body = JSON.stringify(fallbackPayload)

    const response = await fetch(server.url, {
      method: 'POST',
      headers: buildJsonHeaders(server),
      body,
      credentials: 'omit',
      signal: controller.signal
    })

    if (response.status === 405) {
      const allowHeader = response.headers.get('allow') || ''
      if (allowHeader.includes('GET')) {
        legacyTransportServerIds.add(server.id)
        return sendLegacySseJsonRpc(server, method, params, fallbackPayload.id)
      }
    }

    if (!response.ok) {
      throw new Error(`MCP request failed: HTTP ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || ''

    // 处理 SSE 响应
    if (contentType.includes('text/event-stream')) {
      if (!response.body) {
        const text = await response.text()
        const lines = text.split('\n')
        for (const line of lines) {
          if (line.startsWith('data:')) {
            const data = line.slice(5).trim()
            if (data) {
              return JSON.parse(data)
            }
          }
        }
        throw new Error('No data in SSE response')
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let dataLines: string[] = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          const trimmed = line.trimEnd()
          if (!trimmed) {
            if (dataLines.length > 0) {
              const data = dataLines.join('\n').trim()
              dataLines = []
              if (data) {
                try {
                  await reader.cancel()
                } catch {
                  // ignore
                }
                return JSON.parse(data)
              }
            }
            continue
          }
          if (trimmed.startsWith('data:')) {
            const payload = trimmed.slice(5).trim()
            if (payload) dataLines.push(payload)
          }
        }
      }
      if (dataLines.length > 0) {
        const data = dataLines.join('\n').trim()
        if (data) return JSON.parse(data)
      }
      throw new Error('No data in SSE response')
    }

    // 处理 JSON 响应
    return response.json()
  } finally {
    clearTimeout(timeoutId)
  }
}

const buildJsonHeaders = (server: McpServerConfig, accept?: string): Record<string, string> => ({
  'Content-Type': 'application/json',
  Accept: accept || 'application/json, text/event-stream',
  ...(server.headers || {})
})

const parseSseEvents = (
  buffer: string
): {
  events: SseEvent[]
  rest: string
} => {
  const normalized = buffer.replace(/\r\n/g, '\n')
  const parts = normalized.split('\n\n')
  const rest = normalized.endsWith('\n\n') ? '' : parts.pop() || ''
  const events = parts
    .map(part => {
      const lines = part.split('\n')
      let event = 'message'
      const data: string[] = []
      for (const line of lines) {
        if (line.startsWith('event:')) {
          event = line.slice(6).trim() || 'message'
          continue
        }
        if (line.startsWith('data:')) {
          data.push(line.slice(5).trimStart())
        }
      }
      return {
        event,
        data: data.join('\n').trim()
      }
    })
    .filter(item => item.data)

  return { events, rest }
}

const closeLegacySseSession = async (serverId: string, error?: Error) => {
  const session = legacySseSessions.get(serverId)
  if (!session) return
  legacySseSessions.delete(serverId)
  for (const pending of session.pending.values()) {
    clearTimeout(pending.timeoutId)
    pending.reject(error || new Error('Legacy MCP SSE session closed'))
  }
  session.pending.clear()
  try {
    await session.reader.cancel()
  } catch {
    // ignore stream cancellation failures
  }
}

const dispatchLegacySseEvents = (serverId: string, events: SseEvent[]) => {
  const session = legacySseSessions.get(serverId)
  if (!session) return

  for (const event of events) {
    if (event.event !== 'message') continue

    let payload: JsonRpcResponse & { id?: string | number }
    try {
      payload = JSON.parse(event.data) as JsonRpcResponse & { id?: string | number }
    } catch {
      continue
    }

    const messageId = payload.id != null ? String(payload.id) : ''
    if (!messageId) continue

    const pending = session.pending.get(messageId)
    if (!pending) continue

    clearTimeout(pending.timeoutId)
    session.pending.delete(messageId)
    pending.resolve({
      result: payload.result,
      error: payload.error
    })
  }
}

const pumpLegacySseSession = async (serverId: string) => {
  const session = legacySseSessions.get(serverId)
  if (!session) return

  try {
    if (session.queuedEvents.length > 0) {
      dispatchLegacySseEvents(serverId, session.queuedEvents)
      session.queuedEvents = []
    }

    while (true) {
      const { done, value } = await session.reader.read()
      if (done) {
        throw new Error('Legacy MCP SSE stream closed unexpectedly')
      }

      session.buffer += session.decoder.decode(value, { stream: true })
      const { events, rest } = parseSseEvents(session.buffer)
      session.buffer = rest
      dispatchLegacySseEvents(serverId, events)
    }
  } catch (error) {
    const message = error instanceof Error ? error : new Error('Legacy MCP SSE stream failed')
    await closeLegacySseSession(serverId, message)
  }
}

const openLegacySseSession = async (server: McpServerConfig): Promise<LegacySseSession> => {
  const existing = legacySseSessions.get(server.id)
  if (existing) return existing

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  try {
    const response = await fetch(server.url, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
        ...(server.headers || {})
      },
      credentials: 'omit',
      signal: controller.signal
    })

    if (!response.ok || !response.body) {
      throw new Error(`Legacy MCP SSE request failed: HTTP ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        throw new Error('Legacy MCP SSE stream ended before endpoint announcement')
      }

      buffer += decoder.decode(value, { stream: true })
      const { events, rest } = parseSseEvents(buffer)
      buffer = rest
      const endpointIndex = events.findIndex(event => event.event === 'endpoint')
      if (endpointIndex < 0) continue

      const endpointEvent = events[endpointIndex]
      const endpointUrl = new URL(endpointEvent.data, server.url).toString()
      const session: LegacySseSession = {
        serverId: server.id,
        endpointUrl,
        reader,
        decoder,
        buffer,
        queuedEvents: events.slice(endpointIndex + 1),
        pending: new Map(),
        initialized: false,
        pump: Promise.resolve()
      }
      legacySseSessions.set(server.id, session)
      session.pump = pumpLegacySseSession(server.id)
      legacyTransportServerIds.add(server.id)
      return session
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

const dispatchLegacySseJsonRpc = (
  session: LegacySseSession,
  server: McpServerConfig,
  method: string,
  params?: Record<string, unknown>,
  requestId?: string
): Promise<JsonRpcResponse> => {
  const id = requestId || Date.now().toString()
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id,
    method,
    params: params || {}
  })

  return new Promise<JsonRpcResponse>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      session.pending.delete(id)
      reject(new Error(`Legacy MCP SSE request timed out: ${method}`))
    }, REQUEST_TIMEOUT)

    session.pending.set(id, {
      resolve,
      reject,
      timeoutId
    })

    void (async () => {
      try {
        const response = await fetch(session.endpointUrl, {
          method: 'POST',
          headers: buildJsonHeaders(server),
          body,
          credentials: 'omit'
        })

        if (!response.ok && response.status !== 202) {
          clearTimeout(timeoutId)
          session.pending.delete(id)
          reject(new Error(`Legacy MCP request failed: HTTP ${response.status}`))
        }
      } catch (error) {
        clearTimeout(timeoutId)
        session.pending.delete(id)
        reject(error instanceof Error ? error : new Error('Legacy MCP request failed'))
      }
    })()
  })
}

const sendLegacySseNotification = async (
  session: LegacySseSession,
  server: McpServerConfig,
  method: string,
  params?: Record<string, unknown>
) => {
  const response = await fetch(session.endpointUrl, {
    method: 'POST',
    headers: buildJsonHeaders(server),
    body: JSON.stringify({
      jsonrpc: '2.0',
      method,
      params: params || {}
    }),
    credentials: 'omit'
  })

  if (!response.ok && response.status !== 202) {
    throw new Error(`Legacy MCP notification failed: HTTP ${response.status}`)
  }
}

const sendLegacySseJsonRpc = async (
  server: McpServerConfig,
  method: string,
  params?: Record<string, unknown>,
  requestId?: string
): Promise<JsonRpcResponse> => {
  const session = await openLegacySseSession(server)

  if (method !== 'initialize' && !session.initialized) {
    const initResponse = await dispatchLegacySseJsonRpc(
      session,
      server,
      'initialize',
      MCP_INITIALIZE_PARAMS
    )
    if (initResponse.error) {
      return initResponse
    }
    await sendLegacySseNotification(session, server, 'notifications/initialized')
    session.initialized = true
  }

  const response = await dispatchLegacySseJsonRpc(session, server, method, params, requestId)
  if (method === 'initialize' && !response.error) {
    await sendLegacySseNotification(session, server, 'notifications/initialized')
    session.initialized = true
  }
  return response
}

/**
 * 初始化 MCP 服务连接
 */
export async function initializeMcpServer(
  server: McpServerConfig
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await sendJsonRpc(server, 'initialize', MCP_INITIALIZE_PARAMS)

    if (response.error) {
      return { ok: false, error: response.error.message }
    }

    markInitialized(server.id)
    return { ok: true }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { ok: false, error: message }
  }
}

/**
 * 发现 MCP 服务提供的工具列表
 */
export async function discoverMcpTools(server: McpServerConfig): Promise<McpTool[]> {
  // 检查缓存
  const cached = toolsCache.get(server.id)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.tools
  }

  try {
    // 先初始化连接
    const initResult = await initializeMcpServer(server)
    if (!initResult.ok) {
      console.warn(`[MCP] Failed to initialize ${server.name}: ${initResult.error}`)
      return []
    }

    // 获取工具列表
    const response = await sendJsonRpc(server, 'tools/list')

    if (response.error) {
      console.warn(`[MCP] Failed to list tools from ${server.name}: ${response.error.message}`)
      return []
    }

    const result = response.result as { tools?: McpTool[] }
    const tools = result?.tools || []

    // 更新缓存
    toolsCache.set(server.id, {
      serverId: server.id,
      serverName: server.name,
      tools,
      fetchedAt: Date.now()
    })

    return tools
  } catch (error) {
    console.warn(`[MCP] Error discovering tools from ${server.name}:`, error)
    return []
  }
}

/**
 * 调用 MCP 工具
 */
export async function callMcpTool(
  server: McpServerConfig,
  toolName: string,
  args: Record<string, unknown>
): Promise<{ result?: unknown; error?: string }> {
  try {
    if (shouldInit(server.id)) {
      const initResult = await initializeMcpServer(server)
      if (!initResult.ok) {
        return { error: initResult.error || 'MCP 初始化失败' }
      }
    }

    const response = await sendJsonRpc(server, 'tools/call', {
      name: toolName,
      arguments: args
    })

    if (response.error) {
      return { error: response.error.message }
    }

    return { result: response.result }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { error: message }
  }
}

/**
 * 从多个 MCP 服务发现所有工具
 * 返回格式化的工具列表，工具名带有服务前缀
 */
export async function discoverAllMcpTools(
  servers: McpServerConfig[]
): Promise<{ serverId: string; serverName: string; tool: McpTool }[]> {
  const enabledServers = servers.filter(s => s.enabled)
  const results: { serverId: string; serverName: string; tool: McpTool }[] = []

  await Promise.all(
    enabledServers.map(async server => {
      const tools = await discoverMcpTools(server)
      for (const tool of tools) {
        results.push({
          serverId: server.id,
          serverName: server.name,
          tool
        })
      }
    })
  )

  return results
}

/**
 * 将 MCP 工具转换为 Anthropic API 工具格式
 */
export function mcpToolToAnthropicTool(
  serverId: string,
  serverName: string,
  tool: McpTool
): {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required: string[]
  }
} {
  // 使用 mcp_serverId_toolName 格式来标识工具来源
  // serverId 是唯一的，避免服务名冲突
  const safeName = tool.name.replace(/[^a-zA-Z0-9_-]/g, '_')
  const prefixedName = `mcp__${serverId}__${safeName}`
  toolNameMap.set(prefixedName, { serverId, toolName: tool.name })

  return {
    name: prefixedName,
    description: tool.description || `MCP tool: ${tool.name} from ${serverName}`,
    input_schema: {
      type: 'object' as const,
      properties: (tool.inputSchema?.properties as Record<string, unknown>) || {},
      required: tool.inputSchema?.required || []
    }
  }
}

/**
 * 解析 MCP 工具调用名称，提取服务 ID 和工具名
 */
export function parseMcpToolName(
  prefixedName: string
): { serverId: string; toolName: string } | null {
  const cached = toolNameMap.get(prefixedName)
  if (cached) return cached

  // 格式：mcp__serverId__toolName
  if (!prefixedName.startsWith('mcp__')) return null
  const rest = prefixedName.slice(5)
  const sepIndex = rest.indexOf('__')
  if (sepIndex <= 0) return null

  const serverId = rest.slice(0, sepIndex)
  const toolPart = rest.slice(sepIndex + 2)
  if (!serverId || !toolPart) return null

  return {
    serverId,
    // 兼容旧编码：将下划线还原为点号（可能对包含下划线的工具名不准确）
    toolName: toolPart.replace(/_/g, '.')
  }
}

/**
 * 根据服务ID找到对应的服务配置
 */
export function findServerById(
  servers: McpServerConfig[],
  serverId: string
): McpServerConfig | undefined {
  return servers.find(s => s.id === serverId)
}

/**
 * 清除工具缓存
 */
export function clearToolsCache(serverId?: string): void {
  if (serverId) {
    toolsCache.delete(serverId)
    for (const [key, value] of toolNameMap.entries()) {
      if (value.serverId === serverId) toolNameMap.delete(key)
    }
    initCache.delete(serverId)
    legacyTransportServerIds.delete(serverId)
    void closeLegacySseSession(serverId)
  } else {
    toolsCache.clear()
    toolNameMap.clear()
    initCache.clear()
    legacyTransportServerIds.clear()
    for (const serverKey of legacySseSessions.keys()) {
      void closeLegacySseSession(serverKey)
    }
  }
}
