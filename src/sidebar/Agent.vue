<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import katex from 'katex'
import { nanoid } from 'nanoid'

import { useAgentSettings } from '@/agent/useAgentSettings'
import { describeScreenshot, generateChecklist, verifyChecklist } from '@/agent/agentService'
import { AgentCodex } from '@/agent/agentThread'
import { updateMemory } from '@/agent/memory'
import { executeAgentActions } from '@/agent/executeActions'
import type { AgentAction, AgentActionResult, AgentMessage } from '@/agent/types'
import type { AgentToolPayload } from '@/agent/agentPayload'
import type { AgentThreadEvent } from '@/agent/agentThreadEvents'
import type { BrowserActionsItem } from '@/agent/agentThreadItems'

const { settings, activeSubagent } = useAgentSettings()

const inputValue = ref('')
const isSending = ref(false)
const messages = ref<AgentMessage[]>([])
const pendingActions = ref<AgentAction[]>([])
const actionResults = ref<Record<string, AgentActionResult>>({})
const targetTabId = ref<number | null>(null)
const TARGET_TAB_STORAGE_KEY = 'ai-agent-target-tab-id-v1'
const BYPASS_MODE_STORAGE_KEY = 'ai-agent-bypass-mode-v1'
const bypassMode = ref(true)
const lastUserInput = ref('')
const lastToolUseIds = ref<string[]>([])
const lastToolInputs = ref<AgentToolPayload[]>([])
const lastParallelActions = ref(false)
const pendingActionsAssistantId = ref<string | null>(null)
const lastTabContext = ref<any>(null)
const lastChecklist = ref<string[]>([])
const currentThreadId = ref<string | null>(null)
const TIMELINE_STORAGE_KEY = 'ai-agent-timeline-v1'
const timelines = ref<Record<string, { collapsed: boolean; entries: any[] }>>({})
const streamingEntries = ref<Record<string, { thoughtId?: string; stepId?: string }>>({})
const MESSAGE_STORAGE_KEY = 'ai-agent-messages-v1'
const SESSION_STORAGE_KEY = 'ai-agent-session-v1'
const codex = new AgentCodex({ settings: () => settings.value })

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
    { key: 'clickDom', label: '点击 DOM' },
    { key: 'input', label: '输入' }
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

const readStoredBypassMode = (): boolean => {
  if (typeof localStorage === 'undefined') return true
  const raw = localStorage.getItem(BYPASS_MODE_STORAGE_KEY)
  if (!raw) return true
  return raw === 'true'
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
    threadId: currentThreadId.value
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
  } catch {
    pendingActions.value = []
    pendingActionsAssistantId.value = null
    currentThreadId.value = null
  }
  if (
    pendingActionsAssistantId.value &&
    !messages.value.find(item => item.id === pendingActionsAssistantId.value)
  ) {
    pendingActions.value = []
    pendingActionsAssistantId.value = null
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

const writeStoredBypassMode = (value: boolean) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(BYPASS_MODE_STORAGE_KEY, value ? 'true' : 'false')
}

const openAgentSettings = () => {
  if (!chrome?.runtime?.getURL || !chrome?.tabs?.create) return
  const url = chrome.runtime.getURL('index.html?type=options&tabs=settings&subtab=ai-agent')
  chrome.tabs.create({ url })
}

const appendMessage = (message: AgentMessage) => {
  messages.value.push(message)
  saveMessages()
}

