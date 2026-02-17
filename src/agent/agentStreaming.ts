import Anthropic from '@anthropic-ai/sdk'

import type { ApiFlavor } from './types'
import {
  extractBrowserToolUses,
  extractTextContent,
  mergeParsedPayloads,
  parsePayloadFromRawText,
  parseResponsePayload,
  parseToolInputs,
  toolSchema,
  type AgentToolPayload
} from './agentPayload'
import { buildRetryMessage, withRateLimitRetry } from './agentRetry'
import { normalizeAgentUsage, type AgentUsage } from './agentUsage'

export interface AgentStreamUpdate {
  message?: string
  thoughts?: string[]
  steps?: string[]
  actions?: AgentToolPayload['actions']
  parallelActions?: boolean
}

export interface AgentStreamResult {
  rawText: string
  parsed: AgentToolPayload | null
  toolUseId?: string
  toolInput?: AgentToolPayload
  toolUseIds: string[]
  toolInputs: AgentToolPayload[]
  usage: AgentUsage
  mcpToolUses?: { id?: string; name?: string; input?: unknown }[]
}

export interface StreamClaudeToolConversationOptions {
  client: Anthropic
  model: string
  system: string
  messages: Array<{ role: 'user' | 'assistant'; content: any }>
  tools: any[]
  maxTokens: number
  toolChoice?: { type: 'auto' } | { type: 'tool'; name: string }
  onUpdate?: (update: AgentStreamUpdate) => void
}

const emitUpdate = (
  onUpdate: ((update: AgentStreamUpdate) => void) | undefined,
  payload: AgentStreamUpdate
) => {
  if (!onUpdate) return
  if (!payload.message && !payload.thoughts && !payload.steps) return
  onUpdate(payload)
}

const extractUpdateFromSnapshot = (snapshot: unknown): AgentStreamUpdate => {
  const parsed = parseResponsePayload(snapshot)
  if (!parsed) return {}
  return {
    message: parsed.message,
    thoughts: parsed.thoughts,
    steps: parsed.steps,
    actions: parsed.actions,
    parallelActions: parsed.parallelActions
  }
}

const buildStreamResult = (
  rawText: string,
  content: any[] | undefined,
  usage: AgentUsage
): Pick<
  AgentStreamResult,
  | 'rawText'
  | 'parsed'
  | 'toolUseId'
  | 'toolInput'
  | 'toolUseIds'
  | 'toolInputs'
  | 'usage'
  | 'mcpToolUses'
> => {
  const browserToolUses = extractBrowserToolUses(content)
  const { parsedInputs, toolUseIds } = parseToolInputs(browserToolUses)

  let parsed: AgentToolPayload | null = null
  if (parsedInputs.length > 0) {
    parsed = mergeParsedPayloads(parsedInputs)
  }

  if (!parsed) {
    parsed = parsePayloadFromRawText(rawText)
  }

  const mcpToolUses = content?.filter(
    block => block?.type === 'tool_use' && block?.name?.startsWith('mcp__')
  ) as { id?: string; name?: string; input?: unknown }[] | undefined

  return {
    rawText,
    parsed,
    toolUseId: toolUseIds.length === 1 ? toolUseIds[0] : undefined,
    toolInput: parsedInputs.length === 1 ? parsedInputs[0] : undefined,
    toolUseIds,
    toolInputs: parsedInputs,
    usage,
    mcpToolUses
  }
}

export async function streamClaudeToolConversation(
  options: StreamClaudeToolConversationOptions
): Promise<AgentStreamResult> {
  return withRateLimitRetry(
    async () => {
      let streamedText = ''

      const stream = options.client.messages
        .stream({
          model: options.model,
          max_tokens: options.maxTokens,
          system: options.system,
          messages: options.messages,
          tools: options.tools,
          tool_choice: options.toolChoice || { type: 'auto' }
        } as any)
        .on('text', text => {
          streamedText += text
          emitUpdate(options.onUpdate, { message: streamedText })
        })
        .on('thinking', (_, thinkingSnapshot) => {
          emitUpdate(options.onUpdate, { thoughts: [thinkingSnapshot] })
        })
        .on('inputJson', (_partial, jsonSnapshot) => {
          emitUpdate(options.onUpdate, extractUpdateFromSnapshot(jsonSnapshot))
        })

      const finalMessage = await stream.finalMessage()
      const rawText = streamedText || extractTextContent(finalMessage.content)
      const usage = normalizeAgentUsage((finalMessage as any)?.usage)

      return {
        ...buildStreamResult(rawText, finalMessage.content as any[] | undefined, usage)
      }
    },
    (attempt, delayMs, error) => {
      emitUpdate(options.onUpdate, { message: buildRetryMessage(attempt, delayMs, error) })
    }
  )
}

