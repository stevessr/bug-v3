#!/usr/bin/env node

/**
 * MCP Server for Browser Extension
 *
 * Provides:
 * - WebSocket connection for browser extension
 * - Streamable HTTP (SSE) for MCP clients
 */

import http from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import { randomUUID } from 'node:crypto'

const PORT = Number(process.env.MCP_PORT) || 7465
const HOST = process.env.MCP_HOST || '127.0.0.1'

// Tool definitions
const TOOLS = [
  // Chrome tab tools
  {
    name: 'chrome_list_tabs',
    description: '列出所有浏览器标签页',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'chrome_get_active_tab',
    description: '获取当前活动的标签页',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'chrome_tab_create',
    description: '创建新标签页',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '要打开的URL' },
        active: { type: 'boolean', description: '是否激活标签页' }
      }
    }
  },
  {
    name: 'chrome_navigate',
    description: '导航到指定URL',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL' },
        tabId: { type: 'number', description: '标签页ID' }
      },
      required: ['url']
    }
  },
  {
    name: 'chrome_screenshot',
    description: '截取当前标签页屏幕',
    inputSchema: {
      type: 'object',
      properties: {
        format: { type: 'string', enum: ['png', 'jpeg'], description: '图片格式' }
      }
    }
  },
  // Discourse tools
  {
    name: 'discourse_like_post',
    description: '点赞 Discourse 帖子',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', description: 'Discourse 站点URL', default: 'https://linux.do' },
        postId: { type: 'number', description: '帖子ID' },
        reactionId: { type: 'string', description: '表情类型', default: 'heart' }
      },
      required: ['postId']
    }
  },
  {
    name: 'discourse_get_topic_list',
    description: '获取 Discourse 话题列表',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', description: 'Discourse 站点URL', default: 'https://linux.do' },
        strategy: { type: 'string', enum: ['latest', 'new', 'unread', 'top'], description: '浏览策略' },
        page: { type: 'number', description: '页码', default: 0 }
      }
    }
  },
  {
    name: 'discourse_get_topic',
    description: '获取 Discourse 话题详情',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', description: 'Discourse 站点URL', default: 'https://linux.do' },
        topicId: { type: 'number', description: '话题ID' }
      },
      required: ['topicId']
    }
  },
  {
    name: 'discourse_create_post',
    description: '在 Discourse 创建回帖',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', description: 'Discourse 站点URL', default: 'https://linux.do' },
        topicId: { type: 'number', description: '话题ID' },
        raw: { type: 'string', description: '回复内容 (Markdown)' },
        replyToPostNumber: { type: 'number', description: '回复的楼层号' }
      },
      required: ['topicId', 'raw']
    }
  },
  {
    name: 'discourse_browse_topic',
    description: '综合浏览话题（阅读 + 可选点赞）',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', description: 'Discourse 站点URL', default: 'https://linux.do' },
        topicId: { type: 'number', description: '话题ID' },
        readTimeMs: { type: 'number', description: '阅读时间(毫秒)', default: 10000 },
        like: { type: 'boolean', description: '是否点赞', default: false }
      },
      required: ['topicId']
    }
  },
  {
    name: 'discourse_get_user_activity',
    description: '获取用户活动记录',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', description: 'Discourse 站点URL', default: 'https://linux.do' },
        username: { type: 'string', description: '用户名' },
        filter: { type: 'string', description: '过滤类型', default: '4,5' },
        limit: { type: 'number', description: '数量限制', default: 20 }
      },
      required: ['username']
    }
  },
  {
    name: 'discourse_send_timings',
    description: '发送阅读时间到 Discourse',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', description: 'Discourse 站点URL', default: 'https://linux.do' },
        topicId: { type: 'number', description: '话题ID' },
        timeMs: { type: 'number', description: '阅读时间(毫秒)', default: 10000 },
        postNumbers: { type: 'array', items: { type: 'number' }, description: '帖子编号列表' }
      },
      required: ['topicId']
    }
  }
]

// Convert tool name: discourse_like_post -> discourse.like_post
// Only replace the first underscore (namespace separator)
function toExtensionToolName(name) {
  return name.replace(/_/, '.')
}

// State
let extensionWs = null
const pendingCalls = new Map()
const sseClients = new Set()

function log(...args) {
  console.log(`[MCP ${new Date().toISOString()}]`, ...args)
}

// Send JSON-RPC response to SSE client
function sendSseMessage(res, message) {
  res.write(`data: ${JSON.stringify(message)}\n\n`)
}

