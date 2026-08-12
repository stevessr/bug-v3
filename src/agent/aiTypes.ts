/**
 * Browser-only AI contracts.
 *
 * The old agent imported the Pi SDK solely for these small structural types and
 * for its JSON schema helper. Keeping the contracts in the extension means the
 * runtime can use fetch/ReadableStream directly and never bundles a Node-only
 * provider implementation.
 */

export type AiTextContent = {
  type: 'text'
  text: string
}

export type AiImageContent = {
  type: 'image'
  mimeType: string
  data: string
}

export type AiThinkingContent = {
  type: 'thinking'
  thinking: string
}

export type AiToolCallContent = {
  type: 'toolCall'
  id: string
  name: string
  arguments: Record<string, unknown>
}

export type AiContentBlock = AiTextContent | AiImageContent | AiThinkingContent | AiToolCallContent

export type AiMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | AiContentBlock[]
  timestamp?: number
  toolCallId?: string
  toolName?: string
  isError?: boolean
}

export type AssistantMessage = AiMessage & {
  role: 'assistant'
  content: AiContentBlock[]
  usage?: AiUsage | null
}

export type ImageContent = AiImageContent

export type AiUsage = {
  input: number
  output: number
  cacheRead?: number
}

export type AiModel = {
  provider: string
  id: string
  name: string
  baseUrl: string
  apiFlavor: 'messages' | 'responses'
  apiFamily: 'anthropic' | 'google' | 'openai-compatible'
}

export type AiCallOptions = {
  apiKey?: string
  maxTokens?: number
  reasoning?: 'off' | 'high'
  temperature?: number
  signal?: AbortSignal
  onDelta?: (delta: { text?: string; thinking?: string }) => void
}

export type AgentToolResult<TDetails = unknown> = {
  content?: Array<{ type: 'text'; text: string }>
  details?: TDetails
  isError?: boolean
}

export type AgentTool<TParams = unknown, TDetails = unknown> = {
  name: string
  label?: string
  description: string
  parameters: Record<string, unknown>
  execute: (toolCallId: string, params: TParams) => Promise<AgentToolResult<TDetails>>
}

export type AiTool = AgentTool

/**
 * Compatibility helper for plugin schemas. It deliberately performs no runtime
 * validation; providers validate the JSON schema at request time.
 */
export const Type = {
  Unsafe: <T>(schema: unknown): T => schema as T
}
