/**
 * Agent 模块统一导出
 */

// 核心服务
export {
  runAgentMessage,
  runAgentFollowup,
  generateChecklist,
  verifyChecklist,
  describeScreenshot
} from './agentService'

// 上下文管理
export {
  beginContext,
  endContext,
  getCurrentContext,
  getContextChain,
  isInSubagentContext,
  getRootSessionId,
  setContextAwareMemory,
  getContextAwareMemory,
  getContextDiagnostics,
  forceResetAllContexts
} from './agentContext'

// 会话管理
export {
  createSubagentSession,
  updateSubagentSessionItem,
  resolveSubagent
} from './subagentSessions'

// 记忆系统
export {
  // 6层上下文
  loadTableUsage,
  addTableUsage,
  getTableUsage,
  searchTableUsage,
  loadAnnotations,
  addAnnotation,
  searchAnnotations,
  loadCodexEnrichment,
  addCodexEnrichment,
  loadInstitutionalKnowledge,
  addInstitutionalKnowledge,
  searchInstitutionalKnowledge,
  loadMemoryLayer,
  addMemory,
  getMemory,
  searchMemory,
  loadRuntimeContext,
  setRuntimeContext,
  getRuntimeContext,
  clearRuntimeContext,
  // 跨层操作
  promoteRuntimeToMemory,
  extractInstitutionalFromMemory,
  // 统计和提示
  getContextStats,
  contextToPrompt,
  // 兼容性导出
  loadMemory,
  saveMemory,
  updateMemory,
  memoryToPrompt,
  clearAllMemory,
  getMemoryStats
} from './memory'

// 类型导出
export type {
  AgentAction,
  AgentActionResult,
  AgentMessage,
  AgentSettings,
  SubAgentConfig,
  AgentPermissions,
  McpServerConfig,
  ApiFlavor
} from './types'

export type {
  AgentExecutionContext,
  AgentContextType,
  ContextSnapshot
} from './agentContext'

export type {
  SubagentSession,
  SubagentSessionItem
} from './subagentSessions'

export type {
  ContextLayer,
  MemoryCategory,
  TableUsageEntry,
  HumanAnnotationEntry,
  CodexEnrichmentEntry,
  InstitutionalKnowledgeEntry,
  MemoryEntry,
  RuntimeContextEntry,
  ContextStats
} from './memory'
