/**
 * Agent 多层记忆系统
 *
 * 基于 OpenAI 数据代理论文的四层记忆架构：
 * 1. 工作记忆 (Working Memory) - 当前任务的即时上下文，容量小但访问快
 * 2. 情节记忆 (Episodic Memory) - 具体的对话和交互历史，按时间组织
 * 3. 语义记忆 (Semantic Memory) - 抽象的知识和事实，持久存储
 * 4. 程序记忆 (Procedural Memory) - 学习到的技能和操作模式
 */

// ============ 存储键 ============
const WORKING_MEMORY_KEY = 'ai-agent-memory-working-v3'
const EPISODIC_MEMORY_KEY = 'ai-agent-memory-episodic-v3'
const SEMANTIC_MEMORY_KEY = 'ai-agent-memory-semantic-v3'
const PROCEDURAL_MEMORY_KEY = 'ai-agent-memory-procedural-v3'

// ============ 容量限制 ============
const MAX_WORKING_MEMORY = 20 // 工作记忆：最近 20 条，高频访问
const MAX_EPISODIC_MEMORY = 100 // 情节记忆：最近 100 个交互片段
const MAX_SEMANTIC_MEMORY = 500 // 语义记忆：最多 500 条知识
const MAX_PROCEDURAL_MEMORY = 100 // 程序记忆：最多 100 个技能模式

// ============ 类型定义 ============

export type MemoryCategory = 'preference' | 'fact' | 'task' | 'context' | 'skill'
export type MemoryLayer = 'working' | 'episodic' | 'semantic' | 'procedural'

/**
 * 工作记忆条目 - 当前任务的即时上下文
 */
export interface WorkingMemoryEntry {
  key: string
  value: string
  timestamp: number
  ttl?: number // 可选的生存时间（毫秒）
}

/**
 * 情节记忆条目 - 对话和交互历史
 */
export interface EpisodicMemoryEntry {
  id: string
  timestamp: number
  type: 'conversation' | 'action' | 'observation' | 'result'
  content: string
  context?: string
  entities?: string[] // 提取的实体
  sentiment?: 'positive' | 'neutral' | 'negative'
  importance: number // 1-10
}

/**
 * 语义记忆条目 - 抽象知识和事实
 */
export interface SemanticMemoryEntry {
  id: string
  category: MemoryCategory
  key: string
  value: string
  source?: string // 来源
  confidence: number // 0-1
  createdAt: number
  updatedAt: number
  accessCount: number
  embeddings?: number[] // 可选的向量嵌入
}

/**
 * 程序记忆条目 - 技能和操作模式
 */
export interface ProceduralMemoryEntry {
  id: string
  name: string
  description: string
  trigger: string // 触发条件
  steps: string[] // 操作步骤
  successRate: number // 成功率 0-1
  executionCount: number
  lastExecutedAt?: number
  createdAt: number
  updatedAt: number
}

/**
 * 记忆统计信息
 */
export interface MemoryStats {
  working: { count: number; oldestTimestamp: number }
  episodic: { count: number; oldestTimestamp: number }
  semantic: { count: number; totalAccessCount: number }
  procedural: { count: number; totalExecutions: number }
  lastAccess: number
}

// ============ 存储操作 ============

function getStorage(): Storage | null {
  if (typeof localStorage !== 'undefined') return localStorage
  return null
}

function loadFromStorage<T>(key: string, defaultValue: T): T {
  const storage = getStorage()
  if (!storage) return defaultValue
  try {
    const raw = storage.getItem(key)
    if (!raw) return defaultValue
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return defaultValue
    return parsed as T
  } catch {
    return defaultValue
  }
}

function saveToStorage<T>(key: string, data: T): void {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.setItem(key, JSON.stringify(data))
  } catch {
    console.warn('[Memory] Storage quota exceeded, cleaning up')
    // 尝试清理最旧的数据
    cleanupOldestMemories()
  }
}

// ============ 工作记忆 (Working Memory) ============

export function loadWorkingMemory(): WorkingMemoryEntry[] {
  const entries = loadFromStorage<WorkingMemoryEntry[]>(WORKING_MEMORY_KEY, [])
  // 过滤掉已过期的条目
  const now = Date.now()
  return entries.filter(e => !e.ttl || now - e.timestamp < e.ttl)
}

