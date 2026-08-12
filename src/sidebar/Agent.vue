<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import katex from 'katex'
import { nanoid } from 'nanoid'
import { message as antMessage } from 'ant-design-vue'

import { useAgentSettings } from '@/agent/useAgentSettings'
import { describeScreenshot, generateChecklist, verifyChecklist } from '@/agent/agentService'
import { AgentCodex } from '@/agent/agentThread'
import { updateMemory } from '@/agent/memory'
import { executeAgentActions } from '@/agent/executeActions'
import {
  MAX_AGENT_IMAGE_ATTACHMENTS,
  createAgentImageAttachmentFromDataUrl,
  createAgentImageAttachmentFromFile,
  summarizeAgentImageAttachment,
  type AgentImageAttachment
} from '@/agent/imageAttachments'
import {
  assessWorkflowScheduleEligibility,
  buildWorkflowReplayActions
} from '@/agent/browserWorkflows'
import { useBrowserWorkflows } from '@/agent/useBrowserWorkflows'
import {
  AGENT_APPROVAL_MODE_STORAGE_KEY,
  AGENT_PERMISSION_HISTORY_STORAGE_KEY,
  AGENT_SITE_PERMISSIONS_STORAGE_KEY,
  LEGACY_BYPASS_MODE_STORAGE_KEY,
  assessAgentActionBatch,
  readAgentApprovalMode,
  readAgentPermissionHistory,
  readAgentSitePermissions,
  recordAgentPermissionDecision,
  removeAgentSitePermission,
  resolveAgentActionSites,
  setAgentSitePermission,
  writeAgentApprovalMode,
  type AgentApprovalMode,
  type AgentPermissionAssessment,
  type AgentPermissionDecision,
  type AgentPermissionHistoryEntry,
  type AgentSiteDecision,
  type AgentSitePermission
} from '@/agent/permissionPolicy'
import type { AgentAction, AgentActionResult, AgentMessage } from '@/agent/types'
import type { AgentToolPayload } from '@/agent/agentPayload'
import type { AgentThreadEvent } from '@/agent/agentThreadEvents'
import type { BrowserActionsItem } from '@/agent/agentThreadItems'
import type {
  AgentBrowserWorkflow,
  AgentRecordingSession,
  AgentWorkflowSchedule,
  AgentWorkflowScheduleCadence
} from '@/agent/browserWorkflows'
import AgentWorkflowPanel from '@/sidebar/components/AgentWorkflowPanel.vue'
import AgentImageCropModal from '@/sidebar/components/AgentImageCropModal.vue'

const { settings, activeSubagent } = useAgentSettings()
const {
  workflows,
  schedules,
  recordingSession,
  initialize: initializeBrowserWorkflows,
  startRecording,
  stopRecording,
  saveRecording,
  deleteWorkflow,
  markWorkflowRun,
  createSchedule,
  toggleSchedule,
  deleteSchedule,
  runScheduleNow
} = useBrowserWorkflows()

const inputValue = ref('')
const isSending = ref(false)
const messages = ref<AgentMessage[]>([])
const pendingActions = ref<AgentAction[]>([])
const actionResults = ref<Record<string, AgentActionResult>>({})
const targetTabId = ref<number | null>(null)
const TARGET_TAB_STORAGE_KEY = 'ai-agent-target-tab-id-v1'
const approvalMode = ref<AgentApprovalMode>('auto')
const sitePermissions = ref<AgentSitePermission[]>([])
const permissionHistory = ref<AgentPermissionHistoryEntry[]>([])
const pendingAssessment = ref<AgentPermissionAssessment | null>(null)
const isAssessingPermissions = ref(false)
const isExecutingActions = ref(false)
const permissionPanelOpen = ref(false)
const lastUserInput = ref('')
const lastToolUseIds = ref<string[]>([])
const lastToolInputs = ref<AgentToolPayload[]>([])
const lastParallelActions = ref(false)
const pendingActionsAssistantId = ref<string | null>(null)
const pendingWorkflowId = ref<string | null>(null)
const recordingDraft = ref<AgentRecordingSession | null>(null)
const pendingImages = ref<AgentImageAttachment[]>([])
const imageInputRef = ref<HTMLInputElement | null>(null)
const screenshotCropOpen = ref(false)
const screenshotDraftDataUrl = ref('')
const isPreparingImage = ref(false)
const lastTabContext = ref<any>(null)
const lastChecklist = ref<string[]>([])
const currentThreadId = ref<string | null>(null)
const TIMELINE_STORAGE_KEY = 'ai-agent-timeline-v1'
const timelines = ref<Record<string, { collapsed: boolean; entries: any[] }>>({})
const streamingEntries = ref<Record<string, { thoughtId?: string; stepId?: string }>>({})
const MESSAGE_STORAGE_KEY = 'ai-agent-messages-v1'
const SESSION_STORAGE_KEY = 'ai-agent-session-v1'
const codex = new AgentCodex({ settings: () => settings.value })

const approvalModeOptions = [
  { value: 'manual', label: '手动批准' },
  { value: 'auto', label: '自动批准' },
  { value: 'skip', label: '跳过批准' }
]

const approvalModeDescription = computed(() => {
  if (approvalMode.value === 'manual') return '每批动作都需要你确认'
  if (approvalMode.value === 'skip') return '受保护动作仍会确认，禁止动作始终拦截'
  return '已授权站点自动执行，其他站点先询问'
})

const approvedSiteCount = computed(
  () => sitePermissions.value.filter(item => item.decision === 'allow').length
)
const pendingPersistableSites = computed(
  () => pendingAssessment.value?.sites.filter(site => site.persistable) || []
)
const recentPermissionHistory = computed(() => permissionHistory.value.slice(0, 5))
const workflowShortcutQuery = computed(() => {
  const input = inputValue.value.trim()
  if (!input.startsWith('/')) return ''
  return input.slice(1).toLocaleLowerCase()
})
const workflowShortcutSuggestions = computed(() => {
  if (!inputValue.value.trim().startsWith('/')) return []
  const query = workflowShortcutQuery.value
  return workflows.value
    .filter(workflow => `${workflow.shortcut} ${workflow.name}`.toLocaleLowerCase().includes(query))
    .slice(0, 6)
})
const pendingWorkflow = computed(() =>
  workflows.value.find(workflow => workflow.id === pendingWorkflowId.value)
)

const permissionDecisionLabel = (decision: AgentPermissionDecision) => {
  const labels: Record<AgentPermissionDecision, string> = {
    'allow-once': '允许一次',
    'always-allow': '始终允许',
    'block-site': '阻止站点',
    deny: '拒绝',
    revoke: '撤销'
  }
  return labels[decision]
}

const getCurrentThread = () => {
  if (currentThreadId.value) {
    return codex.resumeThread(currentThreadId.value)
  }
  const thread = codex.startThread()
  currentThreadId.value = thread.id
  return thread
}

const hasConnection = computed(() => {
  return Boolean(settings.value.apiKey)
})

const activePermissions = computed(() => {
  const agent = activeSubagent.value
  if (!agent) return []
  const labels: Array<{ key: keyof typeof agent.permissions; label: string }> = [
    { key: 'click', label: '点击' },
    { key: 'scroll', label: '滑动' },
    { key: 'touch', label: '触摸' },
    { key: 'screenshot', label: '截图' },
    { key: 'navigate', label: '切换 URL' },
    { key: 'tabs', label: '多标签' },
    { key: 'debugger', label: '开发者观测' },
    { key: 'clickDom', label: '点击 DOM' },
    { key: 'input', label: '输入' },
    { key: 'fileAccess', label: '文件夹' }
  ]
  return labels.filter(item => agent.permissions[item.key])
})

marked.setOptions({
  breaks: true,
  gfm: true
})

const renderMarkdown = (input: string) => {
  if (!input) return ''
  const blocks: Array<{ tex: string; display: boolean }> = []
  let source = input.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
    const id = blocks.length
    blocks.push({ tex, display: true })
    return `@@MATH_BLOCK_${id}@@`
  })
  source = source.replace(/(^|[^\\])\$(.+?)\$/g, (_match, prefix, tex) => {
    const id = blocks.length
    blocks.push({ tex, display: false })
    return `${prefix}@@MATH_INLINE_${id}@@`
  })
  let html = marked.parse(source) as string
  html = html.replace(/@@MATH_(BLOCK|INLINE)_(\d+)@@/g, (_, kind, index) => {
    const item = blocks[Number(index)]
    if (!item) return ''
    return katex.renderToString(item.tex, {
      displayMode: kind === 'BLOCK',
      throwOnError: false
    })
  })
  return DOMPurify.sanitize(html, {
    ADD_TAGS: [
      'math',
      'semantics',
      'mrow',
      'mi',
      'mn',
      'mo',
      'annotation',
      'annotation-xml',
      'svg',
      'path'
    ],
    ADD_ATTR: ['class', 'style']
  })
}

const mcpSummary = computed(() => {
  if (!settings.value.enableMcp) return '未启用 MCP'
  const scope = activeSubagent.value?.mcpServerIds
  const enabled = settings.value.mcpServers.filter(server => {
    if (!server.enabled) return false
    if (scope && scope.length > 0) return scope.includes(server.id)
    return true
  })
  return enabled.length > 0 ? `MCP ${enabled.length} 个` : 'MCP 未配置'
})

const readStoredTabId = (): number | null => {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(TARGET_TAB_STORAGE_KEY)
  if (!raw) return null
  const id = Number.parseInt(raw, 10)
  return Number.isNaN(id) ? null : id
}

