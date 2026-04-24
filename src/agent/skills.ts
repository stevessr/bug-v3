/**
 * Agent Skills 系统
 *
 * 基于 MCP 工具自动生成 skills，支持内置和自定义 skills
 */

import { nanoid } from 'nanoid'

import type { McpServerConfig } from './types'
import { discoverMcpTools, callMcpTool, type McpTool } from './mcpClient'
import { executeScript, type ScriptContext } from './scriptRunner'

// ============ 类型定义 ============

export interface Skill {
  id: string
  name: string
  description: string
  category: SkillCategory
  source: SkillSource
  enabled: boolean
  // MCP 来源信息
  mcpServerId?: string
  mcpToolName?: string
  // 执行配置
  inputSchema?: {
    type: string
    properties?: Record<string, unknown>
    required?: string[]
  }
  // 快捷键
  shortcut?: string
  // 图标
  icon?: string
  // 触发器模式 (正则表达式)
  triggers?: string[]
  // 优先级 (用于排序和冲突解决)
  priority?: number
  // 标签
  tags?: string[]
  // 别名 (用于匹配)
  aliases?: string[]
  // 参数预设
  presets?: SkillPreset[]
  // 后续 skill (链式执行)
  chainTo?: string[]
  // 使用统计
  stats?: SkillStats
}

export interface SkillPreset {
  id: string
  name: string
  description?: string
  args: Record<string, unknown>
}

export interface SkillStats {
  totalCalls: number
  successCalls: number
  failedCalls: number
  avgDuration: number
  lastUsed?: number
}

export interface SkillChain {
  id: string
  name: string
  description: string
  steps: SkillChainStep[]
  enabled: boolean
}

export interface SkillChainStep {
  skillId: string
  // 参数映射：从上一步结果映射到当前参数
  argMapping?: Record<string, string>
  // 静态参数
  staticArgs?: Record<string, unknown>
  // 条件执行
  condition?: {
    field: string
    operator: 'eq' | 'neq' | 'contains' | 'exists'
    value?: unknown
  }
}

export interface SkillExecutionContext {
  // 前一步结果
  previousResult?: unknown
  // 链式执行状态
  chainState?: Record<string, unknown>
  // 用户输入
  userInput?: string
  // 会话 ID
  sessionId?: string
}

export interface CustomSkill extends Skill {
  // 自定义脚本（可选）
  script?: string
  // 模板提示词
  promptTemplate?: string
  // 外部导入来源（可选）
  importSource?: 'skills.sh'
  // 来源页面
  sourceUrl?: string
  // 对应仓库
  repositoryUrl?: string
  // skills.sh 的 skill 标识
  skillSlug?: string
  // 创建时间
  createdAt: number
  // 更新时间
  updatedAt: number
}

export type SkillCategory =
  | 'search' // 搜索类
  | 'knowledge' // 知识类
  | 'code' // 代码类
  | 'web' // 网页操作类
  | 'data' // 数据处理类
  | 'automation' // 自动化类
  | 'other' // 其他

export type SkillSource =
  | 'builtin' // 内置
  | 'mcp' // MCP 工具
  | 'custom' // 自定义

export interface SkillExecutionResult {
  success: boolean
  result?: unknown
  error?: string
  duration?: number
  // 链式执行结果
  chainResults?: SkillExecutionResult[]
  // 建议的后续 skill
  suggestedNextSkills?: string[]
}

export interface SkillsShImportResult {
  skill: CustomSkill
  action: 'created' | 'updated'
}

export interface BuiltinMcpServer {
  id: string
  name: string
  url: string
  transport: 'sse' | 'streamable-http'
  headers?: Record<string, string>
  description: string
  category: SkillCategory
  requiresApiKey?: string // 需要的 API Key 名称
  enabled: boolean
}

// ============ 存储 ============

const SKILLS_ENABLED_KEY = 'ai-agent-skills-enabled-v1'
const BUILTIN_MCP_ENABLED_KEY = 'ai-agent-builtin-mcp-enabled-v1'
const API_KEYS_KEY = 'ai-agent-api-keys-v1'
const CUSTOM_SKILLS_KEY = 'ai-agent-custom-skills-v1'
const SKILL_CHAINS_KEY = 'ai-agent-skill-chains-v1'
const SKILL_STATS_KEY = 'ai-agent-skill-stats-v1'
const SKILL_PRESETS_KEY = 'ai-agent-skill-presets-v1'

// ============ 内置 MCP 服务 ============

export const BUILTIN_MCP_SERVERS: BuiltinMcpServer[] = [
  {
    id: 'builtin-deepwiki',
    name: 'DeepWiki',
    url: 'https://mcp.deepwiki.com/mcp',
    transport: 'streamable-http',
    description: 'AI 驱动的 GitHub 仓库文档服务，获取任何开源项目的文档和解答',
    category: 'knowledge',
    enabled: false
  },
  {
    id: 'builtin-context7',
    name: 'Context7',
    url: 'https://mcp.context7.com/mcp',
    transport: 'streamable-http',
    headers: {
      CONTEXT7_API_KEY: '$CONTEXT7_API_KEY'
    },
    description: '获取最新的库文档和代码示例，支持任何编程库',
    category: 'code',
    requiresApiKey: 'CONTEXT7_API_KEY',
    enabled: false
  },
  {
    id: 'builtin-tavily',
    name: 'Tavily',
    url: 'https://mcp.tavily.com/mcp',
    transport: 'streamable-http',
    description: 'AI 优化的网络搜索 API，获取实时网络信息',
    category: 'search',
    requiresApiKey: 'TAVILY_API_KEY',
    enabled: false
  },
  {
    id: 'builtin-tavily-expert',
    name: 'Tavily Expert',
    url: 'https://tavily.api.tadata.com/mcp/tavily/$TAVILY_PATH',
    transport: 'sse',
    description: 'Tavily Expert 搜索服务，支持更强大的搜索和内容提取功能',
    category: 'search',
    requiresApiKey: 'TAVILY_PATH',
    enabled: false
  }
]

// ============ 内置 Skills ============