async function streamClaudeResponseApi(options: {
  client: Anthropic
  model: string
  system: string
  prompt: string
  onUpdate?: (update: AgentStreamUpdate) => void
  maxTokens: number
  mcpTools?: any[]
}) {
  const allTools: any[] = [toolSchema, ...(options.mcpTools || [])]

  return withRateLimitRetry(
    async () => {
      let streamedText = ''

      const baseUrl = (options.client as any)._options?.baseURL || 'https://api.anthropic.com'
      const apiKey = (options.client as any)._options?.apiKey || ''

      const requestBody = {
        model: options.model,
        max_tokens: options.maxTokens,
        system: [{ type: 'text', text: options.system }],
        input: [{ role: 'user', content: options.prompt }],
        tools: allTools.map(tool => ({
          type: 'function',
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema
        })),
        stream: true
      }

      const response = await fetch(`${baseUrl}/v1/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2024-01-01',
          'anthropic-beta': 'responses-2025-01-01'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Response API error: ${response.status} - ${errorText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      let buffer = ''
      const toolCalls: Array<{ id: string; name: string; input: unknown }> = []
      let usage: AgentUsage = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue

          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const event = JSON.parse(data)
            const eventUsage = normalizeAgentUsage(
              event?.usage ||
                event?.response?.usage ||
                event?.message?.usage ||
                event?.result?.usage
            )
            if (eventUsage) {
              usage = eventUsage
            }

            if (event.type === 'content_block_delta') {
              if (event.delta?.type === 'text_delta') {
                streamedText += event.delta.text || ''
                emitUpdate(options.onUpdate, { message: streamedText })
              } else if (event.delta?.type === 'thinking_delta') {
                emitUpdate(options.onUpdate, { thoughts: [event.delta.thinking || ''] })
              } else if (event.delta?.type === 'input_json_delta') {
                emitUpdate(options.onUpdate, extractUpdateFromSnapshot(event.delta.partial_json))
              }
            } else if (
              event.type === 'content_block_start' &&
              event.content_block?.type === 'tool_use'
            ) {
              toolCalls.push({
                id: event.content_block.id,
                name: event.content_block.name,
                input: {}
              })
            }
          } catch {
            // ignore malformed event chunks
          }
        }
      }

      const browserToolUses = toolCalls.filter(call => call.name === toolSchema.name)
      const { parsedInputs, toolUseIds } = parseToolInputs(browserToolUses)

      let parsed: AgentToolPayload | null = null
      if (parsedInputs.length > 0) {
        parsed = mergeParsedPayloads(parsedInputs)
      }

      if (!parsed) {
        parsed = parsePayloadFromRawText(streamedText)
      }

      const mcpToolUses = toolCalls.filter(call => call.name.startsWith('mcp__'))

      return {
        rawText: streamedText,
        parsed,
        toolUseId: toolUseIds.length === 1 ? toolUseIds[0] : undefined,
        toolInput: parsedInputs.length === 1 ? parsedInputs[0] : undefined,
        toolUseIds,
        toolInputs: parsedInputs,
        usage,
        mcpToolUses: mcpToolUses.length > 0 ? mcpToolUses : undefined
      }
    },
    (attempt, delayMs, error) => {
      emitUpdate(options.onUpdate, { message: buildRetryMessage(attempt, delayMs, error) })
    }
  )
}

export async function streamClaudeTurn(
  options: {
    client: Anthropic
    model: string
    system: string
    prompt: string
    onUpdate?: (update: AgentStreamUpdate) => void
    forceTool?: boolean
    maxTokens: number
    mcpTools?: any[]
  },
  apiFlavor: ApiFlavor = 'messages'
): Promise<AgentStreamResult> {
  if (apiFlavor === 'responses') {
    return streamClaudeResponseApi(options)
  }

  const allTools = [toolSchema, ...(options.mcpTools || [])]
  return streamClaudeToolConversation({
    client: options.client,
    model: options.model,
    system: options.system,
    messages: [{ role: 'user', content: options.prompt }],
    tools: allTools,
    toolChoice: options.forceTool ? { type: 'tool', name: toolSchema.name } : { type: 'auto' },
    maxTokens: options.maxTokens,
    onUpdate: options.onUpdate
  })
}

export async function streamClaudeText(options: {
  client: Anthropic
  model: string
  system: string
  prompt: string
  maxTokens: number
}) {
  return withRateLimitRetry(
    async () => {
      let streamedText = ''

      const stream = options.client.messages
        .stream({
          model: options.model,
          max_tokens: options.maxTokens,
          system: options.system,
          messages: [{ role: 'user', content: options.prompt }]
        })
        .on('text', text => {
          streamedText += text
        })

      const finalMessage = await stream.finalMessage()
      const rawText = streamedText || extractTextContent(finalMessage.content)
      return rawText.trim()
    },
    () => {
      // no-op for background tasks
    }
  )
}
