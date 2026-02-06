/**
 * Agent 上下文管理
 *
 * 确保 subagent 之间不会串上下文导致错误
 * 每个 agent 执行有独立的上下文边界
 */

import { nanoid } from 'nanoid'

import {
  setRuntimeContext,
  getRuntimeContext,
  clearRuntimeContext,
  loadRuntimeContext,
  saveRuntimeContext,
  addMemory,
  loadMemoryLayer
} from './memory'

// ============ 类型定义 ============

export type AgentContextType = 'master' | 'subagent' | 'mcp'

export interface AgentExecutionContext {
  id: string
  type: AgentContextType
  parentId?: string // 父级上下文 ID（用于 subagent）
  sessionId: string // 会话 ID（同一会话的所有 agent 共享）
  agentId?: string // 具体的 agent 配置 ID
  agentName?: string // agent 名称
  startedAt: number
  input: string // 原始输入
  isolated: boolean // 是否隔离上下文
}

export interface ContextSnapshot {
  contextId: string
  timestamp: number
  runtimeContext: Record<string, string>
  memoryKeys: string[]
}

// ============ 存储 ============

const CONTEXT_STACK_KEY = 'ai-agent-context-stack-v1'
const CONTEXT_SNAPSHOTS_KEY = 'ai-agent-context-snapshots-v1'
const MAX_SNAPSHOTS = 10

// 当前执行的上下文栈
let contextStack: AgentExecutionContext[] = []

function loadContextStack(): AgentExecutionContext[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(CONTEXT_STACK_KEY)
    if (!raw) return []
    return JSON.parse(raw) as AgentExecutionContext[]
  } catch {
    return []
  }
}

function saveContextStack(stack: AgentExecutionContext[]): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(CONTEXT_STACK_KEY, JSON.stringify(stack))
}

function loadSnapshots(): ContextSnapshot[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(CONTEXT_SNAPSHOTS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ContextSnapshot[]
  } catch {
    return []
  }
}

function saveSnapshots(snapshots: ContextSnapshot[]): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(CONTEXT_SNAPSHOTS_KEY, JSON.stringify(snapshots.slice(0, MAX_SNAPSHOTS)))
}

// ============ 上下文生命周期 ============

/**
 * 开始新的执行上下文
 * @param type 上下文类型
 * @param input 用户输入
 * @param options 选项
 * @returns 上下文 ID
 */
export function beginContext(
  type: AgentContextType,
  input: string,
  options?: {
    sessionId?: string
    parentId?: string
    agentId?: string
    agentName?: string
    isolated?: boolean
  }
): string {
  const contextId = nanoid()
  const parentContext = contextStack.length > 0 ? contextStack[contextStack.length - 1] : null

  // 如果是 subagent 且需要隔离，先保存当前上下文快照
  const shouldIsolate = options?.isolated ?? type === 'subagent'
  if (shouldIsolate && parentContext) {
    saveContextSnapshot(parentContext.id)
  }

  const context: AgentExecutionContext = {
    id: contextId,
    type,
    parentId: options?.parentId || parentContext?.id,
    sessionId: options?.sessionId || parentContext?.sessionId || nanoid(),
    agentId: options?.agentId,
    agentName: options?.agentName,
    startedAt: Date.now(),
    input,
    isolated: shouldIsolate
  }

  contextStack.push(context)
  saveContextStack(contextStack)

  // 设置上下文标识到运行时
  setRuntimeContext('__context_id', contextId, { type: 'state', ttl: 30 * 60 * 1000 })
  setRuntimeContext('__context_type', type, { type: 'state', ttl: 30 * 60 * 1000 })
  setRuntimeContext('__session_id', context.sessionId, { type: 'state', ttl: 30 * 60 * 1000 })

  if (context.agentName) {
    setRuntimeContext('__agent_name', context.agentName, { type: 'state', ttl: 30 * 60 * 1000 })
  }

  // 如果是隔离模式，清理非持久化的运行时上下文
  if (shouldIsolate) {
    clearVolatileContext()
  }

  return contextId
}

/**
 * 结束当前执行上下文
 * @param contextId 上下文 ID
 * @param result 执行结果
 */
export function endContext(
  contextId: string,
  result?: {
    success: boolean
    output?: string
    error?: string
    memoryUpdates?: Record<string, string>
  }
): void {
  const index = contextStack.findIndex(ctx => ctx.id === contextId)
  if (index === -1) return

  const context = contextStack[index]

  // 如果有记忆更新，根据上下文类型决定是否合并到父级
  if (result?.memoryUpdates && Object.keys(result.memoryUpdates).length > 0) {
    if (context.type === 'subagent' && context.isolated) {
      // 隔离的 subagent：只将重要结果提升到父级上下文
      promoteSubagentResults(context, result.memoryUpdates, result.success)
    } else {
      // 非隔离：直接更新
      for (const [key, value] of Object.entries(result.memoryUpdates)) {
        addMemory('observation', key, value, {
          source: context.type === 'master' ? 'user' : 'system',
          importance: result.success ? 6 : 4
        })
      }
    }
  }

  // 如果是隔离模式，恢复父级上下文
  if (context.isolated && context.parentId) {
    restoreContextSnapshot(context.parentId)
  }

  // 移除当前上下文
  contextStack = contextStack.filter(ctx => ctx.id !== contextId)
  saveContextStack(contextStack)

  // 恢复上下文标识
  const parentContext = contextStack.length > 0 ? contextStack[contextStack.length - 1] : null
  if (parentContext) {
    setRuntimeContext('__context_id', parentContext.id, { type: 'state' })
    setRuntimeContext('__context_type', parentContext.type, { type: 'state' })
    if (parentContext.agentName) {
      setRuntimeContext('__agent_name', parentContext.agentName, { type: 'state' })
    }
  }
}

