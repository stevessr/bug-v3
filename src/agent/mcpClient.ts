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
const CACHE_TTL = 5 * 60 * 1000 // 5 分钟缓存
const REQUEST_TIMEOUT = 10000 // 10 秒超时

/**
 * 发送 JSON-RPC 请求到 MCP 服务
 */
async function sendJsonRpc(
  server: McpServerConfig,
  method: string,
  params?: Record<string, unknown>
): Promise<{ result?: unknown; error?: { code: number; message: string } }> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(server.headers || {})
    }

    // Some MCP servers require both application/json and text/event-stream
    // Always advertise both; servers can choose the response format.
    void server.transport

    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now().toString(),
      method,
      params: params || {}
    })

    const response = await fetch(server.url, {
      method: 'POST',
      headers,
      body,
      credentials: 'omit',
      signal: controller.signal
    })

    if (!response.ok) {
      throw new Error(`MCP request failed: HTTP ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || ''

    // 处理 SSE 响应
    if (contentType.includes('text/event-stream')) {
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

    // 处理 JSON 响应
    return response.json()
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * 初始化 MCP 服务连接
 */
export async function initializeMcpServer(
  server: McpServerConfig
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await sendJsonRpc(server, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'bug-v3-agent',
        version: '1.0.0'
      }
    })

    if (response.error) {
      return { ok: false, error: response.error.message }
    }

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
 * 解析 MCP 工具调用名称，提取服务ID和工具名
 */
export function parseMcpToolName(
  prefixedName: string
): { serverId: string; toolName: string } | null {
  // 格式: mcp__serverId__toolName
  const match = prefixedName.match(/^mcp__([^_]+)__(.+)$/)
  if (!match) return null

  return {
    serverId: match[1],
    toolName: match[2].replace(/_/g, '.') // 恢复原始工具名中的点号
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
  } else {
    toolsCache.clear()
  }
}
