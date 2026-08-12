import { nanoid } from 'nanoid'

import { completeBrowserAi } from './browserAiClient'
import type {
  AgentTool,
  AgentToolResult,
  AiMessage,
  AiToolCallContent,
  AssistantMessage,
  ImageContent
} from './aiTypes'
import { beginContext, endContext } from './agentContext'
import {
  mergeParsedPayloads,
  parseResponsePayload,
  toolSchema,
  type AgentToolPayload
} from './agentPayload'
import { callMcpTool, discoverAllMcpTools, mcpToolToJsonSchemaTool } from './mcpClient'
import {
  buildPiCallOptions,
  buildPiModel,
  buildSystemPrompt,
  extractAssistantText,
  extractAssistantThinking,
  normalizePiUsage,
  resolveActiveApiKey,
  type AgentTabContextLike
} from './piSupport'
import {
  discoverAllSkills,
  getEnabledBuiltinMcpConfigs,
  getSuggestedSkills,
  recommendSkills,
  type Skill
} from './skills'
import { updateMemory } from './memory'
import {
  buildPluginSystemPromptSection,
  collectPluginTools,
  type PluginRuntimeContext
} from './plugins'
import { createBrowserVmTool } from './browserVm'
import type { AgentStreamUpdate } from './agentStreaming'
import type { AgentUsage } from './agentUsage'
import type {
  AgentAction,
  AgentActionResult,
  AgentMessage,
  AgentPermissions,
  AgentSettings,
  SubAgentConfig
} from './types'

export interface AgentRunResult {
  threadId?: string
  message?: AgentMessage
  actions?: AgentAction[]
  toolUseId?: string
  toolInput?: AgentToolPayload
  toolUseIds?: string[]
  toolInputs?: AgentToolPayload[]
  parallelActions?: boolean
  thoughts?: string[]
  steps?: string[]
  usage?: AgentUsage
  error?: string
}

type PendingBrowserTool = {
  toolUseIds: string[]
  toolInputs: AgentToolPayload[]
}

type StoredThreadState = {
  messages: AiMessage[]
  pendingTool?: PendingBrowserTool
}

type ThreadRuntime = {
  id: string
  messages: AiMessage[]
  settings: AgentSettings
  subagent?: SubAgentConfig
  context?: { tab?: AgentTabContextLike }
  pendingTool?: PendingBrowserTool
  systemPrompt: string
  model: ReturnType<typeof buildPiModel>
  tools: AgentTool<any, any>[]
}

type RunOptions = {
  onUpdate?: (update: AgentStreamUpdate) => void
  sessionId?: string
  isolated?: boolean
  images?: ImageContent[]
}

const THREAD_STORAGE_PREFIX = 'pi-agent-thread-v2:'
const runtimeRegistry = new Map<string, ThreadRuntime>()

const DEFAULT_RUNTIME_PERMISSIONS: AgentPermissions = {
  click: true,
  scroll: true,
  touch: false,
  screenshot: true,
  navigate: true,
  tabs: true,
  debugger: true,
  clickDom: true,
  input: true,
  fileAccess: true
}

const cloneMessages = (messages: AiMessage[]): AiMessage[] =>
  JSON.parse(
    JSON.stringify(
      messages.map(message => {
        if (message.role !== 'user' || !Array.isArray(message.content)) return message
        const imageCount = message.content.filter(block => block.type === 'image').length
        if (!imageCount) return message
        return {
          ...message,
          content: [
            ...message.content.filter(block => block.type !== 'image'),
            {
              type: 'text',
              text: `[${imageCount} 张用户图片已用于本轮视觉上下文，原始数据未持久化]`
            }
          ]
        }
      })
    )
  )

const normalizeStoredMessages = (messages: unknown): AiMessage[] => {
  if (!Array.isArray(messages)) return []
  return messages
    .filter(item => item && typeof item === 'object')
    .map(item => {
      const message = item as Record<string, unknown>
      if (message.role === 'toolResult') {
        return {
          role: 'tool' as const,
          content: Array.isArray(message.content)
            ? message.content
                .filter(block => (block as Record<string, unknown>)?.type === 'text')
                .map(block => String((block as Record<string, unknown>).text || ''))
                .join('')
            : String(message.content || ''),
          toolCallId: typeof message.toolCallId === 'string' ? message.toolCallId : undefined,
          toolName: typeof message.toolName === 'string' ? message.toolName : undefined,
          isError: message.isError === true
        }
      }
      return message as unknown as AiMessage
    })
}