/**
 * 获取当前执行上下文
 */
export function getCurrentContext(): AgentExecutionContext | null {
  if (contextStack.length === 0) {
    contextStack = loadContextStack()
  }
  return contextStack.length > 0 ? contextStack[contextStack.length - 1] : null
}

/**
 * 获取上下文链（从根到当前）
 */
export function getContextChain(): AgentExecutionContext[] {
  if (contextStack.length === 0) {
    contextStack = loadContextStack()
  }
  return [...contextStack]
}

/**
 * 检查是否在 subagent 上下文中
 */
export function isInSubagentContext(): boolean {
  const current = getCurrentContext()
  return current?.type === 'subagent'
}

/**
 * 获取根会话 ID
 */
export function getRootSessionId(): string | null {
  if (contextStack.length === 0) {
    contextStack = loadContextStack()
  }
  return contextStack.length > 0 ? contextStack[0].sessionId : null
}

// ============ 上下文快照 ============

/**
 * 保存上下文快照
 */
function saveContextSnapshot(contextId: string): void {
  const runtime = loadRuntimeContext()
  const memory = loadMemoryLayer()

  // 过滤掉系统键
  const runtimeData: Record<string, string> = {}
  for (const entry of runtime) {
    if (!entry.key.startsWith('__')) {
      runtimeData[entry.key] = entry.value
    }
  }

  const snapshot: ContextSnapshot = {
    contextId,
    timestamp: Date.now(),
    runtimeContext: runtimeData,
    memoryKeys: memory.map(m => m.key)
  }

  const snapshots = loadSnapshots()
  // 移除旧的同 ID 快照
  const filtered = snapshots.filter(s => s.contextId !== contextId)
  saveSnapshots([snapshot, ...filtered])
}

/**
 * 恢复上下文快照
 */
function restoreContextSnapshot(contextId: string): void {
  const snapshots = loadSnapshots()
  const snapshot = snapshots.find(s => s.contextId === contextId)
  if (!snapshot) return

  // 恢复运行时上下文
  const runtime = loadRuntimeContext()
  const systemKeys = runtime.filter(e => e.key.startsWith('__'))

  // 清理当前非系统运行时上下文
  clearRuntimeContext()

  // 恢复系统键
  for (const entry of systemKeys) {
    setRuntimeContext(entry.key, entry.value, { type: entry.type, ttl: entry.ttl })
  }

  // 恢复快照数据
  for (const [key, value] of Object.entries(snapshot.runtimeContext)) {
    setRuntimeContext(key, value, { type: 'variable' })
  }
}

/**
 * 清理易失性上下文（用于隔离模式）
 */
function clearVolatileContext(): void {
  const runtime = loadRuntimeContext()
  // 保留系统键和任务相关键
  const preserved = runtime.filter(
    e => e.key.startsWith('__') || e.type === 'task' || e.type === 'state'
  )
  saveRuntimeContext(preserved)
}

/**
 * 将 subagent 结果提升到父级上下文
 */
function promoteSubagentResults(
  context: AgentExecutionContext,
  updates: Record<string, string>,
  success: boolean
): void {
  const prefix = context.agentName ? `[${context.agentName}] ` : ''

  for (const [key, value] of Object.entries(updates)) {
    // 使用带前缀的键以避免覆盖父级数据
    const prefixedKey = `subagent_result_${context.id}_${key}`

    addMemory('observation', prefixedKey, `${prefix}${value}`, {
      source: 'system',
      importance: success ? 5 : 3,
      context: `来自子代理: ${context.agentName || context.agentId || 'unknown'}`
    })
  }
}

// ============ 上下文感知的记忆操作 ============

/**
 * 在当前上下文中设置记忆（上下文感知）
 */
export function setContextAwareMemory(key: string, value: string): void {
  const context = getCurrentContext()

  if (context?.isolated && context.type === 'subagent') {
    // 隔离的 subagent：使用带上下文前缀的键
    const scopedKey = `${context.id}::${key}`
    setRuntimeContext(scopedKey, value, {
      type: 'variable',
      sessionId: context.sessionId
    })
  } else {
    // 非隔离或 master：直接设置
    setRuntimeContext(key, value, {
      type: 'variable',
      sessionId: context?.sessionId
    })
  }
}

/**
 * 从当前上下文获取记忆（上下文感知）
 */
export function getContextAwareMemory(key: string): string | undefined {
  const context = getCurrentContext()

  if (context?.isolated && context.type === 'subagent') {
    // 先尝试获取本地作用域的值
    const scopedKey = `${context.id}::${key}`
    const scoped = getRuntimeContext(scopedKey)
    if (scoped !== undefined) return scoped

    // 回退到全局（只读访问父级上下文）
    return getRuntimeContext(key)
  }

  return getRuntimeContext(key)
}

// ============ 调试和诊断 ============

/**
 * 获取上下文诊断信息
 */
export function getContextDiagnostics(): {
  currentContext: AgentExecutionContext | null
  contextChain: AgentExecutionContext[]
  snapshotCount: number
  runtimeContextSize: number
} {
  const current = getCurrentContext()
  const chain = getContextChain()
  const snapshots = loadSnapshots()
  const runtime = loadRuntimeContext()

  return {
    currentContext: current,
    contextChain: chain,
    snapshotCount: snapshots.length,
    runtimeContextSize: runtime.length
  }
}

/**
 * 强制清理所有上下文（用于重置）
 */
export function forceResetAllContexts(): void {
  contextStack = []
  saveContextStack([])
  saveSnapshots([])
  clearRuntimeContext()
}
