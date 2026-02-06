#!/usr/bin/env node
import http from 'node:http'
import { setTimeout as delay } from 'node:timers/promises'

const DEFAULT_PORT = Number.parseInt(process.env.MCP_PORT || '', 10) || 7465
const TOOL_TIMEOUT_MS = 30_000

const TOOLS = [
  {
    name: 'chrome.list_tabs',
    description: 'List all open tabs with ids, titles, urls, and active status.',
    input_schema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'chrome.get_active_tab',
    description: 'Get the active tab in the current window.',
    input_schema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'chrome.tab_create',
    description: 'Create a new tab.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        active: { type: 'boolean' },
        index: { type: 'number' },
        windowId: { type: 'number' },
        pinned: { type: 'boolean' }
      }
    }
  },
  {
    name: 'chrome.tab_focus',
    description: 'Focus a tab by id.',
    input_schema: {
      type: 'object',
      properties: {
        tabId: { type: 'number' }
      },
      required: ['tabId']
    }
  },
  {
    name: 'chrome.tab_close',
    description: 'Close a tab by id.',
    input_schema: {
      type: 'object',
      properties: {
        tabId: { type: 'number' }
      },
      required: ['tabId']
    }
  },
  {
    name: 'chrome.tab_reload',
    description: 'Reload a tab.',
    input_schema: {
      type: 'object',
      properties: {
        tabId: { type: 'number' },
        bypassCache: { type: 'boolean' }
      }
    }
  },
  {
    name: 'chrome.tab_back',
    description: 'Go back in a tab history.',
    input_schema: {
      type: 'object',
      properties: {
        tabId: { type: 'number' }
      }
    }
  },
  {
    name: 'chrome.tab_forward',
    description: 'Go forward in a tab history.',
    input_schema: {
      type: 'object',
      properties: {
        tabId: { type: 'number' }
      }
    }
  },
  {
    name: 'chrome.tab_duplicate',
    description: 'Duplicate a tab.',
    input_schema: {
      type: 'object',
      properties: {
        tabId: { type: 'number' }
      },
      required: ['tabId']
    }
  },
  {
    name: 'chrome.tab_move',
    description: 'Move a tab to a new index or window.',
    input_schema: {
      type: 'object',
      properties: {
        tabId: { type: 'number' },
        index: { type: 'number' },
        windowId: { type: 'number' }
      },
      required: ['tabId', 'index']
    }
  },
  {
    name: 'chrome.tab_pin',
    description: 'Pin a tab.',
    input_schema: {
      type: 'object',
      properties: {
        tabId: { type: 'number' }
      },
      required: ['tabId']
    }
  },
  {
    name: 'chrome.tab_unpin',
    description: 'Unpin a tab.',
    input_schema: {
      type: 'object',
      properties: {
        tabId: { type: 'number' }
      },
      required: ['tabId']
    }
  },
  {
    name: 'chrome.tab_mute',
    description: 'Mute a tab.',
    input_schema: {
      type: 'object',
      properties: {
        tabId: { type: 'number' }
      },
      required: ['tabId']
    }
  },
  {
    name: 'chrome.tab_unmute',
    description: 'Unmute a tab.',
    input_schema: {
      type: 'object',
      properties: {
        tabId: { type: 'number' }
      },
      required: ['tabId']
    }
  },
  {
    name: 'chrome.tab_highlight',
    description: 'Highlight tabs in a window.',
    input_schema: {
      type: 'object',
      properties: {
        tabIds: { type: 'array', items: { type: 'number' } },
        windowId: { type: 'number' }
      },
      required: ['tabIds']
    }
  },
  {
    name: 'chrome.tab_zoom_get',
    description: 'Get zoom level of a tab.',
    input_schema: {
      type: 'object',
      properties: {
        tabId: { type: 'number' }
      }
    }
  },
  {
    name: 'chrome.tab_zoom_set',
    description: 'Set zoom level of a tab.',
    input_schema: {
      type: 'object',
      properties: {
        tabId: { type: 'number' },
        zoomFactor: { type: 'number' }
      },
      required: ['zoomFactor']
    }
  },
  {
    name: 'chrome.tab_group',
    description: 'Group tabs together.',
    input_schema: {
      type: 'object',
      properties: {
        tabIds: { type: 'array', items: { type: 'number' } },
        groupId: { type: 'number' }
      },
      required: ['tabIds']
    }
  },
  {
    name: 'chrome.tabs_group',
    description: 'Group tabs together with optional title/color.',
    input_schema: {
      type: 'object',
      properties: {
        tabIds: { type: 'array', items: { type: 'number' } },
        groupId: { type: 'number' },
        title: { type: 'string' },
        color: {
          type: 'string',
          enum: ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange']
        }
      },
      required: ['tabIds']
    }
  },
  {
    name: 'chrome.tab_ungroup',
    description: 'Ungroup tabs.',
    input_schema: {
      type: 'object',
      properties: {
        tabIds: { type: 'array', items: { type: 'number' } }
      },
      required: ['tabIds']
    }
  },
  {
    name: 'chrome.window_list',
    description: 'List all browser windows.',
    input_schema: {
      type: 'object',
      properties: {
        populate: { type: 'boolean' }
      }
    }
  },
  {
    name: 'chrome.window_get',
    description: 'Get a window by id.',
    input_schema: {
      type: 'object',
      properties: {
        windowId: { type: 'number' },
        populate: { type: 'boolean' }
      },
      required: ['windowId']
    }
  },
  {
    name: 'chrome.window_current',
    description: 'Get the current window.',
    input_schema: {
      type: 'object',
      properties: {
        populate: { type: 'boolean' }
      }
    }
  },
  {
    name: 'chrome.window_create',
    description: 'Create a new window.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        focused: { type: 'boolean' },
        incognito: { type: 'boolean' },
        state: { type: 'string', enum: ['normal', 'minimized', 'maximized', 'fullscreen'] },
        left: { type: 'number' },
        top: { type: 'number' },
        width: { type: 'number' },
        height: { type: 'number' }
      }
    }
  },
  {
    name: 'chrome.window_update',
    description: 'Update a window (focus, state, bounds).',
    input_schema: {
      type: 'object',
      properties: {
        windowId: { type: 'number' },
        focused: { type: 'boolean' },
        state: { type: 'string', enum: ['normal', 'minimized', 'maximized', 'fullscreen'] },
        left: { type: 'number' },
        top: { type: 'number' },
        width: { type: 'number' },
        height: { type: 'number' }
      },
      required: ['windowId']
    }
  },
  {
    name: 'chrome.window_focus',
    description: 'Focus a window by id.',
    input_schema: {
      type: 'object',
      properties: {
        windowId: { type: 'number' }
      },
      required: ['windowId']
    }
  },
  {
    name: 'chrome.window_close',
    description: 'Close a window by id.',
    input_schema: {
      type: 'object',
      properties: {
        windowId: { type: 'number' }
      },
      required: ['windowId']
    }
  },
  {
    name: 'chrome.activate_tab',
    description: 'Activate a specific tab by id.',
    input_schema: {
      type: 'object',
      properties: {
        tabId: { type: 'number' }
      },
      required: ['tabId']
    }
  },
  {
    name: 'chrome.navigate',
    description: 'Navigate a tab to a URL.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        tabId: { type: 'number' }
      },
      required: ['url']
    }
  },
  {
    name: 'chrome.click',
    description: 'Click an element by selector or coordinates.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        tabId: { type: 'number' }
      }
    }
  },
  {
    name: 'chrome.double_click',
    description: 'Double click an element by selector or coordinates.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        tabId: { type: 'number' }
      }
    }
  },
  {
    name: 'chrome.right_click',
    description: 'Right click an element by selector or coordinates.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        tabId: { type: 'number' }
      }
    }
  },
  {
    name: 'chrome.hover',
    description: 'Hover over an element by selector or coordinates.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        tabId: { type: 'number' }
      }
    }
  },
  {
    name: 'chrome.focus',
    description: 'Focus an element by selector or coordinates.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        tabId: { type: 'number' }
      }
    }
  },
  {
    name: 'chrome.blur',
    description: 'Blur an element by selector or coordinates.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        tabId: { type: 'number' }
      }
    }
  },
  {
    name: 'chrome.click_dom',
    description: 'Click an element by DOM selector or coordinates (DOM-first).',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        tabId: { type: 'number' }
      }
    }
  },
  {
    name: 'chrome.key',
    description: 'Send a key press to the active element.',
    input_schema: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        code: { type: 'string' },
        ctrlKey: { type: 'boolean' },
        altKey: { type: 'boolean' },
        shiftKey: { type: 'boolean' },
        metaKey: { type: 'boolean' },
        repeat: { type: 'boolean' }
      },
      required: ['key']
    }
  },
  {
    name: 'chrome.type',
    description: 'Type text into a selector or active element.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        text: { type: 'string' },
        clear: { type: 'boolean' },
        delayMs: { type: 'number' },
        tabId: { type: 'number' }
      },
      required: ['text']
    }
  },
  {
    name: 'chrome.drag',
    description: 'Drag from a selector/point to a target selector/point.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        targetSelector: { type: 'string' },
        toX: { type: 'number' },
        toY: { type: 'number' },
        tabId: { type: 'number' }
      }
    }
  },
  {
    name: 'chrome.select',
    description: 'Select an option in a <select> element.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        value: { type: 'string' },
        label: { type: 'string' },
        tabId: { type: 'number' }
      },
      required: ['selector']
    }
  },
  {
    name: 'chrome.scroll',
    description: 'Scroll the page by x/y offsets.',
    input_schema: {
      type: 'object',
      properties: {
        x: { type: 'number' },
        y: { type: 'number' },
        behavior: { type: 'string', enum: ['auto', 'smooth'] },
        tabId: { type: 'number' }
      }
    }
  },
  {
    name: 'chrome.input',
    description: 'Input text into a selector.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        text: { type: 'string' },
        clear: { type: 'boolean' },
        tabId: { type: 'number' }
      },
      required: ['selector', 'text']
    }
  },
  {
    name: 'chrome.touch',
    description: 'Dispatch a touch event to a selector or coordinates.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        tabId: { type: 'number' }
      }
    }
  },
  {
    name: 'chrome.screenshot',
    description: 'Capture a screenshot of the active tab.',
    input_schema: {
      type: 'object',
      properties: {
        format: { type: 'string', enum: ['png', 'jpeg'] },
        tabId: { type: 'number' }
      }
    }
  },
  {
    name: 'chrome.wait',
    description: 'Wait for a number of milliseconds.',
    input_schema: {
      type: 'object',
      properties: {
        ms: { type: 'number' }
      },
      required: ['ms']
    }
  },
  {
    name: 'chrome.dom_tree',
    description: 'Get the DOM tree for the whole page or a selector subtree.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        options: {
          type: 'object',
          properties: {
            maxDepth: { type: 'number' },
            maxChildren: { type: 'number' },
            includeText: { type: 'boolean' },
            textLimit: { type: 'number' }
          }
        },
        tabId: { type: 'number' }
      }
    }
  },
  {
    name: 'chrome.dom_at_point',
    description: 'Get the DOM tree for the topmost element at coordinates.',
    input_schema: {
      type: 'object',
      properties: {
        x: { type: 'number' },
        y: { type: 'number' },
        options: {
          type: 'object',
          properties: {
            maxDepth: { type: 'number' },
            maxChildren: { type: 'number' },
            includeText: { type: 'boolean' },
            textLimit: { type: 'number' }
          }
        },
        tabId: { type: 'number' }
      },
      required: ['x', 'y']
    }
  },
  {
    name: 'discourse.like_post',
    description: 'Like a Discourse post.',
    input_schema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', default: 'https://linux.do' },
        postId: { type: 'number' },
        reactionId: { type: 'string', default: 'heart' }
      },
      required: ['postId']
    }
  },
  {
    name: 'discourse.get_topic_list',
    description: 'Get Discourse topic list.',
    input_schema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', default: 'https://linux.do' },
        strategy: { type: 'string', enum: ['latest', 'new', 'unread', 'top'] },
        page: { type: 'number' }
      }
    }
  },
  {
    name: 'discourse.get_topic',
    description: 'Get Discourse topic detail.',
    input_schema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', default: 'https://linux.do' },
        topicId: { type: 'number' }
      },
      required: ['topicId']
    }
  },
  {
    name: 'discourse.get_post',
    description: 'Get Discourse post detail.',
    input_schema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', default: 'https://linux.do' },
        postId: { type: 'number' },
        includeRaw: { type: 'boolean' }
      },
      required: ['postId']
    }
  },
  {
    name: 'discourse.get_topic_posts',
    description: 'Get posts by post numbers in a topic.',
    input_schema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', default: 'https://linux.do' },
        topicId: { type: 'number' },
        postNumbers: { type: 'array', items: { type: 'number' } },
        includeRaw: { type: 'boolean' }
      },
      required: ['topicId', 'postNumbers']
    }
  },
  {
    name: 'discourse.get_category_list',
    description: 'Get Discourse categories.',
    input_schema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', default: 'https://linux.do' }
      }
    }
  },
  {
    name: 'discourse.get_tag_list',
    description: 'Get Discourse tags.',
    input_schema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', default: 'https://linux.do' }
      }
    }
  },
  {
    name: 'discourse.search_user',
    description: 'Search users.',
    input_schema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', default: 'https://linux.do' },
        term: { type: 'string' }
      },
      required: ['term']
    }
  },
  {
    name: 'discourse.get_notifications',
    description: 'Get notifications.',
    input_schema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', default: 'https://linux.do' },
        page: { type: 'number' }
      }
    }
  },
  {
    name: 'discourse.get_bookmarks',
    description: 'Get bookmarks.',
    input_schema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', default: 'https://linux.do' },
        page: { type: 'number' }
      }
    }
  },
  {
    name: 'discourse.get_post_context',
    description: 'Get post context near a specific post.',
    input_schema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', default: 'https://linux.do' },
        postId: { type: 'number' },
        topicId: { type: 'number' },
        postNumber: { type: 'number' },
        includeRaw: { type: 'boolean' }
      },
      required: ['postId']
    }
  },
  {
    name: 'discourse.send_timings',
    description: 'Send read timings.',
    input_schema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', default: 'https://linux.do' },
        topicId: { type: 'number' },
        timeMs: { type: 'number' },
        postNumbers: { type: 'array', items: { type: 'number' } }
      },
      required: ['topicId']
    }
  },
  {
    name: 'discourse.create_post',
    description: 'Create a reply post.',
    input_schema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', default: 'https://linux.do' },
        topicId: { type: 'number' },
        raw: { type: 'string' },
        replyToPostNumber: { type: 'number' }
      },
      required: ['topicId', 'raw']
    }
  },
  {
    name: 'discourse.like_topic',
    description: 'Like a topic (like first post).',
    input_schema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', default: 'https://linux.do' },
        topicId: { type: 'number' },
        reactionId: { type: 'string', default: 'heart' }
      },
      required: ['topicId']
    }
  },
  {
    name: 'discourse.unlike_post',
    description: 'Unlike a post.',
    input_schema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', default: 'https://linux.do' },
        postId: { type: 'number' },
        reactionId: { type: 'string', default: 'heart' }
      },
      required: ['postId']
    }
  },
  {
    name: 'discourse.bookmark_post',
    description: 'Bookmark a post.',
    input_schema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', default: 'https://linux.do' },
        postId: { type: 'number' },
        name: { type: 'string' }
      },
      required: ['postId']
    }
  },
  {
    name: 'discourse.unbookmark_post',
    description: 'Remove a post bookmark.',
    input_schema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', default: 'https://linux.do' },
        postId: { type: 'number' }
      },
      required: ['postId']
    }
  },
  {
    name: 'discourse.browse_topic',
    description: 'Browse a topic with optional like.',
    input_schema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', default: 'https://linux.do' },
        topicId: { type: 'number' },
        readTimeMs: { type: 'number' },
        like: { type: 'boolean' }
      },
      required: ['topicId']
    }
  },
  {
    name: 'discourse.search',
    description: 'Search Discourse content.',
    input_schema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', default: 'https://linux.do' },
        q: { type: 'string' },
        page: { type: 'number' },
        type: { type: 'string' }
      },
      required: ['q']
    }
  }
]

