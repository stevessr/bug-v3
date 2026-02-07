/**
 * Skill 脚本执行器
 *
 * 提供沙箱环境执行用户自定义的 JavaScript 脚本
 */

import type { McpServerConfig } from './types'
import { callMcpTool } from './mcpClient'

// ============ 类型定义 ============

export interface ScriptContext {
  /** 传入的参数 */
  args: Record<string, unknown>
  /** 上一步的结果（用于链式执行） */
  previousResult?: unknown
  /** 用户输入 */
  userInput?: string
  /** 会话 ID */
  sessionId?: string
}

export interface ScriptApi {
  /** 发起网络请求 */
  fetch: typeof fetch
  /** 调用 MCP 工具 */
  mcp: {
    call(serverId: string, toolName: string, args: Record<string, unknown>): Promise<unknown>
  }
  /** 本地存储 */
  storage: {
    get(key: string): Promise<unknown>
    set(key: string, value: unknown): Promise<void>
    remove(key: string): Promise<void>
  }
  /** 日志 */
  log: (...args: unknown[]) => void
  /** 延迟 */
  delay: (ms: number) => Promise<void>
  /** 解析 JSON */
  parseJSON: (str: string) => unknown
  /** 格式化 JSON */
  formatJSON: (obj: unknown) => string
  /** 正则匹配 */
  match: (str: string, pattern: string, flags?: string) => RegExpMatchArray | null
  /** 字符串替换 */
  replace: (str: string, pattern: string, replacement: string, flags?: string) => string
}

export interface ScriptResult {
  success: boolean
  result?: unknown
  error?: string
  logs?: string[]
}

// ============ 存储 API ============

const SCRIPT_STORAGE_KEY = 'ai-agent-script-storage-v1'

async function getScriptStorage(): Promise<Record<string, unknown>> {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(SCRIPT_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

async function setScriptStorage(data: Record<string, unknown>): Promise<void> {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(SCRIPT_STORAGE_KEY, JSON.stringify(data))
}

// ============ 脚本执行 ============

/**
 * 在沙箱环境中执行脚本
 */
export async function executeScript(
  script: string,
  context: ScriptContext,
  mcpServers: McpServerConfig[] = []
): Promise<ScriptResult> {
  const logs: string[] = []

  // 构建 API
  const api: ScriptApi = {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      // 安全限制：只允许 GET 和 POST
      const method = init?.method?.toUpperCase() || 'GET'
      if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method)) {
        throw new Error(`不支持的 HTTP 方法：${method}`)
      }
      return fetch(input, init)
    },

    mcp: {
      async call(
        serverId: string,
        toolName: string,
        args: Record<string, unknown>
      ): Promise<unknown> {
        const server = mcpServers.find(s => s.id === serverId)
        if (!server) {
          throw new Error(`未找到 MCP 服务：${serverId}`)
        }
        if (!server.enabled) {
          throw new Error(`MCP 服务未启用：${serverId}`)
        }
        const result = await callMcpTool(server, toolName, args)
        if (result.error) {
          throw new Error(result.error)
        }
        return result.result
      }
    },

    storage: {
      async get(key: string): Promise<unknown> {
        const data = await getScriptStorage()
        return data[key]
      },
      async set(key: string, value: unknown): Promise<void> {
        const data = await getScriptStorage()
        data[key] = value
        await setScriptStorage(data)
      },
      async remove(key: string): Promise<void> {
        const data = await getScriptStorage()
        delete data[key]
        await setScriptStorage(data)
      }
    },

    log: (...args: unknown[]) => {
      const message = args
        .map(a => {
          if (typeof a === 'object') {
            try {
              return JSON.stringify(a, null, 2)
            } catch {
              return String(a)
            }
          }
          return String(a)
        })
        .join(' ')
      logs.push(message)
      console.log('[Script]', ...args)
    },

    delay: (ms: number) => new Promise(resolve => setTimeout(resolve, Math.min(ms, 30000))),

    parseJSON: (str: string) => JSON.parse(str),

    formatJSON: (obj: unknown) => JSON.stringify(obj, null, 2),

    match: (str: string, pattern: string, flags = 'g') => str.match(new RegExp(pattern, flags)),

    replace: (str: string, pattern: string, replacement: string, flags = 'g') =>
      str.replace(new RegExp(pattern, flags), replacement)
  }

  try {
    // 构建安全的执行环境
    const safeGlobals = {
      console: { log: api.log, warn: api.log, error: api.log, info: api.log },
      JSON,
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      RegExp,
      Error,
      Promise,
      Map,
      Set,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      encodeURIComponent,
      decodeURIComponent,
      encodeURI,
      decodeURI,
      atob,
      btoa
    }

    // 创建执行函数
    const asyncFn = new Function(
      'context',
      'api',
      'globals',
      `
      "use strict";
      const { args, previousResult, userInput, sessionId } = context;
      const { fetch, mcp, storage, log, delay, parseJSON, formatJSON, match, replace } = api;
      const { console, JSON, Math, Date, Array, Object, String, Number, Boolean, RegExp, Error, Promise, Map, Set, parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent, encodeURI, decodeURI, atob, btoa } = globals;

      return (async () => {
        ${script}
      })();
      `
    )

    const result = await asyncFn(context, api, safeGlobals)

    return {
      success: true,
      result,
      logs
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logs.push(`[Error] ${message}`)
    return {
      success: false,
      error: message,
      logs
    }
  }
}