export const BUILTIN_SKILLS: Skill[] = [
  {
    id: 'skill-web-search',
    name: '网络搜索',
    description: '使用 Tavily 进行 AI 优化的网络搜索',
    category: 'search',
    source: 'builtin',
    mcpServerId: 'builtin-tavily',
    mcpToolName: 'search',
    enabled: true,
    icon: '🔍',
    priority: 100,
    triggers: [
      '搜索 (.+)',
      '查找 (.+)',
      '查询 (.+)',
      'search\\s+(.+)',
      '帮我搜 (.+)',
      '(.+) 是什么',
      '(.+) 怎么样'
    ],
    aliases: ['搜索', 'search', '查询', '查找', '网搜'],
    tags: ['search', 'web', 'tavily'],
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索查询' }
      },
      required: ['query']
    },
    presets: [
      { id: 'news', name: '最新新闻', args: { query: '最新新闻' } },
      { id: 'tech', name: '科技动态', args: { query: '科技新闻' } }
    ]
  },
  {
    id: 'skill-extract-content',
    name: '内容提取',
    description: '从 URL 提取清洁的文本内容',
    category: 'web',
    source: 'builtin',
    mcpServerId: 'builtin-tavily',
    mcpToolName: 'extract',
    enabled: true,
    icon: '📄',
    priority: 80,
    triggers: ['提取 (.+) 内容', '获取 (.+) 的内容', '读取 (.+)', 'extract\\s+(.+)', '抓取 (.+)'],
    aliases: ['提取', 'extract', '抓取', '获取内容'],
    tags: ['web', 'extract', 'content'],
    inputSchema: {
      type: 'object',
      properties: {
        urls: { type: 'array', items: { type: 'string' }, description: '要提取内容的 URL 列表' }
      },
      required: ['urls']
    }
  },
  {
    id: 'skill-github-docs',
    name: 'GitHub 文档',
    description: '获取 GitHub 仓库的 AI 生成文档',
    category: 'knowledge',
    source: 'builtin',
    mcpServerId: 'builtin-deepwiki',
    mcpToolName: 'read_wiki_contents',
    enabled: true,
    icon: '📚',
    priority: 90,
    triggers: ['(.+) 仓库文档', '(.+) 的文档', '(.+) 怎么用', '(.+) 项目介绍', 'github\\s+(.+)'],
    aliases: ['GitHub 文档', 'deepwiki', '仓库文档', '项目文档'],
    tags: ['github', 'docs', 'knowledge'],
    inputSchema: {
      type: 'object',
      properties: {
        repoName: { type: 'string', description: 'GitHub 仓库名称 (owner/repo)' }
      },
      required: ['repoName']
    },
    chainTo: ['skill-ask-repo']
  },
  {
    id: 'skill-ask-repo',
    name: '问答仓库',
    description: '向 GitHub 仓库提问，获取 AI 回答',
    category: 'knowledge',
    source: 'builtin',
    mcpServerId: 'builtin-deepwiki',
    mcpToolName: 'ask_question',
    enabled: true,
    icon: '❓',
    priority: 85,
    triggers: ['问 (.+) 仓库 (.+)', '(.+) 仓库 (.+) 怎么', '(.+) 项目 (.+) 如何'],
    aliases: ['问答', 'ask', '提问仓库'],
    tags: ['github', 'qa', 'knowledge'],
    inputSchema: {
      type: 'object',
      properties: {
        repoName: { type: 'string', description: 'GitHub 仓库名称' },
        question: { type: 'string', description: '要问的问题' }
      },
      required: ['repoName', 'question']
    }
  },
  {
    id: 'skill-library-docs',
    name: '库文档查询',
    description: '获取编程库的最新文档和代码示例',
    category: 'code',
    source: 'builtin',
    mcpServerId: 'builtin-context7',
    mcpToolName: 'get-library-docs',
    enabled: true,
    icon: '📖',
    priority: 95,
    triggers: ['(.+) 文档', '(.+) 怎么使用', '(.+) 用法', '(.+) 示例', '(.+) 教程'],
    aliases: ['库文档', 'docs', 'library docs', 'context7'],
    tags: ['code', 'docs', 'library'],
    inputSchema: {
      type: 'object',
      properties: {
        context7CompatibleLibraryID: { type: 'string', description: '库 ID (如 /mongodb/docs)' },
        topic: { type: 'string', description: '要查询的主题' }
      },
      required: ['context7CompatibleLibraryID']
    },
    chainTo: ['skill-resolve-library']
  },
  {
    id: 'skill-resolve-library',
    name: '查找库 ID',
    description: '将库名称解析为 Context7 兼容的库 ID',
    category: 'code',
    source: 'builtin',
    mcpServerId: 'builtin-context7',
    mcpToolName: 'resolve-library-id',
    enabled: true,
    icon: '🔗',
    priority: 70,
    triggers: ['查找 (.+) 库', '(.+) 库的 ID', 'resolve\\s+(.+)'],
    aliases: ['查找库', 'resolve', '库 ID'],
    tags: ['code', 'library', 'resolve'],
    inputSchema: {
      type: 'object',
      properties: {
        libraryName: { type: 'string', description: '库名称 (如 react, vue, express)' }
      },
      required: ['libraryName']
    },
    chainTo: ['skill-library-docs']
  },
  {
    id: 'skill-expert-search',
    name: '专家搜索',
    description: '使用 Tavily Expert 进行深度网络搜索，支持更精确的结果',
    category: 'search',
    source: 'builtin',
    mcpServerId: 'builtin-tavily-expert',
    mcpToolName: 'tavily_search',
    enabled: true,
    icon: '🔬',
    priority: 95,
    triggers: ['深度搜索 (.+)', '专家搜索 (.+)', '详细搜索 (.+)', 'expert search(.+)'],
    aliases: ['专家搜索', 'expert search', '深度搜索', '详细搜索'],
    tags: ['search', 'expert', 'tavily'],
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索查询' },
        search_depth: { type: 'string', description: '搜索深度：basic 或 advanced' },
        max_results: { type: 'number', description: '最大结果数量' }
      },
      required: ['query']
    },
    presets: [
      {
        id: 'deep-news',
        name: '深度新闻',
        args: { query: '最新新闻', search_depth: 'advanced', max_results: 10 }
      },
      {
        id: 'research',
        name: '学术研究',
        args: { query: '', search_depth: 'advanced', max_results: 20 }
      }
    ]
  },
  {
    id: 'skill-expert-extract',
    name: '专家内容提取',
    description: '使用 Tavily Expert 从多个 URL 提取和分析内容',
    category: 'web',
    source: 'builtin',
    mcpServerId: 'builtin-tavily-expert',
    mcpToolName: 'tavily_extract',
    enabled: true,
    icon: '📑',
    priority: 75,
    triggers: ['深度提取 (.+)', '专家提取 (.+)', '分析 (.+) 内容'],
    aliases: ['专家提取', 'expert extract', '深度提取'],
    tags: ['web', 'extract', 'expert', 'tavily'],
    inputSchema: {
      type: 'object',
      properties: {
        urls: { type: 'array', items: { type: 'string' }, description: '要提取内容的 URL 列表' }
      },
      required: ['urls']
    }
  },
  // ============ 新增内置 Skills ============
  {
    id: 'skill-github-issue',
    name: 'GitHub Issue',
    description: '获取 GitHub Issue 详情和讨论内容',
    category: 'knowledge',
    source: 'builtin',
    mcpServerId: 'builtin-deepwiki',
    mcpToolName: 'ask_question',
    enabled: true,
    icon: '🐛',
    priority: 88,
    triggers: ['github\\s+issue\\s+(.+)', '(.+) 的 issue', '(.+) 问题列表', 'issue\\s+(.+)'],
    aliases: ['GitHub Issue', 'issue', '问题', 'bug'],
    tags: ['github', 'issue', 'bug', 'knowledge'],
    inputSchema: {
      type: 'object',
      properties: {
        repoName: { type: 'string', description: 'GitHub 仓库名称 (owner/repo)' },
        question: {
          type: 'string',
          description: '关于 Issue 的问题，如：最近的 issues、open issues、某个具体问题'
        }
      },
      required: ['repoName', 'question']
    },
    presets: [
      {
        id: 'open-issues',
        name: '开放 Issues',
        args: { question: 'What are the recent open issues?' }
      },
      { id: 'bugs', name: 'Bug 列表', args: { question: 'What are the known bugs?' } }
    ]
  },
  {
    id: 'skill-github-discussion',
    name: 'GitHub Discussion',
    description: '获取 GitHub Discussion 讨论内容',
    category: 'knowledge',
    source: 'builtin',
    mcpServerId: 'builtin-deepwiki',
    mcpToolName: 'ask_question',
    enabled: true,
    icon: '💬',
    priority: 87,
    triggers: [
      'github\\s+discussion\\s+(.+)',
      '(.+) 的讨论',
      '(.+)discussion',
      'discussion\\s+(.+)'
    ],
    aliases: ['GitHub Discussion', 'discussion', '讨论'],
    tags: ['github', 'discussion', 'community', 'knowledge'],
    inputSchema: {
      type: 'object',
      properties: {
        repoName: { type: 'string', description: 'GitHub 仓库名称 (owner/repo)' },
        question: { type: 'string', description: '关于讨论的问题' }
      },
      required: ['repoName', 'question']
    },
    presets: [
      {
        id: 'recent-discussions',
        name: '最近讨论',
        args: { question: 'What are the recent discussions?' }
      },
      {
        id: 'popular-discussions',
        name: '热门讨论',
        args: { question: 'What are the most popular discussions?' }
      }
    ]
  },
  {
    id: 'skill-web-screenshot',
    name: '网页截图',
    description: '截取当前页面的屏幕截图',
    category: 'web',
    source: 'builtin',
    enabled: true,
    icon: '📸',
    priority: 70,
    triggers: ['截图', '截屏', 'screenshot', '屏幕截图', '网页截图'],
    aliases: ['截图', 'screenshot', '截屏'],
    tags: ['web', 'screenshot', 'capture'],
    inputSchema: {
      type: 'object',
      properties: {
        format: { type: 'string', description: '图片格式：png 或 jpeg' }
      }
    }
  },
  {
    id: 'skill-page-dom',
    name: '页面 DOM 分析',
    description: '获取当前页面的 DOM 结构和内容',
    category: 'web',
    source: 'builtin',
    enabled: true,
    icon: '🌳',
    priority: 65,
    triggers: ['获取 DOM', '页面结构', '分析页面', 'DOM 树', '页面内容'],
    aliases: ['DOM', '页面结构', '页面分析'],
    tags: ['web', 'dom', 'analysis'],
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS 选择器，限定分析范围' },
        includeMarkdown: { type: 'boolean', description: '是否包含 Markdown 格式内容' },
        maxDepth: { type: 'number', description: '最大深度' }
      }
    }
  },
  {
    id: 'skill-web-crawl',
    name: '网页抓取',
    description: '抓取指定网页的完整内容',
    category: 'web',
    source: 'builtin',
    mcpServerId: 'builtin-tavily-expert',
    mcpToolName: 'tavily_crawl',
    enabled: true,
    icon: '🕷️',
    priority: 72,
    triggers: ['抓取 (.+)', '爬取 (.+)', 'crawl\\s+(.+)', '网页抓取 (.+)'],
    aliases: ['抓取', 'crawl', '爬取', '网页抓取'],
    tags: ['web', 'crawl', 'scrape'],
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '要抓取的 URL' },
        max_depth: { type: 'number', description: '最大抓取深度' },
        max_pages: { type: 'number', description: '最大页面数量' }
      },
      required: ['url']
    }
  },
  {
    id: 'skill-code-explain',
    name: '代码解释',
    description: '解释选中的代码或页面上的代码片段',
    category: 'code',
    source: 'builtin',
    enabled: true,
    icon: '💡',
    priority: 60,
    triggers: ['解释 (.+) 代码', '(.+) 代码什么意思', '代码解释', 'explain\\s+code'],
    aliases: ['代码解释', 'explain code', '代码说明'],
    tags: ['code', 'explain', 'analysis'],
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: '要解释的代码' },
        language: { type: 'string', description: '编程语言' }
      }
    }
  },
  {
    id: 'skill-translate',
    name: '翻译',
    description: '翻译选中的文本或页面内容',
    category: 'other',
    source: 'builtin',
    enabled: true,
    icon: '🌐',
    priority: 75,
    triggers: ['翻译 (.+)', '(.+) 翻译成 (.+)', 'translate\\s+(.+)', '(.+) 的翻译'],
    aliases: ['翻译', 'translate', '转换'],
    tags: ['translate', 'language'],
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '要翻译的文本' },
        targetLanguage: { type: 'string', description: '目标语言' },
        sourceLanguage: { type: 'string', description: '源语言（可选）' }
      },
      required: ['text']
    },
    presets: [
      { id: 'to-chinese', name: '翻译成中文', args: { targetLanguage: 'zh-CN' } },
      { id: 'to-english', name: '翻译成英文', args: { targetLanguage: 'en' } }
    ]
  },
  {
    id: 'skill-summarize',
    name: '内容总结',
    description: '总结网页或文档内容的要点',
    category: 'other',
    source: 'builtin',
    enabled: true,
    icon: '📝',
    priority: 78,
    triggers: ['总结 (.+)', '概括 (.+)', '(.+) 的要点', 'summarize\\s+(.+)', '摘要 (.+)'],
    aliases: ['总结', 'summarize', '概括', '摘要'],
    tags: ['summarize', 'content'],
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: '要总结的内容' },
        maxLength: { type: 'number', description: '摘要最大长度' },
        format: { type: 'string', description: '输出格式：bullets, paragraph, outline' }
      }
    },
    presets: [
      { id: 'bullets', name: '要点列表', args: { format: 'bullets' } },
      { id: 'brief', name: '简短摘要', args: { format: 'paragraph', maxLength: 200 } }
    ]
  }
]

