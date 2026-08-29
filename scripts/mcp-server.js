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
const MCP_PROTOCOL_VERSION = '2024-11-05'
const MCP_SESSION_ID = `bug-v3-ws-${process.pid}`

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
        url: { type: 'string', description: '要打开的 URL' },
        active: { type: 'boolean', description: '是否激活标签页' }
      }
    }
  },
  {
    name: 'chrome_tab_focus',
    description: '聚焦指定标签页',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: { type: 'number', description: '标签页 ID' }
      },
      required: ['tabId']
    }
  },
  {
    name: 'chrome_tabs_group',
    description: '将多个标签页分组',
    inputSchema: {
      type: 'object',
      properties: {
        tabIds: { type: 'array', items: { type: 'number' }, description: '标签页 ID 列表' },
        groupId: { type: 'number', description: '已有分组 ID（可选）' },
        title: { type: 'string', description: '分组标题（可选）' },
        color: {
          type: 'string',
          description: '分组颜色（可选）',
          enum: ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange']
        }
      },
      required: ['tabIds']
    }
  },
  {
    name: 'chrome_navigate',
    description: '导航到指定 URL',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL' },
        tabId: { type: 'number', description: '标签页 ID' }
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
  {
    name: 'chrome_debug_start',
    description: '开始采集指定标签页的控制台与网络诊断',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: { type: 'number', description: '标签页 ID' },
        captureConsole: { type: 'boolean', description: '采集控制台日志' },
        captureNetwork: { type: 'boolean', description: '采集网络请求' },
        clear: { type: 'boolean', description: '清除旧记录' }
      }
    }
  },
  {
    name: 'chrome_console_logs',
    description: '读取指定标签页采集的控制台日志与异常',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: { type: 'number', description: '标签页 ID' },
        limit: { type: 'number', minimum: 1, maximum: 500 },
        clear: { type: 'boolean', description: '读取后清除记录' }
      }
    }
  },
  {
    name: 'chrome_network_log',
    description: '读取指定标签页采集的网络请求诊断',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: { type: 'number', description: '标签页 ID' },
        limit: { type: 'number', minimum: 1, maximum: 500 },
        clear: { type: 'boolean', description: '读取后清除记录' }
      }
    }
  },
  {
    name: 'chrome_debug_stop',
    description: '停止指定标签页的开发者诊断',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: { type: 'number', description: '标签页 ID' }
      }
    }
  },
  {
    name: 'chrome_window_focus',
    description: '聚焦指定窗口',
    inputSchema: {
      type: 'object',
      properties: {
        windowId: { type: 'number', description: '窗口 ID' }
      },
      required: ['windowId']
    }
  },
  // Discourse tools
  {
    name: 'discourse_get_current_page',
    description: '自动识别当前活动 Discourse 标签页的 topic/category/tag/user/feed/search 路由并返回结构化上下文',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: { type: 'number', description: '可选标签页 ID；默认使用当前活动标签页' },
        baseUrl: { type: 'string', description: '可选 Discourse 站点 URL；提供时必须与标签页同源' },
        includeRaw: { type: 'boolean', description: 'Topic 上下文是否返回 raw 原文', default: false },
        maxPosts: { type: 'number', minimum: 1, maximum: 200, description: '当前页面最多返回帖子数', default: 40 }
      }
    }
  },
  {
    name: 'discourse_like_post',
    description: '点赞 Discourse 帖子',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', description: 'Discourse 站点 URL', default: 'https://linux.do' },
        postId: { type: 'number', description: '帖子 ID' },
        reactionId: { type: 'string', description: '表情类型', default: 'heart' }
      },
      required: ['postId']
    }
  },
  {
    name: 'discourse_get_topic_list',
    description: '获取 Discourse 话题列表，并返回续读 cursor',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', description: 'Discourse 站点 URL', default: 'https://linux.do' },
        strategy: {
          type: 'string',
          enum: ['latest', 'new', 'unread', 'top'],
          description: '浏览策略'
        },
        page: { type: 'number', description: '页码', default: 0 }
      }
    }
  },
  {
    name: 'discourse_get_site_info',
    description: '读取并短期缓存 Discourse 站点基本信息、分类与公开能力',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', description: 'Discourse 站点 URL', default: 'https://linux.do' },
        forceRefresh: { type: 'boolean', description: '忽略 60 秒站点信息缓存并强制刷新', default: false }
      }
    }
  },
  {
    name: 'discourse_get_topic',
    description: '按 post stream 窗口读取 Discourse 话题，并返回前后游标、回复关系和参与者',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', description: 'Discourse 站点 URL', default: 'https://linux.do' },
        topicId: { type: 'number', description: '话题 ID' },
        includeRaw: { type: 'boolean', description: '是否返回 raw 原文', default: false },
        maxPosts: { type: 'number', minimum: 1, maximum: 2000, description: '本窗口最多加载帖子数', default: 200 },
        postOffset: { type: 'number', minimum: 0, description: 'post stream 起始偏移；可直接使用上次 next_post_offset', default: 0 }
      },
      required: ['topicId']
    }
  },
  {
    name: 'discourse_get_post',
    description: '获取 Discourse 帖子详情',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', description: 'Discourse 站点 URL', default: 'https://linux.do' },
        postId: { type: 'number', description: '帖子 ID' },
        includeRaw: { type: 'boolean', description: '是否返回 raw 原文', default: false }
      },
      required: ['postId']
    }
  },
  {
    name: 'discourse_get_topic_posts',
    description: '获取话题内指定楼层帖子，并返回这些楼层的回复关系',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', description: 'Discourse 站点 URL', default: 'https://linux.do' },
        topicId: { type: 'number', description: '话题 ID' },
        postNumbers: {
          type: 'array',
          items: { type: 'number' },
          description: '楼层号列表'
        },
        includeRaw: { type: 'boolean', description: '是否返回 raw 原文', default: false }
      },
      required: ['topicId', 'postNumbers']
    }
  },
  {
    name: 'discourse_get_category_list',
    description: '获取分类列表',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', description: 'Discourse 站点 URL', default: 'https://linux.do' }
      }
    }
  },
  {
    name: 'discourse_get_category_topics',
    description: '按分类浏览 Discourse 话题，可选择 latest/unread/new/top 等分类过滤器并返回续读 cursor',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', description: 'Discourse 站点 URL', default: 'https://linux.do' },
        slug: { type: 'string', description: '分类 slug' },
        categoryId: { type: 'number', description: '分类 ID' },
        filter: {
          type: 'string',
          enum: ['latest', 'unread', 'new', 'unseen', 'top', 'read', 'posted', 'bookmarks'],
          description: '可选分类过滤器'
        },
        page: { type: 'number', description: '页码', default: 0 }
      },
      required: ['slug', 'categoryId']
    }
  },
  {
    name: 'discourse_get_tag_list',
    description: '获取标签列表',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', description: 'Discourse 站点 URL', default: 'https://linux.do' }
      }
    }
  },
  {
    name: 'discourse_get_tag_topics',
    description: '按标签浏览 Discourse 话题并返回续读 cursor',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', description: 'Discourse 站点 URL', default: 'https://linux.do' },
        tag: { type: 'string', description: '标签名' },
        page: { type: 'number', description: '页码', default: 0 }
      },
      required: ['tag']
    }
  },
  {
    name: 'discourse_search_user',
    description: '搜索用户',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', description: 'Discourse 站点 URL', default: 'https://linux.do' },
        term: { type: 'string', description: '搜索关键词' }
      },
      required: ['term']
    }
  },
  {
    name: 'discourse_get_user',
    description: '读取 Discourse 用户公开资料',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', description: 'Discourse 站点 URL', default: 'https://linux.do' },
        username: { type: 'string', description: '用户名' }
      },
      required: ['username']
    }
  },
  {
    name: 'discourse_get_notifications',
    description: '获取通知列表',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', description: 'Discourse 站点 URL', default: 'https://linux.do' },
        page: { type: 'number', description: '页码', default: 0 }
      }
    }
  },
  {
    name: 'discourse_get_bookmarks',
    description: '获取书签列表',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', description: 'Discourse 站点 URL', default: 'https://linux.do' },
        page: { type: 'number', description: '页码', default: 0 }
      }
    }
  },
  {
    name: 'discourse_get_post_context',
    description: '获取帖子上下文（定位到指定帖子附近的上下文、回复关系与参与者）',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', description: 'Discourse 站点 URL', default: 'https://linux.do' },
        postId: { type: 'number', description: '帖子 ID' },
        topicId: { type: 'number', description: '话题 ID（可选，提供则可跳过一次查询）' },
        postNumber: { type: 'number', description: '楼层号（可选，提供则可跳过一次查询）' },
        includeRaw: { type: 'boolean', description: '是否返回 raw 原文', default: false }
      },
      required: ['postId']
    }
  },
  {
    name: 'discourse_create_post',
    description: '在 Discourse 创建回帖',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', description: 'Discourse 站点 URL', default: 'https://linux.do' },
        topicId: { type: 'number', description: '话题 ID' },
        raw: { type: 'string', description: '回复内容 (Markdown)' },
        replyToPostNumber: { type: 'number', description: '回复的楼层号' }
      },
      required: ['topicId', 'raw']
    }
  },
  {
    name: 'discourse_like_topic',
    description: '点赞话题（默认点赞首帖）',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', description: 'Discourse 站点 URL', default: 'https://linux.do' },
        topicId: { type: 'number', description: '话题 ID' },
        reactionId: { type: 'string', description: '表情类型', default: 'heart' }
      },
      required: ['topicId']
    }
  },
  {
    name: 'discourse_unlike_post',
    description: '取消点赞帖子',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', description: 'Discourse 站点 URL', default: 'https://linux.do' },
        postId: { type: 'number', description: '帖子 ID' },
        reactionId: { type: 'string', description: '表情类型', default: 'heart' }
      },
      required: ['postId']
    }
  },
  {
    name: 'discourse_bookmark_post',
    description: '添加帖子书签',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', description: 'Discourse 站点 URL', default: 'https://linux.do' },
        postId: { type: 'number', description: '帖子 ID' },
        name: { type: 'string', description: '书签名称（可选）' }
      },
      required: ['postId']
    }
  },
  {
    name: 'discourse_unbookmark_post',
    description: '取消帖子书签',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', description: 'Discourse 站点 URL', default: 'https://linux.do' },
        postId: { type: 'number', description: '帖子 ID' }
      },
      required: ['postId']
    }
  },
  {
    name: 'discourse_browse_topic',
    description: '按 post stream 窗口浏览话题（阅读上报 + 可选点赞 + 回复关系 + 前后游标）',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', description: 'Discourse 站点 URL', default: 'https://linux.do' },
        topicId: { type: 'number', description: '话题 ID' },
        readTimeMs: { type: 'number', description: '阅读时间 (毫秒)', default: 10000 },
        like: { type: 'boolean', description: '是否点赞', default: false },
        maxPosts: { type: 'number', minimum: 1, maximum: 2000, description: '本窗口最多加载帖子数', default: 200 },
        postOffset: { type: 'number', minimum: 0, description: 'post stream 起始偏移；可直接使用上次 nextPostOffset', default: 0 }
      },
      required: ['topicId']
    }
  },
  {
    name: 'discourse_search',
    description: '搜索 Discourse 内容，并返回续读 cursor',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', description: 'Discourse 站点 URL', default: 'https://linux.do' },
        q: { type: 'string', description: '搜索关键词' },
        page: { type: 'number', description: '页码', default: 0 },
        type: { type: 'string', description: '搜索类型（可选）' }
      },
      required: ['q']
    }
  },
  {
    name: 'discourse_get_user_activity',
    description: '获取用户活动记录，并返回 next_offset cursor',
    inputSchema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', description: 'Discourse 站点 URL', default: 'https://linux.do' },
        username: { type: 'string', description: '用户名' },
        filter: { type: 'string', description: '过滤类型', default: '4,5' },
        limit: { type: 'number', description: '数量限制', default: 20 },
        offset: { type: 'number', description: '偏移量（跳过数量）', default: 0 }
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
        baseUrl: { type: 'string', description: 'Discourse 站点 URL', default: 'https://linux.do' },
        topicId: { type: 'number', description: '话题 ID' },
        timeMs: { type: 'number', description: '阅读时间 (毫秒)', default: 10000 },
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

const TOOL_NAMES = new Set(TOOLS.map(tool => tool.name))

function log(...args) {
  console.log(`[MCP ${new Date().toISOString()}]`, ...args)
}

// Send JSON-RPC response to SSE client
function sendSseMessage(res, message) {
  if (res.writableEnded || res.destroyed) return
  res.write(`event: message\ndata: ${JSON.stringify(message)}\n\n`)
}

function rejectPendingCalls(error) {
  for (const [id, pending] of pendingCalls) {
    clearTimeout(pending.timeout)
    pendingCalls.delete(id)
    pending.reject(error)
  }
}

// Handle MCP JSON-RPC request
async function handleMcpRequest(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    return { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } }
  }

  const { jsonrpc, id, method, params } = request

  if (jsonrpc !== '2.0') {
    return { jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid Request' } }
  }

  if (typeof method !== 'string') {
    return { jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid Request' } }
  }

  if (method.startsWith('notifications/')) {
    return null
  }

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: MCP_PROTOCOL_VERSION,
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

      if (!name || !TOOL_NAMES.has(name)) {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32602, message: `Unknown tool: ${name || '<missing>'}` }
        }
      }

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
          try {
            extensionWs.send(JSON.stringify(toolCall))
          } catch (error) {
            clearTimeout(timeout)
            pendingCalls.delete(callId)
            reject(error)
          }
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
          result: {
            content: [{ type: 'text', text: err.message || 'Tool call failed' }],
            isError: true
          }
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, MCP-Session-Id')
  res.setHeader('Access-Control-Expose-Headers', 'MCP-Session-Id, MCP-Protocol-Version')

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
      Connection: 'keep-alive',
      'MCP-Session-Id': MCP_SESSION_ID,
      'MCP-Protocol-Version': MCP_PROTOCOL_VERSION
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
    req.on('data', chunk => {
      body += chunk
    })
    req.on('end', async () => {
      try {
        const request = JSON.parse(body)
        const isBatch = Array.isArray(request)
        if (isBatch && request.length === 0) throw new Error('Invalid Request')
        log('MCP Request:', isBatch ? 'batch' : request.method)

        const responses = (
          await Promise.all((isBatch ? request : [request]).map(handleMcpRequest))
        ).filter(Boolean)

        if (responses.length === 0) {
          res.writeHead(204, {
            'MCP-Session-Id': MCP_SESSION_ID,
            'MCP-Protocol-Version': MCP_PROTOCOL_VERSION
          })
          res.end()
        } else if ((req.headers.accept || '').includes('text/event-stream')) {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'MCP-Session-Id': MCP_SESSION_ID,
            'MCP-Protocol-Version': MCP_PROTOCOL_VERSION
          })
          responses.forEach(response => sendSseMessage(res, response))
          res.end()
        } else {
          const payload = isBatch ? responses : responses[0]
          const text = JSON.stringify(payload)
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(text),
            'MCP-Session-Id': MCP_SESSION_ID,
            'MCP-Protocol-Version': MCP_PROTOCOL_VERSION
          })
          res.end(text)
        }
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: { code: -32700, message: 'Parse error' }
          })
        )
      }
    })
    return
  }

  // Health check
  if (url.pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        ok: true,
        extensionConnected: extensionWs?.readyState === WebSocket.OPEN,
        tools: TOOLS.length,
        transport: 'websocket'
      })
    )
    return
  }

  // Server info
  if (url.pathname === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        name: 'bugv3-mcp-server',
        version: '1.0.0',
        description: 'MCP Server for Browser Extension',
        mcp: {
          endpoint: '/mcp',
          transport: 'streamable-http',
          protocolVersion: MCP_PROTOCOL_VERSION
        },
        ws: {
          endpoint: '/ws',
          description: 'WebSocket for browser extension'
        }
      })
    )
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

wss.on('connection', ws => {
  log('Extension WebSocket connected')
  if (extensionWs && extensionWs !== ws) {
    try {
      extensionWs.close(1000, 'Replaced by a newer extension connection')
    } catch {
      // ignore
    }
  }
  rejectPendingCalls(new Error('Extension connection replaced'))
  extensionWs = ws

  // Notify SSE clients
  for (const client of sseClients) {
    sendSseMessage(client, {
      jsonrpc: '2.0',
      method: 'notifications/extension_connected',
      params: {}
    })
  }

  ws.on('message', data => {
    try {
      const message = JSON.parse(data.toString())

      // Handle ping from extension (heartbeat)
      if (message.type === 'MCP_PING') {
        ws.send(
          JSON.stringify({
            type: 'MCP_PONG',
            timestamp: message.timestamp
          })
        )
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
      rejectPendingCalls(new Error('Extension disconnected'))
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

  ws.on('error', err => {
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
