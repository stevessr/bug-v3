import {
  Agent,
  type AgentTool,
  type AgentToolResult,
  type AgentMessage as PiAgentMessage
} from '@mariozechner/pi-agent-core'
import {
  Type,
  type AssistantMessage,
  type Message,
  type ToolResultMessage
} from '@mariozechner/pi-ai'
import { nanoid } from 'nanoid'

import { beginContext, endContext } from './agentContext'
import {
  mergeParsedPayloads,
  parseResponsePayload,
  toolSchema,
  type AgentToolPayload
} from './agentPayload'
import { callMcpTool, discoverAllMcpTools, mcpToolToAnthropicTool } from './mcpClient'
import {
  buildPiModel,
  buildSystemPrompt,
  extractAssistantText,
  extractAssistantThinking,
  normalizePiUsage,
  resolveThinkingLevel,
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
import type { AgentStreamUpdate } from './agentStreaming'
import type { AgentUsage } from './agentUsage'
import type {
  AgentAction,
  AgentActionResult,
  AgentMessage,
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

type ThreadRuntime = {
  id: string
  agent: Agent
  settings: AgentSettings
  subagent?: SubAgentConfig
  context?: { tab?: AgentTabContextLike }
  pendingTool?: PendingBrowserTool
}

type PendingBrowserTool = {
  toolUseIds: string[]
  toolInputs: AgentToolPayload[]
  resolve: (result: AgentToolResult<{ kind: 'browser_actions' }>) => void
  reject: (error?: unknown) => void
}

type StoredThreadState = {
  messages: Message[]
  pendingTool?: {
    toolUseIds: string[]
    toolInputs: AgentToolPayload[]
  }
}

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
  settled: () => boolean
}

type RunEventState = {
  lastAssistantMessage: AssistantMessage | null
  lastAssistantText: string
  lastReasoningText: string
  lastPayload: AgentToolPayload | null
  lastToolUseIds: string[]
  lastToolInputs: AgentToolPayload[]
  usage: AgentUsage
}

type RunOptions = {
  onUpdate?: (update: AgentStreamUpdate) => void
  sessionId?: string
  isolated?: boolean
}

const THREAD_STORAGE_PREFIX = 'pi-agent-thread-v2:'
const runtimeRegistry = new Map<string, ThreadRuntime>()

const createDeferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  let settled = false
  const promise = new Promise<T>((res, rej) => {
    resolve = value => {
      if (settled) return
      settled = true
      res(value)
    }
    reject = reason => {
      if (settled) return
      settled = true
      rej(reason)
    }
  })
  return {
    promise,
    resolve,
    reject,
    settled: () => settled
  }
}

const cloneMessages = (messages: PiAgentMessage[]): Message[] =>
  JSON.parse(JSON.stringify(messages))

const readStoredThreadState = (threadId: string): StoredThreadState | null => {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(`${THREAD_STORAGE_PREFIX}${threadId}`)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredThreadState
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
  writeStoredThreadState(threadId, {
    messages: stored.messages,
    pendingTool: undefined
  })
}

const normalizeActions = (actions: AgentToolPayload['actions'] | undefined): AgentAction[] =>
  (actions || []).map(action => ({ ...action, id: action.id || nanoid() }) as AgentAction)

const normalizeToolPayload = (payload: AgentToolPayload | null): AgentToolPayload | null => {
  if (!payload) return null
  if (payload.actions?.length) {
    payload.actions = normalizeActions(payload.actions)
  }
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
  payload: AgentToolPayload | null,
  assistantText: string,
  usage: AgentUsage
): AgentRunResult => {
  const content =
    payload?.message?.trim() ||
    assistantText.trim() ||
    payload?.steps?.[0]?.trim() ||
    '已完成任务。'

  return {
    message: {
      id: nanoid(),
      role: 'assistant',
      content
    },
    actions: normalizeActions(payload?.actions),
    toolUseId: payload ? undefined : undefined,
    toolInput: payload || undefined,
    toolUseIds: undefined,
    toolInputs: payload ? [payload] : undefined,
    parallelActions: payload?.parallelActions,
    thoughts: payload?.thoughts,
    steps: payload?.steps,
    usage
  }
}

const extractBrowserPayload = (message: AssistantMessage | null) => {
  if (!message) {
    return {
      merged: null as AgentToolPayload | null,
      toolUseIds: [] as string[],
      toolInputs: [] as AgentToolPayload[]
    }
  }

  const browserToolCalls = message.content.filter(
    (block): block is Extract<AssistantMessage['content'][number], { type: 'toolCall' }> =>
      block.type === 'toolCall' && block.name === toolSchema.name
  )

  const toolInputs = browserToolCalls
    .map(block => normalizeToolPayload(parseResponsePayload(block.arguments)))
    .filter((payload): payload is AgentToolPayload => Boolean(payload))
  const toolUseIds = browserToolCalls.map(block => block.id)
  const merged = normalizeToolPayload(mergeParsedPayloads(toolInputs))

  return {
    merged,
    toolUseIds,
    toolInputs
  }
}

