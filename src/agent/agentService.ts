import { nanoid } from 'nanoid'
import { query } from '@anthropic-ai/claude-agent-sdk'

import type { AgentAction, AgentMessage, AgentSettings, SubAgentConfig } from './types'

interface AgentRunResult {
  message?: AgentMessage
  actions?: AgentAction[]
  error?: string
}

type SdkMessage = {
  type?: string
  message?: { content?: unknown }
  result?: string
  subtype?: string
  errors?: string[]
}

const extractContent = (content: unknown): string => {
  if (!content) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map(item => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object' && 'text' in item) {
          return String((item as { text?: string }).text ?? '')
        }
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }
  if (typeof content === 'object' && 'text' in (content as Record<string, unknown>)) {
    return String((content as { text?: string }).text ?? '')
  }
  return ''
}

export async function runAgentMessage(
  input: string,
  settings: AgentSettings,
  subagent?: SubAgentConfig
): Promise<AgentRunResult> {
  if (!settings.apiKey || !settings.baseUrl) {
    return {
      error: '请先在设置中填写 Claude Agent 的 baseUrl 和 apiKey。'
    }
  }

  // Placeholder integration: wire up SDK based on actual API surface.
  const mcpServers = settings.enableMcp
    ? settings.mcpServers.filter(server => {
        if (!server.enabled) return false
        const scope = subagent?.mcpServerIds
        if (scope && scope.length > 0) return scope.includes(server.id)
        return true
      })
    : []

  const mcpRecord = mcpServers.reduce<
    Record<string, { type: 'sse' | 'http'; url: string; headers?: Record<string, string> }>
  >((acc, server) => {
    const type = server.transport === 'streamable-http' ? 'http' : 'sse'
    acc[server.id] = {
      type,
      url: server.url,
      ...(server.headers ? { headers: server.headers } : {})
    }
    return acc
  }, {})

  try {
    const resultChunks: string[] = []
    const q = query({
      prompt: input,
      options: {
        model: subagent?.taskModel || settings.taskModel,
        systemPrompt: subagent?.systemPrompt || '',
        mcpServers: mcpRecord,
        env: {
          ANTHROPIC_API_KEY: settings.apiKey,
          ANTHROPIC_BASE_URL: settings.baseUrl,
          ANTHROPIC_API_URL: settings.baseUrl
        }
      }
    })

    for await (const raw of q as AsyncIterable<SdkMessage>) {
      if (raw?.type === 'assistant') {
        const chunk = extractContent(raw.message?.content)
        if (chunk) resultChunks.push(chunk)
      }
      if (raw?.type === 'result' && raw.subtype && raw.subtype !== 'success') {
        return {
          error: raw.errors?.[0] || 'Claude Agent 请求失败。'
        }
      }
      if (raw?.type === 'result' && raw.result) {
        resultChunks.push(raw.result)
      }
    }

    const content = resultChunks.join('\n').trim()
    return {
      message: {
        id: nanoid(),
        role: 'assistant',
        content: content || '已完成任务。'
      },
      actions: []
    }
  } catch (error: any) {
    return {
      error: error?.message || 'Claude Agent 请求失败。'
    }
  }
}
