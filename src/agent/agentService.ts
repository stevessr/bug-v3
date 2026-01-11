import { generateObject } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { nanoid } from 'nanoid'
import { z } from 'zod'

import type { AgentAction, AgentMessage, AgentSettings, SubAgentConfig } from './types'

interface AgentRunResult {
  message?: AgentMessage
  actions?: AgentAction[]
  error?: string
}

const actionSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['click', 'scroll', 'touch', 'screenshot', 'navigate', 'click-dom', 'input']),
  note: z.string().optional(),
  selector: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  behavior: z.enum(['auto', 'smooth']).optional(),
  format: z.enum(['png', 'jpeg']).optional(),
  url: z.string().optional(),
  text: z.string().optional(),
  clear: z.boolean().optional()
})

const responseSchema = z.object({
  message: z.string(),
  actions: z.array(actionSchema).optional()
})

const buildSystemPrompt = (settings: AgentSettings, subagent?: SubAgentConfig): string => {
  const lines = [
    '你是浏览器侧边栏自动化助手，输出简洁计划并用结构化 action 描述需要执行的步骤。',
    '如果不需要自动化操作，仅输出 message。',
    'action 只使用以下类型：click, scroll, touch, screenshot, navigate, click-dom, input。',
    '如果需要操作页面元素，请优先提供 selector；否则使用坐标 x/y。',
    '不要编造不存在的元素，缺少信息时先提问。'
  ]

  if (settings.enableMcp && settings.mcpServers.length > 0) {
    const enabledServers = settings.mcpServers.filter(server => {
      if (!server.enabled) return false
      const scope = subagent?.mcpServerIds
      if (scope && scope.length > 0) return scope.includes(server.id)
      return true
    })
    if (enabledServers.length > 0) {
      lines.push(
        `可用 MCP 服务：${enabledServers
          .map(server => `${server.name}(${server.transport}:${server.url})`)
          .join(', ')}`
      )
    }
  }

  return lines.join('\n')
}

export async function runAgentMessage(
  input: string,
  settings: AgentSettings,
  subagent?: SubAgentConfig
): Promise<AgentRunResult> {
  if (!settings.apiKey) {
    return {
      error: '请先在设置中填写 Claude 的 apiKey。'
    }
  }

  try {
    const provider = createAnthropic({
      apiKey: settings.apiKey,
      baseURL: settings.baseUrl || undefined
    })
    const modelId = subagent?.taskModel || settings.taskModel
    const { object } = await generateObject({
      model: provider(modelId),
      schema: responseSchema,
      system: [buildSystemPrompt(settings, subagent), subagent?.systemPrompt || '']
        .filter(Boolean)
        .join('\n'),
      prompt: input
    })

    const content = object.message?.trim() || '已完成任务。'
    const actions =
      object.actions?.map(action => ({
        ...action,
        id: action.id || nanoid()
      })) || []

    return {
      message: {
        id: nanoid(),
        role: 'assistant',
        content
      },
      actions
    }
  } catch (error: any) {
    return {
      error: error?.message || 'Claude Agent 请求失败。'
    }
  }
}
