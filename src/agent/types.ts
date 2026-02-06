export type McpTransport = 'sse' | 'streamable-http'

export type ApiFlavor = 'messages' | 'responses'

// MCP 桥接设置（用于 WebSocket 连接）
export interface McpBridgeSettings {
  host: string
  port: number
  path: string
  autoConnect: boolean
  reconnectOnFailure: boolean
}

export const DEFAULT_MCP_BRIDGE_SETTINGS: McpBridgeSettings = {
  host: '127.0.0.1',
  port: 7465,
  path: '/ws',
  autoConnect: true,
  reconnectOnFailure: true
}

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
  apiFlavor: ApiFlavor
  taskModel: string
  reasoningModel: string
  imageModel: string
  maxTokens: number
  masterSystemPrompt: string
  enableThoughts: boolean
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
  segments?: Array<{
    id: string
    content: string
    actions?: AgentAction[]
  }>
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
  | 'double-click'
  | 'right-click'
  | 'hover'
  | 'key'
  | 'type'
  | 'drag'
  | 'select'
  | 'focus'
  | 'getDOM'
  | 'blur'

export interface AgentActionBase {
  id: string
  type: AgentActionType
  note?: string
}

export interface ClickAction extends AgentActionBase {
  type: 'click' | 'click-dom' | 'double-click' | 'right-click' | 'hover' | 'focus' | 'blur'
  selector?: string
  x?: number
  y?: number
  button?: number
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

export interface KeyAction extends AgentActionBase {
  type: 'key'
  key: string
  code?: string
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  metaKey?: boolean
  repeat?: boolean
}

export interface TypeAction extends AgentActionBase {
  type: 'type'
  selector?: string
  text: string
  clear?: boolean
  delayMs?: number
}

export interface DragAction extends AgentActionBase {
  type: 'drag'
  selector?: string
  x?: number
  y?: number
  targetSelector?: string
  toX?: number
  toY?: number
}

export interface SelectAction extends AgentActionBase {
  type: 'select'
  selector: string
  value?: string
  label?: string
}

export interface DomTreeAction extends AgentActionBase {
  type: 'getDOM'
  selector?: string
  options?: {
    includeMarkdown?: boolean
    maxDepth?: number
    maxChildren?: number
    maxTextLength?: number
  }
}

export type AgentAction =
  | ClickAction
  | ScrollAction
  | TouchAction
  | ScreenshotAction
  | NavigateAction
  | InputAction
  | KeyAction
  | TypeAction
  | DragAction
  | SelectAction
  | DomTreeAction

export interface AgentActionResult {
  id: string
  type: AgentActionType
  success: boolean
  error?: string
  data?: any
}