const loadTimelines = () => {
  if (typeof localStorage === 'undefined') return
  const raw = localStorage.getItem(TIMELINE_STORAGE_KEY)
  if (!raw) return
  try {
    timelines.value = JSON.parse(raw)
  } catch {
    timelines.value = {}
  }
}

const loadMessages = () => {
  if (typeof localStorage === 'undefined') return
  const raw = localStorage.getItem(MESSAGE_STORAGE_KEY)
  if (!raw) return
  try {
    messages.value = JSON.parse(raw)
  } catch {
    messages.value = []
  }
}

const saveMessages = () => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(MESSAGE_STORAGE_KEY, JSON.stringify(messages.value))
}

const saveSession = () => {
  if (typeof localStorage === 'undefined') return
  const session = {
    pendingActions: pendingActions.value,
    pendingActionsAssistantId: pendingActionsAssistantId.value,
    lastToolUseIds: lastToolUseIds.value,
    lastToolInputs: lastToolInputs.value,
    lastParallelActions: lastParallelActions.value,
    lastUserInput: lastUserInput.value,
    lastChecklist: lastChecklist.value,
    lastTabContext: lastTabContext.value,
    threadId: currentThreadId.value,
    pendingWorkflowId: pendingWorkflowId.value
  }
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
}

const loadSession = () => {
  if (typeof localStorage === 'undefined') return
  const raw = localStorage.getItem(SESSION_STORAGE_KEY)
  if (!raw) return
  try {
    const parsed = JSON.parse(raw)
    pendingActions.value = Array.isArray(parsed?.pendingActions) ? parsed.pendingActions : []
    pendingActionsAssistantId.value =
      typeof parsed?.pendingActionsAssistantId === 'string'
        ? parsed.pendingActionsAssistantId
        : null
    if (Array.isArray(parsed?.lastToolUseIds)) {
      lastToolUseIds.value = parsed.lastToolUseIds.filter((id: unknown) => typeof id === 'string')
    } else if (typeof parsed?.lastToolUseId === 'string') {
      lastToolUseIds.value = [parsed.lastToolUseId]
    } else {
      lastToolUseIds.value = []
    }
    if (Array.isArray(parsed?.lastToolInputs)) {
      lastToolInputs.value = parsed.lastToolInputs.filter(
        (item: unknown): item is AgentToolPayload => Boolean(item) && typeof item === 'object'
      )
    } else if (parsed?.lastToolInput && typeof parsed.lastToolInput === 'object') {
      lastToolInputs.value = [parsed.lastToolInput as AgentToolPayload]
    } else {
      lastToolInputs.value = []
    }
    lastParallelActions.value = parsed?.lastParallelActions !== false
    lastUserInput.value = typeof parsed?.lastUserInput === 'string' ? parsed.lastUserInput : ''
    lastChecklist.value = Array.isArray(parsed?.lastChecklist) ? parsed.lastChecklist : []
    lastTabContext.value = parsed?.lastTabContext ?? null
    currentThreadId.value = typeof parsed?.threadId === 'string' ? parsed.threadId : null
    pendingWorkflowId.value =
      typeof parsed?.pendingWorkflowId === 'string' ? parsed.pendingWorkflowId : null
  } catch {
    pendingActions.value = []
    pendingActionsAssistantId.value = null
    currentThreadId.value = null
    pendingWorkflowId.value = null
  }
  if (
    pendingActionsAssistantId.value &&
    !messages.value.find(item => item.id === pendingActionsAssistantId.value)
  ) {
    pendingActions.value = []
    pendingActionsAssistantId.value = null
    pendingWorkflowId.value = null
  }
}

const saveTimelines = () => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(TIMELINE_STORAGE_KEY, JSON.stringify(timelines.value))
}

const ensureTimeline = (assistantId: string) => {
  if (!timelines.value[assistantId]) {
    timelines.value[assistantId] = { collapsed: false, entries: [] }
  }
}

const addTimelineEntries = (assistantId: string, entries: any[]) => {
  ensureTimeline(assistantId)
  timelines.value[assistantId].entries.push(...entries)
  saveTimelines()
}

const updateStreamingEntry = (assistantId: string, type: 'thought' | 'step', text: string) => {
  if (!text.trim()) return
  ensureTimeline(assistantId)
  const entryMap = streamingEntries.value[assistantId] || {}
  const entryId = type === 'thought' ? entryMap.thoughtId : entryMap.stepId
  if (entryId) {
    updateTimelineEntry(assistantId, entryId, { text })
    return
  }
  const newId = nanoid()
  if (!streamingEntries.value[assistantId]) {
    streamingEntries.value[assistantId] = {}
  }
  if (type === 'thought') streamingEntries.value[assistantId].thoughtId = newId
  if (type === 'step') streamingEntries.value[assistantId].stepId = newId
  addTimelineEntries(assistantId, [{ id: newId, type, text, status: 'info' }])
}

const extractStreamSections = (raw: string) => {
  const sections: { thoughts: string[]; steps: string[] } = { thoughts: [], steps: [] }
  if (!raw) return sections
  const matches = Array.from(
    raw.matchAll(/(^|\n)\s*(thoughts|steps|actions|思考|步骤|动作)\s*[:：]\s*/gi)
  )
  if (matches.length === 0) return sections
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i]
    const keyRaw = match[2].toLowerCase()
    const key =
      keyRaw === '思考'
        ? 'thoughts'
        : keyRaw === '步骤'
          ? 'steps'
          : keyRaw === '动作'
            ? 'actions'
            : keyRaw
    const start = (match.index ?? 0) + match[0].length
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? raw.length) : raw.length
    const block = raw.slice(start, end)
    const items = block
      .split('\n')
      .flatMap(line => line.split('·'))
      .map(line => line.replace(/^[-*+\d.、\s]+/, '').trim())
      .filter(Boolean)
    if (key === 'thoughts') sections.thoughts = items
    if (key === 'steps') sections.steps = items
  }
  return sections
}

const updateTimelineFromStream = (assistantId: string, raw: string) => {
  const { thoughts, steps } = extractStreamSections(raw)
  if (thoughts.length) updateStreamingEntry(assistantId, 'thought', thoughts.join(' · '))
  if (steps.length) updateStreamingEntry(assistantId, 'step', steps.join(' · '))
}

const applyThreadEventItem = (
  assistantId: string,
  item:
    | { type: 'agent_message'; text: string }
    | { type: 'reasoning'; text: string }
    | { type: 'todo_list'; items: Array<{ text: string }> }
    | BrowserActionsItem
    | { type: 'error'; message: string }
) => {
  if (item.type === 'agent_message') {
    updateAssistantMessage(assistantId, item.text)
    updateTimelineFromStream(assistantId, item.text)
    return
  }
  if (item.type === 'reasoning') {
    updateStreamingEntry(assistantId, 'thought', item.text)
    return
  }
  if (item.type === 'todo_list') {
    const steps = item.items.map(step => step.text).filter(Boolean)
    if (steps.length) {
      updateStreamingEntry(assistantId, 'step', steps.join(' · '))
    }
    return
  }
  if (item.type === 'browser_actions') {
    applyToolState(assistantId, {
      actions: item.actions,
      toolUseIds: item.toolUseIds,
      toolInputs: item.toolInputs,
      parallelActions: item.parallelActions
    })
    return
  }
  if (item.type === 'error') {
    updateAssistantMessage(assistantId, item.message, item.message)
  }
}

type ConsumedTurnState = {
  completed: boolean
  failed: boolean
  browserActionsCompleted: boolean
  failureMessage?: string
}

const consumeThreadEvents = async (
  assistantId: string,
  events: AsyncGenerator<AgentThreadEvent>
): Promise<ConsumedTurnState> => {
  const state: ConsumedTurnState = {
    completed: false,
    failed: false,
    browserActionsCompleted: false
  }
  for await (const event of events) {
    if (event.type === 'thread.started') {
      currentThreadId.value = event.thread_id
      saveSession()
      continue
    }

    if (event.type === 'turn.completed') {
      state.completed = true
      continue
    }

    if (event.type === 'turn.failed') {
      updateAssistantMessage(assistantId, event.error.message, event.error.message)
      applyToolState(assistantId, { actions: [], toolUseIds: [], toolInputs: [] })
      state.failed = true
      state.failureMessage = event.error.message
      saveSession()
      continue
    }

    if (event.type === 'error') {
      updateAssistantMessage(assistantId, event.message, event.message)
      applyToolState(assistantId, { actions: [], toolUseIds: [], toolInputs: [] })
      state.failed = true
      state.failureMessage = event.message
      saveSession()
      continue
    }

    if (
      event.type === 'item.started' ||
      event.type === 'item.updated' ||
      event.type === 'item.completed'
    ) {
      const item = event.item
      if (item.type === 'agent_message') {
        applyThreadEventItem(assistantId, item)
      } else if (item.type === 'reasoning') {
        applyThreadEventItem(assistantId, item)
      } else if (item.type === 'todo_list') {
        applyThreadEventItem(assistantId, item)
      } else if (item.type === 'browser_actions') {
        if (event.type === 'item.completed') {
          state.browserActionsCompleted = true
        }
        applyThreadEventItem(assistantId, item)
        saveSession()
      } else if (item.type === 'error') {
        applyThreadEventItem(assistantId, item)
      }
    }
  }
  return state
}

const applyFinalTimelineEntries = (assistantId: string, thoughts?: string[], steps?: string[]) => {
  if (thoughts?.length) {
    updateStreamingEntry(assistantId, 'thought', thoughts.join(' · '))
  }
  if (steps?.length) {
    updateStreamingEntry(assistantId, 'step', steps.join(' · '))
  }
  if (thoughts?.length || steps?.length) {
    saveTimelines()
  }
}

