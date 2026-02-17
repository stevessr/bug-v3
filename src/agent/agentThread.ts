import { nanoid } from 'nanoid'

import type { AgentActionResult, AgentSettings, SubAgentConfig } from './types'
import {
  runAgentFollowup,
  runAgentMessage,
  type AgentRunResult,
  type AgentTabContext
} from './agentService'
import type { AgentToolPayload } from './agentPayload'
import type { AgentStreamUpdate } from './agentStreaming'
import type { AgentThreadEvent, Usage } from './agentThreadEvents'
import type {
  AgentMessageItem,
  AgentThreadItem,
  BrowserActionsItem,
  ErrorItem,
  ReasoningItem,
  TodoListItem
} from './agentThreadItems'

export type AgentUserInput = {
  type: 'text'
  text: string
}

export type AgentInput = string | AgentUserInput[]

type SettingsProvider = () => AgentSettings

export interface AgentThreadOptions {
  subagent?: SubAgentConfig
  context?: { tab?: AgentTabContext }
  isolated?: boolean
}

export interface AgentThreadTurnOptions extends AgentThreadOptions {
  onUpdate?: (update: AgentStreamUpdate) => void
}

export type AgentTurn = {
  items: AgentThreadItem[]
  finalResponse: string
  usage: Usage
  result: AgentRunResult
}

export type AgentStreamedTurn = {
  events: AsyncGenerator<AgentThreadEvent>
  completion: Promise<AgentRunResult>
}

type ThreadItemIds = {
  message: string
  reasoning: string
  steps: string
  actions: string
}

type ThreadItemIdOverrides = Partial<ThreadItemIds>

class AsyncEventQueue<T> {
  private values: T[] = []
  private pending: Array<(result: IteratorResult<T>) => void> = []
  private finished = false

  push(value: T) {
    if (this.finished) return
    const resolver = this.pending.shift()
    if (resolver) {
      resolver({ value, done: false })
      return
    }
    this.values.push(value)
  }

  close() {
    if (this.finished) return
    this.finished = true
    while (this.pending.length > 0) {
      const resolver = this.pending.shift()
      resolver?.({ value: undefined as T, done: true })
    }
  }

  async *stream(): AsyncGenerator<T> {
    while (true) {
      if (this.values.length > 0) {
        yield this.values.shift() as T
        continue
      }

      if (this.finished) {
        return
      }

      const next = await new Promise<IteratorResult<T>>(resolve => {
        this.pending.push(resolve)
      })

      if (next.done) {
        return
      }

      yield next.value
    }
  }
}

const normalizeInput = (input: AgentInput): string => {
  if (typeof input === 'string') return input
  return input
    .filter(item => item.type === 'text')
    .map(item => item.text)
    .join('\n\n')
}

const toTodoItems = (steps: string[]) => steps.map(text => ({ text, completed: false }))

const toThreadItems = (
  result: AgentRunResult,
  ids: ThreadItemIdOverrides = {}
): AgentThreadItem[] => {
  const items: AgentThreadItem[] = []

  if (result.thoughts?.length) {
    const reasoning: ReasoningItem = {
      id: ids.reasoning || nanoid(),
      type: 'reasoning',
      text: result.thoughts.join('\n')
    }
    items.push(reasoning)
  }

  if (result.steps?.length) {
    items.push({
      id: ids.steps || nanoid(),
      type: 'todo_list',
      items: toTodoItems(result.steps)
    })
  }

  if (result.actions?.length) {
    const actions: BrowserActionsItem = {
      id: ids.actions || nanoid(),
      type: 'browser_actions',
      actions: result.actions,
      toolUseIds:
        result.toolUseIds && result.toolUseIds.length > 0
          ? result.toolUseIds
          : result.toolUseId
            ? [result.toolUseId]
            : [],
      toolInputs:
        result.toolInputs && result.toolInputs.length > 0
          ? result.toolInputs
          : result.toolInput
            ? [result.toolInput]
            : [],
      parallelActions: result.parallelActions
    }
    items.push(actions)
  }

  if (result.message?.content) {
    const message: AgentMessageItem = {
      id: ids.message || result.message.id,
      type: 'agent_message',
      text: result.message.content
    }
    items.push(message)
  }

  if (result.error) {
    const error: ErrorItem = {
      id: nanoid(),
      type: 'error',
      message: result.error
    }
    items.push(error)
  }

  return items
}