const readStoredThreadState = (threadId: string): StoredThreadState | null => {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(`${THREAD_STORAGE_PREFIX}${threadId}`)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<StoredThreadState>
    return {
      messages: normalizeStoredMessages(parsed.messages),
      pendingTool: parsed.pendingTool
    }
  } catch {
    return null
  }
}

const writeStoredThreadState = (threadId: string, state: StoredThreadState) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(`${THREAD_STORAGE_PREFIX}${threadId}`, JSON.stringify(state))
}

const clearStoredPendingTool = (threadId: string) => {
  const stored = readStoredThreadState(threadId)
  if (!stored) return
  writeStoredThreadState(threadId, { messages: stored.messages })
}

const normalizeActions = (actions: AgentToolPayload['actions'] | undefined): AgentAction[] =>
  (actions || []).map(action => ({ ...action, id: action.id || nanoid() }) as AgentAction)

const normalizeToolPayload = (payload: AgentToolPayload | null): AgentToolPayload | null => {
  if (!payload) return null
  if (payload.actions?.length) payload.actions = normalizeActions(payload.actions)
  return payload
}

const emitUpdate = (
  onUpdate: ((update: AgentStreamUpdate) => void) | undefined,
  payload: AgentStreamUpdate
) => {
  if (!onUpdate) return
  if (!payload.message && !payload.thoughts && !payload.steps && !payload.actions) return
  onUpdate(payload)
}

const buildResultMessage = (
  threadId: string,
  payload: AgentToolPayload | null,
  assistantText: string,
  usage: AgentUsage,
  toolUseIds: string[] = [],
  toolInputs: AgentToolPayload[] = []
): AgentRunResult => {
  const content =
    payload?.message?.trim() ||
    assistantText.trim() ||
    payload?.steps?.[0]?.trim() ||
    '已完成任务。'
  return {
    threadId,
    message: { id: nanoid(), role: 'assistant', content },
    actions: normalizeActions(payload?.actions),
    toolUseIds,
    toolInputs,
    toolUseId: toolUseIds[0],
    toolInput: toolInputs[0],
    parallelActions: payload?.parallelActions,
    thoughts: payload?.thoughts,
    steps: payload?.steps,
    usage
  }
}

const extractBrowserPayload = (message: AssistantMessage) => {
  const browserToolCalls = message.content.filter(
    (block): block is AiToolCallContent =>
      block.type === 'toolCall' && block.name === toolSchema.name
  )
  const toolInputs = browserToolCalls
    .map(block => normalizeToolPayload(parseResponsePayload(block.arguments)))
    .filter((payload): payload is AgentToolPayload => Boolean(payload))
  return {
    merged: normalizeToolPayload(mergeParsedPayloads(toolInputs)),
    toolUseIds: browserToolCalls.map(block => block.id),
    toolInputs
  }
}

const getScopedEnabledMcpServers = (settings: AgentSettings, subagent?: SubAgentConfig) => {
  const allMcpServers = [...getEnabledBuiltinMcpConfigs(), ...(settings.mcpServers || [])]
  return allMcpServers.filter(server => {
    if (!server.enabled) return false
    const scope = subagent?.mcpServerIds
    return !scope || scope.length === 0 || scope.includes(server.id)
  })
}

const dedupeSkills = (skills: Skill[]): Skill[] => {
  const seen = new Set<string>()
  return skills.filter(skill => {
    if (seen.has(skill.id)) return false
    seen.add(skill.id)
    return true
  })
}

const formatMcpToolName = (skill: Skill): string | null => {
  if (!skill.mcpServerId || !skill.mcpToolName) return null
  return `mcp__${skill.mcpServerId}__${skill.mcpToolName.replace(/[^a-zA-Z0-9_-]/g, '_')}`
}

const buildRuntimeSkillPromptSection = (skills: Skill[]): string => {
  if (!skills.length) return ''
  const lines = [
    '## 当前任务更适合优先考虑的 MCP tools',
    '浏览器页面内操作仍优先使用 browser_actions 或 browser_vm；只有在需要搜索、文档查询、站外能力或外部自动化时，再直接调用下列 MCP tool。',
    '如果能力匹配，请直接调用对应 tool，不要只在自然语言里描述“将要调用”。'
  ]
  for (const skill of skills) {
    const name = formatMcpToolName(skill)
    if (name) lines.push(`- ${skill.name}: ${skill.description}（tool=${name}）`)
  }
  lines.push('仅在当前任务明确相关时调用，并确保传入参数与用户目标一致。')
  return lines.join('\n')
}

