import Anthropic from '@anthropic-ai/sdk'
import { nanoid } from 'nanoid'
import { z } from 'zod'

import type { AgentAction, AgentMessage, AgentSettings, SubAgentConfig } from './types'
import {
  createSubagentSession,
  resolveSubagent,
  updateSubagentSessionItem
} from './subagentSessions'
import { memoryToPrompt, updateMemory } from './memory'

interface AgentRunResult {
  message?: AgentMessage
  actions?: AgentAction[]
  toolUseId?: string
  toolInput?: z.infer<typeof responseSchema>
  parallelActions?: boolean
  thoughts?: string[]
  steps?: string[]
  error?: string
}

const actionSchema = z.object({
  id: z.string().optional(),
  type: z.enum([
    'click',
    'scroll',
    'touch',
    'screenshot',
    'navigate',
    'click-dom',
    'input',
    'double-click',
    'right-click',
    'hover',
    'key',
    'type',
    'drag',
    'select',
    'focus',
    'blur'
  ]),
  note: z.string().optional(),
  selector: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  button: z.number().optional(),
  behavior: z.enum(['auto', 'smooth']).optional(),
  format: z.enum(['png', 'jpeg']).optional(),
  url: z.string().optional(),
  text: z.string().optional(),
  clear: z.boolean().optional(),
  key: z.string().optional(),
  code: z.string().optional(),
  ctrlKey: z.boolean().optional(),
  altKey: z.boolean().optional(),
  shiftKey: z.boolean().optional(),
  metaKey: z.boolean().optional(),
  repeat: z.boolean().optional(),
  delayMs: z.number().optional(),
  targetSelector: z.string().optional(),
  toX: z.number().optional(),
  toY: z.number().optional(),
  value: z.string().optional(),
  label: z.string().optional()
})

const responseSchema = z.object({
  message: z.string().optional(),
  actions: z.array(actionSchema).optional(),
  parallelActions: z.boolean().optional(),
  thoughts: z.array(z.string()).optional(),
  steps: z.array(z.string()).optional(),
  memory: z
    .object({
      set: z.record(z.string()).optional(),
      remove: z.array(z.string()).optional()
    })
    .optional(),
  subagents: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().optional(),
        prompt: z.string()
      })
    )
    .optional()
})

const toolSchema = {
  name: 'browser_actions',
  description:
    'Respond with a message and optional browser actions. Use parallelActions=true for independent actions.',
  input_schema: {
    type: 'object',
    properties: {
      message: { type: 'string' },
      actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: {
              type: 'string',
              enum: [
                'click',
                'double-click',
                'right-click',
                'hover',
                'focus',
                'blur',
                'scroll',
                'touch',
                'screenshot',
                'navigate',
                'click-dom',
                'input',
                'key',
                'type',
                'drag',
                'select'
              ]
            },
            note: { type: 'string' },
            selector: { type: 'string' },
            x: { type: 'number' },
            y: { type: 'number' },
            button: { type: 'number' },
            behavior: { type: 'string', enum: ['auto', 'smooth'] },
            format: { type: 'string', enum: ['png', 'jpeg'] },
            url: { type: 'string' },
            text: { type: 'string' },
            clear: { type: 'boolean' },
            key: { type: 'string' },
            code: { type: 'string' },
            ctrlKey: { type: 'boolean' },
            altKey: { type: 'boolean' },
            shiftKey: { type: 'boolean' },
            metaKey: { type: 'boolean' },
            repeat: { type: 'boolean' },
            delayMs: { type: 'number' },
            targetSelector: { type: 'string' },
            toX: { type: 'number' },
            toY: { type: 'number' },
            value: { type: 'string' },
            label: { type: 'string' }
          },
          required: ['type']
        }
      },
      subagents: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            prompt: { type: 'string' }
          },
          required: ['prompt']
        }
      },
      thoughts: { type: 'array', items: { type: 'string' } },
      steps: { type: 'array', items: { type: 'string' } },
      parallelActions: { type: 'boolean' },
      memory: {
        type: 'object',
        properties: {
          set: { type: 'object' },
          remove: { type: 'array', items: { type: 'string' } }
        }
      }
    },
    required: []
  }
}

type TabContext = {
  id?: number
  title?: string
  url?: string
  status?: string
  active?: boolean
  windowId?: number
}