export function saveWorkingMemory(entries: WorkingMemoryEntry[]): void {
  // 按时间排序，保留最新的
  const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp)
  const trimmed = sorted.slice(0, MAX_WORKING_MEMORY)
  saveToStorage(WORKING_MEMORY_KEY, trimmed)
}

export function setWorkingMemory(key: string, value: string, ttl?: number): void {
  const entries = loadWorkingMemory()
  const now = Date.now()

  const existingIndex = entries.findIndex(e => e.key === key)
  if (existingIndex >= 0) {
    entries[existingIndex] = { key, value, timestamp: now, ttl }
  } else {
    entries.push({ key, value, timestamp: now, ttl })
  }

  saveWorkingMemory(entries)
}

export function getWorkingMemory(key: string): string | undefined {
  const entries = loadWorkingMemory()
  return entries.find(e => e.key === key)?.value
}

export function clearWorkingMemory(): void {
  saveToStorage(WORKING_MEMORY_KEY, [])
}

// ============ 情节记忆 (Episodic Memory) ============

export function loadEpisodicMemory(): EpisodicMemoryEntry[] {
  return loadFromStorage<EpisodicMemoryEntry[]>(EPISODIC_MEMORY_KEY, [])
}

export function saveEpisodicMemory(entries: EpisodicMemoryEntry[]): void {
  // 按时间排序，保留最新的
  const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp)
  const trimmed = sorted.slice(0, MAX_EPISODIC_MEMORY)
  saveToStorage(EPISODIC_MEMORY_KEY, trimmed)
}

