/**
 * Agent 六层上下文系统
 *
 * 基于 OpenAI 数据代理论文的六层上下文架构：
 * 1. Table Usage - 表/数据使用信息，Schema 和使用模式
 * 2. Human Annotations - 人工注释，标签，描述
 * 3. Codex Enrichment - AI 代码增强，语义分析
 * 4. Institutional Knowledge - 机构知识，领域专业知识，业务规则
 * 5. Memory - 代理学习的记忆
 * 6. Runtime Context - 运行时上下文，当前会话信息
 */

// ============ 存储键 ============
const TABLE_USAGE_KEY = 'ai-agent-table-usage-v4'
const HUMAN_ANNOTATIONS_KEY = 'ai-agent-annotations-v4'
const CODEX_ENRICHMENT_KEY = 'ai-agent-codex-v4'
const INSTITUTIONAL_KNOWLEDGE_KEY = 'ai-agent-institutional-v4'
const MEMORY_KEY = 'ai-agent-memory-v4'
const RUNTIME_CONTEXT_KEY = 'ai-agent-runtime-v4'

// ============ 容量限制 ============
const MAX_TABLE_USAGE = 200 // 表使用信息
const MAX_ANNOTATIONS = 500 // 人工注释
const MAX_CODEX_ENRICHMENT = 300 // AI 增强
const MAX_INSTITUTIONAL_KNOWLEDGE = 500 // 机构知识
const MAX_MEMORY = 200 // 记忆条目
const MAX_RUNTIME_CONTEXT = 50 // 运行时上下文

// ============ 类型定义 ============

export type ContextLayer =
  | 'table-usage'
  | 'annotations'
  | 'codex'
  | 'institutional'
  | 'memory'
  | 'runtime'

export type MemoryCategory = 'preference' | 'fact' | 'task' | 'context' | 'skill'

/**
 * Layer 1: Table Usage - 表/数据使用信息
 * 记录数据结构、Schema、使用模式和访问频率
 */
export interface TableUsageEntry {
  id: string
  name: string // 表/数据源名称
  schema?: Record<string, string> // 字段名 -> 类型
  description?: string
  usagePatterns: string[] // 常见使用模式
  queryExamples?: string[] // 示例查询
  accessCount: number
  lastAccessedAt: number
  createdAt: number
}

/**
 * Layer 2: Human Annotations - 人工注释
 * 用户或管理员添加的标签、描述、说明
 */
export interface HumanAnnotationEntry {
  id: string
  targetId?: string // 关联的目标 ID（表、字段等）
  targetType: 'table' | 'field' | 'query' | 'procedure' | 'general'
  annotation: string
  author?: string
  tags?: string[]
  priority: 'low' | 'medium' | 'high' | 'critical'
  createdAt: number
  updatedAt: number
}

/**
 * Layer 3: Codex Enrichment - AI 代码增强
 * AI 生成的语义分析、代码理解、关系推断
 */
export interface CodexEnrichmentEntry {
  id: string
  sourceType: 'schema' | 'query' | 'code' | 'document' | 'conversation'
  sourceId?: string
  enrichment: {
    semanticDescription?: string // 语义描述
    inferredRelations?: Array<{ from: string; to: string; relation: string }>
    suggestedUsage?: string[]
    codePatterns?: string[]
    complexity?: 'simple' | 'moderate' | 'complex'
  }
  confidence: number // 0-1
  model?: string // 生成模型
  createdAt: number
}

/**
 * Layer 4: Institutional Knowledge - 机构知识
 * 组织特定的知识、领域专业知识、业务规则
 */
export interface InstitutionalKnowledgeEntry {
  id: string
  category: 'business-rule' | 'domain-knowledge' | 'best-practice' | 'constraint' | 'glossary'
  title: string
  content: string
  scope?: string[] // 适用范围
  examples?: string[]
  exceptions?: string[]
  source?: string
  confidence: number
  verified: boolean
  createdAt: number
  updatedAt: number
}

/**
 * Layer 5: Memory - 代理记忆
 * 从交互中学习的记忆，包括用户偏好、事实、技能
 */