// ============ 存储操作 ============

function getStorage(): Storage | null {
  if (typeof localStorage !== 'undefined') return localStorage
  return null
}

function loadFromStorage<T>(key: string, defaultValue: T): T {
  const storage = getStorage()
  if (!storage) return defaultValue
  try {
    const raw = storage.getItem(key)
    if (!raw) return defaultValue
    return JSON.parse(raw) as T
  } catch {
    return defaultValue
  }
}

function saveToStorage<T>(key: string, data: T): void {
  const storage = getStorage()
  if (!storage) return
  storage.setItem(key, JSON.stringify(data))
}

// ============ API Keys 管理 ============

export function loadApiKeys(): Record<string, string> {
  return loadFromStorage<Record<string, string>>(API_KEYS_KEY, {})
}

export function saveApiKeys(keys: Record<string, string>): void {
  saveToStorage(API_KEYS_KEY, keys)
}

export function getApiKey(keyName: string): string | undefined {
  const keys = loadApiKeys()
  return keys[keyName]
}

export function setApiKey(keyName: string, value: string): void {
  const keys = loadApiKeys()
  keys[keyName] = value
  saveApiKeys(keys)
}

export function removeApiKey(keyName: string): void {
  const keys = loadApiKeys()
  delete keys[keyName]
  saveApiKeys(keys)
}

// ============ 内置 MCP 启用状态 ============

export function loadBuiltinMcpEnabled(): Record<string, boolean> {
  return loadFromStorage<Record<string, boolean>>(BUILTIN_MCP_ENABLED_KEY, {})
}

export function saveBuiltinMcpEnabled(enabled: Record<string, boolean>): void {
  saveToStorage(BUILTIN_MCP_ENABLED_KEY, enabled)
}

export function isBuiltinMcpEnabled(serverId: string): boolean {
  const enabled = loadBuiltinMcpEnabled()
  return enabled[serverId] ?? false
}

export function setBuiltinMcpEnabled(serverId: string, value: boolean): void {
  const enabled = loadBuiltinMcpEnabled()
  enabled[serverId] = value
  saveBuiltinMcpEnabled(enabled)
}

// ============ Skills 启用状态 ============

export function loadSkillsEnabled(): Record<string, boolean> {
  return loadFromStorage<Record<string, boolean>>(SKILLS_ENABLED_KEY, {})
}

