import {
  completeSimple,
  getModel,
  getModels,
  type AssistantMessage,
  type ImageContent,
  type Message,
  type Model
} from '@mariozechner/pi-ai'

import { memoryToPrompt } from './memory'
import { getEnabledBuiltinMcpConfigs } from './skills'
import type { AgentSettings, SubAgentConfig } from './types'
import type { AgentUsage } from './agentUsage'

export type AgentTabContextLike = {
  id?: number
  title?: string
  url?: string
  status?: string
  active?: boolean
  windowId?: number
}

type SupportedProvider =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'mistral'
  | 'openrouter'
  | 'groq'
  | 'xai'
  | 'cerebras'
  | 'zai'
  | 'minimax'
  | 'opencode'
  | 'opencode-go'
  | 'kimi-coding'

const SUPPORTED_PROVIDER_SET = new Set<SupportedProvider>([
  'anthropic',
  'openai',
  'google',
  'mistral',
  'openrouter',
  'groq',
  'xai',
  'cerebras',
  'zai',
  'minimax',
  'opencode',
  'opencode-go',
  'kimi-coding'
])

const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-20250514'

export const resolveMaxTokens = (value: unknown, fallback = 1024): number => {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.floor(parsed)
}

const parseModelReference = (
  rawValue: string,
  fallbackProvider: SupportedProvider
): { provider: SupportedProvider; modelId: string } => {
  const value = rawValue.trim()
  const slashIndex = value.indexOf('/')

  if (slashIndex > 0) {
    const maybeProvider = value.slice(0, slashIndex).trim() as SupportedProvider
    const modelId = value.slice(slashIndex + 1).trim()
    if (SUPPORTED_PROVIDER_SET.has(maybeProvider) && modelId) {
      return { provider: maybeProvider, modelId }
    }
  }

  return {
    provider: fallbackProvider,
    modelId: value || DEFAULT_ANTHROPIC_MODEL
  }
}

const inferProvider = (modelId: string, baseUrl: string): SupportedProvider => {
  const model = modelId.trim().toLowerCase()
  const url = baseUrl.trim().toLowerCase()

  if (model.startsWith('claude')) return 'anthropic'
  if (model.startsWith('gemini')) return 'google'
  if (model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3')) {
    return 'openai'
  }
  if (model.startsWith('mistral')) return 'mistral'
  if (model.startsWith('grok')) return 'xai'
  if (model.startsWith('moonshot') || model.startsWith('kimi')) return 'kimi-coding'

  if (url.includes('anthropic')) return 'anthropic'
  if (url.includes('openrouter')) return 'openrouter'
  if (url.includes('googleapis') || url.includes('generativelanguage')) return 'google'
  if (url.includes('mistral')) return 'mistral'
  if (url.includes('groq')) return 'groq'
  if (url.includes('cerebras')) return 'cerebras'
  if (url.includes('x.ai') || url.includes('xai')) return 'xai'
  if (url.includes('z.ai') || url.includes('zhipu')) return 'zai'
  if (url.includes('minimax')) return 'minimax'
  if (url.includes('kimi') || url.includes('moonshot')) return 'kimi-coding'
  if (url.includes('openai')) return 'openai'

  return 'anthropic'
}

const createFallbackModel = (
  provider: SupportedProvider,
  modelId: string,
  baseUrl: string
): Model<any> => {
  let template: Model<any> | undefined

  try {
    const models = getModels(provider as any) as Model<any>[]
    template = models[0]
  } catch {
    template = undefined
  }

  if (!template) {
    template = getModel('anthropic', DEFAULT_ANTHROPIC_MODEL as any) as Model<any>
  }

  return {
    ...template,
    provider,
    id: modelId,
    name: modelId,
    baseUrl: baseUrl || template.baseUrl
  }
}

export const buildPiModel = (
  settings: AgentSettings,
  subagent: SubAgentConfig | undefined,
  options?: {
    useReasoning?: boolean
    purpose?: 'task' | 'image'
  }
): Model<any> => {
  const useReasoning = options?.useReasoning === true
  const purpose = options?.purpose || 'task'

  const rawModel =
    purpose === 'image'
      ? subagent?.imageModel || settings.imageModel || settings.taskModel
      : useReasoning
        ? subagent?.reasoningModel || settings.reasoningModel || settings.taskModel
        : subagent?.taskModel || settings.taskModel

  const fallbackProvider = inferProvider(rawModel, settings.baseUrl)
  const { provider, modelId } = parseModelReference(rawModel, fallbackProvider)
  const baseUrl = settings.baseUrl.trim()

  try {
    const model = getModel(provider as any, modelId as any) as Model<any>
    if (!model?.api || !model?.provider || !model?.id) {
      throw new Error(`Unknown Pi model: ${provider}/${modelId}`)
    }
    return {
      ...model,
      baseUrl: baseUrl || model.baseUrl
    }
  } catch {
    return createFallbackModel(provider, modelId, baseUrl)
  }
}

export const shouldUseReasoning = (input: string, settings: AgentSettings) => {
  if (!settings.enableThoughts) return false
  return /深度思考|思考模式|think/i.test(input)
}

export const resolveThinkingLevel = (settings: AgentSettings, input: string) =>
  shouldUseReasoning(input, settings) ? 'high' : 'off'

export const buildPiCallOptions = (settings: AgentSettings, input: string) => ({
  apiKey: settings.apiKey.trim() || undefined,
  maxTokens: resolveMaxTokens(settings.maxTokens),
  reasoning: shouldUseReasoning(input, settings) ? ('high' as const) : undefined
})

