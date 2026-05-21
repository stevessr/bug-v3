export type McpTransport = 'sse' | 'streamable-http'

export type ApiFlavor = 'messages' | 'responses'

/**
 * 每个 provider 独立的连接配置。
 *
 * 设计：把 apiKey / baseUrl / 三个默认模型按 provider 分别保存，
 * 切换 provider 时不会覆盖前一个 provider 的设置。
 * model 字段都是不带 `provider/` 前缀的纯模型 id（例如 `claude-sonnet-4-20250514`），
 * 真正调用时由 piSupport 拼上 provider 前缀。
 */
export interface ProviderProfile {
  /** provider id：pi-ai 已知 provider 或用户自定义字符串 */
  provider: string
  /** 用户显示名（可选；缺省时使用 provider 本身） */
  label?: string
  /** 该 provider 的 API Key（可空，表示尚未配置） */
  apiKey: string
  /** 可选的自定义 endpoint，留空使用 pi-ai 内置默认 */
  baseUrl?: string
  /** 该 provider 下的默认任务模型 id（不含 `provider/` 前缀） */
  taskModel?: string
  /** 该 provider 下的默认思考模型 id（不含前缀） */
  reasoningModel?: string
  /** 该 provider 下的默认图片转述模型 id（不含前缀） */
  imageModel?: string
}

// MCP 桥接协议类型
export type McpBridgeProtocol = 'auto' | 'ws' | 'wss'

// MCP 桥接设置（用于 WebSocket 连接）
export interface McpBridgeSettings {
  host: string
  port: number
  path: string
  protocol: McpBridgeProtocol
  autoConnect: boolean
  reconnectOnFailure: boolean
  // 实验性 UI 特性
  experimentalUI?: {
    enableElicitation: boolean
    enableApps: boolean
  }
}

export const DEFAULT_MCP_BRIDGE_SETTINGS: McpBridgeSettings = {
  host: '127.0.0.1',
  port: 7465,
  path: '/ws',
  protocol: 'auto',
  autoConnect: false,
  reconnectOnFailure: true,
  experimentalUI: {
    enableElicitation: true,
    enableApps: true
  }
}

export interface McpServerConfig {
  id: string
  name: string
  url: string
  transport: McpTransport
  headers?: Record<string, string>
  enabled: boolean
  /** OAuth 2.1 配置；未设置则不走 OAuth 流程，依旧用 headers 中的静态凭证。 */
  oauth?: McpOAuthConfig
  /** 已获取的 OAuth tokens（运行时自动写入）。 */
  oauthTokens?: McpOAuthTokens
}

/**
 * 单个 MCP server 的 OAuth 2.1 配置。
 * 字段对应 RFC 8414 (authorization server metadata) + RFC 7591 (DCR)。
 */
export interface McpOAuthConfig {
  /** RFC 9728 protected-resource metadata URL，自动发现写入。 */
  resourceMetadataUrl?: string
  /** Authorization Server metadata 来源 URL（如 issuer 的 /.well-known/...） */
  authorizationServerUrl?: string
  /** OAuth 端点（必填，可手动设置或由 discovery 填入） */
  authorizationEndpoint?: string
  tokenEndpoint?: string
  /** RFC 7591 Dynamic Client Registration endpoint。 */
  registrationEndpoint?: string
  /** 已注册或手填的 client_id。 */
  clientId?: string
  /** 通常使用 PKCE 不需要 client_secret；公有 client 可留空。 */
  clientSecret?: string
  /** 申请的 scopes，多个用空格分隔。 */
  scopes?: string
  /** 资源标识符，写入 OAuth 2.1 的 `resource` 参数。 */
  resource?: string
  /** 上次自动发现的时间戳，用于在 UI 中提示是否需要重新探测。 */
  lastDiscoveredAt?: number
}

export interface McpOAuthTokens {
  accessToken: string
  refreshToken?: string
  tokenType?: string
  /** 毫秒时间戳，token 过期时间。0/undefined 表示未知。 */
  expiresAt?: number
  scope?: string
  /** 获得 token 的时间戳，便于 UI 显示。 */
  obtainedAt?: number
}

export interface AgentPermissions {
  click: boolean
  scroll: boolean
  touch: boolean
  screenshot: boolean
  navigate: boolean
  clickDom: boolean
  input: boolean
  fileAccess: boolean
}

export interface AgentFolderRoot {
  id: string
  alias: string
  handleName: string
  enabled: boolean
  readOnly: boolean
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
  /**
   * 当前激活的 provider id。runtime 调用时优先用 providerProfiles[activeProvider]
   * 的 apiKey / baseUrl / model 默认值。空字符串/undefined 表示沿用 legacy 字段。
   */
  activeProvider?: string
  /**
   * 每 provider 一份独立的连接配置。新增、删除、切换 provider 都通过这个数组。
   * 旧版本（无该字段）首次加载时会由 storage 层自动迁移。
   */
  providerProfiles: ProviderProfile[]

  /**
   * Legacy 字段：在没有 providerProfiles 的旧版本中存放唯一一份配置。
   * 重构后仍保留，作为「未识别 active provider」时的 fallback 与向后兼容。
   * UI 写入 active profile 时会同步刷新这些字段，便于第三方读取。
   */
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
  folderRoots: AgentFolderRoot[]
  subagents: SubAgentConfig[]
  defaultSubagentId?: string
  /**
   * 已启用的内置插件 id 列表。`undefined` 表示沿用各插件的 defaultEnabled，
   * 一旦用户在 UI 调整过任意插件，便会落盘成具体数组。
   */
  enabledPluginIds?: string[]
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
  | 'list-files'
  | 'read-file'
  | 'write-file'

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
    textLimit?: number
    markdownLimit?: number
    maxTextBlocks?: number
  }
}

export interface FileActionBase extends AgentActionBase {
  rootId?: string
  rootAlias?: string
  path?: string
}

export interface ListFilesAction extends FileActionBase {
  type: 'list-files'
  recursive?: boolean
  maxEntries?: number
}

export interface ReadFileAction extends FileActionBase {
  type: 'read-file'
  path: string
  maxBytes?: number
}

export interface WriteFileAction extends FileActionBase {
  type: 'write-file'
  path: string
  content: string
  overwrite?: boolean
  createParents?: boolean
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
  | ListFilesAction
  | ReadFileAction
  | WriteFileAction

export interface AgentActionResult {
  id: string
  type: AgentActionType
  success: boolean
  error?: string
  data?: any
}