export function saveSkillsEnabled(enabled: Record<string, boolean>): void {
  saveToStorage(SKILLS_ENABLED_KEY, enabled)
}

export function isSkillEnabled(skillId: string): boolean {
  const enabled = loadSkillsEnabled()
  // 默认启用
  return enabled[skillId] ?? true
}

export function setSkillEnabled(skillId: string, value: boolean): void {
  const enabled = loadSkillsEnabled()
  enabled[skillId] = value
  saveSkillsEnabled(enabled)
}

// ============ 获取内置 MCP 服务配置 ============

/**
 * 将内置 MCP 服务转换为 McpServerConfig
 */
export function builtinMcpToConfig(builtin: BuiltinMcpServer): McpServerConfig {
  const apiKeys = loadApiKeys()

  // 处理 URL 中的变量占位符 ($VARIABLE_NAME)
  let url = builtin.url
  if (builtin.requiresApiKey) {
    const apiKey = apiKeys[builtin.requiresApiKey] || ''
    // Tavily 原版特殊处理：API Key 在 URL 参数中
    if (builtin.id === 'builtin-tavily') {
      url = `https://mcp.tavily.com/mcp?tavilyApiKey=${encodeURIComponent(apiKey)}`
    } else {
      // 通用处理：替换 URL 中的 $VARIABLE 占位符
      url = url.replace(/\$([A-Z_][A-Z0-9_]*)/g, (_match, varName) => {
        return apiKeys[varName] || ''
      })
    }
  }

  // 处理 headers 中的 API Key 占位符
  const headers: Record<string, string> = {}
  if (builtin.headers) {
    for (const [key, value] of Object.entries(builtin.headers)) {
      if (value.startsWith('$')) {
        const keyName = value.slice(1)
        headers[key] = apiKeys[keyName] || ''
      } else {
        headers[key] = value
      }
    }
  }

  return {
    id: builtin.id,
    name: builtin.name,
    url,
    transport: builtin.transport,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    enabled: isBuiltinMcpEnabled(builtin.id)
  }
}

/**
 * 获取所有启用的内置 MCP 服务配置
 */
export function getEnabledBuiltinMcpConfigs(): McpServerConfig[] {
  return BUILTIN_MCP_SERVERS.filter(s => isBuiltinMcpEnabled(s.id)).map(builtinMcpToConfig)
}

/**
 * 检查内置 MCP 服务是否可用（API Key 已配置）
 */
export function isBuiltinMcpAvailable(serverId: string): boolean {
  const builtin = BUILTIN_MCP_SERVERS.find(s => s.id === serverId)
  if (!builtin) return false

  if (builtin.requiresApiKey) {
    const apiKey = getApiKey(builtin.requiresApiKey)
    return !!apiKey && apiKey.length > 0
  }

  return true
}

// ============ 从 MCP 工具生成 Skills ============

/**
 * 推断工具类别
 */
function inferSkillCategory(tool: McpTool, serverName: string): SkillCategory {
  const name = tool.name.toLowerCase()
  const desc = (tool.description || '').toLowerCase()
  const server = serverName.toLowerCase()

  // 搜索类
  if (
    name.includes('search') ||
    desc.includes('search') ||
    server.includes('tavily') ||
    server.includes('bing') ||
    server.includes('google')
  ) {
    return 'search'
  }

  // 知识类
  if (
    name.includes('wiki') ||
    name.includes('doc') ||
    name.includes('knowledge') ||
    desc.includes('documentation') ||
    server.includes('deepwiki') ||
    server.includes('context7')
  ) {
    return 'knowledge'
  }

  // 代码类
  if (
    name.includes('code') ||
    name.includes('library') ||
    name.includes('resolve') ||
    desc.includes('code') ||
    desc.includes('library')
  ) {
    return 'code'
  }

  // 网页操作类
  if (
    name.includes('browse') ||
    name.includes('extract') ||
    name.includes('crawl') ||
    name.includes('fetch') ||
    desc.includes('url') ||
    desc.includes('webpage')
  ) {
    return 'web'
  }

  // 数据处理类
  if (
    name.includes('data') ||
    name.includes('parse') ||
    name.includes('transform') ||
    desc.includes('data')
  ) {
    return 'data'
  }

  // 自动化类
  if (name.includes('automate') || name.includes('workflow') || desc.includes('automate')) {
    return 'automation'
  }

  return 'other'
}

/**
 * 从 MCP 工具生成 Skill
 */
export function mcpToolToSkill(serverId: string, serverName: string, tool: McpTool): Skill {
  const category = inferSkillCategory(tool, serverName)

  return {
    id: `skill-mcp-${serverId}-${tool.name}`,
    name: tool.name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    description: tool.description || `MCP 工具：${tool.name}`,
    category,
    source: 'mcp',
    mcpServerId: serverId,
    mcpToolName: tool.name,
    enabled: true,
    inputSchema: tool.inputSchema
  }
}

/**
 * 发现所有可用的 Skills（包括内置和 MCP 工具生成的）
 */
export async function discoverAllSkills(
  customMcpServers: McpServerConfig[] = []
): Promise<Skill[]> {
  const skills: Skill[] = []

  // 添加内置 skills
  for (const skill of BUILTIN_SKILLS) {
    // 检查对应的内置 MCP 是否启用
    if (skill.mcpServerId) {
      const isEnabled = isBuiltinMcpEnabled(skill.mcpServerId)
      const isAvailable = isBuiltinMcpAvailable(skill.mcpServerId)
      if (isEnabled && isAvailable) {
        skills.push({ ...skill, enabled: isSkillEnabled(skill.id) })
      }
    } else {
      skills.push({ ...skill, enabled: isSkillEnabled(skill.id) })
    }
  }

  // 从内置 MCP 服务发现工具
  const enabledBuiltinMcps = getEnabledBuiltinMcpConfigs()
  for (const mcpConfig of enabledBuiltinMcps) {
    if (!isBuiltinMcpAvailable(mcpConfig.id)) continue

    try {
      const tools = await discoverMcpTools(mcpConfig)
      for (const tool of tools) {
        // 跳过已有内置 skill 的工具
        const hasBuiltin = BUILTIN_SKILLS.some(
          s => s.mcpServerId === mcpConfig.id && s.mcpToolName === tool.name
        )
        if (hasBuiltin) continue

        const skill = mcpToolToSkill(mcpConfig.id, mcpConfig.name, tool)
        skill.enabled = isSkillEnabled(skill.id)
        skills.push(skill)
      }
    } catch (error) {
      console.warn(`[Skills] Failed to discover tools from ${mcpConfig.name}:`, error)
    }
  }

  // 从自定义 MCP 服务发现工具
  for (const mcpConfig of customMcpServers) {
    if (!mcpConfig.enabled) continue

    try {
      const tools = await discoverMcpTools(mcpConfig)
      for (const tool of tools) {
        const skill = mcpToolToSkill(mcpConfig.id, mcpConfig.name, tool)
        skill.enabled = isSkillEnabled(skill.id)
        skills.push(skill)
      }
    } catch (error) {
      console.warn(`[Skills] Failed to discover tools from ${mcpConfig.name}:`, error)
    }
  }

  return skills
}

// ============ 执行 Skill ============

/**
 * 执行 Skill
 */