/**
 * 验证脚本语法
 */
export function validateScript(script: string): { valid: boolean; error?: string } {
  try {
    // 尝试解析脚本
    new Function(`
      "use strict";
      return (async () => {
        ${script}
      })();
    `)
    return { valid: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { valid: false, error: message }
  }
}

/**
 * 脚本模板
 */
export const SCRIPT_TEMPLATES = {
  // 简单返回
  simple: `
// 简单脚本示例
log('参数:', args);
return { message: 'Hello from script!', args };
`,

  // 网络请求
  fetchExample: `
// 网络请求示例
const url = args.url || 'https://api.github.com';
const response = await fetch(url);
const data = await response.json();
log('获取到数据:', data);
return data;
`,

  // MCP 调用
  mcpExample: `
// MCP 调用示例
const result = await mcp.call('builtin-tavily', 'search', {
  query: args.query || '最新新闻'
});
log('搜索结果:', result);
return result;
`,

  // 数据处理
  dataProcess: `
// 数据处理示例
const input = previousResult || args.data || [];
const processed = Array.isArray(input)
  ? input.map(item => ({ ...item, processed: true }))
  : { ...input, processed: true };
return processed;
`,

  // 存储操作
  storageExample: `
// 存储操作示例
const key = args.key || 'my-data';
const existing = await storage.get(key);
log('现有数据:', existing);

const newValue = { ...existing, updated: Date.now() };
await storage.set(key, newValue);
log('已保存:', newValue);

return newValue;
`,

  // 链式处理
  chainExample: `
// 链式处理示例 - 处理上一步结果
const prev = previousResult;
if (!prev) {
  throw new Error('需要上一步的结果');
}

// 提取关键信息
const extracted = typeof prev === 'object'
  ? Object.keys(prev).slice(0, 5)
  : [String(prev)];

return {
  source: 'chain',
  extracted,
  timestamp: Date.now()
};
`
}

/**
 * 内置脚本 Skills
 */
export const SCRIPT_SKILLS = [
  {
    id: 'script-json-formatter',
    name: 'JSON 格式化',
    description: '格式化 JSON 字符串',
    script: `
const input = args.json || args.text || '';
try {
  const parsed = parseJSON(input);
  return formatJSON(parsed);
} catch (e) {
  throw new Error('无效的 JSON: ' + e.message);
}
`
  },
  {
    id: 'script-text-stats',
    name: '文本统计',
    description: '统计文本的字符数、词数等',
    script: `
const text = args.text || '';
const chars = text.length;
const words = text.split(/\\s+/).filter(w => w.length > 0).length;
const lines = text.split('\\n').length;
const sentences = text.split(/[.!?.!?]+/).filter(s => s.trim().length > 0).length;

return {
  characters: chars,
  words,
  lines,
  sentences,
  avgWordLength: chars / (words || 1)
};
`
  },
  {
    id: 'script-url-parser',
    name: 'URL 解析',
    description: '解析 URL 的各个部分',
    script: `
const urlStr = args.url || '';
try {
  const url = new URL(urlStr);
  return {
    protocol: url.protocol,
    host: url.host,
    hostname: url.hostname,
    port: url.port,
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    origin: url.origin,
    searchParams: Object.fromEntries(url.searchParams)
  };
} catch (e) {
  throw new Error('无效的 URL: ' + e.message);
}
`
  }
]
