export type McpTransport = 'sse' | 'streamable-http'

export interface McpServerConfig {
  id: string
  name: string
  url: string
  transport: McpTransport
  headers?: Record<string, string>
  enabled: boolean
}

export interface AgentPermissions {
  click: boolean
  scroll: boolean
  touch: boolean
  screenshot: boolean
  navigate: boolean
  clickDom: boolean
  input: boolean
}

export interface SubAgentConfig {
  id: string
  name: string
  description?: string
  systemPrompt?: string
  taskModel?: string
  reasoningModel?: string
  imageModel?: string
  mcpServerIds?: string[]
  permissions: AgentPermissions
  enabled: boolean
  isPreset?: boolean
}

export interface AgentSettings {
  baseUrl: string
  apiKey: string
  taskModel: string
  reasoningModel: string
  imageModel: string
  enableMcp: boolean
  mcpServers: McpServerConfig[]
  subagents: SubAgentConfig[]
  defaultSubagentId?: string
}

export type AgentRole = 'user' | 'assistant' | 'system' | 'tool'

export interface AgentMessage {
  id: string
  role: AgentRole
  content: string
  actions?: AgentAction[]
  error?: string
}

export type AgentActionType =
  | 'click'
  | 'scroll'
  | 'touch'
  | 'screenshot'
  | 'navigate'
  | 'click-dom'
  | 'input'

export interface AgentActionBase {
  id: string
  type: AgentActionType
  note?: string
}

export interface ClickAction extends AgentActionBase {
  type: 'click' | 'click-dom'
  selector?: string
  x?: number
  y?: number
}

export interface ScrollAction extends AgentActionBase {
  type: 'scroll'
  x?: number
  y?: number
  behavior?: ScrollBehavior
}

export interface TouchAction extends AgentActionBase {
  type: 'touch'
  selector?: string
  x?: number
  y?: number
}

export interface ScreenshotAction extends AgentActionBase {
  type: 'screenshot'
  format?: 'png' | 'jpeg'
}

export interface NavigateAction extends AgentActionBase {
  type: 'navigate'
  url: string
}

export interface InputAction extends AgentActionBase {
  type: 'input'
  selector: string
  text: string
  clear?: boolean
}

export type AgentAction =
  | ClickAction
  | ScrollAction
  | TouchAction
  | ScreenshotAction
  | NavigateAction
  | InputAction

export interface AgentActionResult {
  id: string
  type: AgentActionType
  success: boolean
  error?: string
  data?: any
}