export async function executeSkill(
  skill: Skill,
  args: Record<string, unknown>,
  customMcpServers: McpServerConfig[] = [],
  context?: ScriptContext
): Promise<SkillExecutionResult> {
  const startTime = Date.now()

  // 检查是否是自定义脚本 Skill
  const customSkill = skill as CustomSkill
  if (customSkill.script && customSkill.source === 'custom') {
    // 执行脚本
    const scriptContext: ScriptContext = {
      args,
      previousResult: context?.previousResult,
      userInput: context?.userInput,
      sessionId: context?.sessionId
    }

    // 合并所有 MCP 服务
    const allMcpServers = [...getEnabledBuiltinMcpConfigs(), ...customMcpServers]

    const scriptResult = await executeScript(customSkill.script, scriptContext, allMcpServers)
    const duration = Date.now() - startTime

    return {
      success: scriptResult.success,
      result: scriptResult.result,
      error: scriptResult.error,
      duration
    }
  }

  // 如果没有 MCP 配置，可能是纯本地 Skill
  if (!skill.mcpServerId || !skill.mcpToolName) {
    return {
      success: false,
      error: 'Skill 没有关联的 MCP 工具或脚本'
    }
  }

  // 查找 MCP 服务配置
  let mcpConfig: McpServerConfig | undefined

  // 先检查内置 MCP
  const builtinMcp = BUILTIN_MCP_SERVERS.find(s => s.id === skill.mcpServerId)
  if (builtinMcp) {
    if (!isBuiltinMcpEnabled(builtinMcp.id)) {
      return {
        success: false,
        error: `内置 MCP 服务 ${builtinMcp.name} 未启用`
      }
    }
    if (!isBuiltinMcpAvailable(builtinMcp.id)) {
      return {
        success: false,
        error: `内置 MCP 服务 ${builtinMcp.name} 需要配置 API Key`
      }
    }
    mcpConfig = builtinMcpToConfig(builtinMcp)
  } else {
    // 检查自定义 MCP
    mcpConfig = customMcpServers.find(s => s.id === skill.mcpServerId)
  }

  if (!mcpConfig) {
    return {
      success: false,
      error: `未找到 MCP 服务：${skill.mcpServerId}`
    }
  }

  try {
    const result = await callMcpTool(mcpConfig, skill.mcpToolName, args)
    const duration = Date.now() - startTime

    if (result.error) {
      return {
        success: false,
        error: result.error,
        duration
      }
    }

    return {
      success: true,
      result: result.result,
      duration
    }
  } catch (error: unknown) {
    const duration = Date.now() - startTime
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      error: message,
      duration
    }
  }
}

// ============ 快捷方式 ============

/**
 * 通过名称查找 Skill
 */
export function findSkillByName(name: string, skills: Skill[]): Skill | undefined {
  const nameLower = name.toLowerCase()
  return skills.find(
    s =>
      s.name.toLowerCase() === nameLower ||
      s.name.toLowerCase().includes(nameLower) ||
      s.mcpToolName?.toLowerCase() === nameLower
  )
}

/**
 * 通过类别筛选 Skills
 */
export function filterSkillsByCategory(category: SkillCategory, skills: Skill[]): Skill[] {
  return skills.filter(s => s.category === category)
}

/**
 * 获取启用的 Skills
 */
export function getEnabledSkills(skills: Skill[]): Skill[] {
  return skills.filter(s => s.enabled)
}

// ============ Skill Prompt 生成 ============

/**
 * 生成 Skills 说明提示词
 */
export function skillsToPrompt(skills: Skill[]): string {
  const enabledSkills = getEnabledSkills(skills)
  if (enabledSkills.length === 0) return ''

  const lines = ['## 可用 Skills']

  // 按类别分组
  const byCategory = new Map<SkillCategory, Skill[]>()
  for (const skill of enabledSkills) {
    const list = byCategory.get(skill.category) || []
    list.push(skill)
    byCategory.set(skill.category, list)
  }

  const categoryNames: Record<SkillCategory, string> = {
    search: '搜索',
    knowledge: '知识',
    code: '代码',
    web: '网页',
    data: '数据',
    automation: '自动化',
    other: '其他'
  }

  for (const [category, categorySkills] of byCategory) {
    lines.push(`\n### ${categoryNames[category]}`)
    for (const skill of categorySkills) {
      const icon = skill.icon ? `${skill.icon} ` : ''
      lines.push(`- ${icon}**${skill.name}**: ${skill.description}`)
    }
  }

  lines.push('\n使用 skill 时，通过 MCP 工具调用对应功能。')

  return lines.join('\n')
}

// ============ 自定义 Skills 管理 ============

/**
 * 加载自定义 Skills
 */
export function loadCustomSkills(): CustomSkill[] {
  return loadFromStorage<CustomSkill[]>(CUSTOM_SKILLS_KEY, [])
}

/**
 * 保存自定义 Skills
 */
export function saveCustomSkills(skills: CustomSkill[]): void {
  saveToStorage(CUSTOM_SKILLS_KEY, skills)
}

/**
 * 添加自定义 Skill
 */
export function addCustomSkill(
  skill: Omit<CustomSkill, 'id' | 'createdAt' | 'updatedAt'>
): CustomSkill {
  const skills = loadCustomSkills()
  const now = Date.now()
  const newSkill: CustomSkill = {
    ...skill,
    id: `skill-custom-${nanoid()}`,
    source: 'custom',
    createdAt: now,
    updatedAt: now
  }
  skills.push(newSkill)
  saveCustomSkills(skills)
  return newSkill
}

/**
 * 更新自定义 Skill
 */
export function updateCustomSkill(
  skillId: string,
  updates: Partial<CustomSkill>
): CustomSkill | null {
  const skills = loadCustomSkills()
  const index = skills.findIndex(s => s.id === skillId)
  if (index === -1) return null

  skills[index] = {
    ...skills[index],
    ...updates,
    updatedAt: Date.now()
  }
  saveCustomSkills(skills)
  return skills[index]
}

/**
 * 删除自定义 Skill
 */
export function removeCustomSkill(skillId: string): boolean {
  const skills = loadCustomSkills()
  const filtered = skills.filter(s => s.id !== skillId)
  if (filtered.length === skills.length) return false
  saveCustomSkills(filtered)
  return true
}

interface SkillsShReference {
  owner: string
  repo: string
  skillSlug: string
  canonicalUrl: string
}

interface SkillFrontmatter {
  name?: string
  description?: string
}

interface GitHubRepoResponse {
  default_branch?: string
  message?: string
}

interface GitHubTreeResponse {
  tree?: Array<{ path?: string; type?: string }>
  message?: string
}

const SKILLS_SH_HOSTS = new Set(['skills.sh', 'www.skills.sh'])
const GITHUB_API_HEADERS = {
  Accept: 'application/vnd.github+json'
}

function normalizeSkillToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
}

function trimQuotedString(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1).trim()
  }
  return value
}