const buildRuntimeSystemPrompt = async (
  input: string,
  settings: AgentSettings,
  subagent?: SubAgentConfig,
  context?: { tab?: AgentTabContextLike }
): Promise<string> => {
  const basePrompt = buildSystemPrompt(settings, subagent, context)
  const pluginCtx: PluginRuntimeContext = { settings, subagent, tab: context?.tab }
  const pluginSection = buildPluginSystemPromptSection(pluginCtx)
  const withPlugins = (prompt: string) => (pluginSection ? `${prompt}\n\n${pluginSection}` : prompt)
  if (!settings.enableMcp) return withPlugins(basePrompt)
  const servers = getScopedEnabledMcpServers(settings, subagent)
  if (!servers.length) return withPlugins(basePrompt)
  try {
    const allowed = new Set(servers.map(server => server.id))
    const skills = (await discoverAllSkills(settings.mcpServers || [])).filter(
      skill =>
        skill.enabled && skill.mcpServerId && skill.mcpToolName && allowed.has(skill.mcpServerId)
    )
    if (!skills.length) return withPlugins(basePrompt)
    const suggested = getSuggestedSkills(input, skills, 4)
    const recommended = recommendSkills(
      {
        currentUrl: context?.tab?.url,
        pageContent: [context?.tab?.title, input].filter(Boolean).join('\n')
      },
      skills
    ).slice(0, 4)
    const section = buildRuntimeSkillPromptSection(
      dedupeSkills([...suggested, ...recommended]).slice(0, 4)
    )
    return withPlugins(section ? `${basePrompt}\n\n${section}` : basePrompt)
  } catch (error) {
    console.warn('[Browser AI Runtime] Failed to build runtime skill prompt:', error)
    return withPlugins(basePrompt)
  }
}

const createThreadRuntime = (
  threadId: string,
  settings: AgentSettings,
  subagent: SubAgentConfig | undefined,
  context: { tab?: AgentTabContextLike } | undefined
): ThreadRuntime => {
  const stored = readStoredThreadState(threadId)
  const runtime: ThreadRuntime = {
    id: threadId,
    messages: stored?.messages || [],
    pendingTool: stored?.pendingTool,
    settings,
    subagent,
    context,
    systemPrompt: buildSystemPrompt(settings, subagent, context),
    model: buildPiModel(settings, subagent),
    tools: []
  }
  runtimeRegistry.set(threadId, runtime)
  return runtime
}

const getOrCreateThreadRuntime = (
  threadId: string,
  settings: AgentSettings,
  subagent: SubAgentConfig | undefined,
  context: { tab?: AgentTabContextLike } | undefined
) => {
  const existing = runtimeRegistry.get(threadId)
  if (existing) {
    existing.settings = settings
    existing.subagent = subagent
    existing.context = context
    return existing
  }
  return createThreadRuntime(threadId, settings, subagent, context)
}

const getRuntimePermissions = (runtime: ThreadRuntime): AgentPermissions =>
  runtime.subagent?.permissions || DEFAULT_RUNTIME_PERMISSIONS

const buildTools = async (runtime: ThreadRuntime): Promise<AgentTool<any, any>[]> => {
  const pluginCtx: PluginRuntimeContext = {
    settings: runtime.settings,
    subagent: runtime.subagent,
    tab: runtime.context?.tab
  }
  const browserActionsTool: AgentTool<any, any> = {
    name: toolSchema.name,
    label: 'Browser Actions',
    description: toolSchema.description,
    parameters: toolSchema.input_schema as Record<string, unknown>,
    execute: async () => ({
      content: [{ type: 'text', text: 'browser_actions 将由侧边栏批准后执行。' }]
    })
  }
  const browserVmTool = createBrowserVmTool({
    permissions: getRuntimePermissions(runtime),
    settings: runtime.settings,
    targetTabId: runtime.context?.tab?.id
  })
  const tools: AgentTool<any, any>[] = [browserActionsTool, browserVmTool]
  tools.push(...(await collectPluginTools(pluginCtx)))

  if (!runtime.settings.enableMcp) return tools
  const servers = getScopedEnabledMcpServers(runtime.settings, runtime.subagent)
  if (!servers.length) return tools
  for (const discovered of await discoverAllMcpTools(servers)) {
    const proxy = mcpToolToJsonSchemaTool(
      discovered.serverId,
      discovered.serverName,
      discovered.tool
    )
    const server = servers.find(item => item.id === discovered.serverId)
    if (!server) continue
    tools.push({
      name: proxy.name,
      label: `${discovered.serverName}: ${discovered.tool.name}`,
      description: proxy.description,
      parameters: proxy.input_schema as Record<string, unknown>,
      execute: async (_toolCallId, params) => {
        const result = await callMcpTool(
          server,
          discovered.tool.name,
          params as Record<string, unknown>
        )
        if (result.error) throw new Error(result.error)
        return {
          content: [
            {
              type: 'text',
              text:
                typeof result.result === 'string'
                  ? result.result
                  : JSON.stringify(result.result, null, 2)
            }
          ],
          details: {
            kind: 'mcp',
            serverId: discovered.serverId,
            toolName: discovered.tool.name,
            raw: result.result
          }
        }
      }
    })
  }
  return tools
}