const mapUpdateToThreadItems = (
  update: AgentStreamUpdate,
  ids: Pick<ThreadItemIds, 'message' | 'reasoning' | 'steps' | 'actions'>
) => {
  const items: AgentThreadItem[] = []

  if (update.message !== undefined) {
    const message: AgentMessageItem = {
      id: ids.message,
      type: 'agent_message',
      text: update.message
    }
    items.push(message)
  }

  if (update.thoughts?.length) {
    const reasoning: ReasoningItem = {
      id: ids.reasoning,
      type: 'reasoning',
      text: update.thoughts.join('\n')
    }
    items.push(reasoning)
  }

  if (update.steps?.length) {
    const todo: TodoListItem = {
      id: ids.steps,
      type: 'todo_list',
      items: toTodoItems(update.steps)
    }
    items.push(todo)
  }

  if (update.actions?.length) {
    const browserActions: BrowserActionsItem = {
      id: ids.actions,
      type: 'browser_actions',
      actions: update.actions,
      parallelActions: update.parallelActions
    }
    items.push(browserActions)
  }

  return items
}

export class AgentThread {
  private readonly settingsProvider: SettingsProvider
  private readonly defaults: AgentThreadOptions
  private _id: string | null
  private emitThreadStarted: boolean

  constructor(
    settingsProvider: SettingsProvider,
    id: string | null,
    defaults: AgentThreadOptions = {},
    emitThreadStarted = false
  ) {
    this.settingsProvider = settingsProvider
    this.defaults = defaults
    this._id = id
    this.emitThreadStarted = emitThreadStarted
  }

  get id(): string | null {
    return this._id
  }

  async runRaw(input: AgentInput, options: AgentThreadTurnOptions = {}): Promise<AgentRunResult> {
    if (!this._id) {
      this._id = nanoid()
    }
    this.emitThreadStarted = false
    const result = await runAgentMessage(
      normalizeInput(input),
      this.settingsProvider(),
      options.subagent || this.defaults.subagent,
      options.context || this.defaults.context,
      {
        onUpdate: options.onUpdate,
        sessionId: this._id || undefined,
        isolated: options.isolated ?? this.defaults.isolated
      }
    )

    if (result.threadId) {
      this._id = result.threadId
    }

    return result
  }

  async run(input: AgentInput, options: AgentThreadTurnOptions = {}): Promise<AgentTurn> {
    const streamed = await this.runStreamed(input, options)
    const items: AgentThreadItem[] = []
    let finalResponse = ''
    let usage: Usage = null
    let turnFailure: string | null = null

    for await (const event of streamed.events) {
      if (event.type === 'item.completed') {
        items.push(event.item)
        if (event.item.type === 'agent_message') {
          finalResponse = event.item.text
        }
      } else if (event.type === 'turn.completed') {
        usage = event.usage
      } else if (event.type === 'turn.failed') {
        turnFailure = event.error.message
      } else if (event.type === 'error') {
        turnFailure = event.message
      }
    }

    let result: AgentRunResult
    try {
      result = await streamed.completion
    } catch (error: any) {
      if (turnFailure) {
        throw new Error(turnFailure)
      }
      throw error
    }

    if (turnFailure) {
      throw new Error(turnFailure)
    }
    if (result.error) {
      throw new Error(result.error)
    }

    return {
      items,
      finalResponse: finalResponse || result.message?.content || '',
      usage,
      result
    }
  }

  async runTurn(input: AgentInput, options: AgentThreadTurnOptions = {}): Promise<AgentTurn> {
    return this.run(input, options)
  }