const updateTimelineEntry = (assistantId: string, entryId: string, patch: Record<string, any>) => {
  const timeline = timelines.value[assistantId]
  if (!timeline) return
  const entry = timeline.entries.find(item => item.id === entryId)
  if (!entry) return
  Object.assign(entry, patch)
  saveTimelines()
}
const setTimelineCollapsed = (assistantId: string, collapsed: boolean) => {
  ensureTimeline(assistantId)
  timelines.value[assistantId].collapsed = collapsed
  saveTimelines()
}

const writeStoredTabId = (id: number | null) => {
  if (typeof localStorage === 'undefined') return
  if (id === null) {
    localStorage.removeItem(TARGET_TAB_STORAGE_KEY)
    return
  }
  localStorage.setItem(TARGET_TAB_STORAGE_KEY, String(id))
}

const openAgentSettings = () => {
  if (typeof chrome === 'undefined' || !chrome.runtime?.getURL || !chrome.tabs?.create) return
  const url = chrome.runtime.getURL('index.html?type=options&tabs=settings&subtab=ai-agent')
  chrome.tabs.create({ url })
}

const appendMessage = (message: AgentMessage) => {
  messages.value.push(message)
  saveMessages()
}

const reloadPermissionState = () => {
  approvalMode.value = readAgentApprovalMode()
  sitePermissions.value = readAgentSitePermissions()
  permissionHistory.value = readAgentPermissionHistory()
}

const permissionStorageKeys = new Set([
  AGENT_APPROVAL_MODE_STORAGE_KEY,
  AGENT_SITE_PERMISSIONS_STORAGE_KEY,
  AGENT_PERMISSION_HISTORY_STORAGE_KEY,
  LEGACY_BYPASS_MODE_STORAGE_KEY
])

const handlePermissionStorageChange = (event: StorageEvent) => {
  if (event.key && !permissionStorageKeys.has(event.key)) return
  reloadPermissionState()
  pendingAssessment.value = null
  if (pendingActions.value.length > 0) void runActionsAndContinue()
}

const assessPendingActions = async (): Promise<AgentPermissionAssessment | null> => {
  if (pendingActions.value.length === 0) {
    pendingAssessment.value = null
    return null
  }

  isAssessingPermissions.value = true
  try {
    const resolved =
      typeof chrome !== 'undefined' && chrome.tabs
        ? await resolveAgentActionSites(chrome, pendingActions.value, targetTabId.value)
        : { sites: [], unresolvedTargets: ['浏览器上下文'] }
    const assessment = assessAgentActionBatch({
      mode: approvalMode.value,
      actions: pendingActions.value,
      resolved,
      sitePermissions: sitePermissions.value
    })
    pendingAssessment.value = assessment
    return assessment
  } finally {
    isAssessingPermissions.value = false
  }
}

const recordPermissionDecision = (
  decision: AgentPermissionDecision,
  reason?: string,
  assessment = pendingAssessment.value
) => {
  permissionHistory.value = recordAgentPermissionDecision({
    mode: approvalMode.value,
    decision,
    sites: assessment?.sites.map(site => site.key) || [],
    actionTypes: pendingActions.value.map(action => action.type),
    reason
  })
}

const setAssessmentSites = (decision: AgentSiteDecision) => {
  const sites = pendingAssessment.value?.sites.filter(site => site.persistable) || []
  for (const site of sites) {
    sitePermissions.value = setAgentSitePermission(site, decision)
  }
}

const updateStoredSiteDecision = async (site: AgentSitePermission, decision: AgentSiteDecision) => {
  sitePermissions.value = setAgentSitePermission(site, decision)
  recordPermissionDecision(decision === 'allow' ? 'always-allow' : 'block-site', site.label, {
    status: 'approval-required',
    mode: approvalMode.value,
    sites: [site],
    unresolvedTargets: [],
    prohibitedActions: [],
    protectedActions: [],
    reasons: [],
    canAlwaysAllow: false
  })
  pendingAssessment.value = null
  if (pendingActions.value.length > 0) await runActionsAndContinue()
}

const revokeStoredSitePermission = async (site: AgentSitePermission) => {
  sitePermissions.value = removeAgentSitePermission(site.key)
  recordPermissionDecision('revoke', site.label, {
    status: 'approval-required',
    mode: approvalMode.value,
    sites: [site],
    unresolvedTargets: [],
    prohibitedActions: [],
    protectedActions: [],
    reasons: [],
    canAlwaysAllow: false
  })
  pendingAssessment.value = null
  if (pendingActions.value.length > 0) await runActionsAndContinue()
}

const formatPermissionTime = (timestamp: number) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(timestamp)

const runActions = async () => {
  if (!activeSubagent.value || pendingActions.value.length === 0) return
  const results = await executeAgentActions(
    pendingActions.value,
    activeSubagent.value.permissions,
    targetTabId.value,
    { parallel: lastParallelActions.value, settings: settings.value }
  )
  for (const result of results) {
    actionResults.value[result.id] = result
  }
  return results
}

const updateAssistantMessage = (assistantId: string, content: string, error?: string) => {
  const idx = messages.value.findIndex(message => message.id === assistantId)
  if (idx !== -1) {
    messages.value[idx] = {
      ...messages.value[idx],
      content,
      error
    }
  } else {
    appendMessage({
      id: assistantId,
      role: 'assistant',
      content,
      error
    })
  }
  saveMessages()
}

const setAssistantSegments = (
  assistantId: string,
  segments: Array<{ id: string; content: string; actions?: AgentAction[] }> | null
) => {
  const idx = messages.value.findIndex(message => message.id === assistantId)
  if (idx === -1) return
  messages.value[idx] = {
    ...messages.value[idx],
    segments: segments || undefined
  }
  saveMessages()
}

const buildSegmentsFromToolInputs = (
  toolInputs: Array<{ message?: string; steps?: string[]; actions?: AgentAction[] }>,
  toolUseIds?: string[]
) =>
  toolInputs.map((input, index) => {
    const content =
      input.message?.trim() || input.steps?.filter(Boolean).join(' · ') || '已生成动作。'
    return {
      id: toolUseIds?.[index] || `tool-${index + 1}`,
      content,
      actions: input.actions
    }
  })

const applyToolState = (
  assistantId: string,
  payload: {
    actions?: AgentAction[]
    toolUseIds?: string[]
    toolUseId?: string
    toolInputs?: AgentToolPayload[]
    toolInput?: AgentToolPayload
    parallelActions?: boolean
  }
) => {
  pendingActions.value = payload.actions || []
  pendingAssessment.value = null
  actionResults.value = {}
  pendingActionsAssistantId.value = assistantId
  pendingWorkflowId.value = null
  if (payload.toolUseIds?.length) {
    lastToolUseIds.value = payload.toolUseIds
  } else if (payload.toolUseId) {
    lastToolUseIds.value = [payload.toolUseId]
  } else {
    lastToolUseIds.value = []
  }
  if (payload.toolInputs?.length) {
    lastToolInputs.value = payload.toolInputs
  } else if (payload.toolInput) {
    lastToolInputs.value = [payload.toolInput]
  } else {
    lastToolInputs.value = []
  }
  if (lastToolInputs.value.length > 1) {
    setAssistantSegments(
      assistantId,
      buildSegmentsFromToolInputs(lastToolInputs.value, lastToolUseIds.value)
    )
  } else {
    setAssistantSegments(assistantId, null)
  }
  lastParallelActions.value = payload.parallelActions !== false
}

const retryFromMessage = async (message: AgentMessage) => {
  if (!message.content || isSending.value) return
  if (message.attachments?.length) {
    inputValue.value = message.content
    antMessage.warning('图片原始数据未持久化；请重新附加图片后发送')
    return
  }
  const idx = messages.value.findIndex(item => item.id === message.id)
  if (idx === -1) return
  messages.value = messages.value.slice(0, idx + 1)
  pendingActions.value = []
  pendingAssessment.value = null
  actionResults.value = {}
  pendingActionsAssistantId.value = null
  pendingWorkflowId.value = null
  lastToolUseIds.value = []
  lastToolInputs.value = []
  lastParallelActions.value = true
  lastChecklist.value = []
  const keptIds = new Set(messages.value.map(item => item.id))
  const nextTimelines: Record<string, { collapsed: boolean; entries: any[] }> = {}
  for (const [key, value] of Object.entries(timelines.value)) {
    if (keptIds.has(key)) nextTimelines[key] = value
  }
  timelines.value = nextTimelines
  saveMessages()
  saveTimelines()
  saveSession()
  await sendMessageWithInput(message.content, { reuseUserMessage: true })
}