const syncRuntimeConfig = async (runtime: ThreadRuntime, input: string) => {
  runtime.systemPrompt = await buildRuntimeSystemPrompt(
    input,
    runtime.settings,
    runtime.subagent,
    runtime.context
  )
  runtime.model = buildPiModel(runtime.settings, runtime.subagent, {
    useReasoning: runtime.settings.enableThoughts && /深度思考|思考模式|think/i.test(input)
  })
  runtime.tools = await buildTools(runtime)
}

const toolResultText = (result: AgentToolResult) => {
  const content = result.content
    ?.map(item => item.text)
    .join('\n')
    .trim()
  if (content) return content
  return JSON.stringify(result.details ?? result)
}

const appendToolResult = (
  runtime: ThreadRuntime,
  call: AiToolCallContent,
  result: AgentToolResult
) => {
  runtime.messages.push({
    role: 'tool',
    content: toolResultText(result),
    toolCallId: call.id,
    toolName: call.name,
    isError: result.isError === true,
    timestamp: Date.now()
  })
}

const buildUserMessage = (input: string, images?: ImageContent[]): AiMessage => ({
  role: 'user',
  content: images?.length ? [{ type: 'text', text: input }, ...images] : input,
  timestamp: Date.now()
})

const persistRuntime = (runtime: ThreadRuntime) => {
  writeStoredThreadState(runtime.id, {
    messages: cloneMessages(runtime.messages),
    pendingTool: runtime.pendingTool
  })
}

const finalizeAssistant = (
  runtime: ThreadRuntime,
  assistant: AssistantMessage,
  usage: AgentUsage
): AgentRunResult => {
  const text = extractAssistantText(assistant)
  const parsed = parseResponsePayload(text)
  return buildResultMessage(runtime.id, parsed, text, usage)
}

const runModelLoop = async (
  runtime: ThreadRuntime,
  input: string,
  onUpdate?: (update: AgentStreamUpdate) => void
): Promise<AgentRunResult> => {
  let latest: AssistantMessage | null = null
  let usage: AgentUsage = null

  for (let round = 0; round < 8; round += 1) {
    let streamedText = ''
    let streamedThinking = ''
    const assistant = await completeBrowserAi({
      model: runtime.model,
      systemPrompt: runtime.systemPrompt,
      messages: runtime.messages,
      tools: runtime.tools,
      options: {
        ...buildPiCallOptions(runtime.settings, input),
        onDelta: delta => {
          if (delta.text) {
            streamedText += delta.text
            emitUpdate(onUpdate, { message: streamedText })
          }
          if (delta.thinking) {
            streamedThinking += delta.thinking
            emitUpdate(onUpdate, { thoughts: [streamedThinking] })
          }
        }
      }
    })
    latest = assistant
    usage = normalizePiUsage(assistant.usage)
    runtime.messages.push(assistant)

    const browser = extractBrowserPayload(assistant)
    if (browser.toolUseIds.length > 0 && browser.toolInputs.length > 0) {
      if (browser.merged?.memory) updateMemory(browser.merged.memory)
      runtime.pendingTool = { toolUseIds: browser.toolUseIds, toolInputs: browser.toolInputs }
      persistRuntime(runtime)
      const result = buildResultMessage(
        runtime.id,
        browser.merged,
        extractAssistantText(assistant),
        usage,
        browser.toolUseIds,
        browser.toolInputs
      )
      emitUpdate(onUpdate, {
        message:
          browser.merged?.message || extractAssistantText(assistant) || streamedText || undefined,
        thoughts:
          browser.merged?.thoughts ||
          (extractAssistantThinking(assistant) ? [extractAssistantThinking(assistant)] : undefined),
        steps: browser.merged?.steps,
        actions: normalizeActions(browser.merged?.actions),
        parallelActions: browser.merged?.parallelActions
      })
      return result
    }

    const calls = assistant.content.filter(
      (block): block is AiToolCallContent => block.type === 'toolCall'
    )
    if (!calls.length) {
      persistRuntime(runtime)
      return finalizeAssistant(runtime, assistant, usage)
    }

    for (const call of calls) {
      const tool = runtime.tools.find(item => item.name === call.name)
      if (!tool) {
        appendToolResult(runtime, call, {
          content: [{ type: 'text', text: `未知工具：${call.name}` }],
          isError: true
        })
        continue
      }
      try {
        const result = await tool.execute(call.id, call.arguments)
        appendToolResult(runtime, call, result)
      } catch (error) {
        appendToolResult(runtime, call, {
          content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
          isError: true
        })
      }
    }
    persistRuntime(runtime)
  }

  if (latest) return finalizeAssistant(runtime, latest, usage)
  return buildResultMessage(runtime.id, null, '', null)
}