  private async buildStreamedTurn(
    execute: (onUpdate: (update: AgentStreamUpdate) => void) => Promise<AgentRunResult>,
    onExternalUpdate?: (update: AgentStreamUpdate) => void
  ): Promise<AgentStreamedTurn> {
    const queue = new AsyncEventQueue<AgentThreadEvent>()
    const shouldEmitThreadStarted = this.emitThreadStarted
    this.emitThreadStarted = false

    const itemIds = {
      message: nanoid(),
      reasoning: nanoid(),
      steps: nanoid(),
      actions: nanoid()
    }
    const itemStarted = new Set<string>()
    const latestStreamItems = new Map<string, AgentThreadItem>()

    const completion = (async () => {
      if (shouldEmitThreadStarted) {
        if (!this._id) {
          this._id = nanoid()
        }
        queue.push({ type: 'thread.started', thread_id: this._id })
      }
      queue.push({ type: 'turn.started' })

      const result = await execute(update => {
        onExternalUpdate?.(update)
        const items = mapUpdateToThreadItems(update, itemIds)
        for (const item of items) {
          const eventType = itemStarted.has(item.id) ? 'item.updated' : 'item.started'
          queue.push({ type: eventType, item })
          itemStarted.add(item.id)
          latestStreamItems.set(item.id, item)
        }
      })

      if (result.error) {
        const item: ErrorItem = {
          id: nanoid(),
          type: 'error',
          message: result.error
        }
        queue.push({ type: 'item.completed', item })
        queue.push({ type: 'turn.failed', error: { message: result.error } })
        queue.close()
        return result
      }

      const finalItems = toThreadItems(result, {
        message: itemStarted.has(itemIds.message) ? itemIds.message : undefined,
        reasoning: itemStarted.has(itemIds.reasoning) ? itemIds.reasoning : undefined,
        steps: itemStarted.has(itemIds.steps) ? itemIds.steps : undefined,
        actions: itemIds.actions
      })

      const hasType = (type: AgentThreadItem['type']) => finalItems.some(item => item.type === type)

      if (!hasType('agent_message') && itemStarted.has(itemIds.message)) {
        const latest = latestStreamItems.get(itemIds.message)
        if (latest?.type === 'agent_message') {
          finalItems.push({
            id: itemIds.message,
            type: 'agent_message',
            text: latest.text
          })
        }
      }

      if (!hasType('reasoning') && itemStarted.has(itemIds.reasoning)) {
        const latest = latestStreamItems.get(itemIds.reasoning)
        if (latest?.type === 'reasoning') {
          finalItems.push({
            id: itemIds.reasoning,
            type: 'reasoning',
            text: latest.text
          })
        }
      }

      if (!hasType('todo_list') && itemStarted.has(itemIds.steps)) {
        const latest = latestStreamItems.get(itemIds.steps)
        if (latest?.type === 'todo_list') {
          finalItems.push({
            id: itemIds.steps,
            type: 'todo_list',
            items: latest.items
          })
        }
      }

      for (const item of finalItems) {
        queue.push({ type: 'item.completed', item })
      }

      queue.push({ type: 'turn.completed', usage: result.usage || null })
      queue.close()
      return result
    })().catch((error: any) => {
      const message = error?.message || '线程执行失败'
      queue.push({ type: 'error', message })
      queue.push({ type: 'turn.failed', error: { message } })
      queue.close()
      throw error
    })

    return {
      events: queue.stream(),
      completion
    }
  }

  async runStreamed(
    input: AgentInput,
    options: AgentThreadTurnOptions = {}
  ): Promise<AgentStreamedTurn> {
    return this.buildStreamedTurn(
      onUpdate => this.runRaw(input, { ...options, onUpdate }),
      options.onUpdate
    )
  }

  async runFollowup(
    input: AgentInput,
    toolUses: { id: string; input: AgentToolPayload }[],
    toolResult: AgentActionResult[],
    options: AgentThreadTurnOptions = {}
  ): Promise<AgentRunResult> {
    if (!this._id) {
      this._id = nanoid()
    }
    this.emitThreadStarted = false
    const result = await runAgentFollowup(
      normalizeInput(input),
      toolUses,
      toolResult,
      this.settingsProvider(),
      options.subagent || this.defaults.subagent,
      options.context || this.defaults.context,
      {
        onUpdate: options.onUpdate,
        sessionId: this._id || undefined,
        isolated: options.isolated ?? this.defaults.isolated
      }
    )

    if (result.threadId) {
      this._id = result.threadId
    }

    return result
  }

  async runFollowupStreamed(
    input: AgentInput,
    toolUses: { id: string; input: AgentToolPayload }[],
    toolResult: AgentActionResult[],
    options: AgentThreadTurnOptions = {}
  ): Promise<AgentStreamedTurn> {
    return this.buildStreamedTurn(
      onUpdate => this.runFollowup(input, toolUses, toolResult, { ...options, onUpdate }),
      options.onUpdate
    )
  }
}

export interface AgentCodexOptions {
  settings: AgentSettings | (() => AgentSettings)
  threadDefaults?: AgentThreadOptions
}

export class AgentCodex {
  private readonly settingsProvider: SettingsProvider
  private readonly threadDefaults: AgentThreadOptions

  constructor(options: AgentCodexOptions) {
    if (typeof options.settings === 'function') {
      this.settingsProvider = options.settings as () => AgentSettings
    } else {
      const snapshot = options.settings
      this.settingsProvider = () => snapshot
    }
    this.threadDefaults = options.threadDefaults || {}
  }

  startThread(options: AgentThreadOptions = {}): AgentThread {
    return new AgentThread(
      this.settingsProvider,
      null,
      {
        ...this.threadDefaults,
        ...options
      },
      true
    )
  }

  resumeThread(id: string, options: AgentThreadOptions = {}): AgentThread {
    return new AgentThread(this.settingsProvider, id, {
      ...this.threadDefaults,
      ...options
    })
  }
}