export interface MemoryEntry {
  id: string
  type: 'preference' | 'fact' | 'skill' | 'observation' | 'feedback'
  key: string
  value: string
  context?: string
  source: 'user' | 'inferred' | 'system'
  confidence: number
  accessCount: number
  importance: number // 1-10
  createdAt: number
  lastAccessedAt: number
}

/**
 * Layer 6: Runtime Context - 运行时上下文
 * 当前会话的即时上下文，任务状态
 */
export interface RuntimeContextEntry {
  key: string
  value: string
  type: 'task' | 'state' | 'variable' | 'temp'
  timestamp: number
  ttl?: number // 可选的生存时间（毫秒）
  sessionId?: string
}

/**
 * 上下文统计信息
 */
export interface ContextStats {
  tableUsage: { count: number; totalAccess: number }
  annotations: { count: number; byPriority: Record<string, number> }
  codex: { count: number; avgConfidence: number }
  institutional: { count: number; verified: number }
  memory: { count: number; totalAccess: number }
  runtime: { count: number; active: number }
  lastUpdated: number
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
    console.warn('[Context] Storage quota exceeded, cleaning up')
    cleanupOldestData()
  }
}

// ============ Layer 1: Table Usage ============

export function loadTableUsage(): TableUsageEntry[] {
  return loadFromStorage<TableUsageEntry[]>(TABLE_USAGE_KEY, [])
}

export function saveTableUsage(entries: TableUsageEntry[]): void {
  const sorted = [...entries].sort((a, b) => b.accessCount - a.accessCount)
  const trimmed = sorted.slice(0, MAX_TABLE_USAGE)
  saveToStorage(TABLE_USAGE_KEY, trimmed)
}

export function addTableUsage(
  name: string,
  options?: {
    schema?: Record<string, string>
    description?: string
    usagePatterns?: string[]
    queryExamples?: string[]
  }
): string {
  const entries = loadTableUsage()
  const now = Date.now()
  const id = `tbl_${now}_${Math.random().toString(36).slice(2, 8)}`

  // 检查是否已存在
  const existingIndex = entries.findIndex(e => e.name === name)
  if (existingIndex >= 0) {
    entries[existingIndex].accessCount++
    entries[existingIndex].lastAccessedAt = now
    if (options?.schema) entries[existingIndex].schema = options.schema
    if (options?.usagePatterns) {
      entries[existingIndex].usagePatterns = [
        ...new Set([...entries[existingIndex].usagePatterns, ...options.usagePatterns])
      ]
    }
    saveTableUsage(entries)
    return entries[existingIndex].id
  }

  entries.push({
    id,
    name,
    schema: options?.schema,
    description: options?.description,
    usagePatterns: options?.usagePatterns || [],
    queryExamples: options?.queryExamples,
    accessCount: 1,
    lastAccessedAt: now,
    createdAt: now
  })

  saveTableUsage(entries)
  return id
}

export function getTableUsage(name: string): TableUsageEntry | undefined {
  const entries = loadTableUsage()
  const entry = entries.find(e => e.name === name)
  if (entry) {
    entry.accessCount++
    entry.lastAccessedAt = Date.now()
    saveTableUsage(entries)
  }
  return entry
}

export function searchTableUsage(query: string, limit = 20): TableUsageEntry[] {
  const entries = loadTableUsage()
  const queryLower = query.toLowerCase()
  return entries
    .filter(
      e =>
        e.name.toLowerCase().includes(queryLower) ||
        e.description?.toLowerCase().includes(queryLower) ||
        e.usagePatterns.some(p => p.toLowerCase().includes(queryLower))
    )
    .slice(0, limit)
}

// ============ Layer 2: Human Annotations ============

export function loadAnnotations(): HumanAnnotationEntry[] {
  return loadFromStorage<HumanAnnotationEntry[]>(HUMAN_ANNOTATIONS_KEY, [])
}

