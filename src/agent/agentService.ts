import Anthropic from '@anthropic-ai/sdk'
import { nanoid } from 'nanoid'
import { z } from 'zod'

import type {
  AgentAction,
  AgentActionResult,
  AgentMessage,
  AgentSettings,
  SubAgentConfig,
  ApiFlavor
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

// Disable Zod JIT to avoid eval/new Function in CSP-restricted contexts.
z.config({ jitless: true })

interface AgentRunResult {
  message?: AgentMessage
  actions?: AgentAction[]
  toolUseId?: string
  toolInput?: z.infer<typeof responseSchema>
  toolUseIds?: string[]
  toolInputs?: z.infer<typeof responseSchema>[]
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
    'blur',
    'getDOM'
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
  label: z.string().optional(),
  options: z.record(z.any()).optional()
})

const listFromString = z.preprocess(
  value => (typeof value === 'string' ? [value] : value),
  z.array(z.string())
)

const normalizeAgentPayload = (payload: unknown): unknown => {
  if (!payload || typeof payload !== 'object') return payload
  const normalized: Record<string, unknown> = { ...(payload as Record<string, unknown>) }
  const actionTypes = new Set([
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
    'blur',
    'getDOM'
  ])
  if (normalized['memory.set'] || normalized['memory.remove']) {
    normalized.memory =
      normalized.memory && typeof normalized.memory === 'object' ? normalized.memory : {}
    const memory = normalized.memory as Record<string, unknown>
    if (normalized['memory.set'] && typeof normalized['memory.set'] === 'object') {
      memory.set = normalized['memory.set']
    }
    if (Array.isArray(normalized['memory.remove'])) {
      memory.remove = normalized['memory.remove']
    }
    delete normalized['memory.set']
    delete normalized['memory.remove']
  }
  if (Array.isArray(normalized.actions)) {
    const flattened: unknown[] = []
    const embeddedPayloads: Record<string, unknown>[] = []
    for (const action of normalized.actions) {
      if (!action || typeof action !== 'object') {
        flattened.push(action)
        continue
      }
      const actionRecord = action as Record<string, unknown>

      const toolName =
        typeof actionRecord.name === 'string'
          ? actionRecord.name
          : typeof actionRecord.tool === 'string'
            ? actionRecord.tool
            : typeof actionRecord.type === 'string'
              ? actionRecord.type
              : ''
      if (
        toolName === 'browser_actions' &&
        actionRecord.args &&
        typeof actionRecord.args === 'object'
      ) {
        const argsRecord = actionRecord.args as Record<string, unknown>
        const hasPayloadShape =
          'actions' in argsRecord ||
          'subagents' in argsRecord ||
          'message' in argsRecord ||
          'steps' in argsRecord ||
          'thoughts' in argsRecord ||
          'memory' in argsRecord ||
          'parallelActions' in argsRecord
        if (hasPayloadShape) {
          embeddedPayloads.push(argsRecord)
          continue
        }
      }

      if (actionRecord.type === 'browser_actions' && actionRecord.args) {
        const args = actionRecord.args as Record<string, unknown>
        const actionType = args.action
        const actionArgs = args.args
        if (typeof actionType === 'string') {
          if (actionArgs && typeof actionArgs === 'object') {
            flattened.push({ type: actionType, ...(actionArgs as Record<string, unknown>) })
          } else {
            flattened.push({ type: actionType })
          }
          continue
        }
      }

      if (typeof actionRecord.action === 'string' && actionRecord.args && !actionRecord.type) {
        const actionArgs = actionRecord.args
        if (actionArgs && typeof actionArgs === 'object') {
          flattened.push({ type: actionRecord.action, ...(actionArgs as Record<string, unknown>) })
        } else {
          flattened.push({ type: actionRecord.action })
        }
        continue
      }

      flattened.push(actionRecord)
    }
    const nextActions: Record<string, unknown>[] = []
    const nextSubagents: Array<Record<string, unknown>> = Array.isArray(normalized.subagents)
      ? (normalized.subagents as Array<Record<string, unknown>>)
      : []
    for (const item of flattened) {
      if (!item || typeof item !== 'object') continue
      const record = item as Record<string, unknown>
      let type = typeof record.type === 'string' ? record.type : ''
      if (type === 'DOM' || type === 'dom') {
        type = 'getDOM'
        record.type = 'getDOM'
      }
      if (type === 'getDOM') {
        const includeMarkdown =
          typeof record.includeMarkdown === 'boolean'
            ? record.includeMarkdown
            : typeof record.getMarkdown === 'boolean'
              ? record.getMarkdown
              : undefined
        if (includeMarkdown !== undefined) {
          const options = record.options && typeof record.options === 'object' ? record.options : {}
          record.options = { ...options, includeMarkdown }
        }
      }
      if (type === 'subagents' && Array.isArray(record.subagents)) {
        nextSubagents.push(...(record.subagents as Array<Record<string, unknown>>))
        continue
      }
      if (type && !actionTypes.has(type)) {
        continue
      }
      nextActions.push(record)
    }
    normalized.actions = nextActions
    if (nextSubagents.length > 0) normalized.subagents = nextSubagents

    if (embeddedPayloads.length > 0) {
      const mergedEmbedded: Record<string, unknown> = {}
      for (const item of embeddedPayloads) {
        const normalizedItem = normalizeAgentPayload(item)
        if (!normalizedItem || typeof normalizedItem !== 'object') continue
        const record = normalizedItem as Record<string, unknown>
        if (!mergedEmbedded.message && typeof record.message === 'string') {
          mergedEmbedded.message = record.message
        }
        if (Array.isArray(record.actions)) {
          mergedEmbedded.actions = [
            ...((mergedEmbedded.actions as unknown[]) || []),
            ...record.actions
          ]
        }
        if (record.parallelActions !== undefined) {
          mergedEmbedded.parallelActions =
            (mergedEmbedded.parallelActions ?? false) || Boolean(record.parallelActions)
        }
        if (Array.isArray(record.thoughts)) {
          mergedEmbedded.thoughts = [
            ...((mergedEmbedded.thoughts as unknown[]) || []),
            ...record.thoughts
          ]
        }
        if (Array.isArray(record.steps)) {
          mergedEmbedded.steps = [...((mergedEmbedded.steps as unknown[]) || []), ...record.steps]
        }
        if (Array.isArray(record.subagents)) {
          mergedEmbedded.subagents = [
            ...((mergedEmbedded.subagents as unknown[]) || []),
            ...record.subagents
          ]
        }
        if (record.memory && typeof record.memory === 'object') {
          mergedEmbedded.memory = mergedEmbedded.memory || {}
          const memory = record.memory as Record<string, unknown>
          if (memory.set && typeof memory.set === 'object') {
            ;(mergedEmbedded.memory as Record<string, unknown>).set = {
              ...(((mergedEmbedded.memory as Record<string, unknown>).set as Record<
                string,
                unknown
              >) || {}),
              ...(memory.set as Record<string, unknown>)
            }
          }
          if (Array.isArray(memory.remove)) {
            const existing = new Set(
              Array.isArray((mergedEmbedded.memory as Record<string, unknown>).remove)
                ? ((mergedEmbedded.memory as Record<string, unknown>).remove as string[])
                : []
            )
            for (const key of memory.remove) {
              if (typeof key === 'string') existing.add(key)
            }
            ;(mergedEmbedded.memory as Record<string, unknown>).remove = Array.from(existing)
          }
        }
      }

      const combined: Record<string, unknown> = {}
      Object.assign(combined, normalized)
      if (!combined.message && typeof mergedEmbedded.message === 'string') {
        combined.message = mergedEmbedded.message
      }
      if (Array.isArray(mergedEmbedded.actions)) {
        combined.actions = [
          ...((combined.actions as unknown[]) || []),
          ...(mergedEmbedded.actions as unknown[])
        ]
      }
      if (mergedEmbedded.parallelActions !== undefined) {
        combined.parallelActions =
          (combined.parallelActions ?? false) || Boolean(mergedEmbedded.parallelActions)
      }
      if (Array.isArray(mergedEmbedded.thoughts)) {
        combined.thoughts = [
          ...((combined.thoughts as unknown[]) || []),
          ...(mergedEmbedded.thoughts as unknown[])
        ]
      }
      if (Array.isArray(mergedEmbedded.steps)) {
        combined.steps = [
          ...((combined.steps as unknown[]) || []),
          ...(mergedEmbedded.steps as unknown[])
        ]
      }
      if (Array.isArray(mergedEmbedded.subagents)) {
        combined.subagents = [
          ...((combined.subagents as unknown[]) || []),
          ...(mergedEmbedded.subagents as unknown[])
        ]
      }
      if (mergedEmbedded.memory && typeof mergedEmbedded.memory === 'object') {
        combined.memory = combined.memory || {}
        const mergedMemory = mergedEmbedded.memory as Record<string, unknown>
        if (mergedMemory.set && typeof mergedMemory.set === 'object') {
          ;(combined.memory as Record<string, unknown>).set = {
            ...(((combined.memory as Record<string, unknown>).set as Record<string, unknown>) ||
              {}),
            ...(mergedMemory.set as Record<string, unknown>)
          }
        }
        if (Array.isArray(mergedMemory.remove)) {
          const existing = new Set(
            Array.isArray((combined.memory as Record<string, unknown>).remove)
              ? ((combined.memory as Record<string, unknown>).remove as string[])
              : []
          )
          for (const key of mergedMemory.remove) {
            if (typeof key === 'string') existing.add(key)
          }
          ;(combined.memory as Record<string, unknown>).remove = Array.from(existing)
        }
      }

      return combined
    }
  }
  return normalized
}

