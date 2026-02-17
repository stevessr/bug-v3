import Anthropic from '@anthropic-ai/sdk'
import { nanoid } from 'nanoid'

import type {
  AgentAction,
  AgentActionResult,
  AgentMessage,
  AgentSettings,
  SubAgentConfig
} from './types'
import {
  createSubagentSession,
  resolveSubagent,
  updateSubagentSessionItem
} from './subagentSessions'
import { memoryToPrompt, updateMemory } from './memory'
import {
  discoverAllMcpTools,
  mcpToolToAnthropicTool,
  parseMcpToolName,
  findServerById,
  callMcpTool
} from './mcpClient'
import { beginContext, endContext } from './agentContext'
import { getEnabledBuiltinMcpConfigs } from './skills'
import {
  streamClaudeText,
  streamClaudeTurn,
  streamClaudeToolConversation,
  type AgentStreamUpdate
} from './agentStreaming'
import {
  extractTextContent,
  parsePayloadFromRawText,
  toolSchema,
  type AgentToolPayload
} from './agentPayload'
import type { AgentUsage } from './agentUsage'

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
type TabContext = {
  id?: number
  title?: string
  url?: string
  status?: string
  active?: boolean
  windowId?: number
}

export type AgentTabContext = TabContext

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
    '优先通过直接 DOM 访问获取文字内容或结构信息，再决定截图或滚动。',
    '如果需要操作页面元素，请优先提供 selector；否则使用坐标 x/y。',
    'DOM 查询支持 includeMarkdown，可在获取结构时同时拿到页面文字摘要（markdown）。',
    '尽量自行探索当前页面并执行可行的下一步，不要先向用户索要显而易见的信息。',
    '当不确定页面内容时，优先尝试：获取 DOM 树、截图、滚动或聚焦关键区域，再决定下一步。',
    '仅当确实无法继续时才提问，并给出你需要的具体信息。',
    '如果需要调用多个子代理，请尽量并行调用，返回 subagents 数组，每项包含 id 或 name 以及 prompt。',
    '需要子代理时，使用 subagents 数组触发；需要动作时放入 actions。',
    '尽量合并多个独立动作并并行执行，将 parallelActions 设为 true。',
    '可写入记忆：memory.set；可删除记忆：memory.remove。',
    'MCP 服务不是子代理，不要把 MCP 服务名写进 subagents。',
    'steps 与 thoughts 必须基于可观察证据（当前页面、DOM、截图结果），不要猜测或编造。',
    '若证据不足，用“待确认”表述，不要下结论。',
    'DOM 探索工作流：先执行 getDOM（建议 includeMarkdown=true），再定位目标元素并生成 selector。',
    'DOM 探索工作流：优先依据 id、name、data-testid、aria-label、role 等稳定属性构造 selector。',
    'DOM 探索工作流：目标不唯一时先缩小范围（局部 selector + 再次 getDOM），必要时滚动后重复 getDOM。',
    'DOM 探索工作流：仅在 DOM 信息不足时才截图，且截图后仍需回到 DOM 证据。',
    'DOM 探索工作流：执行关键动作前后都应给出可验证依据（步骤描述与后置验证）。'
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

  if (settings.enableMcp) {
    // 合并内置 MCP 服务和自定义 MCP 服务
    const builtinServers = getEnabledBuiltinMcpConfigs()
    const allMcpServers = [...builtinServers, ...settings.mcpServers]
    const enabledServers = allMcpServers.filter(server => {
      if (!server.enabled) return false
      const scope = subagent?.mcpServerIds
      if (scope && scope.length > 0) return scope.includes(server.id)
      return true
    })
    if (enabledServers.length > 0) {
      // 只显示服务名称，不暴露 URL 和 API key
      // 工具会通过 MCP 协议自动发现并作为 tool 传入
      lines.push(
        `可用 MCP 服务：${enabledServers.map(server => server.name).join(', ')}`,
        'MCP 工具已自动注册为 tool，可直接调用。工具名格式：mcp__服务 ID__工具名。',
        '当需要搜索、获取文档等功能时，请直接调用对应的 MCP 工具，不要在文本中描述工具调用。'
      )
    }
  }

  return lines.join('\n')
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