export function saveAnnotations(entries: HumanAnnotationEntry[]): void {
  // 按优先级和时间排序
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  const sorted = [...entries].sort((a, b) => {
    const prioDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
    if (prioDiff !== 0) return prioDiff
    return b.updatedAt - a.updatedAt
  })
  const trimmed = sorted.slice(0, MAX_ANNOTATIONS)
  saveToStorage(HUMAN_ANNOTATIONS_KEY, trimmed)
}

export function addAnnotation(
  annotation: string,
  options?: {
    targetId?: string
    targetType?: HumanAnnotationEntry['targetType']
    author?: string
    tags?: string[]
    priority?: HumanAnnotationEntry['priority']
  }
): string {
  const entries = loadAnnotations()
  const now = Date.now()
  const id = `ann_${now}_${Math.random().toString(36).slice(2, 8)}`

  entries.push({
    id,
    targetId: options?.targetId,
    targetType: options?.targetType || 'general',
    annotation,
    author: options?.author,
    tags: options?.tags,
    priority: options?.priority || 'medium',
    createdAt: now,
    updatedAt: now
  })

  saveAnnotations(entries)
  return id
}

export function searchAnnotations(
  query: string,
  options?: {
    targetType?: HumanAnnotationEntry['targetType']
    priority?: HumanAnnotationEntry['priority']
    tags?: string[]
    limit?: number
  }
): HumanAnnotationEntry[] {
  const entries = loadAnnotations()
  const queryLower = query.toLowerCase()
  const limit = options?.limit ?? 20

  return entries
    .filter(e => {
      if (options?.targetType && e.targetType !== options.targetType) return false
      if (options?.priority && e.priority !== options.priority) return false
      if (options?.tags && !options.tags.some(t => e.tags?.includes(t))) return false
      return e.annotation.toLowerCase().includes(queryLower)
    })
    .slice(0, limit)
}

export function getAnnotationsForTarget(
  targetId: string,
  targetType?: HumanAnnotationEntry['targetType']
): HumanAnnotationEntry[] {
  const entries = loadAnnotations()
  return entries.filter(e => {
    if (e.targetId !== targetId) return false
    if (targetType && e.targetType !== targetType) return false
    return true
  })
}

// ============ Layer 3: Codex Enrichment ============

export function loadCodexEnrichment(): CodexEnrichmentEntry[] {
  return loadFromStorage<CodexEnrichmentEntry[]>(CODEX_ENRICHMENT_KEY, [])
}

export function saveCodexEnrichment(entries: CodexEnrichmentEntry[]): void {
  const sorted = [...entries].sort((a, b) => b.confidence - a.confidence)
  const trimmed = sorted.slice(0, MAX_CODEX_ENRICHMENT)
  saveToStorage(CODEX_ENRICHMENT_KEY, trimmed)
}

export function addCodexEnrichment(
  sourceType: CodexEnrichmentEntry['sourceType'],
  enrichment: CodexEnrichmentEntry['enrichment'],
  options?: {
    sourceId?: string
    confidence?: number
    model?: string
  }
): string {
  const entries = loadCodexEnrichment()
  const now = Date.now()
  const id = `cdx_${now}_${Math.random().toString(36).slice(2, 8)}`

  entries.push({
    id,
    sourceType,
    sourceId: options?.sourceId,
    enrichment,
    confidence: options?.confidence ?? 0.8,
    model: options?.model,
    createdAt: now
  })

  saveCodexEnrichment(entries)
  return id
}

export function getCodexEnrichmentForSource(sourceId: string): CodexEnrichmentEntry | undefined {
  const entries = loadCodexEnrichment()
  return entries.find(e => e.sourceId === sourceId)
}

export function searchCodexEnrichment(
  query: string,
  options?: {
    sourceType?: CodexEnrichmentEntry['sourceType']
    minConfidence?: number
    limit?: number
  }
): CodexEnrichmentEntry[] {
  const entries = loadCodexEnrichment()
  const queryLower = query.toLowerCase()
  const limit = options?.limit ?? 20

  return entries
    .filter(e => {
      if (options?.sourceType && e.sourceType !== options.sourceType) return false
      if (options?.minConfidence && e.confidence < options.minConfidence) return false
      const desc = e.enrichment.semanticDescription?.toLowerCase() || ''
      const patterns = e.enrichment.codePatterns?.join(' ').toLowerCase() || ''
      return desc.includes(queryLower) || patterns.includes(queryLower)
    })
    .slice(0, limit)
}