const pendingToolCalls = new Map()
let serverStarted = false
let serverPort = DEFAULT_PORT

function sendNativeMessage(message) {
  const json = JSON.stringify(message)
  const length = Buffer.byteLength(json)
  const header = Buffer.alloc(4)
  header.writeUInt32LE(length, 0)
  process.stdout.write(header)
  process.stdout.write(json)
}

let incomingBuffer = Buffer.alloc(0)

function handleNativeMessage(message) {
  if (!message || typeof message !== 'object') return

  if (message.type === 'MCP_TOOL_RESULT') {
    const pending = pendingToolCalls.get(message.id)
    if (!pending) return
    pendingToolCalls.delete(message.id)
    if (message.error) {
      pending.reject(new Error(message.error))
    } else {
      pending.resolve(message.result)
    }
    return
  }

  if (message.type === 'MCP_CONFIG') {
    if (typeof message.port === 'number' && !Number.isNaN(message.port)) {
      serverPort = message.port
    }
    if (!serverStarted) {
      startHttpServer()
    }
    return
  }
}

function readNativeMessages() {
  const chunk = process.stdin.read()
  if (!chunk) return
  incomingBuffer = Buffer.concat([incomingBuffer, chunk])

  while (incomingBuffer.length >= 4) {
    const messageLength = incomingBuffer.readUInt32LE(0)
    if (incomingBuffer.length < 4 + messageLength) break
    const messageBuffer = incomingBuffer.slice(4, 4 + messageLength)
    incomingBuffer = incomingBuffer.slice(4 + messageLength)
    try {
      const message = JSON.parse(messageBuffer.toString('utf8'))
      handleNativeMessage(message)
    } catch {
      // ignore malformed messages
    }
  }
}