const parseResponsePayload = (payload: unknown): z.infer<typeof responseSchema> | null => {
  try {
    return responseSchema.parse(normalizeAgentPayload(payload))
  } catch {
    return null
  }
}

const responseSchema = z.object({
  message: z.string().optional(),
  actions: z.array(actionSchema).optional(),
  parallelActions: z.boolean().optional(),
  thoughts: listFromString.optional(),
  steps: listFromString.optional(),
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

const ensureActionIds = (parsed: z.infer<typeof responseSchema>): void => {
  if (!parsed.actions) return
  for (const action of parsed.actions) {
    if (!action.id) action.id = nanoid()
  }
}

const mergeParsedPayloads = (
  payloads: z.infer<typeof responseSchema>[]
): z.infer<typeof responseSchema> | null => {
  if (!payloads.length) return null
  if (payloads.length === 1) return payloads[0]
  const merged: z.infer<typeof responseSchema> = {}
  for (const item of payloads) {
    if (!merged.message && item.message) merged.message = item.message
    if (item.actions?.length) {
      merged.actions = [...(merged.actions || []), ...item.actions]
    }
    if (item.parallelActions !== undefined) {
      merged.parallelActions = (merged.parallelActions ?? false) || item.parallelActions
    }
    if (item.thoughts?.length) {
      merged.thoughts = [...(merged.thoughts || []), ...item.thoughts]
    }
    if (item.steps?.length) {
      merged.steps = [...(merged.steps || []), ...item.steps]
    }
    if (item.subagents?.length) {
      merged.subagents = [...(merged.subagents || []), ...item.subagents]
    }
    if (item.memory) {
      merged.memory = merged.memory || {}
      if (item.memory.set) {
        merged.memory.set = { ...(merged.memory.set || {}), ...item.memory.set }
      }
      if (item.memory.remove?.length) {
        const existing = new Set(merged.memory.remove || [])
        for (const key of item.memory.remove) existing.add(key)
        merged.memory.remove = Array.from(existing)
      }
    }
  }
  return merged
}

const extractBrowserToolUses = (content: Array<any> | undefined) =>
  (content || []).filter(
    block => block?.type === 'tool_use' && block?.name === toolSchema.name
  ) as { id?: string; input?: unknown }[]

const parseToolInputs = (
  toolUses: { id?: string; input?: unknown }[]
): { parsedInputs: z.infer<typeof responseSchema>[]; toolUseIds: string[] } => {
  const parsedInputs: z.infer<typeof responseSchema>[] = []
  const toolUseIds: string[] = []
  for (const toolUse of toolUses) {
    if (!toolUse?.id || !toolUse.input) continue
    const parsed = parseResponsePayload(toolUse.input)
    if (!parsed) continue
    ensureActionIds(parsed)
    parsedInputs.push(parsed)
    toolUseIds.push(toolUse.id)
  }
  return { parsedInputs, toolUseIds }
}

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
                'select',
                'getDOM'
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
            label: { type: 'string' },
            options: { type: 'object' }
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

const repairJson = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  const candidate = raw.slice(start, end + 1)
  const trimmed = candidate
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/"thoughts"\s*:\s*([},])/g, '"thoughts":[]$1')
    .replace(/"steps"\s*:\s*([},])/g, '"steps":[]$1')
    .replace(/"actions"\s*:\s*([},])/g, '"actions":[]$1')
    .replace(/"subagents"\s*:\s*([},])/g, '"subagents":[]$1')
    .replace(/"memory"\s*:\s*([},])/g, '"memory":{}$1')
  return trimmed
}