const buildSystemPrompt = (
  settings: AgentSettings,
  subagent?: SubAgentConfig,
  context?: { tab?: TabContext }
): string => {
  const lines = [
    '你是总代理，了解并可调用可用的子代理协助完成任务。',
    '你是浏览器侧边栏自动化助手。',
    '用工具调用 browser_actions 返回消息与动作，不要输出 JSON 文本。',
    'action 只使用以下类型：click, double-click, right-click, hover, focus, blur, scroll, touch, screenshot, navigate, click-dom, input, key, type, drag, select。',
    '如果需要操作页面元素，请优先提供 selector；否则使用坐标 x/y。',
    '尽量自行探索当前页面并执行可行的下一步，不要先向用户索要显而易见的信息。',
    '当不确定页面内容时，优先尝试：获取 DOM 树、截图、滚动或聚焦关键区域，再决定下一步。',
    '仅当确实无法继续时才提问，并给出你需要的具体信息。',
    '如果需要调用多个子代理，请尽量并行调用，返回 subagents 数组，每项包含 id 或 name 以及 prompt。',
    '需要子代理时，使用 subagents 数组触发；需要动作时放入 actions。',
    '尽量合并多个独立动作并并行执行，将 parallelActions 设为 true。',
    '可写入记忆：memory.set；可删除记忆：memory.remove。',
    'steps 与 thoughts 必须基于可观察证据（当前页面、DOM、截图结果），不要猜测或编造。',
    '若证据不足，用“待确认”表述，不要下结论。'
  ]

  if (settings.enableThoughts) {
    lines.push('允许请求深度思考，并将思考过程放在 thoughts 数组中。')
  }
  lines.push('请在 steps 数组中给出可读的步骤描述，与 actions 对应。')

  if (context?.tab) {
    const tab = context.tab
    const parts = [
      typeof tab.id === 'number' ? `id=${tab.id}` : null,
      tab.title ? `title=${tab.title}` : null,
      tab.url ? `url=${tab.url}` : null,
      tab.status ? `status=${tab.status}` : null,
      typeof tab.active === 'boolean' ? `active=${tab.active}` : null,
      typeof tab.windowId === 'number' ? `windowId=${tab.windowId}` : null
    ].filter(Boolean)
    if (parts.length > 0) {
      lines.push(`当前标签页：${parts.join(', ')}`)
    }
  }

  if (settings.masterSystemPrompt) {
    lines.push(settings.masterSystemPrompt)
  }

  const memoryLine = memoryToPrompt()
  if (memoryLine) lines.push(memoryLine)

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

const repairJson = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  const candidate = raw.slice(start, end + 1)
  return candidate
}

const extractTextContent = (
  content: Array<{ type: string; text?: string }> | undefined
): string => {
  if (!content) return ''
  return content
    .filter(block => block.type === 'text')
    .map(block => block.text || '')
    .join('')
}

const buildSubagentPrompt = (subagent: SubAgentConfig): string => {
  const lines = ['你是协作子代理，只输出简洁的文本结论或步骤。', '不要输出 JSON，不要包含 action。']
  if (subagent.systemPrompt) lines.push(subagent.systemPrompt)
  return lines.join('\n')
}

const shouldUseReasoning = (input: string, settings: AgentSettings) => {
  if (!settings.enableThoughts) return false
  return /深度思考|思考模式|think/i.test(input)
}

const selectTaskModel = (
  settings: AgentSettings,
  subagent?: SubAgentConfig,
  useReasoning?: boolean
) => {
  if (useReasoning) {
    return subagent?.reasoningModel || settings.reasoningModel || settings.taskModel
  }
  return subagent?.taskModel || settings.taskModel
}

async function streamClaudeTools(options: {
  client: Anthropic
  model: string
  system: string
  prompt: string
  onUpdate?: (message: string) => void
  forceTool?: boolean
  maxTokens: number
}) {
  let streamedText = ''
  const stream = options.client.messages
    .stream({
      model: options.model,
      max_tokens: options.maxTokens,
      system: options.system,
      messages: [{ role: 'user', content: options.prompt }],
      tools: [toolSchema],
      tool_choice: options.forceTool ? { type: 'tool', name: toolSchema.name } : { type: 'auto' }
    })
    .on('text', text => {
      streamedText += text
      options.onUpdate?.(streamedText)
    })

  const finalMessage = await stream.finalMessage()
  const rawText = streamedText || extractTextContent(finalMessage.content)
  const toolUse = finalMessage.content?.find(
    (block: any) => block?.type === 'tool_use' && block?.name === toolSchema.name
  ) as { id?: string; input?: any } | undefined
  const toolInput = toolUse?.input

  let parsed: z.infer<typeof responseSchema> | null = null
  if (toolInput) {
    try {
      parsed = responseSchema.parse(toolInput)
    } catch {
      parsed = null
    }
  }

  if (!parsed) {
    const candidate = repairJson(rawText) || rawText
    try {
      parsed = responseSchema.parse(JSON.parse(candidate))
    } catch {
      parsed = null
    }
  }

  return { rawText, parsed, toolUseId: toolUse?.id, toolInput }
}

