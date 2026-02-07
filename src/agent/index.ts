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

// Skills 系统
export {
  // 内置 MCP 服务
  BUILTIN_MCP_SERVERS,
  BUILTIN_SKILLS,
  // API Keys 管理
  loadApiKeys,
  saveApiKeys,
  getApiKey,
  setApiKey,
  removeApiKey,
  // 内置 MCP 启用状态
  loadBuiltinMcpEnabled,
  saveBuiltinMcpEnabled,
  isBuiltinMcpEnabled,
  setBuiltinMcpEnabled,
  isBuiltinMcpAvailable,
  // Skills 启用状态
  loadSkillsEnabled,
  saveSkillsEnabled,
  isSkillEnabled,
  setSkillEnabled,
  // MCP 配置转换
  builtinMcpToConfig,
  getEnabledBuiltinMcpConfigs,
  // Skill 操作
  mcpToolToSkill,
  discoverAllSkills,
  executeSkill,
  executeSkillWithContext,
  findSkillByName,
  filterSkillsByCategory,
  getEnabledSkills,
  skillsToPrompt,
  // 自定义 Skills
  loadCustomSkills,
  saveCustomSkills,
  addCustomSkill,
  updateCustomSkill,
  removeCustomSkill,
  // Skill Chains
  loadSkillChains,
  saveSkillChains,
  addSkillChain,
  updateSkillChain,
  removeSkillChain,
  executeSkillChain,
  // Skill 统计
  loadSkillStats,
  saveSkillStats,
  updateSkillStats,
  getSkillStats,
  getPopularSkills,
  getRecentSkills,
  // Skill 触发器匹配
  matchSkillsToInput,
  getBestSkillMatch,
  getSuggestedSkills,
  // Skill 预设
  loadSkillPresets,
  saveSkillPresets,
  addSkillPreset,
  removeSkillPreset,
  getSkillPresets,
  // 智能推荐
  recommendSkills
} from './skills'

// 脚本执行器
export { executeScript, validateScript, SCRIPT_TEMPLATES, SCRIPT_SKILLS } from './scriptRunner'

// MCP UI 实验性特性
export {
  // Elicitation
  setElicitationHandler,
  handleElicitationRequest,
  respondToElicitation,
  getPendingElicitations,
  // MCP Apps
  hasUIResource,
  getUIResourceUri,
  fetchUIResource,
  createAppSandbox,
  sendMessageToApp,
  // Schema 辅助
  schemaToFormFields,
  validateFormData,
  MCP_APP_MIME_TYPE
} from './mcpUI'

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

export type { AgentExecutionContext, AgentContextType, ContextSnapshot } from './agentContext'

export type { SubagentSession, SubagentSessionItem } from './subagentSessions'

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

export type {
  Skill,
  SkillCategory,
  SkillSource,
  SkillExecutionResult,
  BuiltinMcpServer,
  SkillPreset,
  SkillStats,
  SkillChain,
  SkillChainStep,
  SkillExecutionContext,
  CustomSkill,
  SkillMatch
} from './skills'

export type { ScriptContext, ScriptApi, ScriptResult } from './scriptRunner'

export type {
  ElicitationSchema,
  ElicitationPropertySchema,
  ElicitationRequest,
  ElicitationResponse,
  McpAppMeta,
  McpToolWithUI,
  McpAppResource,
  FormField
} from './mcpUI'