const resolveMaxTokens = (value: unknown, fallback = 1024): number => {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.floor(parsed)
}

const normalizeActions = (actions: AgentToolPayload['actions'] | undefined): AgentAction[] =>
  (actions || []).map(action => ({ ...action, id: action.id || nanoid() }) as AgentAction)

const parseChecklist = (raw: string): string[] => {
  const items = raw
    .split('\n')
    .map(line => line.replace(/^[-*+\d.、\s]+/, '').trim())
    .filter(Boolean)
    .filter(line => !/^(thoughts?|steps?|actions?)\s*:/i.test(line))
  return items.slice(0, 10)
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
      maxTokens: resolveMaxTokens(settings.maxTokens)
    })
    const parsed = parsePayloadFromRawText(raw)
    if (parsed?.steps?.length) return parsed.steps.slice(0, 10)
    if (parsed?.thoughts?.length) return parsed.thoughts.slice(0, 10)
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
      maxTokens: resolveMaxTokens(settings.maxTokens)
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
    onUpdate?: (update: AgentStreamUpdate) => void
    sessionId?: string // 外部传入的会话 ID
    isolated?: boolean // 是否隔离上下文
  }
): Promise<AgentRunResult> {
  const threadId = options?.sessionId || nanoid()
  const withThreadId = (result: AgentRunResult): AgentRunResult => ({
    threadId,
    ...result
  })

  if (!settings.apiKey) {
    return withThreadId({
      error: '请先在设置中填写 Claude 的 apiKey。'
    })
  }

  // 开始执行上下文
  const contextType = subagent ? 'subagent' : 'master'
  const executionContextId = beginContext(contextType, input, {
    sessionId: threadId,
    agentId: subagent?.id,
    agentName: subagent?.name,
    isolated: options?.isolated ?? contextType === 'subagent'
  })

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

    // 发现 MCP 工具
    let mcpTools: ReturnType<typeof mcpToolToAnthropicTool>[] = []
    if (settings.enableMcp) {
      // 合并内置 MCP 服务和自定义 MCP 服务
      const builtinServers = getEnabledBuiltinMcpConfigs()
      const allMcpServers = [...builtinServers, ...settings.mcpServers]
      const enabledServers = allMcpServers.filter(server => {
        if (!server.enabled) return false
        const scope = subagent?.mcpServerIds
        if (scope && scope.length > 0) return scope.includes(server.id)
        return true
      })
      if (enabledServers.length > 0) {
        options?.onUpdate?.({ message: '正在发现 MCP 工具...' })
        const discoveredTools = await discoverAllMcpTools(enabledServers)
        mcpTools = discoveredTools.map(({ serverId, serverName, tool }) =>
          mcpToolToAnthropicTool(serverId, serverName, tool)
        )
      }
    }

    const firstPass = await streamClaudeTurn(
      {
        client,
        model: modelId,
        system,
        prompt: input,
        onUpdate: update => options?.onUpdate?.(update),
        forceTool: mcpTools.length === 0,
        maxTokens: resolveMaxTokens(settings.maxTokens),
        mcpTools
      },
      settings.apiFlavor || 'messages'
    )

    // 处理 MCP 工具调用（并行执行）
    if (firstPass.mcpToolUses && firstPass.mcpToolUses.length > 0) {
      options?.onUpdate?.({ message: '正在执行 MCP 工具调用...' })

      // 合并内置 MCP 服务和自定义 MCP 服务用于查找
      const builtinMcpConfigs = getEnabledBuiltinMcpConfigs()
      const allMcpServersForLookup = [...builtinMcpConfigs, ...settings.mcpServers]

      const mcpResults = await Promise.all(
        firstPass.mcpToolUses.map(async mcpToolUse => {
          const parsed = parseMcpToolName(mcpToolUse.name || '')
          if (!parsed) {
            return { toolUseId: mcpToolUse.id || '', error: '无效的 MCP 工具名称' }
          }

          const server = findServerById(allMcpServersForLookup, parsed.serverId)
          if (!server) {
            return {
              toolUseId: mcpToolUse.id || '',
              error: `未找到 MCP 服务：${parsed.serverId}`
            }
          }

          const args =
            mcpToolUse.input && typeof mcpToolUse.input === 'object'
              ? (mcpToolUse.input as Record<string, unknown>)
              : {}
          const result = await callMcpTool(server, parsed.toolName, args)
          return { toolUseId: mcpToolUse.id || '', ...result }
        })
      )

      // 构建 tool_result 消息让模型处理 MCP 结果
      options?.onUpdate?.({ message: '正在处理 MCP 工具结果...' })

      const toolResultMessages = firstPass.mcpToolUses.map((mcpToolUse, index) => {
        const mcpResult = mcpResults[index]
        return {
          type: 'tool_result' as const,
          tool_use_id: mcpToolUse.id || '',
          content: mcpResult.error
            ? JSON.stringify({ error: mcpResult.error })
            : JSON.stringify(mcpResult.result)
        }
      })

      // 继续对话，让模型处理 MCP 结果
      const followUpResult = await streamClaudeToolConversation({
        client,
        model: modelId,
        system,
        messages: [
          { role: 'user', content: input },
          {
            role: 'assistant',
            content: firstPass.mcpToolUses.map(use => ({
              type: 'tool_use' as const,
              id: use.id || '',
              name: use.name || '',
              input: use.input || {}
            }))
          },
          {
            role: 'user',
            content: toolResultMessages
          }
        ],
        tools: [toolSchema, ...mcpTools],
        toolChoice: { type: 'auto' },
        maxTokens: resolveMaxTokens(settings.maxTokens),
        onUpdate: update => options?.onUpdate?.(update)
      })
      const followUpParsed = followUpResult.parsed

      const content =
        followUpParsed?.message?.trim() ||
        followUpParsed?.steps?.[0]?.trim() ||
        followUpResult.rawText.trim() ||
        '已完成 MCP 工具调用。'

      if (followUpParsed?.memory) {
        updateMemory(followUpParsed.memory)
      }

      // 结束上下文（MCP 调用完成）
      endContext(executionContextId, {
        success: true,
        output: content,
        memoryUpdates: followUpParsed?.memory?.set
      })

      return withThreadId({
        message: {
          id: nanoid(),
          role: 'assistant',
          content
        },
        actions: normalizeActions(followUpParsed?.actions),
        toolUseId: followUpResult.toolUseId,
        toolInput: followUpResult.toolInput,
        toolUseIds: followUpResult.toolUseIds,
        toolInputs: followUpResult.toolInputs,
        parallelActions: followUpParsed?.parallelActions,
        thoughts: followUpParsed?.thoughts,
        steps: followUpParsed?.steps,
        usage: followUpResult.usage
      })
    }

    if (!firstPass.parsed) {
      const fallbackContent = firstPass.rawText.trim() || '已完成任务。'
      // 结束上下文（无解析结果）
      endContext(executionContextId, {
        success: true,
        output: fallbackContent
      })
      return withThreadId({
        message: {
          id: nanoid(),
          role: 'assistant',
          content: fallbackContent
        },
        actions: [],
        usage: firstPass.usage
      })
    }

    if (firstPass.parsed.subagents && firstPass.parsed.subagents.length > 0) {
      const mcpNames = new Set(
        settings.enableMcp
          ? settings.mcpServers
              .map(server => server.id)
              .concat(settings.mcpServers.map(server => server.name))
          : []
      )
      const resolvedCount = firstPass.parsed.subagents.filter(call =>
        Boolean(resolveSubagent(settings.subagents, call))
      ).length
      if (resolvedCount === 0) {
        const hasMcpMatch = firstPass.parsed.subagents.some(call => {
          const key = (call.id || call.name || '').trim()
          return key ? mcpNames.has(key) : false
        })
        const errorContent = hasMcpMatch
          ? '当前 MCP 服务不是子代理，无法通过 subagents 调用。请在设置中的 MCP 配置里使用"测试该服务"，或直接用工具/动作完成任务。'
          : '未找到可用的子代理，请检查子代理配置或更换任务。'

        // 结束上下文（错误情况）
        endContext(executionContextId, {
          success: false,
          error: errorContent
        })

        return withThreadId({
          message: {
            id: nanoid(),
            role: 'assistant',
            content: errorContent
          },
          actions: [],
          usage: firstPass.usage
        })
      }
      const sessionId = nanoid()
      createSubagentSession(sessionId, input, firstPass.parsed.subagents)

      // 使用独立上下文并行执行子代理
      const subagentResults = await Promise.all(
        firstPass.parsed.subagents.map(async call => {
          const target = resolveSubagent(settings.subagents, call)
          if (!target) {
            const error = '未找到子代理'
            updateSubagentSessionItem(sessionId, call, { error })
            return { id: call.id, name: call.name, error }
          }

          // 为每个 subagent 创建独立的执行上下文
          const subContextId = beginContext('subagent', call.prompt, {
            sessionId,
            parentId: executionContextId,
            agentId: target.id,
            agentName: target.name,
            isolated: true // 强制隔离
          })

          try {
            const output = await streamClaudeText({
              client,
              model: selectTaskModel(settings, target, useReasoning),
              system: buildSubagentPrompt(target),
              prompt: call.prompt,
              maxTokens: resolveMaxTokens(settings.maxTokens)
            })

            // 结束 subagent 上下文（成功）
            endContext(subContextId, {
              success: true,
              output,
              memoryUpdates: { result: output.slice(0, 500) }
            })

            updateSubagentSessionItem(sessionId, call, { output })
            return { id: call.id, name: call.name, output }
          } catch (error: any) {
            const message = error?.message || '子代理调用失败'

            // 结束 subagent 上下文（失败）
            endContext(subContextId, {
              success: false,
              error: message
            })

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

      const aggregated = await streamClaudeToolConversation({
        client,
        model: modelId,
        system: `${system}\n不要再调用子代理。`,
        messages: [{ role: 'user', content: aggregatePrompt }],
        tools: [toolSchema],
        toolChoice: { type: 'auto' },
        maxTokens: resolveMaxTokens(settings.maxTokens),
        onUpdate: update => options?.onUpdate?.(update)
      })

      if (!aggregated.parsed) {
        const fallbackContent = aggregated.rawText.trim() || '已完成任务。'
        // 结束上下文（子代理汇总完成）
        endContext(executionContextId, {
          success: true,
          output: fallbackContent
        })
        return withThreadId({
          message: {
            id: nanoid(),
            role: 'assistant',
            content: fallbackContent
          },
          actions: [],
          usage: aggregated.usage
        })
      }

      const aggregatedContent =
        aggregated.parsed.message?.trim() || aggregated.parsed.steps?.[0]?.trim() || '已完成任务。'
      const aggregatedActions = normalizeActions(aggregated.parsed.actions)

      if (aggregated.parsed?.memory) {
        updateMemory(aggregated.parsed.memory)
      }

      // 结束上下文（子代理汇总完成）
      endContext(executionContextId, {
        success: true,
        output: aggregatedContent,
        memoryUpdates: aggregated.parsed?.memory?.set
      })

      return withThreadId({
        message: {
          id: nanoid(),
          role: 'assistant',
          content: aggregatedContent
        },
        actions: aggregatedActions,
        toolUseId: aggregated.toolUseId,
        toolInput: aggregated.toolInput,
        toolUseIds: aggregated.toolUseIds,
        toolInputs: aggregated.toolInputs,
        parallelActions: aggregated.parsed?.parallelActions,
        thoughts: aggregated.parsed?.thoughts,
        steps: aggregated.parsed?.steps,
        usage: aggregated.usage
      })
    }

    if (firstPass.parsed.memory) {
      updateMemory(firstPass.parsed.memory)
    }

    const content =
      firstPass.parsed.message?.trim() || firstPass.parsed.steps?.[0]?.trim() || '已完成任务。'
    const actions = normalizeActions(firstPass.parsed.actions)

    // 结束执行上下文（成功）
    endContext(executionContextId, {
      success: true,
      output: content,
      memoryUpdates: firstPass.parsed.memory?.set
    })

    return withThreadId({
      message: {
        id: nanoid(),
        role: 'assistant',
        content
      },
      actions,
      toolUseId: firstPass.toolUseId,
      toolInput: firstPass.toolInput,
      toolUseIds: firstPass.toolUseIds,
      toolInputs: firstPass.toolInputs,
      parallelActions: firstPass.parsed.parallelActions,
      thoughts: firstPass.parsed.thoughts,
      steps: firstPass.parsed.steps,
      usage: firstPass.usage
    })
  } catch (error: any) {
    // 结束执行上下文（失败）
    endContext(executionContextId, {
      success: false,
      error: error?.message || 'Claude Agent 请求失败。'
    })
    return withThreadId({
      error: error?.message || 'Claude Agent 请求失败。'
    })
  }
}

export async function runAgentFollowup(
  input: string,
  toolUses: { id: string; input: AgentToolPayload }[],
  toolResult: AgentActionResult[],
  settings: AgentSettings,
  subagent?: SubAgentConfig,
  context?: { tab?: TabContext },
  options?: {
    onUpdate?: (update: AgentStreamUpdate) => void
    sessionId?: string
    isolated?: boolean
  }
): Promise<AgentRunResult> {
  const threadId = options?.sessionId || nanoid()
  const withThreadId = (result: AgentRunResult): AgentRunResult => ({
    threadId,
    ...result
  })

  const contextType = subagent ? 'subagent' : 'master'
  const executionContextId = beginContext(contextType, input, {
    sessionId: threadId,
    agentId: subagent?.id,
    agentName: subagent?.name,
    isolated: options?.isolated ?? contextType === 'subagent'
  })

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

    const followupResult = await streamClaudeToolConversation({
      client,
      model: modelId,
      system,
      messages: [
        { role: 'user', content: input },
        {
          role: 'assistant',
          content: toolUses.map(use => ({
            type: 'tool_use' as const,
            id: use.id,
            name: toolSchema.name,
            input: use.input
          }))
        },
        {
          role: 'user',
          content: toolUses.map(use => {
            const actionIds = (use.input.actions || [])
              .map(action => action.id)
              .filter((id): id is string => typeof id === 'string')
            const filteredResults = actionIds.length
              ? toolResult.filter(result => actionIds.includes(result.id))
              : []
            return {
              type: 'tool_result' as const,
              tool_use_id: use.id,
              content: JSON.stringify(filteredResults)
            }
          })
        }
      ],
      tools: [toolSchema],
      toolChoice: { type: 'auto' },
      maxTokens: resolveMaxTokens(settings.maxTokens),
      onUpdate: update => options?.onUpdate?.(update)
    })

    const parsed = followupResult.parsed

    if (!parsed) {
      const fallbackContent = followupResult.rawText.trim() || '已完成任务。'
      endContext(executionContextId, {
        success: true,
        output: fallbackContent
      })
      return withThreadId({
        message: {
          id: nanoid(),
          role: 'assistant',
          content: fallbackContent
        },
        actions: [],
        usage: followupResult.usage
      })
    }

    if (parsed.memory) {
      updateMemory(parsed.memory)
    }

    const content = parsed.message?.trim() || parsed.steps?.[0]?.trim() || '已完成任务。'
    const actions = normalizeActions(parsed.actions)

    endContext(executionContextId, {
      success: true,
      output: content,
      memoryUpdates: parsed.memory?.set
    })

    return withThreadId({
      message: {
        id: nanoid(),
        role: 'assistant',
        content
      },
      actions,
      toolUseId: followupResult.toolUseId,
      toolInput: followupResult.toolInput,
      toolUseIds: followupResult.toolUseIds,
      toolInputs: followupResult.toolInputs,
      parallelActions: parsed.parallelActions,
      thoughts: parsed.thoughts,
      steps: parsed.steps,
      usage: followupResult.usage
    })
  } catch (error: any) {
    endContext(executionContextId, {
      success: false,
      error: error?.message || 'Claude Agent 请求失败。'
    })
    return withThreadId({ error: error?.message || 'Claude Agent 请求失败。' })
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
        max_tokens: resolveMaxTokens(options.settings.maxTokens),
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
    if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(mediaType)) return ''
    const base64 = match[2]
    let streamedText = ''
    const stream = client.messages
      .stream({
        model: modelId,
        max_tokens: resolveMaxTokens(settings.maxTokens),
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
                  data: base64
                }
              },
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