/**
 * Parse YAML-like format returned by some models (e.g. GLM-4.7-flash)
 * Example format:
 *   thoughts: ["..."]
 *   steps: ["..."]
 *   actions: [{"action": "tool", ...}]
 */
const parseYamlLikeFormat = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null
  const text = raw.trim()
  if (!text) return null
  if (text.includes('```')) return null

  // Only accept if the first non-empty line starts with a known key
  const lines = text.split('\n').map(line => line.trim())
  const firstLine = lines.find(line => line.length > 0)
  if (!firstLine) return null
  const keyValuePattern = /^(thoughts|steps|actions|message|parallelActions|memory|subagents)\s*:/
  if (!keyValuePattern.test(firstLine)) return null
  if (text.startsWith('{') && text.endsWith('}')) return null

  const result: Record<string, unknown> = {}

  let currentKey = ''
  let currentValue = ''
  let bracketDepth = 0
  let inValue = false

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine) continue

    // Check if line starts a new key
    const keyMatch = trimmedLine.match(
      /^(thoughts|steps|actions|message|parallelActions|memory|subagents)\s*:\s*(.*)$/
    )
    if (keyMatch && bracketDepth === 0) {
      // Save previous key-value if exists
      if (currentKey && currentValue) {
        try {
          result[currentKey] = JSON.parse(currentValue.trim())
        } catch {
          result[currentKey] = currentValue.trim()
        }
      }

      currentKey = keyMatch[1]
      currentValue = keyMatch[2]
      inValue = true

      // Count brackets to handle multi-line values
      bracketDepth =
        (currentValue.match(/[[{]/g) || []).length - (currentValue.match(/[}\]]/g) || []).length
    } else if (inValue) {
      currentValue += '\n' + trimmedLine
      bracketDepth +=
        (trimmedLine.match(/[[{]/g) || []).length - (trimmedLine.match(/[}\]]/g) || []).length
    }
  }

  // Save the last key-value
  if (currentKey && currentValue) {
    try {
      result[currentKey] = JSON.parse(currentValue.trim())
    } catch {
      result[currentKey] = currentValue.trim()
    }
  }

  // Only return if we parsed something useful
  if (Object.keys(result).length === 0) return null

  try {
    return JSON.stringify(result)
  } catch {
    return null
  }
}