export function addEpisode(
  type: EpisodicMemoryEntry['type'],
  content: string,
  options?: {
    context?: string
    entities?: string[]
    sentiment?: EpisodicMemoryEntry['sentiment']
    importance?: number
  }
): string {
  const entries = loadEpisodicMemory()
  const id = `ep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  entries.push({
    id,
    timestamp: Date.now(),
    type,
    content,
    context: options?.context,
    entities: options?.entities,
    sentiment: options?.sentiment,
    importance: options?.importance ?? 5
  })

  saveEpisodicMemory(entries)
  return id
}

export function searchEpisodes(query: string, limit = 10): EpisodicMemoryEntry[] {
  const entries = loadEpisodicMemory()
  const queryLower = query.toLowerCase()

  return entries
    .filter(
      e =>
        e.content.toLowerCase().includes(queryLower) ||
        e.context?.toLowerCase().includes(queryLower) ||
        e.entities?.some(entity => entity.toLowerCase().includes(queryLower))
    )
    .slice(0, limit)
}

export function getRecentEpisodes(limit = 10): EpisodicMemoryEntry[] {
  const entries = loadEpisodicMemory()
  return entries.slice(0, limit)
}

export function getImportantEpisodes(minImportance = 7, limit = 20): EpisodicMemoryEntry[] {
  const entries = loadEpisodicMemory()
  return entries
    .filter(e => e.importance >= minImportance)
    .sort((a, b) => b.importance - a.importance)
    .slice(0, limit)
}

// ============ 语义记忆 (Semantic Memory) ============

export function loadSemanticMemory(): SemanticMemoryEntry[] {
  return loadFromStorage<SemanticMemoryEntry[]>(SEMANTIC_MEMORY_KEY, [])
}

export function saveSemanticMemory(entries: SemanticMemoryEntry[]): void {
  // 按访问次数和更新时间综合排序
  const sorted = [...entries].sort((a, b) => {
    const scoreA = a.accessCount * 1000 + a.updatedAt / 1000000
    const scoreB = b.accessCount * 1000 + b.updatedAt / 1000000
    return scoreB - scoreA
  })
  const trimmed = sorted.slice(0, MAX_SEMANTIC_MEMORY)
  saveToStorage(SEMANTIC_MEMORY_KEY, trimmed)
}

export function addSemanticKnowledge(
  category: MemoryCategory,
  key: string,
  value: string,
  options?: {
    source?: string
    confidence?: number
  }
): string {
  const entries = loadSemanticMemory()
  const now = Date.now()
  const id = `sem_${now}_${Math.random().toString(36).slice(2, 8)}`

  // 检查是否已存在相同 key
  const existingIndex = entries.findIndex(e => e.key === key)
  if (existingIndex >= 0) {
    // 更新现有条目
    entries[existingIndex].value = value
    entries[existingIndex].updatedAt = now
    entries[existingIndex].accessCount++
    if (options?.confidence !== undefined) {
      entries[existingIndex].confidence = options.confidence
    }
    saveSemanticMemory(entries)
    return entries[existingIndex].id
  }

  entries.push({
    id,
    category,
    key,
    value,
    source: options?.source,
    confidence: options?.confidence ?? 0.8,
    createdAt: now,
    updatedAt: now,
    accessCount: 1
  })

  saveSemanticMemory(entries)
  return id
}

export function getSemanticKnowledge(key: string): SemanticMemoryEntry | undefined {
  const entries = loadSemanticMemory()
  const entry = entries.find(e => e.key === key)

  if (entry) {
    // 更新访问计数
    entry.accessCount++
    entry.updatedAt = Date.now()
    saveSemanticMemory(entries)
  }

  return entry
}

export function searchSemanticMemory(
  query: string,
  options?: {
    category?: MemoryCategory
    minConfidence?: number
    limit?: number
  }
): SemanticMemoryEntry[] {
  const entries = loadSemanticMemory()
  const queryLower = query.toLowerCase()
  const limit = options?.limit ?? 20

  return entries
    .filter(e => {
      if (options?.category && e.category !== options.category) return false
      if (options?.minConfidence && e.confidence < options.minConfidence) return false
      return e.key.toLowerCase().includes(queryLower) || e.value.toLowerCase().includes(queryLower)
    })
    .slice(0, limit)
}

export function getKnowledgeByCategory(
  category: MemoryCategory,
  limit = 50
): SemanticMemoryEntry[] {
  const entries = loadSemanticMemory()
  return entries.filter(e => e.category === category).slice(0, limit)
}

// ============ 程序记忆 (Procedural Memory) ============

export function loadProceduralMemory(): ProceduralMemoryEntry[] {
  return loadFromStorage<ProceduralMemoryEntry[]>(PROCEDURAL_MEMORY_KEY, [])
}

export function saveProceduralMemory(entries: ProceduralMemoryEntry[]): void {
  // 按执行次数和成功率排序
  const sorted = [...entries].sort((a, b) => {
    const scoreA = a.executionCount * a.successRate
    const scoreB = b.executionCount * b.successRate
    return scoreB - scoreA
  })
  const trimmed = sorted.slice(0, MAX_PROCEDURAL_MEMORY)
  saveToStorage(PROCEDURAL_MEMORY_KEY, trimmed)
}

export function addProcedure(
  name: string,
  description: string,
  trigger: string,
  steps: string[]
): string {
  const entries = loadProceduralMemory()
  const now = Date.now()
  const id = `proc_${now}_${Math.random().toString(36).slice(2, 8)}`

  // 检查是否已存在相同名称
  const existingIndex = entries.findIndex(e => e.name === name)
  if (existingIndex >= 0) {
    // 更新现有条目
    entries[existingIndex].description = description
    entries[existingIndex].trigger = trigger
    entries[existingIndex].steps = steps
    entries[existingIndex].updatedAt = now
    saveProceduralMemory(entries)
    return entries[existingIndex].id
  }

  entries.push({
    id,
    name,
    description,
    trigger,
    steps,
    successRate: 0.5, // 初始成功率
    executionCount: 0,
    createdAt: now,
    updatedAt: now
  })

  saveProceduralMemory(entries)
  return id
}

export function executeProcedure(id: string, success: boolean): void {
  const entries = loadProceduralMemory()
  const entry = entries.find(e => e.id === id)

  if (entry) {
    entry.executionCount++
    entry.lastExecutedAt = Date.now()
    // 更新成功率（滑动平均）
    const alpha = 0.3 // 学习率
    entry.successRate = entry.successRate * (1 - alpha) + (success ? 1 : 0) * alpha
    saveProceduralMemory(entries)
  }
}

export function findProcedure(trigger: string): ProceduralMemoryEntry | undefined {
  const entries = loadProceduralMemory()
  const triggerLower = trigger.toLowerCase()

  // 查找匹配的程序
  return entries.find(
    e =>
      e.trigger.toLowerCase().includes(triggerLower) ||
      triggerLower.includes(e.trigger.toLowerCase())
  )
}

export function searchProcedures(query: string, limit = 10): ProceduralMemoryEntry[] {
  const entries = loadProceduralMemory()
  const queryLower = query.toLowerCase()

  return entries
    .filter(
      e =>
        e.name.toLowerCase().includes(queryLower) ||
        e.description.toLowerCase().includes(queryLower) ||
        e.trigger.toLowerCase().includes(queryLower)
    )
    .slice(0, limit)
}

// ============ 记忆整合与提升 ============

/**
 * 将工作记忆中的重要信息提升到语义记忆
 */
export function consolidateWorkingToSemantic(): number {
  const workingEntries = loadWorkingMemory()
  let consolidated = 0

  for (const entry of workingEntries) {
    // 如果工作记忆存在超过 5 分钟，考虑提升
    if (Date.now() - entry.timestamp > 5 * 60 * 1000) {
      addSemanticKnowledge('context', entry.key, entry.value, {
        source: 'working_memory_consolidation'
      })
      consolidated++
    }
  }

  return consolidated
}

/**
 * 从情节记忆中提取语义知识
 */
export function extractSemanticFromEpisodic(): number {
  const episodes = loadEpisodicMemory()
  let extracted = 0

  // 查找高重要性的情节
  const importantEpisodes = episodes.filter(e => e.importance >= 8)

  for (const episode of importantEpisodes) {
    if (episode.entities && episode.entities.length > 0) {
      for (const entity of episode.entities) {
        addSemanticKnowledge('fact', entity, episode.content.slice(0, 200), {
          source: `episodic:${episode.id}`,
          confidence: episode.importance / 10
        })
        extracted++
      }
    }
  }

  return extracted
}

/**
 * 从成功的操作序列中学习程序
 */
export function learnProcedureFromEpisodes(
  name: string,
  description: string,
  trigger: string
): string | null {
  const episodes = getRecentEpisodes(20)
  const actionEpisodes = episodes.filter(e => e.type === 'action')

  if (actionEpisodes.length < 2) return null

  const steps = actionEpisodes.map(e => e.content)
  return addProcedure(name, description, trigger, steps)
}

// ============ 清理操作 ============

function cleanupOldestMemories(): void {
  // 清理最旧的情节记忆
  const episodes = loadEpisodicMemory()
  if (episodes.length > MAX_EPISODIC_MEMORY * 0.8) {
    const trimmed = episodes.slice(0, Math.floor(MAX_EPISODIC_MEMORY * 0.6))
    saveToStorage(EPISODIC_MEMORY_KEY, trimmed)
  }
}

export function clearAllMemory(): void {
  saveToStorage(WORKING_MEMORY_KEY, [])
  saveToStorage(EPISODIC_MEMORY_KEY, [])
  saveToStorage(SEMANTIC_MEMORY_KEY, [])
  saveToStorage(PROCEDURAL_MEMORY_KEY, [])
}

export function clearMemoryLayer(layer: MemoryLayer): void {
  switch (layer) {
    case 'working':
      saveToStorage(WORKING_MEMORY_KEY, [])
      break
    case 'episodic':
      saveToStorage(EPISODIC_MEMORY_KEY, [])
      break
    case 'semantic':
      saveToStorage(SEMANTIC_MEMORY_KEY, [])
      break
    case 'procedural':
      saveToStorage(PROCEDURAL_MEMORY_KEY, [])
      break
  }
}

// ============ 统计信息 ============

export function getMemoryStats(): MemoryStats {
  const working = loadWorkingMemory()
  const episodic = loadEpisodicMemory()
  const semantic = loadSemanticMemory()
  const procedural = loadProceduralMemory()

  return {
    working: {
      count: working.length,
      oldestTimestamp: working.length > 0 ? Math.min(...working.map(e => e.timestamp)) : 0
    },
    episodic: {
      count: episodic.length,
      oldestTimestamp: episodic.length > 0 ? Math.min(...episodic.map(e => e.timestamp)) : 0
    },
    semantic: {
      count: semantic.length,
      totalAccessCount: semantic.reduce((sum, e) => sum + e.accessCount, 0)
    },
    procedural: {
      count: procedural.length,
      totalExecutions: procedural.reduce((sum, e) => sum + e.executionCount, 0)
    },
    lastAccess: Date.now()
  }
}

// ============ Prompt 生成 ============

export function memoryToPrompt(): string {
  const parts: string[] = []

  // 工作记忆
  const working = loadWorkingMemory()
  if (working.length > 0) {
    const workingData = Object.fromEntries(working.map(e => [e.key, e.value]))
    parts.push(`## 工作记忆（当前上下文）\n${JSON.stringify(workingData, null, 2)}`)
  }

  // 最近情节
  const recentEpisodes = getRecentEpisodes(5)
  if (recentEpisodes.length > 0) {
    const episodeSummary = recentEpisodes.map(e => `- [${e.type}] ${e.content.slice(0, 100)}`)
    parts.push(`## 最近交互\n${episodeSummary.join('\n')}`)
  }

  // 高置信度语义知识
  const semantic = loadSemanticMemory()
  const highConfidence = semantic.filter(e => e.confidence >= 0.7).slice(0, 10)
  if (highConfidence.length > 0) {
    const knowledgeData = Object.fromEntries(highConfidence.map(e => [e.key, e.value]))
    parts.push(`## 已知信息\n${JSON.stringify(knowledgeData, null, 2)}`)
  }

  // 可用程序/技能
  const procedures = loadProceduralMemory()
  const reliableProcedures = procedures.filter(e => e.successRate >= 0.7 && e.executionCount >= 2)
  if (reliableProcedures.length > 0) {
    const skills = reliableProcedures.map(e => `- ${e.name}: ${e.description}`)
    parts.push(`## 已学习技能\n${skills.join('\n')}`)
  }

  if (parts.length === 0) return ''
  return parts.join('\n\n')
}