const withThreadId = (threadId: string, result: AgentRunResult): AgentRunResult => ({
  threadId,
  ...result
})

const failWithContext = (
  threadId: string,
  executionContextId: string,
  error: unknown
): AgentRunResult => {
  const message = error instanceof Error ? error.message : '浏览器 AI Agent 请求失败。'
  endContext(executionContextId, { success: false, error: message })
  return withThreadId(threadId, { error: message })
}

export async function runPiAgentMessage(
  input: string,
  settings: AgentSettings,
  subagent?: SubAgentConfig,
  context?: { tab?: AgentTabContextLike },
  options?: RunOptions
): Promise<AgentRunResult> {
  const threadId = options?.sessionId || nanoid()
  if (!resolveActiveApiKey(settings)) {
    return withThreadId(threadId, { error: '请先在设置中填写 AI API Key。' })
  }
  const executionContextId = beginContext(subagent ? 'subagent' : 'master', input, {
    sessionId: threadId,
    agentId: subagent?.id,
    agentName: subagent?.name,
    isolated: options?.isolated ?? Boolean(subagent)
  })
  try {
    const runtime = getOrCreateThreadRuntime(threadId, settings, subagent, context)
    await syncRuntimeConfig(runtime, input)
    runtime.messages.push(buildUserMessage(input, options?.images))
    const result = await runModelLoop(runtime, input, options?.onUpdate)
    endContext(executionContextId, { success: true, output: result.message?.content || '' })
    return result
  } catch (error) {
    return failWithContext(threadId, executionContextId, error)
  }
}

export async function runPiAgentFollowup(
  input: string,
  toolUses: { id: string; input: AgentToolPayload }[],
  toolResult: AgentActionResult[],
  settings: AgentSettings,
  subagent?: SubAgentConfig,
  context?: { tab?: AgentTabContextLike },
  options?: RunOptions
): Promise<AgentRunResult> {
  const threadId = options?.sessionId || nanoid()
  const executionContextId = beginContext(subagent ? 'subagent' : 'master', input, {
    sessionId: threadId,
    agentId: subagent?.id,
    agentName: subagent?.name,
    isolated: options?.isolated ?? Boolean(subagent)
  })
  try {
    if (!resolveActiveApiKey(settings)) throw new Error('请先在设置中填写 AI API Key。')
    const runtime = getOrCreateThreadRuntime(threadId, settings, subagent, context)
    await syncRuntimeConfig(runtime, input)
    const stored = runtime.pendingTool || readStoredThreadState(threadId)?.pendingTool
    const effectiveUses = toolUses.length
      ? toolUses
      : (stored?.toolUseIds || [])
          .map((id, index) => ({ id, input: stored?.toolInputs[index] }))
          .filter((item): item is { id: string; input: AgentToolPayload } => Boolean(item.input))
    if (!effectiveUses.length) throw new Error('工具调用信息缺失，无法继续。')

    for (const use of effectiveUses) {
      const actionIds = (use.input.actions || []).map(action => action.id).filter(Boolean)
      const filtered = actionIds.length
        ? toolResult.filter(result => actionIds.includes(result.id))
        : toolResult
      runtime.messages.push({
        role: 'tool',
        toolCallId: use.id,
        toolName: toolSchema.name,
        content: JSON.stringify(filtered),
        isError: filtered.some(result => Boolean(result.error)),
        timestamp: Date.now()
      })
    }
    runtime.pendingTool = undefined
    clearStoredPendingTool(threadId)
    persistRuntime(runtime)
    const result = await runModelLoop(runtime, input, options?.onUpdate)
    endContext(executionContextId, { success: true, output: result.message?.content || '' })
    return result
  } catch (error) {
    return failWithContext(threadId, executionContextId, error)
  }
}