// Handle MCP JSON-RPC request
async function handleMcpRequest(request) {
  const { jsonrpc, id, method, params } = request

  if (jsonrpc !== '2.0') {
    return { jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid Request' } }
  }

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'bugv3-mcp-server',
            version: '1.0.0'
          }
        }
      }

    case 'notifications/initialized':
      return null // No response for notifications

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: { tools: TOOLS }
      }

    case 'tools/call': {
      const { name, arguments: args } = params || {}

      if (!extensionWs || extensionWs.readyState !== WebSocket.OPEN) {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32000, message: 'Extension not connected' }
        }
      }

      const callId = randomUUID()
      const extensionToolName = toExtensionToolName(name)

      // Send to extension via WebSocket
      const toolCall = {
        type: 'MCP_TOOL_CALL',
        id: callId,
        tool: extensionToolName,
        args: args || {}
      }

      try {
        const result = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            pendingCalls.delete(callId)
            reject(new Error('Tool call timeout'))
          }, 30000)

          pendingCalls.set(callId, { resolve, reject, timeout })
          extensionWs.send(JSON.stringify(toolCall))
        })

        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          }
        }
      } catch (err) {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32000, message: err.message }
        }
      }
    }

    default:
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: 'Method not found' }
      }
  }
}

// Handle HTTP requests
async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${HOST}:${PORT}`)

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  // MCP Streamable HTTP endpoint (SSE)
  if (url.pathname === '/mcp' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    })

    sseClients.add(res)
    log('MCP SSE client connected')

    req.on('close', () => {
      sseClients.delete(res)
      log('MCP SSE client disconnected')
    })
    return
  }

  // MCP JSON-RPC endpoint
  if (url.pathname === '/mcp' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', async () => {
      try {
        const request = JSON.parse(body)
        log('MCP Request:', request.method)

        const response = await handleMcpRequest(request)

        if (response) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(response))
        } else {
          res.writeHead(204)
          res.end()
        }
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: 'Parse error' }
        }))
      }
    })
    return
  }

  // Health check
  if (url.pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      ok: true,
      extensionConnected: extensionWs?.readyState === WebSocket.OPEN,
      tools: TOOLS.length
    }))
    return
  }

  // Server info
  if (url.pathname === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      name: 'bugv3-mcp-server',
      version: '1.0.0',
      description: 'MCP Server for Browser Extension',
      mcp: {
        endpoint: '/mcp',
        transport: 'streamable-http'
      },
      ws: {
        endpoint: '/ws',
        description: 'WebSocket for browser extension'
      }
    }))
    return
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
}

// Create HTTP server
const server = http.createServer(handleRequest)

// Create WebSocket server for extension
const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (ws) => {
  log('Extension WebSocket connected')
  extensionWs = ws

  // Notify SSE clients
  for (const client of sseClients) {
    sendSseMessage(client, {
      jsonrpc: '2.0',
      method: 'notifications/extension_connected',
      params: {}
    })
  }

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString())

      // Handle ping from extension (heartbeat)
      if (message.type === 'MCP_PING') {
        ws.send(JSON.stringify({
          type: 'MCP_PONG',
          timestamp: message.timestamp
        }))
        return
      }

      // Handle tool result from extension
      if (message.type === 'MCP_TOOL_RESULT') {
        const pending = pendingCalls.get(message.id)
        if (pending) {
          clearTimeout(pending.timeout)
          pendingCalls.delete(message.id)

          if (message.error) {
            pending.reject(new Error(message.error))
          } else {
            pending.resolve(message.result)
          }
        }
      }
    } catch (err) {
      log('WebSocket message error:', err.message)
    }
  })

  ws.on('close', () => {
    log('Extension WebSocket disconnected')
    if (extensionWs === ws) {
      extensionWs = null
    }

    // Notify SSE clients
    for (const client of sseClients) {
      sendSseMessage(client, {
        jsonrpc: '2.0',
        method: 'notifications/extension_disconnected',
        params: {}
      })
    }
  })

  ws.on('error', (err) => {
    log('WebSocket error:', err.message)
  })
})

// Start server
server.listen(PORT, HOST, () => {
  log(`MCP Server started on http://${HOST}:${PORT}`)
  log('')
  log('Endpoints:')
  log(`  MCP Streamable HTTP: http://${HOST}:${PORT}/mcp`)
  log(`  WebSocket (extension): ws://${HOST}:${PORT}/ws`)
  log(`  Health check: http://${HOST}:${PORT}/health`)
  log('')
  log('Waiting for extension connection...')
})

// Graceful shutdown
process.on('SIGINT', () => {
  log('Shutting down...')
  wss.close()
  server.close(() => {
    log('Server closed')
    process.exit(0)
  })
})

process.on('SIGTERM', () => {
  log('Shutting down...')
  wss.close()
  server.close(() => {
    log('Server closed')
    process.exit(0)
  })
})