function parseSkillsShReference(input: string): SkillsShReference {
  const raw = input.trim()
  if (!raw) {
    throw new Error('请输入 skills.sh 链接')
  }

  let owner = ''
  let repo = ''
  let skillSlug = ''

  const shorthandMatch = raw.match(
    /^([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)(?:\/|@)([A-Za-z0-9._-]+)$/
  )
  if (shorthandMatch) {
    owner = shorthandMatch[1]
    repo = shorthandMatch[2]
    skillSlug = shorthandMatch[3]
  } else {
    let url: URL
    try {
      url = new URL(raw)
    } catch {
      throw new Error('请输入合法的 skills.sh 链接，例如 https://skills.sh/owner/repo/skill')
    }

    if (!SKILLS_SH_HOSTS.has(url.hostname.toLowerCase())) {
      throw new Error('仅支持 skills.sh 链接')
    }

    const segments = url.pathname.split('/').filter(Boolean)
    if (segments.length < 3) {
      throw new Error('skills.sh 链接格式应为 /owner/repo/skill')
    }

    owner = decodeURIComponent(segments[0] || '')
    repo = decodeURIComponent(segments[1] || '')
    skillSlug = decodeURIComponent(segments[2] || '')
  }

  if (!owner || !repo || !skillSlug) {
    throw new Error('无法解析 skills.sh 链接，请检查 owner/repo/skill 是否完整')
  }

  return {
    owner,
    repo,
    skillSlug,
    canonicalUrl: `https://skills.sh/${owner}/${repo}/${skillSlug}`
  }
}

function parseSkillFrontmatter(markdown: string): SkillFrontmatter {
  const result: SkillFrontmatter = {}
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!match) return result

  const lines = match[1].split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separatorIndex = trimmed.indexOf(':')
    if (separatorIndex <= 0) continue

    const key = trimmed.slice(0, separatorIndex).trim().toLowerCase()
    const value = trimQuotedString(trimmed.slice(separatorIndex + 1).trim())

    if (key === 'name' && value) {
      result.name = value
    } else if (key === 'description' && value) {
      result.description = value
    }
  }

  return result
}

function extractMarkdownHeading(markdown: string): string | undefined {
  const withoutFrontmatter = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '')
  const headingMatch = withoutFrontmatter.match(/^\s*#\s+(.+?)\s*$/m)
  return headingMatch?.[1]?.trim()
}

function rankSkillPath(path: string, skillSlug: string): number {
  const normalizedPath = path.toLowerCase()
  const normalizedSlug = skillSlug.toLowerCase()

  if (normalizedPath === `${normalizedSlug}/skill.md`) return 1000
  if (normalizedPath.endsWith(`/${normalizedSlug}/skill.md`)) return 950
  if (normalizedPath.includes(`/${normalizedSlug}/`)) return 900
  if (normalizedPath.includes(normalizedSlug)) return 700
  if (normalizedPath === 'skill.md') return 400
  if (normalizedPath.endsWith('/skill.md')) return 300
  return 0
}

async function getGithubErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { message?: string }
    if (typeof data.message === 'string' && data.message.trim()) {
      return `: ${data.message}`
    }
  } catch {
    // ignore parse error
  }
  return ''
}

async function fetchGithubDefaultBranch(owner: string, repo: string): Promise<string> {
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    {
      headers: GITHUB_API_HEADERS
    }
  )

  if (!response.ok) {
    const message = await getGithubErrorMessage(response)
    throw new Error(`无法访问 GitHub 仓库 ${owner}/${repo}${message}`)
  }

  const data = (await response.json()) as GitHubRepoResponse
  if (!data.default_branch) {
    throw new Error(`仓库 ${owner}/${repo} 缺少默认分支信息`)
  }
  return data.default_branch
}

async function fetchGithubSkillPaths(
  owner: string,
  repo: string,
  branch: string
): Promise<string[]> {
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
      repo
    )}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    {
      headers: GITHUB_API_HEADERS
    }
  )

  if (!response.ok) {
    const message = await getGithubErrorMessage(response)
    throw new Error(`读取仓库文件树失败${message}`)
  }

  const data = (await response.json()) as GitHubTreeResponse
  const tree = Array.isArray(data.tree) ? data.tree : []
  return tree
    .filter(item => item.type === 'blob' && typeof item.path === 'string')
    .map(item => item.path as string)
    .filter(path => /(^|\/)SKILL\.md$/i.test(path))
}

async function fetchGithubRawSkill(
  owner: string,
  repo: string,
  branch: string,
  path: string
): Promise<string> {
  const encodedPath = path
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/')

  const response = await fetch(
    `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(
      repo
    )}/${encodeURIComponent(branch)}/${encodedPath}`
  )

  if (!response.ok) {
    throw new Error(`下载 Skill 文件失败：${path}`)
  }

  return response.text()
}

async function resolveSkillMarkdownFromGitHub(reference: SkillsShReference): Promise<{
  markdown: string
  frontmatter: SkillFrontmatter
}> {
  const branch = await fetchGithubDefaultBranch(reference.owner, reference.repo)
  const paths = await fetchGithubSkillPaths(reference.owner, reference.repo, branch)

  if (paths.length === 0) {
    throw new Error(`仓库 ${reference.owner}/${reference.repo} 中未找到 SKILL.md`)
  }

  const sortedPaths = paths
    .map(path => ({ path, score: rankSkillPath(path, reference.skillSlug) }))
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))

  const normalizedSlug = normalizeSkillToken(reference.skillSlug)
  let fallback:
    | {
        markdown: string
        frontmatter: SkillFrontmatter
      }
    | undefined

  const maxInspect = Math.min(sortedPaths.length, 24)
  for (let i = 0; i < maxInspect; i++) {
    const candidate = sortedPaths[i]
    const markdown = await fetchGithubRawSkill(
      reference.owner,
      reference.repo,
      branch,
      candidate.path
    )
    const frontmatter = parseSkillFrontmatter(markdown)

    if (!fallback) {
      fallback = { markdown, frontmatter }
    }

    const normalizedName = frontmatter.name ? normalizeSkillToken(frontmatter.name) : ''
    if (normalizedName && normalizedName === normalizedSlug) {
      return { markdown, frontmatter }
    }

    if (candidate.score >= 950) {
      return { markdown, frontmatter }
    }
  }

  if (fallback) {
    return fallback
  }

  throw new Error('未找到可导入的 Skill 内容')
}

function buildImportedSkillTags(
  reference: SkillsShReference,
  existingTags: string[] = []
): string[] {
  const tags = new Set<string>(existingTags.filter(Boolean))
  tags.add('skills.sh')
  tags.add(reference.skillSlug)
  tags.add(`${reference.owner}/${reference.repo}`)
  return Array.from(tags)
}

/**
 * 从 skills.sh 导入 Skill 到自定义 Skills
 */
export async function importSkillFromSkillsSh(
  referenceInput: string
): Promise<SkillsShImportResult> {
  const reference = parseSkillsShReference(referenceInput)
  const { markdown, frontmatter } = await resolveSkillMarkdownFromGitHub(reference)
  const now = Date.now()
  const skills = loadCustomSkills()
  const repositoryUrl = `https://github.com/${reference.owner}/${reference.repo}`
  const normalizedSlug = normalizeSkillToken(reference.skillSlug)
  const existingIndex = skills.findIndex(skill => {
    if (skill.importSource !== 'skills.sh') return false

    if (skill.sourceUrl === reference.canonicalUrl) return true
    if (skill.repositoryUrl !== repositoryUrl) return false

    const skillSlug = skill.skillSlug ? normalizeSkillToken(skill.skillSlug) : ''
    return skillSlug === normalizedSlug
  })

  const name = frontmatter.name?.trim() || extractMarkdownHeading(markdown) || reference.skillSlug
  const description =
    frontmatter.description?.trim() || `从 skills.sh 导入的 Skill：${reference.skillSlug}`

  if (existingIndex >= 0) {
    const existing = skills[existingIndex]
    const updated: CustomSkill = {
      ...existing,
      name,
      description,
      source: 'custom',
      category: existing.category || 'other',
      promptTemplate: markdown,
      importSource: 'skills.sh',
      sourceUrl: reference.canonicalUrl,
      repositoryUrl,
      skillSlug: reference.skillSlug,
      tags: buildImportedSkillTags(reference, existing.tags),
      updatedAt: now
    }

    skills[existingIndex] = updated
    saveCustomSkills(skills)
    return { skill: updated, action: 'updated' }
  }

  const created: CustomSkill = {
    id: `skill-custom-${nanoid()}`,
    name,
    description,
    category: 'other',
    source: 'custom',
    enabled: true,
    promptTemplate: markdown,
    importSource: 'skills.sh',
    sourceUrl: reference.canonicalUrl,
    repositoryUrl,
    skillSlug: reference.skillSlug,
    tags: buildImportedSkillTags(reference),
    createdAt: now,
    updatedAt: now
  }

  skills.push(created)
  saveCustomSkills(skills)
  return { skill: created, action: 'created' }
}