async function streamClaudeText(options: {
  client: Anthropic
  model: string
  system: string
  prompt: string
  maxTokens: number
}) {
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
}

const parseChecklist = (raw: string): string[] => {
  return raw
    .split('\n')
    .map(line => line.replace(/^[-*+\d.、\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 10)
}

export async function generateChecklist(
  input: string,
  settings: AgentSettings,
  subagent?: SubAgentConfig,
  context?: { tab?: TabContext }
): Promise<string[]> {
  try {
    const client = new Anthropic({
      apiKey: settings.apiKey,
      baseURL: settings.baseUrl || undefined,
      dangerouslyAllowBrowser: true
    })
    const modelId = selectTaskModel(settings, subagent, false)
    const system = [
      buildSystemPrompt(settings, subagent, context),
      '请将用户需求拆分为可执行的清单任务（最多 7 条）。',
      '仅输出条目列表，每行一条，不要输出其他内容。'
    ].join('\n')
    const raw = await streamClaudeText({
      client,
      model: modelId,
      system,
      prompt: input,
      maxTokens: Math.min(settings.maxTokens || 1024, 512)
    })
    return parseChecklist(raw)
  } catch {
    return []
  }
}

export async function verifyChecklist(
  input: string,
  checklist: string[],
  finalMessage: string,
  settings: AgentSettings,
  subagent?: SubAgentConfig,
  context?: { tab?: TabContext }
): Promise<string> {
  try {
    const client = new Anthropic({
      apiKey: settings.apiKey,
      baseURL: settings.baseUrl || undefined,
      dangerouslyAllowBrowser: true
    })
    const modelId = selectTaskModel(settings, subagent, false)
    const system = [
      buildSystemPrompt(settings, subagent, context),
      '你是任务核查助手，只根据提供的信息判断是否完成清单。',
      '输出一句简短结论，格式：已完成/未完成 + 简要原因。'
    ].join('\n')
    const prompt = [
      `用户需求：${input}`,
      `任务清单：${JSON.stringify(checklist)}`,
      `最终输出：${finalMessage}`
    ].join('\n')
    const raw = await streamClaudeText({
      client,
      model: modelId,
      system,
      prompt,
      maxTokens: Math.min(settings.maxTokens || 1024, 256)
    })
    return raw || '待确认'
  } catch {
    return '待确认'
  }
}

export async function runAgentMessage(
  input: string,
  settings: AgentSettings,
  subagent?: SubAgentConfig,
  context?: { tab?: TabContext },
  options?: {
    onUpdate?: (update: { message?: string }) => void
  }
): Promise<AgentRunResult> {
  if (!settings.apiKey) {
    return {
      error: '请先在设置中填写 Claude 的 apiKey。'
    }
  }

  try {
    const client = new Anthropic({
      apiKey: settings.apiKey,
      baseURL: settings.baseUrl || undefined,
      dangerouslyAllowBrowser: true
    })
    const useReasoning = shouldUseReasoning(input, settings)
    const modelId = selectTaskModel(settings, subagent, useReasoning)
    const system = [buildSystemPrompt(settings, subagent, context), subagent?.systemPrompt || '']
      .filter(Boolean)
      .join('\n')
    const firstPass = await streamClaudeTools({
      client,
      model: modelId,
      system,
      prompt: input,
      onUpdate: message => options?.onUpdate?.({ message }),
      forceTool: true,
      maxTokens: settings.maxTokens || 1024
    })

    if (!firstPass.parsed) {
      const fallbackContent = firstPass.rawText.trim() || '已完成任务。'
      return {
        message: {
          id: nanoid(),
          role: 'assistant',
          content: fallbackContent
        },
        actions: []
      }
    }

    if (firstPass.parsed.subagents && firstPass.parsed.subagents.length > 0) {
      const sessionId = nanoid()
      createSubagentSession(sessionId, input, firstPass.parsed.subagents)

      const subagentResults = await Promise.all(
        firstPass.parsed.subagents.map(async call => {
          const target = resolveSubagent(settings.subagents, call)
          if (!target) {
            const error = '未找到子代理'
            updateSubagentSessionItem(sessionId, call, { error })
            return { id: call.id, name: call.name, error }
          }
          try {
            const output = await streamClaudeText({
              client,
              model: selectTaskModel(settings, target, useReasoning),
              system: buildSubagentPrompt(target),
              prompt: call.prompt,
              maxTokens: settings.maxTokens || 1024
            })
            updateSubagentSessionItem(sessionId, call, { output })
            return { id: call.id, name: call.name, output }
          } catch (error: any) {
            const message = error?.message || '子代理调用失败'
            updateSubagentSessionItem(sessionId, call, { error: message })
            return { id: call.id, name: call.name, error: message }
          }
        })
      )

      options?.onUpdate?.({ message: '已完成子代理任务，正在汇总结果…' })

      const aggregatePrompt = [
        '用户原始需求：',
        input,
        '',
        '子代理结果：',
        JSON.stringify(subagentResults)
      ].join('\n')

      const aggregated = await streamClaudeTools({
        client,
        model: modelId,
        system: `${system}\n不要再调用子代理。`,
        prompt: aggregatePrompt,
        onUpdate: message => options?.onUpdate?.({ message }),
        forceTool: false,
        maxTokens: settings.maxTokens || 1024
      })

      if (!aggregated.parsed) {
        const fallbackContent = aggregated.rawText.trim() || '已完成任务。'
        return {
          message: {
            id: nanoid(),
            role: 'assistant',
            content: fallbackContent
          },
          actions: []
        }
      }

      const aggregatedContent =
        aggregated.parsed.message?.trim() || aggregated.parsed.steps?.[0]?.trim() || '已完成任务。'
      const aggregatedActions =
        aggregated.parsed.actions?.map(action => ({
          ...action,
          id: action.id || nanoid()
        })) || []

      if (aggregated.parsed?.memory) {
        updateMemory(aggregated.parsed.memory)
      }

      return {
        message: {
          id: nanoid(),
          role: 'assistant',
          content: aggregatedContent
        },
        actions: aggregatedActions,
        toolUseId: aggregated.toolUseId,
        toolInput: aggregated.toolInput,
        parallelActions: aggregated.parsed?.parallelActions,
        thoughts: aggregated.parsed?.thoughts,
        steps: aggregated.parsed?.steps
      }
    }

    if (firstPass.parsed.memory) {
      updateMemory(firstPass.parsed.memory)
    }

    const content =
      firstPass.parsed.message?.trim() || firstPass.parsed.steps?.[0]?.trim() || '已完成任务。'
    const actions =
      firstPass.parsed.actions?.map(action => ({
        ...action,
        id: action.id || nanoid()
      })) || []

    return {
      message: {
        id: nanoid(),
        role: 'assistant',
        content
      },
      actions,
      toolUseId: firstPass.toolUseId,
      toolInput: firstPass.toolInput,
      parallelActions: firstPass.parsed.parallelActions,
      thoughts: firstPass.parsed.thoughts,
      steps: firstPass.parsed.steps
    }
  } catch (error: any) {
    return {
      error: error?.message || 'Claude Agent 请求失败。'
    }
  }
}

export async function runAgentFollowup(
  input: string,
  toolUseId: string,
  toolInput: z.infer<typeof responseSchema>,
  toolResult: unknown,
  settings: AgentSettings,
  subagent?: SubAgentConfig,
  context?: { tab?: TabContext },
  options?: {
    onUpdate?: (update: { message?: string }) => void
  }
): Promise<AgentRunResult> {
  try {
    const client = new Anthropic({
      apiKey: settings.apiKey,
      baseURL: settings.baseUrl || undefined,
      dangerouslyAllowBrowser: true
    })
    const useReasoning = shouldUseReasoning(input, settings)
    const modelId = selectTaskModel(settings, subagent, useReasoning)
    const system = [buildSystemPrompt(settings, subagent, context), subagent?.systemPrompt || '']
      .filter(Boolean)
      .join('\n')

    let streamedText = ''
    const stream = client.messages
      .stream({
        model: modelId,
        max_tokens: settings.maxTokens || 1024,
        system,
        messages: [
          { role: 'user', content: input },
          {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: toolUseId,
                name: toolSchema.name,
                input: toolInput
              }
            ]
          },
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: toolUseId,
                content: JSON.stringify(toolResult ?? {})
              }
            ]
          }
        ],
        tools: [toolSchema],
        tool_choice: { type: 'auto' }
      })
      .on('text', text => {
        streamedText += text
        options?.onUpdate?.({ message: streamedText })
      })

    const finalMessage = await stream.finalMessage()
    const rawText = streamedText || extractTextContent(finalMessage.content)
    const toolUse = finalMessage.content?.find(
      (block: any) => block?.type === 'tool_use' && block?.name === toolSchema.name
    ) as { id?: string; input?: any } | undefined
    const toolInputNext = toolUse?.input

    let parsed: z.infer<typeof responseSchema> | null = null
    if (toolInputNext) {
      try {
        parsed = responseSchema.parse(toolInputNext)
      } catch {
        parsed = null
      }
    }

    if (!parsed) {
      const candidate = repairJson(rawText) || rawText
      try {
        parsed = responseSchema.parse(JSON.parse(candidate))
      } catch {
        parsed = null
      }
    }

    if (!parsed) {
      const fallbackContent = rawText.trim() || '已完成任务。'
      return {
        message: {
          id: nanoid(),
          role: 'assistant',
          content: fallbackContent
        },
        actions: []
      }
    }

    if (parsed.memory) {
      updateMemory(parsed.memory)
    }

    const content = parsed.message?.trim() || parsed.steps?.[0]?.trim() || '已完成任务。'
    const actions =
      parsed.actions?.map(action => ({
        ...action,
        id: action.id || nanoid()
      })) || []

    return {
      message: {
        id: nanoid(),
        role: 'assistant',
        content
      },
      actions,
      toolUseId: toolUse?.id,
      toolInput: toolInputNext,
      parallelActions: parsed.parallelActions,
      thoughts: parsed.thoughts,
      steps: parsed.steps
    }
  } catch (error: any) {
    return { error: error?.message || 'Claude Agent 请求失败。' }
  }
}