export const normalizePiUsage = (
  usage: AssistantMessage['usage'] | null | undefined
): AgentUsage => {
  if (!usage) return null
  return {
    input_tokens: Number.isFinite(usage.input) ? usage.input : 0,
    cached_input_tokens: Number.isFinite(usage.cacheRead) ? usage.cacheRead : 0,
    output_tokens: Number.isFinite(usage.output) ? usage.output : 0
  }
}

export const extractAssistantText = (message: AssistantMessage | null | undefined) =>
  (message?.content || [])
    .filter(
      (block): block is Extract<AssistantMessage['content'][number], { type: 'text' }> =>
        block.type === 'text'
    )
    .map(block => block.text)
    .join('')
    .trim()

export const extractAssistantThinking = (message: AssistantMessage | null | undefined) =>
  (message?.content || [])
    .filter(
      (block): block is Extract<AssistantMessage['content'][number], { type: 'thinking' }> =>
        block.type === 'thinking'
    )
    .map(block => block.thinking)
    .join('')
    .trim()

export const dataUrlToImageContent = (dataUrl: string): ImageContent | null => {
  const match = /^data:(.+?);base64,(.+)$/i.exec(dataUrl)
  if (!match) return null
  const [, mimeType, data] = match
  return {
    type: 'image',
    mimeType,
    data
  }
}

export const buildSystemPrompt = (
  settings: AgentSettings,
  subagent?: SubAgentConfig,
  context?: { tab?: AgentTabContextLike }
): string => {
  const lines = [
    '你是浏览器扩展侧边栏里的自动化助手。',
    '优先使用一次 browser_actions 工具调用返回 message、steps、thoughts 与 actions，不要输出 JSON 文本。',
    '每一轮最多调用一次 browser_actions；把本轮需要的动作合并到同一次调用中。',
    'action 只使用以下类型：click, double-click, right-click, hover, focus, blur, scroll, touch, screenshot, navigate, click-dom, input, key, type, drag, select, getDOM。',
    '优先通过直接 DOM 访问获取文字内容或结构信息，再决定截图或滚动。',
    '如果需要操作页面元素，请优先提供 selector；否则使用坐标 x/y。',
    'DOM 查询支持 includeMarkdown，可在获取结构时同时拿到页面文字摘要（markdown）。',
    '尽量自行探索当前页面并执行可行的下一步，不要先向用户索要显而易见的信息。',
    '当不确定页面内容时，优先尝试：获取 DOM 树、截图、滚动或聚焦关键区域，再决定下一步。',
    '仅当确实无法继续时才提问，并给出你需要的具体信息。',
    'steps 与 thoughts 必须基于可观察证据（当前页面、DOM、截图结果），不要猜测或编造。',
    '若证据不足，用“待确认”表述，不要下结论。',
    'DOM 探索工作流：先执行 getDOM（建议 includeMarkdown=true），再定位目标元素并生成 selector。',
    'DOM 探索工作流：优先依据 id、name、data-testid、aria-label、role 等稳定属性构造 selector。',
    'DOM 探索工作流：目标不唯一时先缩小范围（局部 selector + 再次 getDOM），必要时滚动后重复 getDOM。',
    'DOM 探索工作流：仅在 DOM 信息不足时才截图，且截图后仍需回到 DOM 证据。',
    'DOM 探索工作流：执行关键动作前后都应给出可验证依据（步骤描述与后置验证）。'
  ]

  if (settings.enableThoughts) {
    lines.push('如果模型支持 reasoning，可将简短思考摘要放入 thoughts 数组。')
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

  if (subagent?.systemPrompt) {
    lines.push(subagent.systemPrompt)
  }

  const memoryLine = memoryToPrompt()
  if (memoryLine) lines.push(memoryLine)

  if (settings.enableMcp) {
    const builtinServers = getEnabledBuiltinMcpConfigs()
    const allMcpServers = [...builtinServers, ...settings.mcpServers]
    const enabledServers = allMcpServers.filter(server => {
      if (!server.enabled) return false
      const scope = subagent?.mcpServerIds
      if (scope && scope.length > 0) return scope.includes(server.id)
      return true
    })
    if (enabledServers.length > 0) {
      lines.push(
        `可用 MCP 服务：${enabledServers.map(server => server.name).join(', ')}`,
        'MCP 工具已自动注册为 tool，可直接调用。',
        '当需要搜索、文档查询或站外能力时，直接调用对应的 MCP 工具，不要用自然语言描述伪调用。'
      )
    }
  }

  return lines.join('\n')
}

const createUserTextMessage = (text: string): Message => ({
  role: 'user',
  content: text,
  timestamp: Date.now()
})

const createUserImageMessage = (text: string, image: ImageContent): Message => ({
  role: 'user',
  content: [{ type: 'text', text }, image],
  timestamp: Date.now()
})

export const runSimpleTextPrompt = async (options: {
  prompt: string
  systemPrompt: string
  settings: AgentSettings
  subagent?: SubAgentConfig
  purpose?: 'task' | 'image'
}) => {
  const model = buildPiModel(options.settings, options.subagent, {
    useReasoning: shouldUseReasoning(options.prompt, options.settings),
    purpose: options.purpose || 'task'
  })

  return completeSimple(
    model,
    {
      systemPrompt: options.systemPrompt,
      messages: [createUserTextMessage(options.prompt)]
    },
    buildPiCallOptions(options.settings, options.prompt)
  )
}

export const runSimpleVisionPrompt = async (options: {
  prompt: string
  image: ImageContent
  systemPrompt: string
  settings: AgentSettings
  subagent?: SubAgentConfig
}) => {
  const model = buildPiModel(options.settings, options.subagent, {
    useReasoning: false,
    purpose: 'image'
  })

  return completeSimple(
    model,
    {
      systemPrompt: options.systemPrompt,
      messages: [createUserImageMessage(options.prompt, options.image)]
    },
    buildPiCallOptions(options.settings, options.prompt)
  )
}