// ============ Skill Chains 管理 ============

/**
 * 加载 Skill Chains
 */
export function loadSkillChains(): SkillChain[] {
  return loadFromStorage<SkillChain[]>(SKILL_CHAINS_KEY, [])
}

/**
 * 保存 Skill Chains
 */
export function saveSkillChains(chains: SkillChain[]): void {
  saveToStorage(SKILL_CHAINS_KEY, chains)
}

/**
 * 添加 Skill Chain
 */
export function addSkillChain(chain: Omit<SkillChain, 'id'>): SkillChain {
  const chains = loadSkillChains()
  const newChain: SkillChain = {
    ...chain,
    id: `chain-${nanoid()}`
  }
  chains.push(newChain)
  saveSkillChains(chains)
  return newChain
}

/**
 * 更新 Skill Chain
 */
export function updateSkillChain(chainId: string, updates: Partial<SkillChain>): SkillChain | null {
  const chains = loadSkillChains()
  const index = chains.findIndex(c => c.id === chainId)
  if (index === -1) return null

  chains[index] = { ...chains[index], ...updates }
  saveSkillChains(chains)
  return chains[index]
}

/**
 * 删除 Skill Chain
 */
export function removeSkillChain(chainId: string): boolean {
  const chains = loadSkillChains()
  const filtered = chains.filter(c => c.id !== chainId)
  if (filtered.length === chains.length) return false
  saveSkillChains(filtered)
  return true
}

/**
 * 执行 Skill Chain
 */
export async function executeSkillChain(
  chain: SkillChain,
  initialArgs: Record<string, unknown>,
  allSkills: Skill[],
  customMcpServers: McpServerConfig[] = [],
  context?: SkillExecutionContext
): Promise<SkillExecutionResult> {
  const startTime = Date.now()
  const chainResults: SkillExecutionResult[] = []
  const chainState: Record<string, unknown> = { ...initialArgs, ...(context?.chainState || {}) }
  let previousResult: unknown = context?.previousResult

  for (const step of chain.steps) {
    // 检查条件
    if (step.condition) {
      const fieldValue = chainState[step.condition.field]
      let conditionMet = false

      switch (step.condition.operator) {
        case 'eq':
          conditionMet = fieldValue === step.condition.value
          break
        case 'neq':
          conditionMet = fieldValue !== step.condition.value
          break
        case 'contains':
          conditionMet =
            typeof fieldValue === 'string' &&
            typeof step.condition.value === 'string' &&
            fieldValue.includes(step.condition.value)
          break
        case 'exists':
          conditionMet = fieldValue !== undefined && fieldValue !== null
          break
      }

      if (!conditionMet) {
        continue // 跳过此步骤
      }
    }

    // 查找 skill
    const skill = allSkills.find(s => s.id === step.skillId)
    if (!skill) {
      chainResults.push({
        success: false,
        error: `未找到 Skill: ${step.skillId}`
      })
      continue
    }

    // 构建参数
    const stepArgs: Record<string, unknown> = { ...(step.staticArgs || {}) }

    // 应用参数映射
    if (step.argMapping) {
      for (const [targetKey, sourceKey] of Object.entries(step.argMapping)) {
        if (sourceKey === '$previous') {
          stepArgs[targetKey] = previousResult
        } else if (sourceKey.startsWith('$state.')) {
          const stateKey = sourceKey.slice(7)
          stepArgs[targetKey] = chainState[stateKey]
        } else {
          stepArgs[targetKey] = chainState[sourceKey]
        }
      }
    }

    // 执行 skill
    const result = await executeSkill(skill, stepArgs, customMcpServers)
    chainResults.push(result)

    // 更新统计
    updateSkillStats(skill.id, result)

    if (!result.success) {
      return {
        success: false,
        error: `Chain 在步骤 ${step.skillId} 失败：${result.error}`,
        duration: Date.now() - startTime,
        chainResults
      }
    }

    // 更新状态
    previousResult = result.result
    chainState[step.skillId] = result.result
  }

  return {
    success: true,
    result: previousResult,
    duration: Date.now() - startTime,
    chainResults
  }
}

// ============ Skill 统计 ============

/**
 * 加载 Skill 统计
 */
export function loadSkillStats(): Record<string, SkillStats> {
  return loadFromStorage<Record<string, SkillStats>>(SKILL_STATS_KEY, {})
}

/**
 * 保存 Skill 统计
 */
export function saveSkillStats(stats: Record<string, SkillStats>): void {
  saveToStorage(SKILL_STATS_KEY, stats)
}

/**
 * 更新 Skill 统计
 */
export function updateSkillStats(skillId: string, result: SkillExecutionResult): void {
  const allStats = loadSkillStats()
  const stats = allStats[skillId] || {
    totalCalls: 0,
    successCalls: 0,
    failedCalls: 0,
    avgDuration: 0
  }

  stats.totalCalls++
  if (result.success) {
    stats.successCalls++
  } else {
    stats.failedCalls++
  }

  // 更新平均时长
  if (result.duration) {
    stats.avgDuration =
      (stats.avgDuration * (stats.totalCalls - 1) + result.duration) / stats.totalCalls
  }

  stats.lastUsed = Date.now()

  allStats[skillId] = stats
  saveSkillStats(allStats)
}

/**
 * 获取 Skill 统计
 */
export function getSkillStats(skillId: string): SkillStats | undefined {
  const allStats = loadSkillStats()
  return allStats[skillId]
}

/**
 * 获取热门 Skills (按使用次数排序)
 */
export function getPopularSkills(skills: Skill[], limit = 10): Skill[] {
  const allStats = loadSkillStats()
  return skills
    .filter(s => allStats[s.id]?.totalCalls > 0)
    .sort((a, b) => (allStats[b.id]?.totalCalls || 0) - (allStats[a.id]?.totalCalls || 0))
    .slice(0, limit)
}

/**
 * 获取最近使用的 Skills
 */
export function getRecentSkills(skills: Skill[], limit = 10): Skill[] {
  const allStats = loadSkillStats()
  return skills
    .filter(s => allStats[s.id]?.lastUsed)
    .sort((a, b) => (allStats[b.id]?.lastUsed || 0) - (allStats[a.id]?.lastUsed || 0))
    .slice(0, limit)
}

// ============ Skill 触发器匹配 ============

export interface SkillMatch {
  skill: Skill
  score: number
  matchedTrigger?: string
  extractedArgs?: Record<string, string>
}

/**
 * 匹配用户输入到 Skills
 */