const extractSingleCodeFence = (raw: string): string | null => {
  const match = raw.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return match ? match[1].trim() : null
}

const canParseStructured = (raw: string): { candidate: string | null } => {
  const fenced = extractSingleCodeFence(raw)
  if (fenced !== null) {
    return { candidate: fenced }
  }
  if (raw.includes('```')) return { candidate: null }
  const trimmed = raw.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return { candidate: trimmed }
  return { candidate: raw }
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

const sleep = async (ms: number) => {
  if (!ms) return
  await new Promise(resolve => setTimeout(resolve, ms))
}

const getHeaderValue = (headers: any, key: string): string | null => {
  if (!headers) return null
  const lowerKey = key.toLowerCase()
  if (typeof headers.get === 'function') {
    return headers.get(lowerKey) || headers.get(key) || null
  }
  const value = headers[key] ?? headers[lowerKey]
  return typeof value === 'string' ? value : null
}

const getRetryDelayMs = (error: any, attempt: number): number | null => {
  const status = error?.status ?? error?.statusCode
  const name = typeof error?.name === 'string' ? error.name : ''
  const message = typeof error?.message === 'string' ? error.message : ''
  const isRateLimit = status === 429 || name === 'RateLimitError' || /429|rate limit/i.test(message)
  const isTransientStreamError =
    /stream ended without producing a Message with role=assistant/i.test(message) ||
    /request ended without sending any chunks/i.test(message)
  const isServerError = typeof status === 'number' && status >= 500
  if (!isRateLimit && !isTransientStreamError && !isServerError) return null
  const retryAfter = getHeaderValue(error?.headers, 'retry-after')
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(seconds * 1000, 30000)
    }
  }
  const base = 1000
  const maxDelay = 8000
  const backoff = Math.min(base * 2 ** attempt, maxDelay)
  const jitter = Math.floor(Math.random() * 250)
  const quick = 500 + Math.floor(Math.random() * 500)
  return (isTransientStreamError ? quick : backoff) + jitter
}