process.stdin.on('readable', readNativeMessages)
process.stdin.on('end', () => process.exit(0))

function callExtensionTool(name, args) {
  if (name === 'chrome.wait') {
    const ms = Number(args?.ms || 0)
    return delay(ms).then(() => ({ success: true, waitedMs: ms }))
  }

  const id = `tool_${Date.now()}_${Math.random().toString(16).slice(2)}`
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingToolCalls.delete(id)
      reject(new Error('Tool call timed out'))
    }, TOOL_TIMEOUT_MS)
    pendingToolCalls.set(id, {
      resolve: result => {
        clearTimeout(timeout)
        resolve(result)
      },
      reject: error => {
        clearTimeout(timeout)
        reject(error)
      }
    })
    sendNativeMessage({ type: 'MCP_TOOL_CALL', id, tool: name, args })
  })
}

function jsonRpcResponse(id, result, error) {
  if (error) {
    return { jsonrpc: '2.0', id, error }
  }
  return { jsonrpc: '2.0', id, result }
}

function toToolResult(payload) {
  return {
    content: [
      {
        type: 'text',
        text: typeof payload === 'string' ? payload : JSON.stringify(payload)
      }
    ]
  }
}

async function handleRpcRequest(rpc) {
  if (!rpc || typeof rpc !== 'object') {
    return jsonRpcResponse(null, null, { code: -32600, message: 'Invalid Request' })
  }

  const { id, method, params } = rpc

  if (!method) {
    return jsonRpcResponse(id ?? null, null, { code: -32600, message: 'Invalid Request' })
  }

  if (method === 'initialize') {
    return jsonRpcResponse(id ?? null, {
      serverInfo: { name: 'bug-v3-chrome-mcp', version: '0.1.0' },
      capabilities: { tools: {} }
    })
  }

  if (method === 'tools/list') {
    return jsonRpcResponse(id ?? null, { tools: TOOLS })
  }

  if (method === 'ping') {
    return jsonRpcResponse(id ?? null, { pong: true })
  }

  if (method === 'resources/list') {
    return jsonRpcResponse(id ?? null, { resources: [] })
  }

  if (method === 'prompts/list') {
    return jsonRpcResponse(id ?? null, { prompts: [] })
  }

  if (method === 'tools/call') {
    const toolName = params?.name
    if (!toolName) {
      return jsonRpcResponse(id ?? null, null, { code: -32602, message: 'Missing tool name' })
    }
    try {
      const result = await callExtensionTool(toolName, params?.arguments || {})
      return jsonRpcResponse(id ?? null, toToolResult(result))
    } catch (error) {
      return jsonRpcResponse(id ?? null, toToolResult(error?.message || 'Tool call failed'), {
        code: -32000,
        message: error?.message || 'Tool call failed'
      })
    }
  }

  return jsonRpcResponse(id ?? null, null, { code: -32601, message: 'Method not found' })
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.setEncoding('utf8')
    req.on('data', chunk => {
      raw += chunk
    })
    req.on('end', () => resolve(raw))
    req.on('error', reject)
  })
}

