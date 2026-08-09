import { executeAgentActions } from '@/agent/executeActions'
import {
  AGENT_SITE_PERMISSIONS_STORAGE_KEY,
  sanitizeAgentSitePermissions
} from '@/agent/permissionPolicy'
import { waitForTabLoad } from '@/agent/tabActions'
import {
  AGENT_BROWSER_WORKFLOWS_STORAGE_KEY,
  AGENT_WORKFLOW_SCHEDULES_STORAGE_KEY,
  assessWorkflowScheduleEligibility,
  buildWorkflowReplayActions,
  computeNextAgentWorkflowRun,
  loadAgentBrowserWorkflows,
  loadAgentWorkflowSchedules,
  sanitizeAgentWorkflowUrl,
  sanitizeRecordedAction,
  sanitizeRecordingSession,
  saveAgentWorkflowSchedules,
  type AgentRecordingSession,
  type AgentWorkflowRecordedEvent,
  type AgentWorkflowSchedule
} from '@/agent/browserWorkflows'
import type { AgentAction, AgentPermissions } from '@/agent/types'
import type { BackgroundMessage, MessageResponse } from '@/types/messages'

const RECORDING_SESSION_STORAGE_KEY = 'ai-agent-recording-session-v1'
const WORKFLOW_ALARM_PREFIX = 'agent-workflow-schedule:'
const MAX_RECORDED_ACTIONS = 500
const MAX_REDACTED_FIELDS = 100

const SCHEDULE_PERMISSIONS: AgentPermissions = {
  click: true,
  scroll: true,
  touch: false,
  screenshot: false,
  navigate: true,
  tabs: false,
  debugger: false,
  clickDom: true,
  input: true,
  fileAccess: false
}

let recordingQueue: Promise<unknown> = Promise.resolve()
const runningSchedules = new Set<string>()