async function rewriteScreenshotPrompt(options: {
  input: string
  settings: AgentSettings
  subagent?: SubAgentConfig
  context?: { tab?: TabContext }
}): Promise<string> {
  try {
    const client = new Anthropic({
      apiKey: options.settings.apiKey,
      baseURL: options.settings.baseUrl || undefined,
      dangerouslyAllowBrowser: true
    })
    const modelId = selectTaskModel(options.settings, options.subagent, false)
    const system = [
      buildSystemPrompt(options.settings, options.subagent, options.context),
      '你是任务规划助手，请基于用户需求与当前页面上下文，重写用于截图识别的提示词。',
      '输出一句中文提示词，不要包含多余解释。'
    ].join('\n')
    let streamedText = ''
    const stream = client.messages
      .stream({
        model: modelId,
        max_tokens: Math.min(options.settings.maxTokens || 1024, 512),
        system,
        messages: [{ role: 'user', content: options.input }]
      })
      .on('text', text => {
        streamedText += text
      })
    const finalMessage = await stream.finalMessage()
    const rawText = streamedText || extractTextContent(finalMessage.content)
    return rawText.trim() || '请简要描述截图内容，突出可见的关键信息与可操作元素。'
  } catch {
    return '请简要描述截图内容，突出可见的关键信息与可操作元素。'
  }
}

export async function describeScreenshot(
  dataUrl: string,
  input: string,
  settings: AgentSettings,
  subagent?: SubAgentConfig,
  context?: { tab?: TabContext }
): Promise<string> {
  try {
    const client = new Anthropic({
      apiKey: settings.apiKey,
      baseURL: settings.baseUrl || undefined,
      dangerouslyAllowBrowser: true
    })
    const modelId = subagent?.imageModel || settings.imageModel || settings.taskModel
    const prompt = await rewriteScreenshotPrompt({
      input,
      settings,
      subagent,
      context
    })
    const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/)
    if (!match) return ''
    const mediaType = match[1]
    const base64 = match[2]
    let streamedText = ''
    const stream = client.messages
      .stream({
        model: modelId,
        max_tokens: settings.maxTokens || 1024,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
              { type: 'text', text: prompt }
            ]
          }
        ]
      })
      .on('text', text => {
        streamedText += text
      })
    const finalMessage = await stream.finalMessage()
    const rawText = streamedText || extractTextContent(finalMessage.content)
    return rawText.trim()
  } catch {
    return ''
  }
}