function writeJson(res, statusCode, payload) {
  const data = JSON.stringify(payload)
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  })
  res.end(data)
}

function writeSse(res, payloads) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  })
  for (const payload of payloads) {
    res.write(`event: message\n`)
    res.write(`data: ${JSON.stringify(payload)}\n\n`)
  }
  res.end()
}

function startHttpServer() {
  const server = http.createServer(async (req, res) => {
    if (!req.url) {
      res.writeHead(404)
      res.end()
      return
    }

    if (req.method === 'GET' && req.url === '/health') {
      writeJson(res, 200, { ok: true })
      return
    }

    if (req.method !== 'POST' || req.url !== '/mcp') {
      res.writeHead(404)
      res.end()
      return
    }

    const rawBody = await collectBody(req)
    let payload
    try {
      payload = JSON.parse(rawBody)
    } catch {
      writeJson(res, 400, jsonRpcResponse(null, null, { code: -32700, message: 'Parse error' }))
      return
    }

    const isBatch = Array.isArray(payload)
    const requests = isBatch ? payload : [payload]
    const responses = await Promise.all(requests.map(handleRpcRequest))

    const accept = req.headers.accept || ''
    if (accept.includes('text/event-stream')) {
      writeSse(res, responses)
      return
    }

    writeJson(res, 200, isBatch ? responses : responses[0])
  })

  server.listen(serverPort, '127.0.0.1', () => {
    serverStarted = true
    sendNativeMessage({ type: 'MCP_SERVER_STARTED', port: serverPort })
  })
}

if (!serverStarted) {
  startHttpServer()
}

sendNativeMessage({ type: 'MCP_HOST_READY', port: serverPort })