// ============ Layer 4: Institutional Knowledge ============

export function loadInstitutionalKnowledge(): InstitutionalKnowledgeEntry[] {
  return loadFromStorage<InstitutionalKnowledgeEntry[]>(INSTITUTIONAL_KNOWLEDGE_KEY, [])
}

export function saveInstitutionalKnowledge(entries: InstitutionalKnowledgeEntry[]): void {
  // 已验证的知识优先
  const sorted = [...entries].sort((a, b) => {
    if (a.verified !== b.verified) return a.verified ? -1 : 1
    return b.confidence - a.confidence
  })
  const trimmed = sorted.slice(0, MAX_INSTITUTIONAL_KNOWLEDGE)
  saveToStorage(INSTITUTIONAL_KNOWLEDGE_KEY, trimmed)
}

export function addInstitutionalKnowledge(
  category: InstitutionalKnowledgeEntry['category'],
  title: string,
  content: string,
  options?: {
    scope?: string[]
    examples?: string[]
    exceptions?: string[]
    source?: string
    confidence?: number
    verified?: boolean
  }
): string {
  const entries = loadInstitutionalKnowledge()
  const now = Date.now()
  const id = `inst_${now}_${Math.random().toString(36).slice(2, 8)}`

  // 检查是否已存在相同标题
  const existingIndex = entries.findIndex(e => e.title === title)
  if (existingIndex >= 0) {
    entries[existingIndex].content = content
    entries[existingIndex].updatedAt = now
    if (options?.scope) entries[existingIndex].scope = options.scope
    if (options?.examples) entries[existingIndex].examples = options.examples
    if (options?.confidence !== undefined) entries[existingIndex].confidence = options.confidence
    if (options?.verified !== undefined) entries[existingIndex].verified = options.verified
    saveInstitutionalKnowledge(entries)
    return entries[existingIndex].id
  }

  entries.push({
    id,
    category,
    title,
    content,
    scope: options?.scope,
    examples: options?.examples,
    exceptions: options?.exceptions,
    source: options?.source,
    confidence: options?.confidence ?? 0.8,
    verified: options?.verified ?? false,
    createdAt: now,
    updatedAt: now
  })

  saveInstitutionalKnowledge(entries)
  return id
}

export function searchInstitutionalKnowledge(
  query: string,
  options?: {
    category?: InstitutionalKnowledgeEntry['category']
    verifiedOnly?: boolean
    minConfidence?: number
    limit?: number
  }
): InstitutionalKnowledgeEntry[] {
  const entries = loadInstitutionalKnowledge()
  const queryLower = query.toLowerCase()
  const limit = options?.limit ?? 20

  return entries
    .filter(e => {
      if (options?.category && e.category !== options.category) return false
      if (options?.verifiedOnly && !e.verified) return false
      if (options?.minConfidence && e.confidence < options.minConfidence) return false
      return (
        e.title.toLowerCase().includes(queryLower) || e.content.toLowerCase().includes(queryLower)
      )
    })
    .slice(0, limit)
}

export function getKnowledgeByCategory(
  category: InstitutionalKnowledgeEntry['category'],
  limit = 50
): InstitutionalKnowledgeEntry[] {
  const entries = loadInstitutionalKnowledge()
  return entries.filter(e => e.category === category).slice(0, limit)
}

// ============ Layer 5: Memory ============

export function loadMemoryLayer(): MemoryEntry[] {
  return loadFromStorage<MemoryEntry[]>(MEMORY_KEY, [])
}

export function saveMemoryLayer(entries: MemoryEntry[]): void {
  // 按重要性和访问次数排序
  const sorted = [...entries].sort((a, b) => {
    const scoreA = a.importance * 10 + a.accessCount
    const scoreB = b.importance * 10 + b.accessCount
    return scoreB - scoreA
  })
  const trimmed = sorted.slice(0, MAX_MEMORY)
  saveToStorage(MEMORY_KEY, trimmed)
}