export function matchSkillsToInput(input: string, skills: Skill[]): SkillMatch[] {
  const matches: SkillMatch[] = []
  const inputLower = input.toLowerCase()

  for (const skill of skills) {
    if (!skill.enabled) continue

    let bestScore = 0
    let matchedTrigger: string | undefined
    let extractedArgs: Record<string, string> | undefined

    // 1. 触发器匹配 (最高优先级)
    if (skill.triggers && skill.triggers.length > 0) {
      for (const trigger of skill.triggers) {
        try {
          const regex = new RegExp(trigger, 'i')
          const match = input.match(regex)
          if (match) {
            const score = 100 + (skill.priority || 0)
            if (score > bestScore) {
              bestScore = score
              matchedTrigger = trigger
              // 提取捕获组作为参数
              if (match.length > 1) {
                extractedArgs = {}
                for (let i = 1; i < match.length; i++) {
                  extractedArgs[`arg${i}`] = match[i]
                }
              }
            }
          }
        } catch {
          // 忽略无效正则
        }
      }
    }

    // 2. 别名匹配
    if (skill.aliases) {
      for (const alias of skill.aliases) {
        if (inputLower.includes(alias.toLowerCase())) {
          const score = 80 + (skill.priority || 0)
          if (score > bestScore) {
            bestScore = score
          }
        }
      }
    }

    // 3. 名称匹配
    if (inputLower.includes(skill.name.toLowerCase())) {
      const score = 60 + (skill.priority || 0)
      if (score > bestScore) {
        bestScore = score
      }
    }

    // 4. 标签匹配
    if (skill.tags) {
      for (const tag of skill.tags) {
        if (inputLower.includes(tag.toLowerCase())) {
          const score = 40 + (skill.priority || 0)
          if (score > bestScore) {
            bestScore = score
          }
        }
      }
    }

    // 5. 描述匹配 (模糊匹配)
    const descWords = skill.description.toLowerCase().split(/\s+/)
    const inputWords = inputLower.split(/\s+/)
    const matchedWords = descWords.filter(w =>
      inputWords.some(iw => iw.includes(w) || w.includes(iw))
    )
    if (matchedWords.length > 0) {
      const score = 20 + matchedWords.length * 5 + (skill.priority || 0)
      if (score > bestScore) {
        bestScore = score
      }
    }

    if (bestScore > 0) {
      matches.push({
        skill,
        score: bestScore,
        matchedTrigger,
        extractedArgs
      })
    }
  }

  // 按分数排序
  return matches.sort((a, b) => b.score - a.score)
}

/**
 * 获取最佳匹配的 Skill
 */
export function getBestSkillMatch(input: string, skills: Skill[]): SkillMatch | undefined {
  const matches = matchSkillsToInput(input, skills)
  return matches[0]
}

/**
 * 获取建议的 Skills (基于输入)
 */
export function getSuggestedSkills(input: string, skills: Skill[], limit = 5): Skill[] {
  const matches = matchSkillsToInput(input, skills)
  return matches.slice(0, limit).map(m => m.skill)
}

// ============ Skill 预设管理 ============

/**
 * 加载 Skill 预设
 */
export function loadSkillPresets(): Record<string, SkillPreset[]> {
  return loadFromStorage<Record<string, SkillPreset[]>>(SKILL_PRESETS_KEY, {})
}

/**
 * 保存 Skill 预设
 */
export function saveSkillPresets(presets: Record<string, SkillPreset[]>): void {
  saveToStorage(SKILL_PRESETS_KEY, presets)
}

/**
 * 添加 Skill 预设
 */
export function addSkillPreset(skillId: string, preset: Omit<SkillPreset, 'id'>): SkillPreset {
  const allPresets = loadSkillPresets()
  const skillPresets = allPresets[skillId] || []

  const newPreset: SkillPreset = {
    ...preset,
    id: `preset-${nanoid()}`
  }
  skillPresets.push(newPreset)
  allPresets[skillId] = skillPresets
  saveSkillPresets(allPresets)
  return newPreset
}

/**
 * 删除 Skill 预设
 */
export function removeSkillPreset(skillId: string, presetId: string): boolean {
  const allPresets = loadSkillPresets()
  const skillPresets = allPresets[skillId] || []
  const filtered = skillPresets.filter(p => p.id !== presetId)

  if (filtered.length === skillPresets.length) return false

  allPresets[skillId] = filtered
  saveSkillPresets(allPresets)
  return true
}

/**
 * 获取 Skill 的所有预设 (内置 + 自定义)
 */
export function getSkillPresets(skill: Skill): SkillPreset[] {
  const customPresets = loadSkillPresets()[skill.id] || []
  const builtinPresets = skill.presets || []
  return [...builtinPresets, ...customPresets]
}

// ============ 增强的执行 Skill ============

/**
 * 执行 Skill (带统计和链式支持)
 */
export async function executeSkillWithContext(
  skill: Skill,
  args: Record<string, unknown>,
  customMcpServers: McpServerConfig[] = [],
  _context?: SkillExecutionContext,
  allSkills?: Skill[]
): Promise<SkillExecutionResult> {
  // 执行 skill
  const result = await executeSkill(skill, args, customMcpServers)

  // 更新统计
  updateSkillStats(skill.id, result)

  // 如果成功且有链式配置，返回建议的下一步
  if (result.success && skill.chainTo && skill.chainTo.length > 0 && allSkills) {
    result.suggestedNextSkills = skill.chainTo.filter(id =>
      allSkills.some(s => s.id === id && s.enabled)
    )
  }

  return result
}

// ============ 智能 Skill 推荐 ============

/**
 * 基于上下文推荐 Skills
 */
export function recommendSkills(
  context: {
    recentSkills?: string[]
    currentUrl?: string
    pageContent?: string
    userPreferences?: string[]
  },
  allSkills: Skill[]
): Skill[] {
  const recommendations: Array<{ skill: Skill; score: number }> = []
  const stats = loadSkillStats()

  for (const skill of allSkills) {
    if (!skill.enabled) continue

    let score = 0

    // 基于最近使用
    if (context.recentSkills?.includes(skill.id)) {
      score += 20
    }

    // 基于 URL 匹配
    const { currentUrl } = context
    if (currentUrl) {
      if (skill.tags?.some(t => currentUrl.includes(t))) {
        score += 30
      }
      // GitHub 页面推荐 GitHub 相关 skills
      if (currentUrl.includes('github.com') && skill.category === 'knowledge') {
        score += 25
      }
    }

    // 基于页面内容
    if (context.pageContent) {
      const contentLower = context.pageContent.toLowerCase()
      if (skill.tags?.some(t => contentLower.includes(t.toLowerCase()))) {
        score += 15
      }
    }

    // 基于用户偏好
    const { userPreferences } = context
    if (userPreferences) {
      if (skill.tags?.some(t => userPreferences.includes(t))) {
        score += 40
      }
      if (userPreferences.includes(skill.category)) {
        score += 20
      }
    }

    // 基于历史使用频率
    const skillStats = stats[skill.id]
    if (skillStats) {
      score += Math.min(skillStats.totalCalls * 2, 30)
      // 成功率加权
      if (skillStats.totalCalls > 0) {
        const successRate = skillStats.successCalls / skillStats.totalCalls
        score += successRate * 10
      }
    }

    // 优先级加权
    score += (skill.priority || 0) / 10

    if (score > 0) {
      recommendations.push({ skill, score })
    }
  }

  return recommendations
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(r => r.skill)
}