const runActionsAndContinue = async (options?: {
  approveCurrent?: boolean
  deniedReason?: string
}) => {
  if (!pendingActionsAssistantId.value || isExecutingActions.value) return
  isExecutingActions.value = true
  let approveCurrent = options?.approveCurrent === true
  let deniedReason = options?.deniedReason
  let hasFollowupFailure = false
  try {
    if (!lastTabContext.value) {
      lastTabContext.value = await resolveTabContext(targetTabId.value)
      saveSession()
    }
    while (
      pendingActions.value.length > 0 &&
      (pendingWorkflowId.value !== null ||
        (lastToolUseIds.value.length > 0 && lastToolInputs.value.length > 0))
    ) {
      const assessment = await assessPendingActions()
      if (!deniedReason && assessment?.status === 'blocked') break
      if (!approveCurrent && !deniedReason && assessment?.status !== 'allow') break

      const currentActions = [...pendingActions.value]
      const workflowId = pendingWorkflowId.value
      const wasDenied = Boolean(deniedReason)
      const results = deniedReason
        ? currentActions.map<AgentActionResult>(action => ({
            id: action.id,
            type: action.type,
            success: false,
            error: deniedReason
          }))
        : (await runActions()) || []
      for (const result of results) actionResults.value[result.id] = result
      pendingAssessment.value = null
      approveCurrent = false
      deniedReason = undefined
      if (pendingActionsAssistantId.value) {
        addTimelineEntries(
          pendingActionsAssistantId.value,
          results.map(result => ({
            id: result.id,
            type: 'action',
            actionType: result.type,
            status: result.success ? 'success' : result.error ? 'error' : 'info',
            error: result.error,
            data: result.data
          }))
        )
      }
      if (pendingActionsAssistantId.value) {
        for (const result of results) {
          if (result.type === 'screenshot' && result.data) {
            const promptEntryId = nanoid()
            addTimelineEntries(pendingActionsAssistantId.value, [
              {
                id: promptEntryId,
                type: 'vision_prompt',
                text: '识图中',
                status: 'info'
              }
            ])
            const description = await describeScreenshot(
              result.data,
              lastUserInput.value,
              settings.value,
              activeSubagent.value,
              { tab: lastTabContext.value || undefined }
            )
            if (description) {
              result.data = { dataUrl: result.data, vision: description }
              updateTimelineEntry(pendingActionsAssistantId.value, promptEntryId, {
                text: '识图完成'
              })
            }
          }
        }
      }
      if (workflowId) {
        const failures = results.filter(result => !result.success)
        const status = wasDenied ? 'denied' : failures.length > 0 ? 'failed' : 'success'
        const summary =
          status === 'success'
            ? `工作流执行完成：${results.length} 个动作全部成功。`
            : status === 'denied'
              ? '工作流未执行：你拒绝了这批动作。'
              : `工作流执行失败：${failures
                  .map(result => `${result.type}（${result.error || '未知错误'}）`)
                  .join('；')}`
        updateAssistantMessage(
          pendingActionsAssistantId.value,
          summary,
          status === 'failed' ? summary : undefined
        )
        await markWorkflowRun(
          workflowId,
          status,
          failures
            .map(result => result.error)
            .filter(Boolean)
            .join('；') || undefined
        )
        pendingActions.value = []
        pendingAssessment.value = null
        pendingWorkflowId.value = null
        lastToolUseIds.value = []
        lastToolInputs.value = []
        setTimelineCollapsed(pendingActionsAssistantId.value, true)
        saveSession()
        break
      }
      const toolUses = lastToolUseIds.value
        .map((id, index) => ({
          id,
          input: lastToolInputs.value[index]
        }))
        .filter(
          (item): item is { id: string; input: AgentToolPayload } =>
            typeof item.id === 'string' && Boolean(item.input)
        )
      if (toolUses.length === 0) {
        updateAssistantMessage(
          pendingActionsAssistantId.value as string,
          '工具调用信息缺失，无法继续。',
          '工具调用信息缺失，无法继续。'
        )
        applyToolState(pendingActionsAssistantId.value as string, {
          actions: [],
          toolUseIds: [],
          toolInputs: []
        })
        hasFollowupFailure = true
        break
      }

      const sanitizedResults = results.map(result => {
        if (result.type !== 'screenshot') return result
        if (!result.data) return result
        if (typeof result.data === 'string') {
          return { ...result, data: { vision: undefined } }
        }
        if (typeof result.data === 'object') {
          const vision = (result.data as { vision?: string }).vision
          return { ...result, data: vision ? { vision } : { vision: undefined } }
        }
        return result
      })

      const thread = getCurrentThread()
      const streamedFollowup = await thread.runFollowupStreamed(
        lastUserInput.value,
        toolUses,
        sanitizedResults,
        {
          subagent: activeSubagent.value,
          context: { tab: lastTabContext.value || undefined }
        }
      )
      const followupEventsDone = consumeThreadEvents(
        pendingActionsAssistantId.value as string,
        streamedFollowup.events
      )
      const followup = await streamedFollowup.completion
      const followupState = await followupEventsDone

      if (followup.threadId) {
        currentThreadId.value = followup.threadId
      }

      if (followupState.failed || followup.error) {
        hasFollowupFailure = true
        if (followup.error && !followupState.failed) {
          updateAssistantMessage(
            pendingActionsAssistantId.value as string,
            followup.error,
            followup.error
          )
          applyToolState(pendingActionsAssistantId.value as string, {
            actions: [],
            toolUseIds: [],
            toolInputs: []
          })
        }
        break
      }

      if (!followupState.completed) {
        if (followup.message) {
          updateAssistantMessage(
            pendingActionsAssistantId.value as string,
            followup.message.content
          )
        }
        applyToolState(pendingActionsAssistantId.value as string, followup)
        if (pendingActionsAssistantId.value) {
          applyFinalTimelineEntries(
            pendingActionsAssistantId.value,
            followup.thoughts,
            followup.steps
          )
        }
      }
      if (followupState.completed && !followupState.browserActionsCompleted) {
        applyToolState(pendingActionsAssistantId.value as string, followup)
      }

      saveSession()
      if (!pendingActions.value.length) break
    }
    if (
      !hasFollowupFailure &&
      pendingActionsAssistantId.value &&
      pendingActions.value.length === 0 &&
      lastChecklist.value.length
    ) {
      const finalMessage =
        messages.value.find(item => item.id === pendingActionsAssistantId.value)?.content || ''
      const review = await verifyChecklist(
        lastUserInput.value,
        lastChecklist.value,
        finalMessage,
        settings.value,
        activeSubagent.value,
        { tab: lastTabContext.value || undefined }
      )
      addTimelineEntries(pendingActionsAssistantId.value, [
        {
          id: nanoid(),
          type: 'review',
          text: review,
          status: review.includes('未完成') ? 'error' : 'success'
        }
      ])
    }
    if (
      !hasFollowupFailure &&
      pendingActionsAssistantId.value &&
      pendingActions.value.length === 0
    ) {
      setTimelineCollapsed(pendingActionsAssistantId.value, true)
    }
  } catch (error: any) {
    hasFollowupFailure = true
    if (pendingActionsAssistantId.value) {
      const message = error?.message || '自动执行后续动作失败。'
      const workflowId = pendingWorkflowId.value
      updateAssistantMessage(pendingActionsAssistantId.value, message, message)
      applyToolState(pendingActionsAssistantId.value, {
        actions: [],
        toolUseIds: [],
        toolInputs: []
      })
      if (workflowId) await markWorkflowRun(workflowId, 'failed', message)
    }
  } finally {
    isExecutingActions.value = false
    saveSession()
  }
}

const approvePendingOnce = async () => {
  if (pendingAssessment.value?.status === 'blocked') {
    antMessage.warning('已阻止的站点或禁止动作不能通过临时批准绕过')
    return
  }
  recordPermissionDecision('allow-once', pendingAssessment.value?.reasons.join('；'))
  await runActionsAndContinue({ approveCurrent: true })
}

const alwaysAllowPendingSites = async () => {
  if (pendingAssessment.value?.status === 'blocked') {
    antMessage.warning('已阻止的站点或禁止动作不能加入始终允许')
    return
  }
  setAssessmentSites('allow')
  recordPermissionDecision('always-allow', pendingAssessment.value?.reasons.join('；'))
  pendingAssessment.value = null
  await runActionsAndContinue({ approveCurrent: true })
}

const denyPendingActions = async () => {
  const reason = '用户拒绝了这批浏览器动作'
  recordPermissionDecision('deny', reason)
  await runActionsAndContinue({ deniedReason: reason })
}

const blockPendingSites = async () => {
  const reason = '用户阻止了目标站点'
  setAssessmentSites('block')
  recordPermissionDecision('block-site', reason)
  await runActionsAndContinue({ deniedReason: reason })
}

const onApprovalModeChange = async (value: unknown) => {
  if (typeof value !== 'string' || !['manual', 'auto', 'skip'].includes(value)) return
  approvalMode.value = value as AgentApprovalMode
  writeAgentApprovalMode(approvalMode.value)
  pendingAssessment.value = null
  if (pendingActions.value.length > 0) await runActionsAndContinue()
}

const resolveActiveTabId = async (): Promise<number | null> => {
  if (typeof chrome === 'undefined' || !chrome.tabs?.query) return null
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  return tabs[0]?.id ?? null
}

const resolveTabContext = async (tabId: number | null) => {
  if (typeof chrome === 'undefined' || !chrome.tabs) return null
  if (typeof tabId === 'number' && chrome.tabs.get) {
    try {
      const tab = await chrome.tabs.get(tabId)
      return {
        id: tab.id,
        title: tab.title,
        url: tab.url,
        status: tab.status,
        active: tab.active,
        windowId: tab.windowId
      }
    } catch {
      return null
    }
  }
  if (chrome.tabs.query) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    const tab = tabs[0]
    if (!tab) return null
    return {
      id: tab.id,
      title: tab.title,
      url: tab.url,
      status: tab.status,
      active: tab.active,
      windowId: tab.windowId
    }
  }
  return null
}

const setTargetTabId = (id: number | null) => {
  targetTabId.value = id
  writeStoredTabId(id)
}

const ensureImageCapacity = (additional = 1) => {
  if (pendingImages.value.length + additional <= MAX_AGENT_IMAGE_ATTACHMENTS) return true
  antMessage.warning(`每次最多共享 ${MAX_AGENT_IMAGE_ATTACHMENTS} 张图片`)
  return false
}