const runActions = async () => {
  if (!activeSubagent.value || pendingActions.value.length === 0) return
  const results = await executeAgentActions(
    pendingActions.value,
    activeSubagent.value.permissions,
    targetTabId.value,
    { parallel: lastParallelActions.value }
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
  actionResults.value = {}
  pendingActionsAssistantId.value = assistantId
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
  const idx = messages.value.findIndex(item => item.id === message.id)
  if (idx === -1) return
  messages.value = messages.value.slice(0, idx + 1)
  pendingActions.value = []
  actionResults.value = {}
  pendingActionsAssistantId.value = null
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

const runActionsAndContinue = async () => {
  if (!pendingActionsAssistantId.value) return
  if (!lastTabContext.value) {
    lastTabContext.value = await resolveTabContext(targetTabId.value)
    saveSession()
  }
  let hasFollowupFailure = false
  try {
    while (
      pendingActions.value.length > 0 &&
      lastToolUseIds.value.length > 0 &&
      lastToolInputs.value.length > 0
    ) {
      const results = (await runActions()) || []
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
      updateAssistantMessage(pendingActionsAssistantId.value, message, message)
      applyToolState(pendingActionsAssistantId.value, {
        actions: [],
        toolUseIds: [],
        toolInputs: []
      })
    }
  } finally {
    saveSession()
  }
}

const resolveActiveTabId = async (): Promise<number | null> => {
  if (!chrome?.tabs?.query) return null
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  return tabs[0]?.id ?? null
}

const resolveTabContext = async (tabId: number | null) => {
  if (!chrome?.tabs) return null
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

const sendMessageWithInput = async (rawInput: string, options?: { reuseUserMessage?: boolean }) => {
  const content = rawInput.trim()
  if (!content || isSending.value) return
  lastUserInput.value = content
  pendingActions.value = []
  actionResults.value = {}
  pendingActionsAssistantId.value = null
  lastToolUseIds.value = []
  lastToolInputs.value = []
  lastParallelActions.value = true
  lastChecklist.value = []

  if (!options?.reuseUserMessage) {
    const userMessage: AgentMessage = {
      id: nanoid(),
      role: 'user',
      content
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
    const streamedTurn = await thread.runStreamed(content, {
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
    if (bypassMode.value && pendingActions.value.length > 0) {
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
  inputValue.value = ''
  await sendMessageWithInput(content)
}

const clearMessages = () => {
  messages.value = []
  pendingActions.value = []
  actionResults.value = {}
  setTargetTabId(null)
  lastToolUseIds.value = []
  lastToolInputs.value = []
  pendingActionsAssistantId.value = null
  currentThreadId.value = null
  timelines.value = {}
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(TIMELINE_STORAGE_KEY)
    localStorage.removeItem(MESSAGE_STORAGE_KEY)
    localStorage.removeItem(SESSION_STORAGE_KEY)
  }
}

onMounted(async () => {
  const stored = readStoredTabId()
  if (!stored) return
  if (!chrome?.tabs?.get) {
    setTargetTabId(stored)
    return
  }
  try {
    await chrome.tabs.get(stored)
    setTargetTabId(stored)
  } catch {
    setTargetTabId(null)
  }
})

onMounted(() => {
  bypassMode.value = readStoredBypassMode()
})

onMounted(() => {
  loadTimelines()
})

onMounted(() => {
  loadMessages()
})

onMounted(() => {
  loadSession()
})

onMounted(async () => {
  if (bypassMode.value && pendingActions.value.length > 0) {
    await runActionsAndContinue()
  }
})

const onBypassModeChange = (value: boolean | string | number) => {
  const enabled = value === true
  bypassMode.value = enabled
  writeStoredBypassMode(enabled)
}
</script>

<template>
  <div class="agent-shell">
    <div class="agent-header">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="agent-avatar">C</div>
          <div>
            <div class="text-sm font-semibold text-gray-900 dark:text-white">Claude Task Agent</div>
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
        <div class="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
          <span>自动执行</span>
          <a-switch size="small" :checked="bypassMode" @change="onBypassModeChange" />
        </div>
        <div class="text-[11px] text-gray-500 dark:text-gray-400">
          任务模型：{{ activeSubagent?.taskModel || settings.taskModel }}
        </div>
      </div>
      <div class="agent-tags">
        <span v-for="item in activePermissions" :key="item.key" class="agent-tag">
          {{ item.label }}
        </span>
      </div>
    </div>

    <div class="agent-body">
      <div v-if="messages.length === 0" class="agent-empty">
        <div class="agent-empty-title">Claude 已准备好</div>
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
          {{ message.role === 'user' ? '你' : 'Claude' }}
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

      <div v-if="pendingActions.length && !bypassMode" class="agent-actions">
        <div class="agent-actions-header">
          <div class="text-xs text-gray-500 dark:text-gray-400">待执行动作</div>
          <a-button size="small" @click="runActionsAndContinue">执行全部</a-button>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">动作详情已显示在过程时间线中。</div>
      </div>
    </div>

    <div class="agent-input">
      <div class="agent-input-inner">
        <a-textarea
          v-model:value="inputValue"
          :auto-size="{ minRows: 1, maxRows: 4 }"
          placeholder="描述任务，支持多步指令..."
          class="agent-textarea"
          @pressEnter="sendMessage"
        />
        <a-button type="primary" :loading="isSending" @click="sendMessage">发送</a-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import 'katex/dist/katex.min.css';

.agent-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.9) 0%, #ffffff 60%);
  font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
}

.agent-header {
  padding: 12px 14px 10px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(8px);
}

.agent-avatar {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: #111827;
  color: #f8fafc;
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
  background: rgba(15, 23, 42, 0.06);
  color: #475569;
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
  border: 1px dashed rgba(148, 163, 184, 0.5);
  border-radius: 16px;
  padding: 16px;
  background: rgba(248, 250, 252, 0.6);
}

.agent-empty-title {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}

.agent-empty-sub {
  margin-top: 6px;
  font-size: 12px;
  color: #64748b;
}

.agent-suggestion-row {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.agent-suggestion {
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: white;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  color: #0f172a;
  cursor: pointer;
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
  color: #94a3b8;
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

.agent-segments {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.agent-segment {
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(255, 255, 255, 0.6);
}

.agent-segment-title {
  font-size: 11px;
  color: #64748b;
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
  background: rgba(15, 23, 42, 0.06);
  overflow: auto;
}

.agent-markdown :deep(code) {
  padding: 2px 6px;
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.08);
}

.agent-markdown :deep(table) {
  width: 100%;
  border-collapse: collapse;
}

.agent-markdown :deep(th),
.agent-markdown :deep(td) {
  border: 1px solid rgba(148, 163, 184, 0.3);
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
  background: #3b82f6;
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
  background: #0f172a;
  color: #f8fafc;
  border-bottom-right-radius: 4px;
}

.agent-assistant {
  background: #f1f5f9;
  color: #0f172a;
  border-bottom-left-radius: 4px;
}

.agent-action-hint {
  margin-top: 6px;
  font-size: 11px;
  color: #64748b;
}

.agent-actions {
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 14px;
  padding: 12px;
  background: white;
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
  color: #0f172a;
}

.agent-input {
  border-top: 1px solid rgba(148, 163, 184, 0.2);
  padding: 12px;
  background: rgba(248, 250, 252, 0.9);
}

.agent-input-inner {
  display: flex;
  gap: 8px;
}

.agent-textarea :deep(textarea) {
  border-radius: 12px;
  font-size: 13px;
}

@media (prefers-color-scheme: dark) {
  .agent-shell {
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.92) 0%, #0b1120 60%);
  }
  .agent-header {
    background: rgba(15, 23, 42, 0.9);
    border-bottom-color: rgba(51, 65, 85, 0.5);
  }
  .agent-tag {
    background: rgba(148, 163, 184, 0.18);
    color: #cbd5f5;
  }
  .agent-empty {
    background: rgba(15, 23, 42, 0.5);
  }
  .agent-empty-title {
    color: #f8fafc;
  }
  .agent-empty-sub {
    color: #94a3b8;
  }
  .agent-suggestion {
    background: rgba(15, 23, 42, 0.6);
    color: #e2e8f0;
    border-color: rgba(148, 163, 184, 0.3);
  }
  .agent-assistant {
    background: rgba(30, 41, 59, 0.7);
    color: #e2e8f0;
  }
  .agent-actions {
    background: rgba(15, 23, 42, 0.8);
    border-color: rgba(51, 65, 85, 0.6);
  }
  .agent-input {
    background: rgba(15, 23, 42, 0.9);
    border-top-color: rgba(51, 65, 85, 0.5);
  }
}
</style>
