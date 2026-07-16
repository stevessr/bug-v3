// ============ Agent Skills 类型定义 ============

export interface Skill {
  id: string
  name: string
  description: string
  category: SkillCategory
  source: SkillSource
  enabled: boolean
  mcpServerId?: string
  mcpToolName?: string
  inputSchema?: {
    type: string
    properties?: Record<string, unknown>
    required?: string[]
  }
  shortcut?: string
  icon?: string
  triggers?: string[]
  priority?: number
  tags?: string[]
  aliases?: string[]
  presets?: SkillPreset[]
  chainTo?: string[]
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
  argMapping?: Record<string, string>
  staticArgs?: Record<string, unknown>
  condition?: {
    field: string
    operator: 'eq' | 'neq' | 'contains' | 'exists'
    value?: unknown
  }
}

export interface SkillExecutionContext {
  previousResult?: unknown
  chainState?: Record<string, unknown>
  userInput?: string
  sessionId?: string
}

export interface CustomSkill extends Skill {
  script?: string
  promptTemplate?: string
  importSource?: 'skills.sh'
  sourceUrl?: string
  repositoryUrl?: string
  skillSlug?: string
  createdAt: number
  updatedAt: number
}

export type SkillCategory =
  'search' | 'knowledge' | 'code' | 'web' | 'data' | 'automation' | 'other'

export type SkillSource =
  'builtin' | 'mcp' | 'custom' | 'marketplace' | 'skills.sh' | 'github' | 'cloud'

export interface SkillExecutionResult {
  success: boolean
  result?: unknown
  error?: string
  duration?: number
  chainResults?: SkillExecutionResult[]
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
  requiresApiKey?: string
  enabled: boolean
}

export interface SkillMatch {
  skill: Skill
  score: number
  matchedTrigger?: string
  extractedArgs?: Record<string, string>
}