const addPendingImage = (attachment: AgentImageAttachment) => {
  if (!ensureImageCapacity()) return
  pendingImages.value = [...pendingImages.value, attachment]
}

const removePendingImage = (id: string) => {
  pendingImages.value = pendingImages.value.filter(image => image.id !== id)
}

const openImagePicker = () => imageInputRef.value?.click()

const handleImageFiles = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = [...(input.files || [])]
  input.value = ''
  if (!files.length || !ensureImageCapacity(files.length)) return
  isPreparingImage.value = true
  try {
    for (const file of files) {
      try {
        addPendingImage(await createAgentImageAttachmentFromFile(file))
      } catch (error) {
        antMessage.error(error instanceof Error ? error.message : `无法处理 ${file.name}`)
      }
    }
  } finally {
    isPreparingImage.value = false
  }
}

const captureVisibleTab = async (): Promise<string> => {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    throw new Error('页面截图仅在已加载的浏览器扩展中可用')
  }
  const tabId = await resolveActiveTabId()
  if (tabId === null) throw new Error('未找到可截图的活动标签页')
  setTargetTabId(tabId)
  const response = (await chrome.runtime.sendMessage({
    type: 'CAPTURE_SCREENSHOT',
    format: 'png',
    tabId
  })) as { success?: boolean; data?: string; error?: string } | undefined
  if (!response?.success || !response.data) {
    throw new Error(response?.error || '页面截图失败')
  }
  return response.data
}

const handleCaptureVisualContext = async () => {
  if (!ensureImageCapacity()) return
  if (activeSubagent.value && !activeSubagent.value.permissions.screenshot) {
    antMessage.warning('当前 Agent 预设未启用截图权限')
    return
  }
  isPreparingImage.value = true
  try {
    screenshotDraftDataUrl.value = await captureVisibleTab()
    screenshotCropOpen.value = true
  } catch (error) {
    antMessage.error(error instanceof Error ? error.message : '页面截图失败')
  } finally {
    isPreparingImage.value = false
  }
}

const closeScreenshotCrop = () => {
  screenshotCropOpen.value = false
  screenshotDraftDataUrl.value = ''
}

const confirmScreenshotCrop = async (payload: { dataUrl: string; cropped: boolean }) => {
  isPreparingImage.value = true
  try {
    const attachment = await createAgentImageAttachmentFromDataUrl(payload.dataUrl, {
      name: payload.cropped ? '页面选区.png' : '页面截图.png',
      source: payload.cropped ? 'region' : 'screenshot'
    })
    addPendingImage(attachment)
    closeScreenshotCrop()
    antMessage.success(payload.cropped ? '已添加截图选区' : '已添加页面截图')
  } catch (error) {
    antMessage.error(error instanceof Error ? error.message : '无法处理页面截图')
  } finally {
    isPreparingImage.value = false
  }
}

const handleStartWorkflowRecording = async () => {
  if (isSending.value || isExecutingActions.value || pendingActions.value.length > 0) {
    antMessage.warning('请先完成当前 Agent 任务或权限确认')
    return
  }
  try {
    const tabId = await resolveActiveTabId()
    if (tabId === null) throw new Error('未找到可录制的活动标签页')
    setTargetTabId(tabId)
    await startRecording(tabId)
    antMessage.success('已开始录制；敏感字段内容不会保存')
  } catch (error) {
    antMessage.error(error instanceof Error ? error.message : '开始录制失败')
  }
}

const handleStopWorkflowRecording = async () => {
  try {
    const session = await stopRecording()
    if (!session) throw new Error('没有正在进行的录制')
    if (session.actions.length === 0) {
      antMessage.warning('没有捕获到可回放动作，录制已结束')
      return
    }
    recordingDraft.value = session
    antMessage.success(`录制完成：${session.actions.length} 个动作`)
  } catch (error) {
    antMessage.error(error instanceof Error ? error.message : '停止录制失败')
  }
}

const handleSaveWorkflowRecording = async (payload: {
  session: AgentRecordingSession
  name: string
}) => {
  try {
    const workflow = await saveRecording(payload.session, payload.name)
    recordingDraft.value = null
    antMessage.success(`工作流 /${workflow.shortcut} 已保存`)
  } catch (error) {
    antMessage.error(error instanceof Error ? error.message : '保存工作流失败')
  }
}

const handleDeleteWorkflow = async (workflow: AgentBrowserWorkflow) => {
  try {
    await deleteWorkflow(workflow.id)
    antMessage.success(`已删除“${workflow.name}”`)
  } catch (error) {
    antMessage.error(error instanceof Error ? error.message : '删除工作流失败')
  }
}

const handleRunWorkflow = async (workflow: AgentBrowserWorkflow) => {
  if (recordingSession.value) {
    antMessage.warning('请先停止录制')
    return
  }
  if (workflow.redactedFields.length > 0) {
    antMessage.warning('该工作流包含已脱敏字段，不能自动回放；请重新录制不含敏感输入的部分')
    return
  }
  if (isSending.value || isExecutingActions.value || pendingActions.value.length > 0) {
    antMessage.warning('请先完成当前 Agent 任务或权限确认')
    return
  }
  if (!activeSubagent.value) {
    antMessage.error('没有可用的 Agent 子代理配置')
    return
  }

  const assistantId = nanoid()
  try {
    const tabId = await resolveActiveTabId()
    if (tabId === null) throw new Error('未找到活动标签页')
    setTargetTabId(tabId)
    lastTabContext.value = await resolveTabContext(tabId)
    const actions = buildWorkflowReplayActions(workflow, lastTabContext.value?.url)
    if (actions.length === 0) throw new Error('工作流没有可执行动作')

    const command = `运行工作流 /${workflow.shortcut}`
    appendMessage({ id: nanoid(), role: 'user', content: command })
    appendMessage({
      id: assistantId,
      role: 'assistant',
      content: `准备运行“${workflow.name}”，正在检查站点和动作权限。`
    })
    ensureTimeline(assistantId)
    addTimelineEntries(assistantId, [
      {
        id: nanoid(),
        type: 'checklist',
        text: `确定性回放 ${actions.length} 个已录制动作`,
        status: 'info'
      }
    ])
    lastUserInput.value = command
    lastChecklist.value = []
    lastToolUseIds.value = []
    lastToolInputs.value = []
    lastParallelActions.value = false
    pendingActions.value = actions
    pendingAssessment.value = null
    actionResults.value = {}
    pendingActionsAssistantId.value = assistantId
    pendingWorkflowId.value = workflow.id
    saveSession()
    await runActionsAndContinue()
  } catch (error) {
    const text = error instanceof Error ? error.message : '运行工作流失败'
    updateAssistantMessage(assistantId, text, text)
    pendingActions.value = []
    pendingAssessment.value = null
    pendingActionsAssistantId.value = null
    pendingWorkflowId.value = null
    saveSession()
    antMessage.error(text)
  }
}

const handleCreateWorkflowSchedule = async (payload: {
  workflow: AgentBrowserWorkflow
  cadence: AgentWorkflowScheduleCadence
  intervalMinutes?: number
  firstRunAt: number
}) => {
  try {
    const eligibility = assessWorkflowScheduleEligibility(payload.workflow)
    const blocked = sitePermissions.value.filter(
      permission => permission.decision === 'block' && eligibility.origins.includes(permission.key)
    )
    if (blocked.length > 0) {
      throw new Error(`不能调度已阻止站点：${blocked.map(site => site.label).join('、')}`)
    }
    await createSchedule(payload.workflow, {
      cadence: payload.cadence,
      intervalMinutes: payload.intervalMinutes,
      firstRunAt: payload.firstRunAt
    })
    antMessage.success('定时工作流已创建')
  } catch (error) {
    antMessage.error(error instanceof Error ? error.message : '创建定时任务失败')
  }
}

const handleToggleWorkflowSchedule = async (payload: {
  schedule: AgentWorkflowSchedule
  enabled: boolean
}) => {
  try {
    await toggleSchedule(payload.schedule, payload.enabled)
    antMessage.success(payload.enabled ? '定时任务已启用' : '定时任务已暂停')
  } catch (error) {
    antMessage.error(error instanceof Error ? error.message : '更新定时任务失败')
  }
}

const handleDeleteWorkflowSchedule = async (schedule: AgentWorkflowSchedule) => {
  try {
    await deleteSchedule(schedule.id)
    antMessage.success('定时任务已移除')
  } catch (error) {
    antMessage.error(error instanceof Error ? error.message : '移除定时任务失败')
  }
}

const handleRunWorkflowSchedule = async (schedule: AgentWorkflowSchedule) => {
  try {
    await runScheduleNow(schedule.id)
    antMessage.success('已在后台启动工作流；完成后会发送通知')
  } catch (error) {
    antMessage.error(error instanceof Error ? error.message : '启动定时工作流失败')
  }
}