export function addMemory(
  type: MemoryEntry['type'],
  key: string,
  value: string,
  options?: {
    context?: string
    source?: MemoryEntry['source']
    confidence?: number
    importance?: number
  }
): string {
  const entries = loadMemoryLayer()
  const now = Date.now()
  const id = `mem_${now}_${Math.random().toString(36).slice(2, 8)}`

  // 检查是否已存在相同 key
  const existingIndex = entries.findIndex(e => e.key === key)
  if (existingIndex >= 0) {
    entries[existingIndex].value = value
    entries[existingIndex].accessCount++
    entries[existingIndex].lastAccessedAt = now
    if (options?.confidence !== undefined) {
      entries[existingIndex].confidence = options.confidence
    }
    if (options?.importance !== undefined) {
      entries[existingIndex].importance = options.importance
    }
    saveMemoryLayer(entries)
    return entries[existingIndex].id
  }

  entries.push({
    id,
    type,
    key,
    value,
    context: options?.context,
    source: options?.source ?? 'inferred',
    confidence: options?.confidence ?? 0.8,
    accessCount: 1,
    importance: options?.importance ?? 5,
    createdAt: now,
    lastAccessedAt: now
  })

  saveMemoryLayer(entries)
  return id
}

export function getMemory(key: string): MemoryEntry | undefined {
  const entries = loadMemoryLayer()
  const entry = entries.find(e => e.key === key)
  if (entry) {
    entry.accessCount++
    entry.lastAccessedAt = Date.now()
    saveMemoryLayer(entries)
  }
  return entry
}

export function searchMemory(
  query: string,
  options?: {
    type?: MemoryEntry['type']
    source?: MemoryEntry['source']
    minImportance?: number
    limit?: number
  }
): MemoryEntry[] {
  const entries = loadMemoryLayer()
  const queryLower = query.toLowerCase()
  const limit = options?.limit ?? 20

  return entries
    .filter(e => {
      if (options?.type && e.type !== options.type) return false
      if (options?.source && e.source !== options.source) return false
      if (options?.minImportance && e.importance < options.minImportance) return false
      return e.key.toLowerCase().includes(queryLower) || e.value.toLowerCase().includes(queryLower)
    })
    .slice(0, limit)
}

export function getImportantMemories(minImportance = 7, limit = 20): MemoryEntry[] {
  const entries = loadMemoryLayer()
  return entries
    .filter(e => e.importance >= minImportance)
    .sort((a, b) => b.importance - a.importance)
    .slice(0, limit)
}

// ============ Layer 6: Runtime Context ============

export function loadRuntimeContext(): RuntimeContextEntry[] {
  const entries = loadFromStorage<RuntimeContextEntry[]>(RUNTIME_CONTEXT_KEY, [])
  // 过滤掉已过期的条目
  const now = Date.now()
  return entries.filter(e => !e.ttl || now - e.timestamp < e.ttl)
}

export function saveRuntimeContext(entries: RuntimeContextEntry[]): void {
  const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp)
  const trimmed = sorted.slice(0, MAX_RUNTIME_CONTEXT)
  saveToStorage(RUNTIME_CONTEXT_KEY, trimmed)
}

export function setRuntimeContext(
  key: string,
  value: string,
  options?: {
    type?: RuntimeContextEntry['type']
    ttl?: number
    sessionId?: string
  }
): void {
  const entries = loadRuntimeContext()
  const now = Date.now()

  const existingIndex = entries.findIndex(e => e.key === key)
  if (existingIndex >= 0) {
    entries[existingIndex] = {
      key,
      value,
      type: options?.type ?? entries[existingIndex].type,
      timestamp: now,
      ttl: options?.ttl,
      sessionId: options?.sessionId
    }
  } else {
    entries.push({
      key,
      value,
      type: options?.type ?? 'variable',
      timestamp: now,
      ttl: options?.ttl,
      sessionId: options?.sessionId
    })
  }

  saveRuntimeContext(entries)
}

export function getRuntimeContext(key: string): string | undefined {
  const entries = loadRuntimeContext()
  return entries.find(e => e.key === key)?.value
}