const withRateLimitRetry = async <T>(
  task: () => Promise<T>,
  onRetry?: (attempt: number, delayMs: number, error: any) => void,
  maxRetries = 2
): Promise<T> => {
  let attempt = 0
  while (true) {
    try {
      return await task()
    } catch (error: any) {
      const delayMs = getRetryDelayMs(error, attempt)
      if (delayMs === null || attempt >= maxRetries) {
        throw error
      }
      onRetry?.(attempt + 1, delayMs, error)
      await sleep(delayMs)
      attempt += 1
    }
  }
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

async function streamClaudeTools(options: {
  client: Anthropic
  model: string
  system: string
  prompt: string
  onUpdate?: (update: { message?: string; thoughts?: string[]; steps?: string[] }) => void
  forceTool?: boolean
  maxTokens: number
  mcpTools?: ReturnType<typeof mcpToolToAnthropicTool>[]
}) {
  // 合并 browser_actions 工具和 MCP 工具
  const allTools: (typeof toolSchema)[] = [toolSchema as typeof toolSchema]
  if (options.mcpTools && options.mcpTools.length > 0) {
    allTools.push(...(options.mcpTools as (typeof toolSchema)[]))
  }

  const emitUpdate = (payload: { message?: string; thoughts?: string[]; steps?: string[] }) => {
    if (!options.onUpdate) return
    if (!payload.message && !payload.thoughts && !payload.steps) return
    options.onUpdate(payload)
  }
  const extractFromSnapshot = (snapshot: unknown) => {
    if (!snapshot || typeof snapshot !== 'object') return
    const record = snapshot as Record<string, unknown>
    const message = typeof record.message === 'string' ? record.message : undefined
    const thoughts = Array.isArray(record.thoughts)
      ? record.thoughts.filter(item => typeof item === 'string')
      : undefined
    const steps = Array.isArray(record.steps)
      ? record.steps.filter(item => typeof item === 'string')
      : undefined
    emitUpdate({ message, thoughts, steps })
  }

  return withRateLimitRetry(
    async () => {
      let streamedText = ''
      const stream = options.client.messages
        .stream({
          model: options.model,
          max_tokens: options.maxTokens,
          system: options.system,
          messages: [{ role: 'user', content: options.prompt }],
          tools: allTools,
          tool_choice: options.forceTool
            ? { type: 'tool', name: toolSchema.name }
            : { type: 'auto' }
        })
        .on('text', text => {
          streamedText += text
          emitUpdate({ message: streamedText })
        })
        .on('thinking', (_, thinkingSnapshot) => {
          emitUpdate({ thoughts: [thinkingSnapshot] })
        })
        .on('inputJson', (_partial, jsonSnapshot) => {
          extractFromSnapshot(jsonSnapshot)
        })

      const finalMessage = await stream.finalMessage()
      const rawText = streamedText || extractTextContent(finalMessage.content)

      // 检查 browser_actions 工具调用
      const browserToolUses = extractBrowserToolUses(finalMessage.content as any[] | undefined)
      const { parsedInputs, toolUseIds } = parseToolInputs(browserToolUses)
      const toolUseId = toolUseIds.length === 1 ? toolUseIds[0] : undefined
      const toolInput = parsedInputs.length === 1 ? parsedInputs[0] : undefined

      // 检查 MCP 工具调用
      const mcpToolUses = finalMessage.content?.filter(
        (block: any) => block?.type === 'tool_use' && block?.name?.startsWith('mcp__')
      ) as { id?: string; name?: string; input?: any }[] | undefined

      let parsed: z.infer<typeof responseSchema> | null = null
      if (parsedInputs.length > 0) {
        parsed = mergeParsedPayloads(parsedInputs)
      }

      if (!parsed) {
        const { candidate } = canParseStructured(rawText)
        if (candidate) {
          const repaired = repairJson(candidate) || candidate
          try {
            parsed = parseResponsePayload(JSON.parse(repaired))
          } catch {
            parsed = null
          }
        }
      }

      // Try YAML-like format as fallback (for models like GLM-4.7-flash)
      if (!parsed) {
        const yamlLikeCandidate = parseYamlLikeFormat(rawText)
        if (yamlLikeCandidate) {
          try {
            parsed = parseResponsePayload(JSON.parse(yamlLikeCandidate))
          } catch {
            parsed = null
          }
        }
      }

      return {
        rawText,
        parsed,
        toolUseId,
        toolInput,
        toolUseIds,
        toolInputs: parsedInputs,
        mcpToolUses
      }
    },
    (attempt, delayMs, error) => {
      const message =
        error?.status === 429 || /429|rate limit/i.test(String(error?.message || ''))
          ? `请求过于频繁，${delayMs}ms 后重试（${attempt}/3）…`
          : `连接中断，${delayMs}ms 后重试（${attempt}/3）…`
      emitUpdate({ message })
    }
  )
}

/**
 * 使用 Response API 调用 Claude
 * Response API 是 Anthropic 的新 API 格式，支持更好的流式响应和工具调用
 */
async function streamClaudeResponseApi(options: {
  client: Anthropic
  model: string
  system: string
  prompt: string
  onUpdate?: (update: { message?: string; thoughts?: string[]; steps?: string[] }) => void
  forceTool?: boolean
  maxTokens: number
  mcpTools?: ReturnType<typeof mcpToolToAnthropicTool>[]
}) {
  // 合并 browser_actions 工具和 MCP 工具
  const allTools: (typeof toolSchema)[] = [toolSchema as typeof toolSchema]
  if (options.mcpTools && options.mcpTools.length > 0) {
    allTools.push(...(options.mcpTools as (typeof toolSchema)[]))
  }

  const emitUpdate = (payload: { message?: string; thoughts?: string[]; steps?: string[] }) => {
    if (!options.onUpdate) return
    if (!payload.message && !payload.thoughts && !payload.steps) return
    options.onUpdate(payload)
  }

  const extractFromSnapshot = (snapshot: unknown) => {
    if (!snapshot || typeof snapshot !== 'object') return
    const record = snapshot as Record<string, unknown>
    const message = typeof record.message === 'string' ? record.message : undefined
    const thoughts = Array.isArray(record.thoughts)
      ? record.thoughts.filter(item => typeof item === 'string')
      : undefined
    const steps = Array.isArray(record.steps)
      ? record.steps.filter(item => typeof item === 'string')
      : undefined
    emitUpdate({ message, thoughts, steps })
  }

  return withRateLimitRetry(
    async () => {
      let streamedText = ''

      // Response API 使用 responses.create 而不是 messages.create
      // 但目前 @anthropic-ai/sdk 可能还不支持 responses API
      // 我们需要使用原生 fetch 调用
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
      const toolCalls: Array<{ id: string; name: string; input: any }> = []

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

            // 处理不同类型的事件
            if (event.type === 'content_block_delta') {
              if (event.delta?.type === 'text_delta') {
                streamedText += event.delta.text || ''
                emitUpdate({ message: streamedText })
              } else if (event.delta?.type === 'thinking_delta') {
                emitUpdate({ thoughts: [event.delta.thinking || ''] })
              } else if (event.delta?.type === 'input_json_delta') {
                // 工具调用参数增量
                extractFromSnapshot(event.delta.partial_json)
              }
            } else if (event.type === 'content_block_start') {
              if (event.content_block?.type === 'tool_use') {
                toolCalls.push({
                  id: event.content_block.id,
                  name: event.content_block.name,
                  input: {}
                })
              }
            } else if (event.type === 'content_block_stop') {
              // 工具调用完成
            } else if (event.type === 'message_stop') {
              // 消息完成
            }
          } catch {
            // 忽略解析错误
          }
        }
      }

      // 解析工具调用结果
      const browserToolUses = toolCalls.filter(t => t.name === 'browser_actions')
      const mcpToolUses = toolCalls.filter(t => t.name?.startsWith('mcp__'))

      const { parsedInputs, toolUseIds } = parseToolInputs(
        browserToolUses.map(t => ({ id: t.id, name: t.name, input: t.input }))
      )
      const toolUseId = toolUseIds.length === 1 ? toolUseIds[0] : undefined
      const toolInput = parsedInputs.length === 1 ? parsedInputs[0] : undefined

      let parsed: z.infer<typeof responseSchema> | null = null
      if (parsedInputs.length > 0) {
        parsed = mergeParsedPayloads(parsedInputs)
      }

      if (!parsed) {
        const { candidate } = canParseStructured(streamedText)
        if (candidate) {
          const repaired = repairJson(candidate) || candidate
          try {
            parsed = parseResponsePayload(JSON.parse(repaired))
          } catch {
            parsed = null
          }
        }
      }

      return {
        rawText: streamedText,
        parsed,
        toolUseId,
        toolInput,
        toolUseIds,
        toolInputs: parsedInputs,
        mcpToolUses: mcpToolUses.length > 0 ? mcpToolUses : undefined
      }
    },
    (attempt, delayMs, error) => {
      const message =
        error?.status === 429 || /429|rate limit/i.test(String(error?.message || ''))
          ? `请求过于频繁，${delayMs}ms 后重试（${attempt}/3）…`
          : `连接中断，${delayMs}ms 后重试（${attempt}/3）…`
      emitUpdate({ message })
    }
  )
}