const findExactWorkflowShortcut = (input: string) => {
  const shortcut = input.trim().replace(/^\//, '').toLocaleLowerCase()
  return workflows.value.find(item => item.shortcut.toLocaleLowerCase() === shortcut)
}

const runWorkflowShortcut = async (workflow: AgentBrowserWorkflow) => {
  inputValue.value = ''
  await handleRunWorkflow(workflow)
}

const sendMessageWithInput = async (
  rawInput: string,
  options?: { reuseUserMessage?: boolean; attachments?: AgentImageAttachment[] }
) => {
  const attachments = options?.attachments || []
  const content =
    rawInput.trim() || (attachments.length ? '请分析这些图片，并结合当前页面完成相关任务。' : '')
  if (!content || isSending.value) return
  lastUserInput.value = content
  pendingActions.value = []
  pendingAssessment.value = null
  actionResults.value = {}
  pendingActionsAssistantId.value = null
  pendingWorkflowId.value = null
  lastToolUseIds.value = []
  lastToolInputs.value = []
  lastParallelActions.value = true
  lastChecklist.value = []

  if (!options?.reuseUserMessage) {
    const userMessage: AgentMessage = {
      id: nanoid(),
      role: 'user',
      content,
      attachments: attachments.map(summarizeAgentImageAttachment)
    }
    appendMessage(userMessage)
  }
  inputValue.value = ''
  isSending.value = true
  const assistantId = nanoid()
  try {
    setTargetTabId(await resolveActiveTabId())
    lastTabContext.value = await resolveTabContext(targetTabId.value)
    lastChecklist.value = await generateChecklist(content, settings.value, activeSubagent.value, {
      tab: lastTabContext.value || undefined
    })
    if (lastChecklist.value.length) {
      updateMemory({
        set: { task_checklist: lastChecklist.value.map(item => `- ${item}`).join('\n') }
      })
    }
    saveSession()

    appendMessage({
      id: assistantId,
      role: 'assistant',
      content: ''
    })
    ensureTimeline(assistantId)
    saveTimelines()
    if (lastChecklist.value.length) {
      addTimelineEntries(assistantId, [
        {
          id: nanoid(),
          type: 'checklist',
          text: lastChecklist.value.join(' · '),
          status: 'info'
        }
      ])
    }
    pendingActionsAssistantId.value = assistantId
    saveSession()

    const thread = getCurrentThread()
    const threadInput = attachments.length
      ? [
          { type: 'text' as const, text: content },
          ...attachments.map(attachment => ({
            type: 'image' as const,
            dataUrl: attachment.dataUrl,
            name: attachment.name
          }))
        ]
      : content
    const streamedTurn = await thread.runStreamed(threadInput, {
      subagent: activeSubagent.value,
      context: { tab: lastTabContext.value || undefined }
    })
    const turnEventsDone = consumeThreadEvents(assistantId, streamedTurn.events)
    const result = await streamedTurn.completion
    const turnState = await turnEventsDone

    if (result.threadId) {
      currentThreadId.value = result.threadId
    }

    if (turnState.failed || result.error) {
      if (result.error && !turnState.failed) {
        updateAssistantMessage(assistantId, result.error, result.error)
        applyToolState(assistantId, { actions: [], toolUseIds: [], toolInputs: [] })
      }
      return
    }

    if (!turnState.completed) {
      if (result.message) {
        updateAssistantMessage(assistantId, result.message.content)
      }
      applyToolState(assistantId, result)
      applyFinalTimelineEntries(assistantId, result.thoughts, result.steps)
    }
    if (turnState.completed && !turnState.browserActionsCompleted) {
      applyToolState(assistantId, result)
    }

    saveSession()
    if (pendingActions.value.length > 0) {
      await runActionsAndContinue()
    }
    if (pendingActions.value.length === 0 && lastChecklist.value.length) {
      const finalMessage = messages.value.find(item => item.id === assistantId)?.content || ''
      const review = await verifyChecklist(
        lastUserInput.value,
        lastChecklist.value,
        finalMessage,
        settings.value,
        activeSubagent.value,
        { tab: lastTabContext.value || undefined }
      )
      addTimelineEntries(assistantId, [
        {
          id: nanoid(),
          type: 'review',
          text: review,
          status: review.includes('未完成') ? 'error' : 'success'
        }
      ])
    }
    if (pendingActions.value.length === 0) {
      setTimelineCollapsed(assistantId, true)
    }
  } catch (error: any) {
    const message = error?.message || '发送消息失败。'
    updateAssistantMessage(assistantId, message, message)
    applyToolState(assistantId, { actions: [], toolUseIds: [], toolInputs: [] })
  } finally {
    isSending.value = false
    saveSession()
  }
}

const sendMessage = async () => {
  const content = inputValue.value.trim()
  const attachments = [...pendingImages.value]
  const workflow =
    attachments.length === 0 && content.startsWith('/')
      ? findExactWorkflowShortcut(content)
      : undefined
  inputValue.value = ''
  if (workflow) {
    await handleRunWorkflow(workflow)
    return
  }
  pendingImages.value = []
  await sendMessageWithInput(content, { attachments })
}

const clearMessages = () => {
  messages.value = []
  pendingActions.value = []
  pendingAssessment.value = null
  actionResults.value = {}
  setTargetTabId(null)
  lastToolUseIds.value = []
  lastToolInputs.value = []
  pendingActionsAssistantId.value = null
  pendingWorkflowId.value = null
  currentThreadId.value = null
  pendingImages.value = []
  timelines.value = {}
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(TIMELINE_STORAGE_KEY)
    localStorage.removeItem(MESSAGE_STORAGE_KEY)
    localStorage.removeItem(SESSION_STORAGE_KEY)
  }
}

onMounted(async () => {
  window.addEventListener('storage', handlePermissionStorageChange)
  reloadPermissionState()
  loadTimelines()
  loadMessages()
  loadSession()
  await initializeBrowserWorkflows()

  if (
    pendingWorkflowId.value &&
    !workflows.value.some(workflow => workflow.id === pendingWorkflowId.value)
  ) {
    pendingWorkflowId.value = null
    pendingActions.value = []
    pendingActionsAssistantId.value = null
    saveSession()
  }

  const stored = readStoredTabId()
  if (stored) {
    if (typeof chrome === 'undefined' || !chrome.tabs?.get) {
      setTargetTabId(stored)
    } else {
      try {
        await chrome.tabs.get(stored)
        setTargetTabId(stored)
      } catch {
        setTargetTabId(null)
      }
    }
  }

  if (pendingActions.value.length > 0) await runActionsAndContinue()
})

onUnmounted(() => {
  window.removeEventListener('storage', handlePermissionStorageChange)
})
</script>

