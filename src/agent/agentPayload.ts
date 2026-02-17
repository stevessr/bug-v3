import { nanoid } from 'nanoid'
import { z } from 'zod'

import type { AgentAction } from './types'

// Disable Zod JIT to avoid eval/new Function in CSP-restricted contexts.
z.config({ jitless: true })

const ACTION_TYPES = [
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
] as const

const ACTION_TYPE_SET = new Set<string>(ACTION_TYPES)

const actionSchema = z.object({
  id: z.string().optional(),
  type: z.enum(ACTION_TYPES),
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
  options: z.record(z.string(), z.any()).optional()
})

const listFromString = z.preprocess(
  value => (typeof value === 'string' ? [value] : value),
  z.array(z.string())
)

const normalizeAgentPayload = (payload: unknown): unknown => {
  if (!payload || typeof payload !== 'object') return payload

  const normalized: Record<string, unknown> = { ...(payload as Record<string, unknown>) }

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

      if (type && !ACTION_TYPE_SET.has(type)) {
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

export const responseSchema = z.object({
  message: z.string().optional(),
  actions: z.array(actionSchema).optional(),
  parallelActions: z.boolean().optional(),
  thoughts: listFromString.optional(),
  steps: listFromString.optional(),
  memory: z
    .object({
      set: z.record(z.string(), z.string()).optional(),
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

export interface AgentToolPayload {
  message?: string
  actions?: AgentAction[]
  parallelActions?: boolean
  thoughts?: string[]
  steps?: string[]
  memory?: {
    set?: Record<string, string>
    remove?: string[]
  }
  subagents?: Array<{
    id?: string
    name?: string
    prompt: string
  }>
}

export const parseResponsePayload = (payload: unknown): AgentToolPayload | null => {
  try {
    return responseSchema.parse(normalizeAgentPayload(payload)) as AgentToolPayload
  } catch {
    return null
  }
}

const ensureActionIds = (parsed: AgentToolPayload): void => {
  if (!parsed.actions) return
  for (const action of parsed.actions) {
    if (!action.id) action.id = nanoid()
  }
}

export const mergeParsedPayloads = (payloads: AgentToolPayload[]): AgentToolPayload | null => {
  if (!payloads.length) return null
  if (payloads.length === 1) return payloads[0]

  const merged: AgentToolPayload = {}
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

export interface ParsedToolInputs {
  parsedInputs: AgentToolPayload[]
  toolUseIds: string[]
}

export const extractBrowserToolUses = (content: Array<any> | undefined) =>
  (content || []).filter(
    block => block?.type === 'tool_use' && block?.name === toolSchema.name
  ) as { id?: string; input?: unknown }[]

export const parseToolInputs = (toolUses: { id?: string; input?: unknown }[]): ParsedToolInputs => {
  const parsedInputs: AgentToolPayload[] = []
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

export const toolSchema = {
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
              enum: ACTION_TYPES
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

const repairJson = (raw: string): string | null => {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null

  const candidate = raw.slice(start, end + 1)
  return candidate
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/"thoughts"\s*:\s*([},])/g, '"thoughts":[]$1')
    .replace(/"steps"\s*:\s*([},])/g, '"steps":[]$1')
    .replace(/"actions"\s*:\s*([},])/g, '"actions":[]$1')
    .replace(/"subagents"\s*:\s*([},])/g, '"subagents":[]$1')
    .replace(/"memory"\s*:\s*([},])/g, '"memory":{}$1')
}

const parseYamlLikeFormat = (raw: string): string | null => {
  const text = raw.trim()
  if (!text) return null
  if (text.includes('```')) return null

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

    const keyMatch = trimmedLine.match(
      /^(thoughts|steps|actions|message|parallelActions|memory|subagents)\s*:\s*(.*)$/
    )

    if (keyMatch && bracketDepth === 0) {
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
      bracketDepth =
        (currentValue.match(/[[{]/g) || []).length - (currentValue.match(/[}\]]/g) || []).length
    } else if (inValue) {
      currentValue += '\n' + trimmedLine
      bracketDepth +=
        (trimmedLine.match(/[[{]/g) || []).length - (trimmedLine.match(/[}\]]/g) || []).length
    }
  }

  if (currentKey && currentValue) {
    try {
      result[currentKey] = JSON.parse(currentValue.trim())
    } catch {
      result[currentKey] = currentValue.trim()
    }
  }

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

const canParseStructured = (raw: string): string | null => {
  const fenced = extractSingleCodeFence(raw)
  if (fenced !== null) return fenced
  if (raw.includes('```')) return null

  const trimmed = raw.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed

  return raw
}

export const parsePayloadFromRawText = (rawText: string): AgentToolPayload | null => {
  const candidate = canParseStructured(rawText)
  if (candidate) {
    const repaired = repairJson(candidate) || candidate
    try {
      const parsed = parseResponsePayload(JSON.parse(repaired))
      if (parsed) return parsed
    } catch {
      // continue fallback
    }
  }

  const yamlLikeCandidate = parseYamlLikeFormat(rawText)
  if (yamlLikeCandidate) {
    try {
      return parseResponsePayload(JSON.parse(yamlLikeCandidate))
    } catch {
      return null
    }
  }

  return null
}

export const extractTextContent = (
  content: Array<{ type: string; text?: string }> | undefined
): string => {
  if (!content) return ''
  return content
    .filter(block => block.type === 'text')
    .map(block => block.text || '')
    .join('')
}