/**
 * 根据 API 风格选择调用方法
 */
async function streamClaude(
  options: {
    client: Anthropic
    model: string
    system: string
    prompt: string
    onUpdate?: (update: { message?: string; thoughts?: string[]; steps?: string[] }) => void
    forceTool?: boolean
    maxTokens: number
    mcpTools?: ReturnType<typeof mcpToolToAnthropicTool>[]
  },
  apiFlavor: ApiFlavor = 'messages'
) {
  if (apiFlavor === 'responses') {
    return streamClaudeResponseApi(options)
  }
  return streamClaudeTools(options)
}

async function streamClaudeText(options: {
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
    const yamlLikeCandidate = parseYamlLikeFormat(raw)
    if (yamlLikeCandidate) {
      try {
        const parsed = parseResponsePayload(JSON.parse(yamlLikeCandidate))
        if (parsed?.steps?.length) return parsed.steps.slice(0, 10)
        if (parsed?.thoughts?.length) return parsed.thoughts.slice(0, 10)
      } catch {
        // fallback to plain parsing
      }
    }
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
    onUpdate?: (update: { message?: string; thoughts?: string[]; steps?: string[] }) => void
    sessionId?: string // 外部传入的会话 ID
    isolated?: boolean // 是否隔离上下文
  }
): Promise<AgentRunResult> {
  if (!settings.apiKey) {
    return {
      error: '请先在设置中填写 Claude 的 apiKey。'
    }
  }

  // 开始执行上下文
  const contextType = subagent ? 'subagent' : 'master'
  const executionContextId = beginContext(contextType, input, {
    sessionId: options?.sessionId,
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

    const firstPass = await streamClaude(
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

          const result = await callMcpTool(server, parsed.toolName, mcpToolUse.input || {})
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
      let followUpText = ''
      const emitFollowUp = (payload: {
        message?: string
        thoughts?: string[]
        steps?: string[]
      }) => {
        if (!options?.onUpdate) return
        if (!payload.message && !payload.thoughts && !payload.steps) return
        options.onUpdate(payload)
      }
      const extractFollowUpSnapshot = (snapshot: unknown) => {
        if (!snapshot || typeof snapshot !== 'object') return
        const record = snapshot as Record<string, unknown>
        const message = typeof record.message === 'string' ? record.message : undefined
        const thoughts = Array.isArray(record.thoughts)
          ? record.thoughts.filter(item => typeof item === 'string')
          : undefined
        const steps = Array.isArray(record.steps)
          ? record.steps.filter(item => typeof item === 'string')
          : undefined
        emitFollowUp({ message, thoughts, steps })
      }
      const followUpResult = await withRateLimitRetry(
        async () => {
          followUpText = ''
          const followUpStream = client.messages
            .stream({
              model: modelId,
              max_tokens: resolveMaxTokens(settings.maxTokens),
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
              tools: [toolSchema, ...(mcpTools as (typeof toolSchema)[])],
              tool_choice: { type: 'auto' }
            })
            .on('text', text => {
              followUpText += text
              emitFollowUp({ message: followUpText })
            })
            .on('thinking', (_, thinkingSnapshot) => {
              emitFollowUp({ thoughts: [thinkingSnapshot] })
            })
            .on('inputJson', (_partial, jsonSnapshot) => {
              extractFollowUpSnapshot(jsonSnapshot)
            })

          const followUpMessage = await followUpStream.finalMessage()
          return {
            followUpMessage,
            followUpRawText: followUpText || extractTextContent(followUpMessage.content)
          }
        },
        (attempt, delayMs, error) => {
          const message =
            error?.status === 429 || /429|rate limit/i.test(String(error?.message || ''))
              ? `请求过于频繁，${delayMs}ms 后重试（${attempt}/3）…`
              : `连接中断，${delayMs}ms 后重试（${attempt}/3）…`
          emitFollowUp({ message })
        }
      )
      const followUpMessage = followUpResult.followUpMessage
      const followUpRawText = followUpResult.followUpRawText

      // 检查是否有 browser_actions 工具调用
      const followUpToolUses = extractBrowserToolUses(followUpMessage.content as any[] | undefined)
      const followUpParsedInputs = parseToolInputs(followUpToolUses)
      let followUpParsed: z.infer<typeof responseSchema> | null = null
      if (followUpParsedInputs.parsedInputs.length > 0) {
        followUpParsed = mergeParsedPayloads(followUpParsedInputs.parsedInputs)
      }

      if (!followUpParsed) {
        const { candidate } = canParseStructured(followUpRawText)
        if (candidate) {
          const repaired = repairJson(candidate) || candidate
          try {
            followUpParsed = parseResponsePayload(JSON.parse(repaired))
          } catch {
            followUpParsed = null
          }
        }
      }

      if (!followUpParsed) {
        const yamlLikeCandidate = parseYamlLikeFormat(followUpRawText)
        if (yamlLikeCandidate) {
          try {
            followUpParsed = parseResponsePayload(JSON.parse(yamlLikeCandidate))
          } catch {
            followUpParsed = null
          }
        }
      }

      const content =
        followUpParsed?.message?.trim() ||
        followUpParsed?.steps?.[0]?.trim() ||
        followUpRawText.trim() ||
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

      return {
        message: {
          id: nanoid(),
          role: 'assistant',
          content
        },
        actions:
          followUpParsed?.actions?.map(action => ({
            ...action,
            id: action.id || nanoid()
          })) || [],
        toolUseId:
          followUpParsedInputs.toolUseIds.length === 1
            ? followUpParsedInputs.toolUseIds[0]
            : undefined,
        toolInput:
          followUpParsedInputs.parsedInputs.length === 1
            ? followUpParsedInputs.parsedInputs[0]
            : undefined,
        toolUseIds: followUpParsedInputs.toolUseIds,
        toolInputs: followUpParsedInputs.parsedInputs,
        parallelActions: followUpParsed?.parallelActions,
        thoughts: followUpParsed?.thoughts,
        steps: followUpParsed?.steps
      }
    }

    if (!firstPass.parsed) {
      const fallbackContent = firstPass.rawText.trim() || '已完成任务。'
      // 结束上下文（无解析结果）
      endContext(executionContextId, {
        success: true,
        output: fallbackContent
      })
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

        return {
          message: {
            id: nanoid(),
            role: 'assistant',
            content: errorContent
          },
          actions: []
        }
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

      const aggregated = await streamClaudeTools({
        client,
        model: modelId,
        system: `${system}\n不要再调用子代理。`,
        prompt: aggregatePrompt,
        onUpdate: message => options?.onUpdate?.({ message }),
        forceTool: false,
        maxTokens: resolveMaxTokens(settings.maxTokens)
      })

      if (!aggregated.parsed) {
        const fallbackContent = aggregated.rawText.trim() || '已完成任务。'
        // 结束上下文（子代理汇总完成）
        endContext(executionContextId, {
          success: true,
          output: fallbackContent
        })
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

      // 结束上下文（子代理汇总完成）
      endContext(executionContextId, {
        success: true,
        output: aggregatedContent,
        memoryUpdates: aggregated.parsed?.memory?.set
      })

      return {
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

    // 结束执行上下文（成功）
    endContext(executionContextId, {
      success: true,
      output: content,
      memoryUpdates: firstPass.parsed.memory?.set
    })

    return {
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
      steps: firstPass.parsed.steps
    }
  } catch (error: any) {
    // 结束执行上下文（失败）
    endContext(executionContextId, {
      success: false,
      error: error?.message || 'Claude Agent 请求失败。'
    })
    return {
      error: error?.message || 'Claude Agent 请求失败。'
    }
  }
}

export async function runAgentFollowup(
  input: string,
  toolUses: { id: string; input: z.infer<typeof responseSchema> }[],
  toolResult: AgentActionResult[],
  settings: AgentSettings,
  subagent?: SubAgentConfig,
  context?: { tab?: TabContext },
  options?: {
    onUpdate?: (update: { message?: string; thoughts?: string[]; steps?: string[] }) => void
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
    const emitUpdate = (payload: { message?: string; thoughts?: string[]; steps?: string[] }) => {
      if (!options?.onUpdate) return
      if (!payload.message && !payload.thoughts && !payload.steps) return
      options.onUpdate(payload)
    }
    const extractFromSnapshot = (snapshot: unknown) => {
      if (!snapshot || typeof snapshot !== 'object') return
      const record = snapshot as Record<string, unknown>
      const message = typeof record.message === 'string' ? record.message : undefined
      const thoughts = Array.isArray(record.thoughts)
        ? record.thoughts.filter(item => typeof item === 'string')
        : undefined
      const steps = Array.isArray(record.steps)
        ? record.steps.filter(item => typeof item === 'string')
        : undefined
      emitUpdate({ message, thoughts, steps })
    }
    const followupResult = await withRateLimitRetry(
      async () => {
        streamedText = ''
        const stream = client.messages
          .stream({
            model: modelId,
            max_tokens: resolveMaxTokens(settings.maxTokens),
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
            tool_choice: { type: 'auto' }
          })
          .on('text', text => {
            streamedText += text
            emitUpdate({ message: streamedText })
          })
          .on('thinking', (_, thinkingSnapshot) => {
            emitUpdate({ thoughts: [thinkingSnapshot] })
          })
          .on('inputJson', (_partial, jsonSnapshot) => {
            extractFromSnapshot(jsonSnapshot)
          })

        const finalMessage = await stream.finalMessage()
        return {
          finalMessage,
          rawText: streamedText || extractTextContent(finalMessage.content)
        }
      },
      (attempt, delayMs, error) => {
        const message =
          error?.status === 429 || /429|rate limit/i.test(String(error?.message || ''))
            ? `请求过于频繁，${delayMs}ms 后重试（${attempt}/3）…`
            : `连接中断，${delayMs}ms 后重试（${attempt}/3）…`
        emitUpdate({ message })
      }
    )

    const finalMessage = followupResult.finalMessage
    const rawText = followupResult.rawText
    const followUpToolUses = extractBrowserToolUses(finalMessage.content as any[] | undefined)
    const followUpParsedInputs = parseToolInputs(followUpToolUses)

    let parsed: z.infer<typeof responseSchema> | null = null
    if (followUpParsedInputs.parsedInputs.length > 0) {
      parsed = mergeParsedPayloads(followUpParsedInputs.parsedInputs)
    }

    if (!parsed) {
      const { candidate } = canParseStructured(rawText)
      if (candidate) {
        const repaired = repairJson(candidate) || candidate
        try {
          parsed = parseResponsePayload(JSON.parse(repaired))
        } catch {
          parsed = null
        }
      }
    }

    // Try YAML-like format as fallback (for models like GLM-4.7-flash)
    if (!parsed) {
      const yamlLikeCandidate = parseYamlLikeFormat(rawText)
      if (yamlLikeCandidate) {
        try {
          parsed = parseResponsePayload(JSON.parse(yamlLikeCandidate))
        } catch {
          parsed = null
        }
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
      toolUseId:
        followUpParsedInputs.toolUseIds.length === 1
          ? followUpParsedInputs.toolUseIds[0]
          : undefined,
      toolInput:
        followUpParsedInputs.parsedInputs.length === 1
          ? followUpParsedInputs.parsedInputs[0]
          : undefined,
      toolUseIds: followUpParsedInputs.toolUseIds,
      toolInputs: followUpParsedInputs.parsedInputs,
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