const serializeToolResultContent = (
  toolUses: { id: string; input: AgentToolPayload }[],
  results: AgentActionResult[]
): ToolResultMessage[] =>
  toolUses.map(use => {
    const actionIds = (use.input.actions || [])
      .map(action => action.id)
      .filter((id): id is string => typeof id === 'string')
    const filteredResults = actionIds.length
      ? results.filter(result => actionIds.includes(result.id))
      : results

    return {
      role: 'toolResult',
      toolCallId: use.id,
      toolName: toolSchema.name,
      content: [
        {
          type: 'text',
          text: JSON.stringify(filteredResults)
        }
      ],
      details: { kind: 'browser_actions' as const, results: filteredResults },
      isError: filteredResults.some(result => result.error),
      timestamp: Date.now()
    }
  })

const getScopedEnabledMcpServers = (settings: AgentSettings, subagent?: SubAgentConfig) => {
  const builtinServers = getEnabledBuiltinMcpConfigs()
  const allMcpServers = [...builtinServers, ...settings.mcpServers]

  return allMcpServers.filter(server => {
    if (!server.enabled) return false
    const scope = subagent?.mcpServerIds
    if (scope && scope.length > 0) return scope.includes(server.id)
    return true
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
  const safeToolName = skill.mcpToolName.replace(/[^a-zA-Z0-9_-]/g, '_')
  return `mcp__${skill.mcpServerId}__${safeToolName}`
}

const buildRuntimeSkillPromptSection = (skills: Skill[]): string => {
  if (!skills.length) return ''

  const lines = [
    '## 当前任务更适合优先考虑的 MCP tools',
    '浏览器页面内操作仍优先使用 browser_actions；只有在需要搜索、文档查询、站外能力或外部自动化时，再直接调用下列 MCP tool。',
    '如果能力匹配，请直接调用对应 tool，不要只在自然语言里描述“将要调用”。'
  ]

  for (const skill of skills) {
    const toolName = formatMcpToolName(skill)
    if (!toolName) continue
    lines.push(`- ${skill.name}: ${skill.description}（tool=${toolName}）`)
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

  if (!settings.enableMcp) return basePrompt

  const enabledServers = getScopedEnabledMcpServers(settings, subagent)
  if (!enabledServers.length) return basePrompt

  try {
    const allowedServerIds = new Set(enabledServers.map(server => server.id))
    const allSkills = await discoverAllSkills(settings.mcpServers)
    const callableSkills = allSkills.filter(
      skill =>
        skill.enabled &&
        skill.mcpServerId &&
        skill.mcpToolName &&
        allowedServerIds.has(skill.mcpServerId)
    )

    if (!callableSkills.length) return basePrompt

    const suggestedSkills = getSuggestedSkills(input, callableSkills, 4)
    const recommendedSkills = recommendSkills(
      {
        currentUrl: context?.tab?.url,
        pageContent: [context?.tab?.title, input].filter(Boolean).join('\n')
      },
      callableSkills
    ).slice(0, 4)

    const promptSkills = dedupeSkills([...suggestedSkills, ...recommendedSkills]).slice(0, 4)
    const skillSection = buildRuntimeSkillPromptSection(promptSkills)

    return skillSection ? `${basePrompt}\n\n${skillSection}` : basePrompt
  } catch (error) {
    console.warn('[Pi Runtime] Failed to build runtime skill prompt:', error)
    return basePrompt
  }
}

const createThreadRuntime = (
  threadId: string,
  settings: AgentSettings,
  subagent: SubAgentConfig | undefined,
  context: { tab?: AgentTabContextLike } | undefined,
  input: string
) => {
  const stored = readStoredThreadState(threadId)
  const runtime: ThreadRuntime = {
    id: threadId,
    settings,
    subagent,
    context,
    agent: new Agent({
      initialState: {
        systemPrompt: buildSystemPrompt(settings, subagent, context),
        model: buildPiModel(settings, subagent, {
          useReasoning: resolveThinkingLevel(settings, input) !== 'off'
        }),
        thinkingLevel: resolveThinkingLevel(settings, input),
        messages: (stored?.messages || []) as any,
        tools: []
      },
      getApiKey: async _provider => runtime.settings.apiKey.trim() || undefined
    })
  }

  if (stored?.pendingTool?.toolUseIds.length && stored.pendingTool.toolInputs.length) {
    runtime.pendingTool = {
      toolUseIds: stored.pendingTool.toolUseIds,
      toolInputs: stored.pendingTool.toolInputs,
      resolve: () => undefined,
      reject: () => undefined
    }
  }

  runtimeRegistry.set(threadId, runtime)
  return runtime
}

const getOrCreateThreadRuntime = (
  threadId: string,
  settings: AgentSettings,
  subagent: SubAgentConfig | undefined,
  context: { tab?: AgentTabContextLike } | undefined,
  input: string
) => {
  const existing = runtimeRegistry.get(threadId)
  if (existing) {
    existing.settings = settings
    existing.subagent = subagent
    existing.context = context
    return existing
  }
  return createThreadRuntime(threadId, settings, subagent, context, input)
}

const syncRuntimeConfig = async (
  runtime: ThreadRuntime,
  input: string,
  suspendResult: Deferred<AgentRunResult | null>
) => {
  runtime.agent.state.systemPrompt = await buildRuntimeSystemPrompt(
    input,
    runtime.settings,
    runtime.subagent,
    runtime.context
  )
  runtime.agent.state.model = buildPiModel(runtime.settings, runtime.subagent, {
    useReasoning: resolveThinkingLevel(runtime.settings, input) !== 'off'
  })
  runtime.agent.state.thinkingLevel = resolveThinkingLevel(runtime.settings, input)
  runtime.agent.state.tools = await buildTools(runtime, suspendResult)
}

const buildTools = async (
  runtime: ThreadRuntime,
  suspendResult: Deferred<AgentRunResult | null>
) => {
  const browserActionsTool = {
    name: toolSchema.name,
    label: 'Browser Actions',
    description: toolSchema.description,
    parameters: Type.Unsafe<Record<string, unknown>>(
      toolSchema.input_schema as Record<string, unknown>
    ),
    execute: async (toolCallId: string, params: Record<string, unknown>) => {
      const parsed = normalizeToolPayload(parseResponsePayload(params))
      const mergedPayload = parsed || runtime.pendingTool?.toolInputs[0] || null
      const toolUseIds =
        runtime.pendingTool?.toolUseIds.length && runtime.pendingTool.toolUseIds[0]
          ? runtime.pendingTool.toolUseIds
          : [toolCallId]
      const toolInputs = parsed ? [parsed] : runtime.pendingTool?.toolInputs || []

      if (mergedPayload?.memory) {
        updateMemory(mergedPayload.memory)
      }

      writeStoredThreadState(runtime.id, {
        messages: cloneMessages(runtime.agent.state.messages),
        pendingTool:
          toolUseIds.length > 0 && toolInputs.length > 0
            ? {
                toolUseIds,
                toolInputs
              }
            : undefined
      })

      const livePromise = new Promise<AgentToolResult<{ kind: 'browser_actions' }>>(
        (resolve, reject) => {
          runtime.pendingTool = {
            toolUseIds,
            toolInputs,
            resolve,
            reject
          }
        }
      )

      const partialResult = buildResultMessage(
        mergedPayload,
        runtime.agent.state.streamMessage && 'content' in runtime.agent.state.streamMessage
          ? extractAssistantText(runtime.agent.state.streamMessage as AssistantMessage)
          : '',
        null
      )

      partialResult.toolUseId = toolCallId
      partialResult.toolUseIds = toolUseIds
      partialResult.toolInput = parsed || toolInputs[0]
      partialResult.toolInputs = toolInputs

      if (!suspendResult.settled()) {
        suspendResult.resolve(partialResult)
      }

      return livePromise
    }
  }

  const tools: AgentTool<any, any>[] = [browserActionsTool]

  if (!runtime.settings.enableMcp) {
    return tools
  }

  const enabledServers = getScopedEnabledMcpServers(runtime.settings, runtime.subagent)

  if (!enabledServers.length) return tools

  const discoveredTools = await discoverAllMcpTools(enabledServers)
  for (const discovered of discoveredTools) {
    const proxyTool = mcpToolToAnthropicTool(
      discovered.serverId,
      discovered.serverName,
      discovered.tool
    )
    const server = enabledServers.find(item => item.id === discovered.serverId)
    if (!server) continue

    tools.push({
      name: proxyTool.name,
      label: `${discovered.serverName}: ${discovered.tool.name}`,
      description: proxyTool.description,
      parameters: Type.Unsafe<Record<string, unknown>>(
        proxyTool.input_schema as Record<string, unknown>
      ),
      execute: async (_toolCallId: string, params: Record<string, unknown>) => {
        const result = await callMcpTool(server, discovered.tool.name, params)
        if (result.error) {
          throw new Error(result.error)
        }
        return {
          content: [
            {
              type: 'text' as const,
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

const createRunEventState = (): RunEventState => ({
  lastAssistantMessage: null,
  lastAssistantText: '',
  lastReasoningText: '',
  lastPayload: null,
  lastToolUseIds: [],
  lastToolInputs: [],
  usage: null
})

const subscribeToRun = (
  runtime: ThreadRuntime,
  state: RunEventState,
  onUpdate?: (update: AgentStreamUpdate) => void
) =>
  runtime.agent.subscribe(event => {
    if (event.type === 'message_update' && event.message.role === 'assistant') {
      state.lastAssistantMessage = event.message as AssistantMessage
      state.lastAssistantText = extractAssistantText(state.lastAssistantMessage)
      state.lastReasoningText = extractAssistantThinking(state.lastAssistantMessage)

      if (event.assistantMessageEvent.type === 'text_delta') {
        emitUpdate(onUpdate, { message: state.lastAssistantText })
      }
      if (event.assistantMessageEvent.type === 'thinking_delta') {
        emitUpdate(onUpdate, {
          thoughts: state.lastReasoningText ? [state.lastReasoningText] : undefined
        })
      }
      if (event.assistantMessageEvent.type === 'toolcall_delta') {
        const toolCall =
          state.lastAssistantMessage.content[event.assistantMessageEvent.contentIndex]
        if (toolCall?.type === 'toolCall' && toolCall.name === toolSchema.name) {
          const parsed = normalizeToolPayload(parseResponsePayload(toolCall.arguments))
          if (parsed) {
            emitUpdate(onUpdate, {
              message: parsed.message || state.lastAssistantText || undefined,
              thoughts:
                parsed.thoughts?.length || state.lastReasoningText
                  ? parsed.thoughts || [state.lastReasoningText]
                  : undefined,
              steps: parsed.steps,
              actions: normalizeActions(parsed.actions),
              parallelActions: parsed.parallelActions
            })
          }
        }
      }
      return
    }

    if (event.type === 'message_end') {
      if (event.message.role === 'assistant') {
        state.lastAssistantMessage = event.message as AssistantMessage
        state.lastAssistantText = extractAssistantText(state.lastAssistantMessage)
        state.lastReasoningText = extractAssistantThinking(state.lastAssistantMessage)
        state.usage = normalizePiUsage(state.lastAssistantMessage.usage)

        const { merged, toolUseIds, toolInputs } = extractBrowserPayload(state.lastAssistantMessage)
        state.lastPayload = merged
        state.lastToolUseIds = toolUseIds
        state.lastToolInputs = toolInputs

        if (merged?.memory) {
          updateMemory(merged.memory)
        }

        emitUpdate(onUpdate, {
          message: merged?.message?.trim() || state.lastAssistantText || undefined,
          thoughts:
            merged?.thoughts?.length || state.lastReasoningText
              ? merged?.thoughts || [state.lastReasoningText]
              : undefined,
          steps: merged?.steps,
          actions: normalizeActions(merged?.actions),
          parallelActions: merged?.parallelActions
        })
      }

      writeStoredThreadState(runtime.id, {
        messages: cloneMessages(runtime.agent.state.messages),
        pendingTool:
          runtime.pendingTool?.toolUseIds.length && runtime.pendingTool.toolInputs.length
            ? {
                toolUseIds: runtime.pendingTool.toolUseIds,
                toolInputs: runtime.pendingTool.toolInputs
              }
            : undefined
      })
    }
  })

const finalizeResult = (threadId: string, state: RunEventState): AgentRunResult => {
  const message =
    state.lastPayload?.message?.trim() ||
    state.lastAssistantText ||
    state.lastPayload?.steps?.[0]?.trim() ||
    '已完成任务。'

  return {
    threadId,
    message: {
      id: nanoid(),
      role: 'assistant',
      content: message
    },
    actions: normalizeActions(state.lastPayload?.actions),
    toolUseIds: state.lastToolUseIds,
    toolInputs: state.lastToolInputs,
    toolUseId: state.lastToolUseIds[0],
    toolInput: state.lastToolInputs[0],
    parallelActions: state.lastPayload?.parallelActions,
    thoughts: state.lastPayload?.thoughts,
    steps: state.lastPayload?.steps,
    usage: state.usage
  }
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
  const message = error instanceof Error ? error.message : 'Pi Agent 请求失败。'
  endContext(executionContextId, {
    success: false,
    error: message
  })
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
  if (!settings.apiKey?.trim()) {
    return withThreadId(threadId, {
      error: '请先在设置中填写可供 Pi Agent SDK 使用的 API Key。'
    })
  }

  const executionContextId = beginContext(subagent ? 'subagent' : 'master', input, {
    sessionId: threadId,
    agentId: subagent?.id,
    agentName: subagent?.name,
    isolated: options?.isolated ?? Boolean(subagent)
  })

  try {
    const runtime = getOrCreateThreadRuntime(threadId, settings, subagent, context, input)
    runtime.settings = settings
    runtime.subagent = subagent
    runtime.context = context

    const suspendResult = createDeferred<AgentRunResult | null>()
    await syncRuntimeConfig(runtime, input, suspendResult)

    const runState = createRunEventState()
    const unsubscribe = subscribeToRun(runtime, runState, options?.onUpdate)

    const promptPromise = runtime.agent
      .prompt(input)
      .then(() => null)
      .catch(error => {
        if (!suspendResult.settled()) throw error
        return null
      })

    const suspended = await Promise.race([suspendResult.promise, promptPromise])
    unsubscribe()

    if (suspended) {
      endContext(executionContextId, {
        success: true,
        output: suspended.message?.content || ''
      })
      return withThreadId(threadId, suspended)
    }

    runtime.pendingTool = undefined
    clearStoredPendingTool(threadId)
    const result = finalizeResult(threadId, runState)
    endContext(executionContextId, {
      success: true,
      output: result.message?.content || ''
    })
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
    const runtime = getOrCreateThreadRuntime(threadId, settings, subagent, context, input)
    runtime.settings = settings
    runtime.subagent = subagent
    runtime.context = context

    const suspendResult = createDeferred<AgentRunResult | null>()
    const runState = createRunEventState()
    const unsubscribe = subscribeToRun(runtime, runState, options?.onUpdate)

    const storedPending = runtime.pendingTool
    const livePending = Boolean(
      storedPending?.toolUseIds.length && typeof storedPending.resolve === 'function'
    )

    if (livePending && storedPending) {
      await syncRuntimeConfig(runtime, input, suspendResult)

      const filteredToolUses = toolUses.length
        ? toolUses
        : storedPending.toolUseIds.map((id, index) => ({
            id,
            input: storedPending.toolInputs[index]
          }))

      const toolResults = serializeToolResultContent(filteredToolUses, toolResult)
      clearStoredPendingTool(threadId)
      runtime.pendingTool = undefined
      storedPending?.resolve({
        content: toolResults[0]?.content || [{ type: 'text', text: JSON.stringify(toolResult) }],
        details: { kind: 'browser_actions' }
      })

      const completionPromise = runtime.agent.waitForIdle().then(() => null)
      const suspended = await Promise.race([suspendResult.promise, completionPromise])
      unsubscribe()

      if (suspended) {
        endContext(executionContextId, {
          success: true,
          output: suspended.message?.content || ''
        })
        return withThreadId(threadId, suspended)
      }

      const result = finalizeResult(threadId, runState)
      endContext(executionContextId, {
        success: true,
        output: result.message?.content || ''
      })
      return result
    }

    const stored = readStoredThreadState(threadId)
    const effectiveToolUses =
      toolUses.length > 0
        ? toolUses
        : (stored?.pendingTool?.toolUseIds || []).map((id, index) => ({
            id,
            input: stored?.pendingTool?.toolInputs?.[index] as AgentToolPayload
          }))

    if (!effectiveToolUses.length) {
      unsubscribe()
      return failWithContext(
        threadId,
        executionContextId,
        new Error('工具调用信息缺失，无法继续。')
      )
    }

    await syncRuntimeConfig(runtime, input, suspendResult)

    clearStoredPendingTool(threadId)
    runtime.pendingTool = undefined

    for (const item of serializeToolResultContent(effectiveToolUses, toolResult)) {
      runtime.agent.appendMessage(item)
    }

    writeStoredThreadState(threadId, {
      messages: cloneMessages(runtime.agent.state.messages as Message[]),
      pendingTool: undefined
    })

    const continuePromise = runtime.agent.continue().then(() => null)
    const suspended = await Promise.race([suspendResult.promise, continuePromise])
    unsubscribe()

    if (suspended) {
      endContext(executionContextId, {
        success: true,
        output: suspended.message?.content || ''
      })
      return withThreadId(threadId, suspended)
    }

    const result = finalizeResult(threadId, runState)
    endContext(executionContextId, {
      success: true,
      output: result.message?.content || ''
    })
    return result
  } catch (error) {
    return failWithContext(threadId, executionContextId, error)
  }
}