<template>
  <div class="agent-shell">
    <div class="agent-header">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="agent-avatar">P</div>
          <div>
            <div class="text-sm font-semibold text-gray-900 dark:text-white">Browser AI Agent</div>
            <div class="text-[11px] text-gray-400">
              {{ hasConnection ? '已连接' : '未连接' }} · {{ mcpSummary }}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <a-button size="small" @click="clearMessages">清空</a-button>
          <a-button size="small" @click="openAgentSettings">设置</a-button>
        </div>
      </div>
      <div class="agent-config">
        <div class="agent-approval-control">
          <span class="text-[11px] text-gray-500 dark:text-gray-400">权限模式</span>
          <a-select
            :value="approvalMode"
            :options="approvalModeOptions"
            size="small"
            class="agent-approval-select"
            data-testid="agent-approval-mode"
            :disabled="isExecutingActions"
            @change="onApprovalModeChange"
          />
          <a-button
            size="small"
            type="text"
            data-testid="agent-site-permissions-toggle"
            @click="permissionPanelOpen = !permissionPanelOpen"
          >
            站点 {{ approvedSiteCount }}
          </a-button>
        </div>
        <div class="text-[11px] text-gray-500 dark:text-gray-400">
          任务模型：{{ activeSubagent?.taskModel || settings.taskModel }}
        </div>
      </div>
      <div class="agent-approval-description">{{ approvalModeDescription }}</div>
      <div class="agent-tags">
        <span v-for="item in activePermissions" :key="item.key" class="agent-tag">
          {{ item.label }}
        </span>
      </div>
      <AgentWorkflowPanel
        :workflows="workflows"
        :schedules="schedules"
        :recording-session="recordingSession"
        :recording-draft="recordingDraft"
        :busy="isSending || isExecutingActions"
        @start-recording="handleStartWorkflowRecording"
        @stop-recording="handleStopWorkflowRecording"
        @save-recording="handleSaveWorkflowRecording"
        @discard-draft="recordingDraft = null"
        @run="handleRunWorkflow"
        @delete="handleDeleteWorkflow"
        @create-schedule="handleCreateWorkflowSchedule"
        @toggle-schedule="handleToggleWorkflowSchedule"
        @delete-schedule="handleDeleteWorkflowSchedule"
        @run-schedule="handleRunWorkflowSchedule"
      />
      <div
        v-if="permissionPanelOpen"
        class="agent-site-permission-panel"
        data-testid="agent-site-permissions-panel"
      >
        <div class="agent-site-permission-title">
          <span>站点权限</span>
          <span>{{ sitePermissions.length }} 条</span>
        </div>
        <div v-if="sitePermissions.length === 0" class="agent-site-permission-empty">
          暂无持久站点权限；自动模式会在首次访问时询问。
        </div>
        <div v-for="site in sitePermissions" :key="site.key" class="agent-site-permission-row">
          <div class="agent-site-permission-copy">
            <strong>{{ site.label }}</strong>
            <span>{{ site.decision === 'allow' ? '已允许' : '已阻止' }}</span>
          </div>
          <div class="agent-site-permission-actions">
            <a-button
              size="small"
              type="text"
              @click="updateStoredSiteDecision(site, site.decision === 'allow' ? 'block' : 'allow')"
            >
              {{ site.decision === 'allow' ? '阻止' : '允许' }}
            </a-button>
            <a-button size="small" type="text" danger @click="revokeStoredSitePermission(site)">
              撤销
            </a-button>
          </div>
        </div>
        <div v-if="recentPermissionHistory.length" class="agent-permission-history">
          <div class="agent-site-permission-title">最近决策</div>
          <div v-for="entry in recentPermissionHistory" :key="entry.id" class="agent-history-row">
            <span>{{ permissionDecisionLabel(entry.decision) }}</span>
            <span>{{ entry.sites.join('、') || '无站点' }}</span>
            <time>{{ formatPermissionTime(entry.timestamp) }}</time>
          </div>
        </div>
      </div>
    </div>

    <div class="agent-body">
      <div v-if="messages.length === 0" class="agent-empty">
        <div class="agent-empty-title">AI Agent 已准备好</div>
        <div class="agent-empty-sub">
          描述你要自动化的任务，例如“打开当前页面的登录按钮并填写账号信息”。
        </div>
        <div class="agent-suggestion-row">
          <button class="agent-suggestion" @click="inputValue = '总结当前页面重点'">
            总结页面
          </button>
          <button
            class="agent-suggestion"
            @click="
              inputValue =
                '先探索当前页面 DOM（includeMarkdown=true），列出关键区域、可交互元素与推荐 selector。'
            "
          >
            DOM 探索
          </button>
          <button class="agent-suggestion" @click="inputValue = '定位页面中的搜索框并输入关键词'">
            定位搜索框
          </button>
          <button class="agent-suggestion" @click="inputValue = '自动滚动并提取主要列表'">
            提取列表
          </button>
        </div>
      </div>

      <div v-for="message in messages" :key="message.id" class="agent-message">
        <div class="agent-message-role" :data-role="message.role">
          {{ message.role === 'user' ? '你' : 'Agent' }}
          <a-button
            v-if="message.role === 'user'"
            size="small"
            class="ml-2"
            @click="retryFromMessage(message)"
          >
            重试
          </a-button>
        </div>
        <div v-if="message.role === 'assistant' && timelines[message.id]" class="agent-timeline">
          <a-collapse
            :active-key="timelines[message.id].collapsed ? [] : ['flow']"
            @change="keys => setTimelineCollapsed(message.id, (keys as string[]).length === 0)"
            ghost
          >
            <a-collapse-panel key="flow" header="过程">
              <a-timeline>
                <a-timeline-item
                  v-for="entry in timelines[message.id].entries"
                  :key="entry.id"
                  :color="
                    entry.status === 'error' ? 'red' : entry.status === 'success' ? 'green' : 'blue'
                  "
                >
                  <div class="text-xs text-gray-600">
                    <span v-if="entry.type === 'thought'">思考：{{ entry.text }}</span>
                    <span v-else-if="entry.type === 'step'">步骤：{{ entry.text }}</span>
                    <span v-else-if="entry.type === 'checklist'">清单：{{ entry.text }}</span>
                    <span v-else-if="entry.type === 'review'">核查：{{ entry.text }}</span>
                    <span v-else-if="entry.type === 'vision_prompt'" class="agent-working">
                      识图中
                    </span>
                    <span v-else>
                      动作：{{ entry.actionType }}
                      <span v-if="entry.error" class="text-red-500">（{{ entry.error }}）</span>
                    </span>
                  </div>
                  <div v-if="entry.actionType === 'screenshot' && entry.data" class="mt-2">
                    <a-image :src="entry.data.dataUrl || entry.data" :width="200" />
                  </div>
                </a-timeline-item>
              </a-timeline>
            </a-collapse-panel>
          </a-collapse>
        </div>
        <div
          class="agent-message-bubble"
          :class="message.role === 'user' ? 'agent-user' : 'agent-assistant'"
        >
          <div v-if="message.attachments?.length" class="agent-message-attachments">
            <span v-for="attachment in message.attachments" :key="attachment.id">
              {{ attachment.source === 'region' ? '截图选区' : attachment.name }} ·
              {{ attachment.width }}×{{ attachment.height }}
            </span>
          </div>
          <div v-if="message.segments && message.segments.length" class="agent-segments">
            <div v-for="segment in message.segments" :key="segment.id" class="agent-segment">
              <div class="agent-segment-title">Tool {{ segment.id }}</div>
              <div class="agent-markdown" v-html="renderMarkdown(segment.content)"></div>
              <div
                v-if="segment.actions && segment.actions.length"
                class="agent-action-hint agent-action-hint--segment"
              >
                返回 {{ segment.actions.length }} 个动作待执行
              </div>
            </div>
          </div>
          <div v-else class="agent-markdown" v-html="renderMarkdown(message.content)"></div>
          <div v-if="message.actions && message.actions.length" class="agent-action-hint">
            返回 {{ message.actions.length }} 个动作待执行
          </div>
        </div>
      </div>

      <div
        v-if="
          pendingActions.length &&
          (isAssessingPermissions || (pendingAssessment && pendingAssessment.status !== 'allow'))
        "
        class="agent-actions agent-approval-card"
        :data-status="pendingAssessment?.status || 'loading'"
        data-testid="agent-approval-card"
      >
        <div class="agent-actions-header">
          <div>
            <div class="agent-approval-title">
              {{
                pendingAssessment?.status === 'blocked'
                  ? pendingAssessment.prohibitedActions.length
                    ? '动作已安全阻止'
                    : '站点已阻止'
                  : pendingWorkflow
                    ? `运行工作流：${pendingWorkflow.name}`
                    : '需要批准'
              }}
            </div>
            <div class="agent-approval-count">{{ pendingActions.length }} 个动作</div>
          </div>
          <a-spin v-if="isAssessingPermissions" size="small" />
        </div>
        <template v-if="pendingAssessment && !isAssessingPermissions">
          <div v-if="pendingAssessment.sites.length" class="agent-approval-sites">
            <span
              v-for="site in pendingAssessment.sites"
              :key="site.key"
              class="agent-approval-site"
              :data-decision="site.decision || 'unknown'"
            >
              {{ site.label }}
              <small v-if="site.decision === 'allow'">已允许</small>
              <small v-else-if="site.decision === 'block'">已阻止</small>
              <small v-else>未授权</small>
            </span>
          </div>
          <ul v-if="pendingAssessment.reasons.length" class="agent-approval-reasons">
            <li v-for="reason in pendingAssessment.reasons" :key="reason">{{ reason }}</li>
          </ul>
          <div class="agent-approval-buttons">
            <a-button size="small" danger :loading="isExecutingActions" @click="denyPendingActions">
              {{ pendingAssessment.status === 'blocked' ? '停止这批动作' : '拒绝' }}
            </a-button>
            <a-button
              v-if="pendingAssessment.status !== 'blocked' && pendingPersistableSites.length"
              size="small"
              danger
              ghost
              :disabled="isExecutingActions"
              @click="blockPendingSites"
            >
              阻止站点
            </a-button>
            <a-button
              v-if="pendingAssessment.status !== 'blocked'"
              size="small"
              :loading="isExecutingActions"
              @click="approvePendingOnce"
            >
              仅本次允许
            </a-button>
            <a-button
              v-if="pendingAssessment.status !== 'blocked' && pendingPersistableSites.length"
              size="small"
              type="primary"
              :loading="isExecutingActions"
              @click="alwaysAllowPendingSites"
            >
              始终允许站点并执行
            </a-button>
          </div>
        </template>
      </div>
    </div>

    <div class="agent-input">
      <div
        v-if="workflowShortcutSuggestions.length"
        class="agent-shortcut-palette"
        data-testid="agent-shortcut-palette"
      >
        <button
          v-for="workflow in workflowShortcutSuggestions"
          :key="workflow.id"
          type="button"
          class="agent-shortcut-option"
          @click="runWorkflowShortcut(workflow)"
        >
          <span>
            <strong>/{{ workflow.shortcut }}</strong>
            <small>{{ workflow.name }}</small>
          </span>
          <span>{{ workflow.actions.length }} 步</span>
        </button>
      </div>
      <div
        v-if="pendingImages.length"
        class="agent-image-attachment-tray"
        data-testid="agent-image-attachment-tray"
      >
        <div v-for="image in pendingImages" :key="image.id" class="agent-image-attachment">
          <img :src="image.dataUrl" :alt="image.name" />
          <span>
            <strong>{{ image.name }}</strong>
            <small>{{ image.width }}×{{ image.height }}</small>
          </span>
          <button
            type="button"
            :aria-label="`移除 ${image.name}`"
            @click="removePendingImage(image.id)"
          >
            ×
          </button>
        </div>
      </div>
      <div class="agent-input-tools">
        <input
          ref="imageInputRef"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          class="agent-image-file-input"
          data-testid="agent-image-file-input"
          @change="handleImageFiles"
        />
        <a-button
          size="small"
          type="text"
          data-testid="agent-image-upload"
          :disabled="
            isSending || isExecutingActions || pendingImages.length >= MAX_AGENT_IMAGE_ATTACHMENTS
          "
          @click="openImagePicker"
        >
          添加图片
        </a-button>
        <a-button
          size="small"
          type="text"
          data-testid="agent-screenshot-context"
          :loading="isPreparingImage"
          :disabled="
            isSending || isExecutingActions || pendingImages.length >= MAX_AGENT_IMAGE_ATTACHMENTS
          "
          @click="handleCaptureVisualContext"
        >
          截图选区
        </a-button>
        <span>{{ pendingImages.length }}/{{ MAX_AGENT_IMAGE_ATTACHMENTS }} · 图片不持久化</span>
      </div>
      <div class="agent-input-inner">
        <a-textarea
          v-model:value="inputValue"
          :auto-size="{ minRows: 1, maxRows: 4 }"
          placeholder="描述任务，或输入 / 运行工作流..."
          class="agent-textarea"
          @pressEnter="sendMessage"
        />
        <a-button
          type="primary"
          :loading="isSending"
          :disabled="!inputValue.trim() && pendingImages.length === 0"
          @click="sendMessage"
        >
          发送
        </a-button>
      </div>
    </div>

    <AgentImageCropModal
      :open="screenshotCropOpen"
      :image-data-url="screenshotDraftDataUrl"
      @close="closeScreenshotCrop"
      @confirm="confirmScreenshotCrop"
    />
  </div>