export function clearRuntimeContext(sessionId?: string): void {
  if (sessionId) {
    const entries = loadRuntimeContext()
    const filtered = entries.filter(e => e.sessionId !== sessionId)
    saveRuntimeContext(filtered)
  } else {
    saveToStorage(RUNTIME_CONTEXT_KEY, [])
  }
}

export function getAllRuntimeContext(): Record<string, string> {
  const entries = loadRuntimeContext()
  return Object.fromEntries(entries.map(e => [e.key, e.value]))
}

// ============ 跨层操作 ============

/**
 * 将运行时上下文中的重要信息提升到记忆层
 */
export function promoteRuntimeToMemory(): number {
  const runtime = loadRuntimeContext()
  let promoted = 0

  for (const entry of runtime) {
    // 如果存在超过 10 分钟且不是临时类型，考虑提升
    if (entry.type !== 'temp' && Date.now() - entry.timestamp > 10 * 60 * 1000) {
      addMemory('observation', entry.key, entry.value, {
        source: 'system',
        importance: 5
      })
      promoted++
    }
  }

  return promoted
}

/**
 * 从记忆中提取机构知识
 */
export function extractInstitutionalFromMemory(): number {
  const memories = loadMemoryLayer()
  let extracted = 0

  // 查找高置信度、高访问的记忆
  const candidates = memories.filter(m => m.confidence >= 0.9 && m.accessCount >= 5)

  for (const memory of candidates) {
    if (memory.type === 'skill') {
      addInstitutionalKnowledge('best-practice', memory.key, memory.value, {
        source: `memory:${memory.id}`,
        confidence: memory.confidence
      })
      extracted++
    } else if (memory.type === 'fact') {
      addInstitutionalKnowledge('domain-knowledge', memory.key, memory.value, {
        source: `memory:${memory.id}`,
        confidence: memory.confidence
      })
      extracted++
    }
  }

  return extracted
}

/**
 * 使用 AI 丰富表使用信息
 */
export function enrichTableWithCodex(
  tableId: string,
  enrichment: CodexEnrichmentEntry['enrichment'],
  model?: string
): string {
  return addCodexEnrichment('schema', enrichment, {
    sourceId: tableId,
    model
  })
}

// ============ 清理操作 ============

function cleanupOldestData(): void {
  // 清理最旧的运行时上下文
  const runtime = loadRuntimeContext()
  if (runtime.length > MAX_RUNTIME_CONTEXT * 0.8) {
    const trimmed = runtime.slice(0, Math.floor(MAX_RUNTIME_CONTEXT * 0.6))
    saveToStorage(RUNTIME_CONTEXT_KEY, trimmed)
  }

  // 清理低置信度的 Codex 增强
  const codex = loadCodexEnrichment()
  if (codex.length > MAX_CODEX_ENRICHMENT * 0.8) {
    const filtered = codex.filter(e => e.confidence >= 0.5)
    saveToStorage(CODEX_ENRICHMENT_KEY, filtered)
  }
}

export function clearAllContext(): void {
  saveToStorage(TABLE_USAGE_KEY, [])
  saveToStorage(HUMAN_ANNOTATIONS_KEY, [])
  saveToStorage(CODEX_ENRICHMENT_KEY, [])
  saveToStorage(INSTITUTIONAL_KNOWLEDGE_KEY, [])
  saveToStorage(MEMORY_KEY, [])
  saveToStorage(RUNTIME_CONTEXT_KEY, [])
}

export function clearContextLayer(layer: ContextLayer): void {
  switch (layer) {
    case 'table-usage':
      saveToStorage(TABLE_USAGE_KEY, [])
      break
    case 'annotations':
      saveToStorage(HUMAN_ANNOTATIONS_KEY, [])
      break
    case 'codex':
      saveToStorage(CODEX_ENRICHMENT_KEY, [])
      break
    case 'institutional':
      saveToStorage(INSTITUTIONAL_KNOWLEDGE_KEY, [])
      break
    case 'memory':
      saveToStorage(MEMORY_KEY, [])
      break
    case 'runtime':
      saveToStorage(RUNTIME_CONTEXT_KEY, [])
      break
  }
}