// ============ 兼容性导出 ============

// 保持与旧 API 的兼容性
export type AgentMemory = Record<string, { value: string; accessCount: number }>

export function loadMemory(): Record<string, string> {
  const semantic = loadSemanticMemory()
  const working = loadWorkingMemory()

  const result: Record<string, string> = {}

  // 合并语义记忆
  for (const entry of semantic) {
    result[entry.key] = entry.value
  }

  // 工作记忆覆盖
  for (const entry of working) {
    result[entry.key] = entry.value
  }

  return result
}

export function saveMemory(memory: Record<string, string>): void {
  for (const [key, value] of Object.entries(memory)) {
    setWorkingMemory(key, value)
  }
}

export interface MemoryUpdate {
  set?: Record<string, unknown>
  remove?: string[]
  promote?: string[]
  category?: Record<string, MemoryCategory>
}

export function updateMemory(update: MemoryUpdate): void {
  if (update.set) {
    for (const [key, value] of Object.entries(update.set)) {
      if (!key) continue
      const strValue = String(value)
      setWorkingMemory(key, strValue)

      // 如果指定了分类，同时添加到语义记忆
      if (update.category?.[key]) {
        addSemanticKnowledge(update.category[key], key, strValue)
      }
    }
  }

  if (update.remove) {
    const working = loadWorkingMemory()
    const filteredWorking = working.filter(e => !update.remove!.includes(e.key))
    saveWorkingMemory(filteredWorking)

    const semantic = loadSemanticMemory()
    const filteredSemantic = semantic.filter(e => !update.remove!.includes(e.key))
    saveSemanticMemory(filteredSemantic)
  }

  if (update.promote) {
    const working = loadWorkingMemory()
    for (const key of update.promote) {
      const entry = working.find(e => e.key === key)
      if (entry) {
        addSemanticKnowledge('fact', key, entry.value, {
          source: 'manual_promotion'
        })
      }
    }
  }
}

// 自动提升记忆（定期调用）
export function autoPromoteMemory(): void {
  consolidateWorkingToSemantic()
  extractSemanticFromEpisodic()
}

// 添加上下文条目（兼容旧 API）
export function addContextEntry(summary: string, topics: string[]): void {
  addEpisode('observation', summary, {
    entities: topics,
    importance: 6
  })
}

// 加载上下文历史（兼容旧 API）
export function loadContextHistory(): Array<{
  timestamp: number
  summary: string
  topics: string[]
}> {
  const episodes = loadEpisodicMemory()
  return episodes
    .filter(e => e.type === 'observation')
    .map(e => ({
      timestamp: e.timestamp,
      summary: e.content,
      topics: e.entities || []
    }))
}