</template>

<style scoped>
@import 'katex/dist/katex.min.css';

.agent-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--md3-surface);
  font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
}

.agent-header {
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--md3-outline-variant);
  background: var(--md3-surface-container-low);
  backdrop-filter: blur(8px);
}

.agent-avatar {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: var(--md3-primary);
  color: var(--md3-on-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}

.agent-config {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 10px;
}

.agent-approval-control {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.agent-approval-select {
  width: 112px;
}

.agent-approval-description {
  margin-top: 4px;
  font-size: 10px;
  line-height: 1.4;
  color: var(--md3-on-surface-variant);
}

.agent-site-permission-panel {
  margin-top: 10px;
  padding: 10px;
  border: 1px solid var(--md3-outline-variant);
  border-radius: 14px;
  background: var(--md3-surface-container);
  max-height: 240px;
  overflow: auto;
}

.agent-site-permission-title {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--md3-on-surface);
}

.agent-site-permission-empty {
  margin-top: 8px;
  font-size: 11px;
  color: var(--md3-on-surface-variant);
}

.agent-site-permission-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--md3-outline-variant);
}

.agent-site-permission-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
  font-size: 11px;
  color: var(--md3-on-surface-variant);
}

.agent-site-permission-copy strong {
  overflow: hidden;
  color: var(--md3-on-surface);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-site-permission-actions {
  display: flex;
  flex: 0 0 auto;
}

.agent-permission-history {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 10px;
}

.agent-history-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 6px;
  align-items: center;
  font-size: 10px;
  color: var(--md3-on-surface-variant);
}

.agent-history-row span:nth-child(2) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-tags {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.agent-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--md3-surface-container-high);
  color: var(--md3-on-surface);
}

.agent-body {
  flex: 1 1 auto;
  overflow: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.agent-empty {
  border: 1px dashed var(--md3-outline);
  border-radius: 16px;
  padding: 16px;
  background: var(--md3-surface-container-low);
}

.agent-empty-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--md3-on-surface);
}

.agent-empty-sub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--md3-on-surface-variant);
}

.agent-suggestion-row {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.agent-suggestion {
  border: 1px solid var(--md3-outline-variant);
  background: var(--md3-surface-container-low);
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  color: var(--md3-on-surface);
  cursor: pointer;
  transition: all 0.2s ease;
}

.agent-suggestion:hover {
  background: var(--md3-primary-container);
  color: var(--md3-on-primary-container);
  border-color: var(--md3-primary);
}

.agent-message {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.agent-timeline {
  margin-bottom: 6px;
}

.agent-message-role {
  font-size: 11px;
  color: var(--md3-on-surface-variant);
}

.agent-message-role[data-role='user'] {
  align-self: flex-end;
}

.agent-message-bubble {
  max-width: 90%;
  padding: 10px 12px;
  border-radius: 14px;
  font-size: 13px;
  line-height: 1.5;
}

.agent-message-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 7px;
}

.agent-message-attachments span {
  padding: 3px 7px;
  border: 1px solid color-mix(in srgb, currentcolor 28%, transparent);
  border-radius: 999px;
  font-size: 10px;
}

.agent-segments {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.agent-segment {
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--md3-outline-variant);
  background: var(--md3-surface-container-low);
}

.agent-segment-title {
  font-size: 11px;
  color: var(--md3-on-surface-variant);
  margin-bottom: 4px;
}

.agent-action-hint--segment {
  margin-top: 6px;
}

.agent-markdown :deep(p) {
  margin: 0 0 8px;
}

.agent-markdown :deep(pre) {
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--md3-surface-container-high);
  overflow: auto;
}

.agent-markdown :deep(code) {
  padding: 2px 6px;
  border-radius: 6px;
  background: var(--md3-surface-container-highest);
}

.agent-markdown :deep(table) {
  width: 100%;
  border-collapse: collapse;
}

.agent-markdown :deep(th),
.agent-markdown :deep(td) {
  border: 1px solid var(--md3-outline-variant);
  padding: 6px 8px;
}

.agent-working {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.agent-working::after {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--md3-primary);
  animation: agentPulse 0.9s ease-in-out infinite;
}

@keyframes agentPulse {
  0% {
    transform: scale(0.6);
    opacity: 0.4;
  }
  50% {
    transform: scale(1);
    opacity: 1;
  }
  100% {
    transform: scale(0.6);
    opacity: 0.4;
  }
}

.agent-user {
  align-self: flex-end;
  background: var(--md3-primary);
  color: var(--md3-on-primary);
  border-bottom-right-radius: 4px;
}

.agent-assistant {
  background: var(--md3-surface-container);
  color: var(--md3-on-surface);
  border-bottom-left-radius: 4px;
}

.agent-action-hint {
  margin-top: 6px;
  font-size: 11px;
  color: var(--md3-on-surface-variant);
}

.agent-actions {
  border: 1px solid var(--md3-outline-variant);
  border-radius: 14px;
  padding: 12px;
  background: var(--md3-surface-container-low);
}

.agent-approval-card[data-status='blocked'] {
  border-color: var(--md3-error, #b3261e);
  background: color-mix(in srgb, var(--md3-error-container, #f9dedc) 55%, transparent);
}

.agent-approval-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--md3-on-surface);
}

.agent-approval-count {
  margin-top: 2px;
  font-size: 10px;
  color: var(--md3-on-surface-variant);
}

.agent-approval-sites {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.agent-approval-site {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 100%;
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--md3-surface-container-high);
  color: var(--md3-on-surface);
  font-size: 11px;
}

.agent-approval-site[data-decision='allow'] {
  background: color-mix(in srgb, var(--md3-primary-container) 70%, transparent);
}

.agent-approval-site[data-decision='block'] {
  background: color-mix(in srgb, var(--md3-error-container, #f9dedc) 75%, transparent);
}

.agent-approval-site small {
  color: var(--md3-on-surface-variant);
  font-size: 9px;
}

.agent-approval-reasons {
  margin: 0 0 10px;
  padding-left: 18px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--md3-on-surface-variant);
}

.agent-approval-buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.agent-actions-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.agent-actions-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.agent-action-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}

.agent-action-text {
  display: flex;
  gap: 6px;
  align-items: center;
}

.agent-action-type {
  font-weight: 600;
  color: var(--md3-on-surface);
}

.agent-input {
  border-top: 1px solid var(--md3-outline-variant);
  padding: 12px;
  background: var(--md3-surface-container-low);
}

.agent-shortcut-palette {
  display: grid;
  gap: 4px;
  max-height: 210px;
  overflow: auto;
  margin-bottom: 8px;
  padding: 6px;
  border: 1px solid var(--md3-outline-variant);
  border-radius: 14px;
  background: var(--md3-surface-container);
  box-shadow: var(--md3-elevation-2);
}

.agent-shortcut-option {
  display: flex;
  min-height: 42px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 9px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--md3-on-surface-variant);
  font: inherit;
  font-size: 10px;
  text-align: left;
  cursor: pointer;
}

.agent-shortcut-option:hover,
.agent-shortcut-option:focus-visible {
  outline: none;
  background: var(--md3-secondary-container);
  color: var(--md3-on-secondary-container);
}

.agent-shortcut-option > span:first-child {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.agent-shortcut-option strong {
  color: var(--md3-on-surface);
  font-size: 12px;
}

.agent-shortcut-option small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-image-attachment-tray {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  margin-bottom: 7px;
  padding-bottom: 2px;
}

.agent-image-attachment {
  display: grid;
  min-width: 178px;
  grid-template-columns: 42px minmax(0, 1fr) 24px;
  gap: 7px;
  align-items: center;
  padding: 5px;
  border: 1px solid var(--md3-outline-variant);
  border-radius: 11px;
  background: var(--md3-surface-container);
}

.agent-image-attachment img {
  width: 42px;
  height: 42px;
  border-radius: 8px;
  object-fit: cover;
}

.agent-image-attachment > span {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.agent-image-attachment strong,
.agent-image-attachment small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-image-attachment strong {
  color: var(--md3-on-surface);
  font-size: 10px;
}

.agent-image-attachment small {
  color: var(--md3-on-surface-variant);
  font-size: 9px;
}

.agent-image-attachment button {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--md3-on-surface-variant);
  cursor: pointer;
}

.agent-image-attachment button:hover,
.agent-image-attachment button:focus-visible {
  outline: none;
  background: var(--md3-surface-container-highest);
  color: var(--md3-error);
}

.agent-input-tools {
  display: flex;
  align-items: center;
  gap: 2px;
  min-height: 26px;
  margin-bottom: 5px;
}

.agent-input-tools > span {
  overflow: hidden;
  margin-left: auto;
  color: var(--md3-on-surface-variant);
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-image-file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

.agent-input-inner {
  display: flex;
  gap: 8px;
}

.agent-textarea :deep(textarea) {
  border-radius: 12px;
  font-size: 13px;
  background: var(--md3-surface);
  border-color: var(--md3-outline);
  color: var(--md3-on-surface);
}

.agent-textarea :deep(textarea:focus) {
  border-color: var(--md3-primary);
  box-shadow: 0 0 0 2px var(--md3-primary-container);
}
</style>