// ============ 统计信息 ============

export function getContextStats(): ContextStats {
  const tableUsage = loadTableUsage()
  const annotations = loadAnnotations()
  const codex = loadCodexEnrichment()
  const institutional = loadInstitutionalKnowledge()
  const memory = loadMemoryLayer()
  const runtime = loadRuntimeContext()

  const annotationsByPriority = annotations.reduce(
    (acc, e) => {
      acc[e.priority] = (acc[e.priority] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const avgConfidence =
    codex.length > 0 ? codex.reduce((sum, e) => sum + e.confidence, 0) / codex.length : 0

  return {
    tableUsage: {
      count: tableUsage.length,
      totalAccess: tableUsage.reduce((sum, e) => sum + e.accessCount, 0)
    },
    annotations: {
      count: annotations.length,
      byPriority: annotationsByPriority
    },
    codex: {
      count: codex.length,
      avgConfidence
    },
    institutional: {
      count: institutional.length,
      verified: institutional.filter(e => e.verified).length
    },
    memory: {
      count: memory.length,
      totalAccess: memory.reduce((sum, e) => sum + e.accessCount, 0)
    },
    runtime: {
      count: runtime.length,
      active: runtime.filter(e => !e.ttl || Date.now() - e.timestamp < e.ttl).length
    },
    lastUpdated: Date.now()
  }
}

// ============ Prompt 生成 ============

export function contextToPrompt(): string {
  const parts: string[] = []

  // Layer 6: Runtime Context（最顶层，最重要）
  const runtime = loadRuntimeContext()
  if (runtime.length > 0) {
    const runtimeData = Object.fromEntries(runtime.map(e => [e.key, e.value]))
    parts.push(`## 运行时上下文\n${JSON.stringify(runtimeData, null, 2)}`)
  }

  // Layer 5: Memory
  const memories = getImportantMemories(6, 10)
  if (memories.length > 0) {
    const memoryData = Object.fromEntries(memories.map(e => [e.key, e.value]))
    parts.push(`## 记忆\n${JSON.stringify(memoryData, null, 2)}`)
  }

  // Layer 4: Institutional Knowledge
  const knowledge = loadInstitutionalKnowledge()
  const verifiedKnowledge = knowledge.filter(e => e.verified || e.confidence >= 0.8).slice(0, 10)
  if (verifiedKnowledge.length > 0) {
    const knowledgeList = verifiedKnowledge.map(e => `- **${e.title}**: ${e.content.slice(0, 150)}`)
    parts.push(`## 机构知识\n${knowledgeList.join('\n')}`)
  }

  // Layer 3: Codex Enrichment
  const codex = loadCodexEnrichment()
  const highConfidenceCodex = codex.filter(e => e.confidence >= 0.8).slice(0, 5)
  if (highConfidenceCodex.length > 0) {
    const enrichments = highConfidenceCodex
      .filter(e => e.enrichment.semanticDescription)
      .map(e => `- ${e.enrichment.semanticDescription}`)
    if (enrichments.length > 0) {
      parts.push(`## AI 理解\n${enrichments.join('\n')}`)
    }
  }

  // Layer 2: Human Annotations (高优先级)
  const annotations = loadAnnotations()
  const importantAnnotations = annotations
    .filter(e => e.priority === 'critical' || e.priority === 'high')
    .slice(0, 5)
  if (importantAnnotations.length > 0) {
    const annotationList = importantAnnotations.map(e => `- [${e.priority}] ${e.annotation}`)
    parts.push(`## 重要注释\n${annotationList.join('\n')}`)
  }

  // Layer 1: Table Usage (频繁使用的)
  const tables = loadTableUsage()
  const frequentTables = tables.filter(e => e.accessCount >= 3).slice(0, 5)
  if (frequentTables.length > 0) {
    const tableList = frequentTables.map(e => {
      const desc = e.description ? `: ${e.description}` : ''
      return `- ${e.name}${desc}`
    })
    parts.push(`## 常用数据\n${tableList.join('\n')}`)
  }

  if (parts.length === 0) return ''
  return parts.join('\n\n')
}

// ============ 兼容性导出 ============

// 保持与旧 API 的兼容性
export type AgentMemory = Record<string, { value: string; accessCount: number }>
export type MemoryLayer = ContextLayer // 别名

export function loadMemory(): Record<string, string> {
  const memory = loadMemoryLayer()
  const runtime = loadRuntimeContext()

  const result: Record<string, string> = {}

  // 合并记忆
  for (const entry of memory) {
    result[entry.key] = entry.value
  }

  // 运行时上下文覆盖
  for (const entry of runtime) {
    result[entry.key] = entry.value
  }

  return result
}

export function saveMemory(memory: Record<string, string>): void {
  for (const [key, value] of Object.entries(memory)) {
    setRuntimeContext(key, value)
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
      setRuntimeContext(key, strValue)

      // 如果指定了分类，同时添加到记忆层
      if (update.category?.[key]) {
        const type = update.category[key] as MemoryEntry['type']
        addMemory(type, key, strValue, { source: 'user' })
      }
    }
  }

  if (update.remove) {
    const runtime = loadRuntimeContext()
    const filteredRuntime = runtime.filter(e => !update.remove!.includes(e.key))
    saveRuntimeContext(filteredRuntime)

    const memory = loadMemoryLayer()
    const filteredMemory = memory.filter(e => !update.remove!.includes(e.key))
    saveMemoryLayer(filteredMemory)
  }

  if (update.promote) {
    const runtime = loadRuntimeContext()
    for (const key of update.promote) {
      const entry = runtime.find(e => e.key === key)
      if (entry) {
        addMemory('fact', key, entry.value, {
          source: 'user',
          importance: 7
        })
      }
    }
  }
}

// 自动提升（定期调用）
export function autoPromoteMemory(): void {
  promoteRuntimeToMemory()
  extractInstitutionalFromMemory()
}

// 兼容旧 API
export function memoryToPrompt(): string {
  return contextToPrompt()
}

// 兼容：工作记忆
export function setWorkingMemory(key: string, value: string, ttl?: number): void {
  setRuntimeContext(key, value, { type: 'variable', ttl })
}

export function getWorkingMemory(key: string): string | undefined {
  return getRuntimeContext(key)
}

export function clearWorkingMemory(): void {
  clearRuntimeContext()
}

// 兼容：语义记忆
export function addSemanticKnowledge(
  category: MemoryCategory,
  key: string,
  value: string,
  options?: { source?: string; confidence?: number }
): string {
  return addMemory(category as MemoryEntry['type'], key, value, {
    source: options?.source ? 'system' : 'inferred',
    confidence: options?.confidence
  })
}

export function getSemanticKnowledge(key: string): MemoryEntry | undefined {
  return getMemory(key)
}

// 兼容：情节记忆
export function addEpisode(
  type: 'conversation' | 'action' | 'observation' | 'result',
  content: string,
  options?: { entities?: string[]; importance?: number }
): string {
  const memType = type === 'observation' ? 'observation' : 'fact'
  return addMemory(memType, `episode_${Date.now()}`, content, {
    importance: options?.importance
  })
}

// 兼容：程序记忆
export function addProcedure(
  name: string,
  description: string,
  _trigger: string,
  steps: string[]
): string {
  return addInstitutionalKnowledge('best-practice', name, description, {
    examples: steps
  })
}

// 兼容：上下文条目
export function addContextEntry(summary: string, topics: string[]): void {
  addAnnotation(summary, {
    tags: topics,
    targetType: 'general'
  })
}

// 兼容：加载上下文历史
export function loadContextHistory(): Array<{
  timestamp: number
  summary: string
  topics: string[]
}> {
  const annotations = loadAnnotations()
  return annotations.map(e => ({
    timestamp: e.createdAt,
    summary: e.annotation,
    topics: e.tags || []
  }))
}

// 兼容：清除所有记忆
export function clearAllMemory(): void {
  clearAllContext()
}

// 兼容：获取记忆统计
export function getMemoryStats(): ContextStats {
  return getContextStats()
}
