/**
 * Agent Skills 系统
 *
 * 基于 MCP 工具自动生成 skills，支持内置和自定义 skills
 */

import { nanoid } from 'nanoid'
import type { McpServerConfig } from './types'
import { discoverMcpTools, callMcpTool, type McpTool } from './mcpClient'

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
      'CONTEXT7_API_KEY': '$CONTEXT7_API_KEY'
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
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索查询' }
      },
      required: ['query']
    }
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
    inputSchema: {
      type: 'object',
      properties: {
        repoName: { type: 'string', description: 'GitHub 仓库名称 (owner/repo)' }
      },
      required: ['repoName']
    }
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
    inputSchema: {
      type: 'object',
      properties: {
        context7CompatibleLibraryID: { type: 'string', description: '库 ID (如 /mongodb/docs)' },
        topic: { type: 'string', description: '要查询的主题' }
      },
      required: ['context7CompatibleLibraryID']
    }
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
    inputSchema: {
      type: 'object',
      properties: {
        libraryName: { type: 'string', description: '库名称 (如 react, vue, express)' }
      },
      required: ['libraryName']
    }
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

  // 处理 URL 中的 API Key 占位符
  let url = builtin.url
  if (builtin.requiresApiKey) {
    const apiKey = apiKeys[builtin.requiresApiKey] || ''
    // Tavily 特殊处理：API Key 在 URL 参数中
    if (builtin.id === 'builtin-tavily') {
      url = `https://mcp.tavily.com/mcp?tavilyApiKey=${encodeURIComponent(apiKey)}`
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
  if (
    name.includes('automate') ||
    name.includes('workflow') ||
    desc.includes('automate')
  ) {
    return 'automation'
  }

  return 'other'
}

/**
 * 从 MCP 工具生成 Skill
 */
export function mcpToolToSkill(
  serverId: string,
  serverName: string,
  tool: McpTool
): Skill {
  const category = inferSkillCategory(tool, serverName)

  return {
    id: `skill-mcp-${serverId}-${tool.name}`,
    name: tool.name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    description: tool.description || `MCP 工具: ${tool.name}`,
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
  customMcpServers: McpServerConfig[] = []
): Promise<SkillExecutionResult> {
  const startTime = Date.now()

  if (!skill.mcpServerId || !skill.mcpToolName) {
    return {
      success: false,
      error: 'Skill 没有关联的 MCP 工具'
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
      error: `未找到 MCP 服务: ${skill.mcpServerId}`
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