const makeId = (prefix: string) =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`

const cleanText = (value: unknown, maxLength: number) =>
  typeof value === 'string'
    ? [...value]
        .filter(character => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
        .join('')
        .trim()
        .slice(0, maxLength)
    : ''

const isRecordablePageUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

const getRecordingStorage = () => chrome.storage?.session || chrome.storage?.local

async function readRecordingSession(): Promise<AgentRecordingSession | null> {
  const storage = getRecordingStorage()
  if (!storage?.get) return null
  const result = await storage.get(RECORDING_SESSION_STORAGE_KEY)
  return sanitizeRecordingSession(result[RECORDING_SESSION_STORAGE_KEY])
}

async function writeRecordingSession(session: AgentRecordingSession | null): Promise<void> {
  const storage = getRecordingStorage()
  if (!storage) throw new Error('录制会话存储不可用')
  if (session) {
    await storage.set({ [RECORDING_SESSION_STORAGE_KEY]: session })
  } else {
    await storage.remove(RECORDING_SESSION_STORAGE_KEY)
  }
}

const runInRecordingQueue = <T>(operation: () => Promise<T>): Promise<T> => {
  const next = recordingQueue.then(operation, operation)
  recordingQueue = next.catch(() => undefined)
  return next
}

const notifyContentRecordingState = async (tabId: number, active: boolean): Promise<void> => {
  if (!chrome.tabs?.sendMessage) return
  await new Promise<void>(resolve => {
    chrome.tabs.sendMessage(tabId, { type: 'AGENT_RECORDING_SET_STATE', active }, () => {
      void chrome.runtime.lastError
      resolve()
    })
  })
}

async function startRecording(tabId: number): Promise<AgentRecordingSession> {
  if (!Number.isInteger(tabId) || tabId < 0 || !chrome.tabs?.get) {
    throw new Error('缺少有效的录制标签页')
  }
  const tab = await chrome.tabs.get(tabId)
  if (!isRecordablePageUrl(tab.url)) {
    throw new Error('只能录制 HTTP(S) 页面；浏览器内置页不允许注入录制器')
  }
  const startUrl = sanitizeAgentWorkflowUrl(tab.url)
  if (!startUrl) throw new Error('无法验证录制页面地址')
  const current = await readRecordingSession()
  if (current && current.tabId !== tabId) {
    await notifyContentRecordingState(current.tabId, false)
  }
  const now = Date.now()
  const session: AgentRecordingSession = {
    id: makeId('recording'),
    tabId,
    startedAt: now,
    updatedAt: now,
    startUrl: startUrl.url,
    startTitle: cleanText(tab.title, 240) || undefined,
    lastUrl: startUrl.url,
    actions: [],
    redactedFields: startUrl.redacted
      ? [
          {
            selector: 'url:sensitive-parameters',
            label: '页面地址中的敏感参数',
            url: startUrl.url,
            recordedAt: now
          }
        ]
      : []
  }
  await writeRecordingSession(session)
  await notifyContentRecordingState(tabId, true)
  return session
}

async function stopRecording(tabId?: number): Promise<AgentRecordingSession | null> {
  const current = await readRecordingSession()
  if (!current) return null
  if (typeof tabId === 'number' && current.tabId !== tabId) {
    throw new Error('当前标签页不是正在录制的标签页')
  }
  await writeRecordingSession(null)
  return current
}

const combineRecordedAction = (
  session: AgentRecordingSession,
  action: AgentAction
): AgentRecordingSession => {
  const actions = [...session.actions]
  const last = actions[actions.length - 1]

  if (
    last &&
    action.type === 'input' &&
    last.type === 'input' &&
    last.selector === action.selector
  ) {
    actions[actions.length - 1] = action
  } else if (last && action.type === 'scroll' && last.type === 'scroll') {
    actions[actions.length - 1] = {
      ...action,
      x: (last.x || 0) + (action.x || 0),
      y: (last.y || 0) + (action.y || 0)
    }
  } else if (
    action.type === 'navigate' &&
    (action.url === session.lastUrl || (last?.type === 'navigate' && last.url === action.url))
  ) {
    return session
  } else if (actions.length < MAX_RECORDED_ACTIONS) {
    actions.push(action)
  }

  return {
    ...session,
    actions,
    lastUrl: action.type === 'navigate' ? action.url : session.lastUrl,
    updatedAt: Date.now()
  }
}

async function appendRecordedEvent(
  tabId: number,
  event: AgentWorkflowRecordedEvent
): Promise<AgentRecordingSession | null> {
  const session = await readRecordingSession()
  if (!session || session.tabId !== tabId) return null

  if (event.kind === 'action') {
    const action = sanitizeRecordedAction(event.action)
    if (!action) return session
    let source = session
    if (
      event.action.type === 'navigate' &&
      action.type === 'navigate' &&
      event.action.url !== action.url &&
      !session.redactedFields.some(field => field.selector === 'url:sensitive-parameters')
    ) {
      source = {
        ...session,
        redactedFields: [
          ...session.redactedFields,
          {
            selector: 'url:sensitive-parameters',
            label: '页面地址中的敏感参数',
            url: action.url,
            recordedAt: Date.now()
          }
        ].slice(0, MAX_REDACTED_FIELDS)
      }
    }
    const next = combineRecordedAction(source, action)
    if (next !== session) await writeRecordingSession(next)
    return next
  }

  const selector = cleanText(event.selector, 1000)
  if (!selector) return session
  if (
    session.redactedFields.some(field => field.selector === selector && field.url === event.url)
  ) {
    return session
  }
  const redactedFields = [
    ...session.redactedFields,
    {
      selector,
      label: cleanText(event.label, 120) || '敏感输入字段',
      url: sanitizeAgentWorkflowUrl(event.url)?.url || '',
      recordedAt:
        typeof event.recordedAt === 'number' && Number.isFinite(event.recordedAt)
          ? event.recordedAt
          : Date.now()
    }
  ].slice(0, MAX_REDACTED_FIELDS)
  const next = { ...session, redactedFields, updatedAt: Date.now() }
  await writeRecordingSession(next)
  return next
}

async function appendNavigation(tabId: number, rawUrl: string): Promise<void> {
  if (!isRecordablePageUrl(rawUrl)) return
  await appendRecordedEvent(tabId, {
    kind: 'action',
    action: {
      id: makeId('navigation'),
      type: 'navigate',
      url: rawUrl,
      waitForLoad: true,
      note: '页面导航'
    }
  })
}

const alarmNameForSchedule = (scheduleId: string) => `${WORKFLOW_ALARM_PREFIX}${scheduleId}`

async function syncWorkflowAlarms(): Promise<void> {
  if (!chrome.alarms) return
  const schedules = await loadAgentWorkflowSchedules()
  const expected = new Set(
    schedules
      .filter(schedule => schedule.enabled)
      .map(schedule => alarmNameForSchedule(schedule.id))
  )
  const alarms = await chrome.alarms.getAll()
  await Promise.all(
    alarms
      .filter(alarm => alarm.name.startsWith(WORKFLOW_ALARM_PREFIX) && !expected.has(alarm.name))
      .map(alarm => chrome.alarms.clear(alarm.name))
  )
  const now = Date.now()
  for (const schedule of schedules) {
    if (!schedule.enabled) continue
    chrome.alarms.create(alarmNameForSchedule(schedule.id), {
      when: Math.max(schedule.nextRunAt, now + 1000)
    })
  }
}

const updateSchedule = async (
  scheduleId: string,
  patch: Partial<AgentWorkflowSchedule>
): Promise<void> => {
  const schedules = await loadAgentWorkflowSchedules()
  const next = schedules.map(schedule =>
    schedule.id === scheduleId ? { ...schedule, ...patch, updatedAt: Date.now() } : schedule
  )
  await saveAgentWorkflowSchedules(next)
}

const showScheduleNotification = async (
  title: string,
  message: string,
  success: boolean
): Promise<void> => {
  if (!chrome.notifications?.create) return
  try {
    await chrome.notifications.create(`agent-workflow-${Date.now()}`, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('img/128.png'),
      title,
      message,
      priority: success ? 0 : 1
    })
  } catch {
    // Notifications are best effort; execution state remains persisted.
  }
}

async function executeScheduledWorkflow(
  scheduleId: string,
  options: { advanceSchedule?: boolean } = {}
): Promise<void> {
  if (runningSchedules.has(scheduleId)) return
  const advanceSchedule = options.advanceSchedule !== false
  runningSchedules.add(scheduleId)
  let createdTabId: number | undefined
  try {
    const schedules = await loadAgentWorkflowSchedules()
    const schedule = schedules.find(item => item.id === scheduleId)
    if (!schedule || (advanceSchedule && !schedule.enabled)) return
    const workflows = await loadAgentBrowserWorkflows()
    const workflow = workflows.find(item => item.id === schedule.workflowId)
    if (!workflow) throw new Error('定时任务关联的工作流不存在')

    const eligibility = assessWorkflowScheduleEligibility(workflow)
    if (!eligibility.eligible) throw new Error(eligibility.reasons.join('；'))
    if (eligibility.origins.some(origin => !schedule.allowedOrigins.includes(origin))) {
      throw new Error('工作流站点范围已变化，请重新创建定时任务')
    }
    const permissionSnapshot = await chrome.storage.local.get(AGENT_SITE_PERMISSIONS_STORAGE_KEY)
    const blockedOrigins = new Set(
      sanitizeAgentSitePermissions(permissionSnapshot[AGENT_SITE_PERMISSIONS_STORAGE_KEY])
        .filter(permission => permission.decision === 'block')
        .map(permission => permission.key)
    )
    if (eligibility.origins.some(origin => blockedOrigins.has(origin))) {
      throw new Error('工作流包含已明确阻止的站点')
    }
    if (!chrome.tabs?.create) throw new Error('无法创建后台标签页')

    await updateSchedule(schedule.id, { lastRunStatus: 'running', lastRunError: undefined })
    const tab = await chrome.tabs.create({ url: workflow.startUrl, active: false })
    if (typeof tab.id !== 'number') throw new Error('后台标签页创建失败')
    createdTabId = tab.id
    await waitForTabLoad(chrome, tab.id, 30_000)
    await new Promise(resolve => setTimeout(resolve, 250))
    const currentTab = await chrome.tabs.get(tab.id)
    const actions = buildWorkflowReplayActions(workflow, currentTab.url)
    const results = await executeAgentActions(actions, SCHEDULE_PERMISSIONS, tab.id, {
      parallel: false
    })
    const failures = results.filter(result => !result.success)
    if (failures.length > 0) {
      throw new Error(
        failures.map(result => `${result.type}: ${result.error || '失败'}`).join('；')
      )
    }

    const finishedAt = Date.now()
    await updateSchedule(schedule.id, {
      lastRunAt: finishedAt,
      lastRunStatus: 'success',
      lastRunError: undefined,
      nextRunAt: advanceSchedule
        ? computeNextAgentWorkflowRun(schedule, finishedAt)
        : schedule.nextRunAt
    })
    if (schedule.closeTabWhenDone && chrome.tabs?.remove) {
      await chrome.tabs.remove(tab.id)
      createdTabId = undefined
    }
    await showScheduleNotification(
      `工作流已完成：${workflow.name}`,
      `成功执行 ${results.length} 个动作。`,
      true
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : '定时工作流执行失败'
    const now = Date.now()
    const schedule = (await loadAgentWorkflowSchedules()).find(item => item.id === scheduleId)
    await updateSchedule(scheduleId, {
      lastRunAt: now,
      lastRunStatus: 'failed',
      lastRunError: message,
      nextRunAt:
        advanceSchedule && schedule
          ? computeNextAgentWorkflowRun(schedule, now)
          : schedule?.nextRunAt || now + 60 * 60 * 1000
    })
    await showScheduleNotification('工作流运行失败', message.slice(0, 240), false)
    console.error('[AgentWorkflow] Scheduled run failed:', error)
  } finally {
    runningSchedules.delete(scheduleId)
    void syncWorkflowAlarms()
    if (createdTabId !== undefined) {
      // Keep a failed run open for inspection instead of hiding the failure.
      console.warn(`[AgentWorkflow] Failed run left tab ${createdTabId} open for inspection`)
    }
  }
}

export async function handleAgentWorkflowRequest(
  message: BackgroundMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: MessageResponse) => void
): Promise<void> {
  try {
    switch (message.type) {
      case 'AGENT_RECORDING_START': {
        const session = await runInRecordingQueue(() => startRecording(message.tabId))
        sendResponse({ success: true, data: session })
        return
      }
      case 'AGENT_RECORDING_STOP': {
        const current = await runInRecordingQueue(readRecordingSession)
        if (current && typeof message.tabId === 'number' && current.tabId !== message.tabId) {
          throw new Error('当前标签页不是正在录制的标签页')
        }
        // Disable capture outside the serialization queue. The content script
        // may flush debounced input by sending AGENT_RECORDING_EVENT messages,
        // and those messages must be allowed to enter the queue before removal.
        if (current) await notifyContentRecordingState(current.tabId, false)
        await new Promise(resolve => setTimeout(resolve, 80))
        const session = await runInRecordingQueue(() => stopRecording(message.tabId))
        sendResponse({ success: true, data: session })
        return
      }
      case 'AGENT_RECORDING_STATUS': {
        const session = await runInRecordingQueue(readRecordingSession)
        const matches =
          !session || typeof message.tabId !== 'number' || session.tabId === message.tabId
        sendResponse({ success: true, data: matches ? session : null })
        return
      }
      case 'AGENT_RECORDING_CONTENT_READY': {
        const session = await runInRecordingQueue(readRecordingSession)
        sendResponse({
          success: true,
          data: { active: Boolean(session && sender.tab?.id === session.tabId), session }
        })
        return
      }
      case 'AGENT_RECORDING_EVENT': {
        if (typeof sender.tab?.id !== 'number') throw new Error('录制事件缺少来源标签页')
        const session = await runInRecordingQueue(() =>
          appendRecordedEvent(sender.tab?.id as number, message.event)
        )
        sendResponse({ success: true, data: session })
        return
      }
      case 'AGENT_WORKFLOW_RUN_SCHEDULE': {
        const schedule = (await loadAgentWorkflowSchedules()).find(
          item => item.id === message.scheduleId
        )
        if (!schedule) throw new Error('定时任务不存在')
        void executeScheduledWorkflow(schedule.id, { advanceSchedule: false })
        sendResponse({ success: true, data: { started: true } })
        return
      }
      default:
        throw new Error('不支持的工作流消息')
    }
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : '工作流操作失败'
    })
  }
}

export function setupAgentWorkflows(): void {
  if (chrome.tabs?.onUpdated) {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
      if (!changeInfo.url) return
      void runInRecordingQueue(() => appendNavigation(tabId, changeInfo.url as string))
    })
  }
  if (chrome.tabs?.onRemoved) {
    chrome.tabs.onRemoved.addListener(tabId => {
      void runInRecordingQueue(async () => {
        const session = await readRecordingSession()
        if (session?.tabId === tabId) await writeRecordingSession(null)
      })
    })
  }
  if (chrome.alarms?.onAlarm) {
    chrome.alarms.onAlarm.addListener(alarm => {
      if (!alarm.name.startsWith(WORKFLOW_ALARM_PREFIX)) return
      void executeScheduledWorkflow(alarm.name.slice(WORKFLOW_ALARM_PREFIX.length), {
        advanceSchedule: true
      })
    })
  }
  chrome.storage?.onChanged?.addListener((changes, areaName) => {
    if (areaName !== 'local') return
    if (
      changes[AGENT_WORKFLOW_SCHEDULES_STORAGE_KEY] ||
      changes[AGENT_BROWSER_WORKFLOWS_STORAGE_KEY]
    ) {
      void syncWorkflowAlarms()
    }
  })
  void syncWorkflowAlarms()
}
