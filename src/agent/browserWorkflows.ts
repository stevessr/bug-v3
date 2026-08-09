import { classifyProtectedAgentAction, normalizeAgentSite } from './permissionPolicy'
import type { AgentAction, AgentActionType } from './types'

export const AGENT_BROWSER_WORKFLOWS_STORAGE_KEY = 'ai-agent-browser-workflows-v1'
export const AGENT_WORKFLOW_SCHEDULES_STORAGE_KEY = 'ai-agent-workflow-schedules-v1'

const MAX_WORKFLOWS = 100
const MAX_WORKFLOW_ACTIONS = 500
const MAX_REDACTED_FIELDS = 100
const MAX_SCHEDULES = 100
const MIN_SCHEDULE_INTERVAL_MINUTES = 1
const MAX_SCHEDULE_INTERVAL_MINUTES = 365 * 24 * 60
const SENSITIVE_URL_KEY_PATTERN = /token|key|secret|password|passwd|auth|code|session/i

const RECORDED_ACTION_TYPES = new Set<AgentActionType>([
  'click',
  'click-dom',
  'scroll',
  'navigate',
  'input',
  'key',
  'type',
  'select',
  'focus',
  'blur',
  'wait'
])

const SCHEDULE_SAFE_ACTION_TYPES = new Set<AgentActionType>([
  'click',
  'click-dom',
  'scroll',
  'navigate',
  'input',
  'key',
  'type',
  'select',
  'focus',
  'blur',
  'wait'
])

export type AgentWorkflowRedactedField = {
  selector: string
  label: string
  url: string
  recordedAt: number
}

export type AgentRecordingSession = {
  id: string
  tabId: number
  startedAt: number
  updatedAt: number
  startUrl: string
  startTitle?: string
  lastUrl: string
  actions: AgentAction[]
  redactedFields: AgentWorkflowRedactedField[]
}

export type AgentWorkflowRecordedEvent =
  | {
      kind: 'action'
      action: AgentAction
      url?: string
      recordedAt?: number
    }
  | {
      kind: 'redacted-input'
      selector: string
      label?: string
      url?: string
      recordedAt?: number
    }

export type AgentBrowserWorkflow = {
  id: string
  name: string
  description?: string
  shortcut: string
  createdAt: number
  updatedAt: number
  startUrl: string
  startTitle?: string
  actions: AgentAction[]
  redactedFields: AgentWorkflowRedactedField[]
  lastRunAt?: number
  lastRunStatus?: 'success' | 'failed' | 'denied'
  lastRunError?: string
}

export type AgentWorkflowScheduleCadence = 'interval' | 'daily' | 'weekly' | 'monthly' | 'yearly'

export type AgentWorkflowSchedule = {
  id: string
  workflowId: string
  enabled: boolean
  cadence: AgentWorkflowScheduleCadence
  intervalMinutes: number
  /** The user-selected first occurrence. Calendar recurrences derive from this anchor. */
  anchorAt: number
  nextRunAt: number
  allowedOrigins: string[]
  closeTabWhenDone: boolean
  createdAt: number
  updatedAt: number
  lastRunAt?: number
  lastRunStatus?: 'success' | 'failed' | 'running'
  lastRunError?: string
}

export type AgentWorkflowScheduleEligibility = {
  eligible: boolean
  reasons: string[]
  origins: string[]
}

export type AgentWorkflowScheduleOptions = {
  cadence?: AgentWorkflowScheduleCadence
  intervalMinutes?: number
  firstRunAt?: number
}

const SCHEDULE_CADENCES = new Set<AgentWorkflowScheduleCadence>([
  'interval',
  'daily',
  'weekly',
  'monthly',
  'yearly'
])

const DEFAULT_INTERVAL_BY_CADENCE: Record<AgentWorkflowScheduleCadence, number> = {
  interval: 60,
  daily: 24 * 60,
  weekly: 7 * 24 * 60,
  monthly: 30 * 24 * 60,
  yearly: 365 * 24 * 60
}

const makeId = (prefix: string) =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`

const cleanText = (value: unknown, maxLength: number): string =>
  typeof value === 'string'
    ? [...value]
        .filter(character => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
        .join('')
        .trim()
        .slice(0, maxLength)
    : ''

const normalizeTimestamp = (value: unknown, fallback = Date.now()): number => {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

const clampInteger = (value: unknown, fallback: number, min: number, max: number): number => {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.floor(parsed)))
}

const isReplayableUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function sanitizeAgentWorkflowUrl(value: unknown): {
  url: string
  redacted: boolean
} | null {
  if (!isReplayableUrl(value)) return null
  const url = new URL(value)
  let redacted = false
  if (url.username || url.password) {
    url.username = ''
    url.password = ''
    redacted = true
  }
  for (const key of [...url.searchParams.keys()]) {
    if (!SENSITIVE_URL_KEY_PATTERN.test(key)) continue
    url.searchParams.set(key, '[REDACTED]')
    redacted = true
  }
  if (url.hash && SENSITIVE_URL_KEY_PATTERN.test(url.hash)) {
    url.hash = '#[REDACTED]'
    redacted = true
  }
  return { url: url.toString().slice(0, 4000), redacted }
}

export function normalizeWorkflowShortcut(value: unknown, fallbackName = 'workflow'): string {
  const source = cleanText(value, 64).replace(/^\/+/, '') || cleanText(fallbackName, 64)
  const normalized = source
    .toLocaleLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[\\/?#%&=:+]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return normalized || `workflow-${makeId('shortcut').slice(-6)}`
}

function sanitizeAction(raw: unknown): AgentAction | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const type = record.type as AgentActionType
  if (!RECORDED_ACTION_TYPES.has(type)) return null

  const id = cleanText(record.id, 100) || makeId('action')
  const action: Record<string, unknown> = { ...record, id, type }
  delete action.tabId

  if (typeof action.selector === 'string') {
    action.selector = cleanText(action.selector, 1000)
  }
  if (typeof action.note === 'string') {
    action.note = cleanText(action.note, 240)
  }
  if ((type === 'input' || type === 'type') && typeof action.text === 'string') {
    action.text = action.text.slice(0, 20_000)
  }
  if (type === 'navigate') {
    const sanitizedUrl = sanitizeAgentWorkflowUrl(action.url)
    if (!sanitizedUrl) return null
    action.url = sanitizedUrl.url
  }
  if (type === 'scroll') {
    action.x = clampInteger(action.x, 0, -100_000, 100_000)
    action.y = clampInteger(action.y, 0, -100_000, 100_000)
    action.behavior = 'auto'
  }
  if (type === 'wait') {
    action.ms = clampInteger(action.ms, 500, 0, 30_000)
  }
  return action as unknown as AgentAction
}

export function sanitizeRecordedAction(raw: unknown): AgentAction | null {
  return sanitizeAction(raw)
}

function sanitizeRedactedField(raw: unknown): AgentWorkflowRedactedField | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const selector = cleanText(record.selector, 1000)
  if (!selector) return null
  return {
    selector,
    label: cleanText(record.label, 120) || '敏感输入字段',
    url: sanitizeAgentWorkflowUrl(record.url)?.url || '',
    recordedAt: normalizeTimestamp(record.recordedAt)
  }
}

export function sanitizeRecordingSession(raw: unknown): AgentRecordingSession | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const tabId = clampInteger(record.tabId, -1, -1, Number.MAX_SAFE_INTEGER)
  const startUrl = sanitizeAgentWorkflowUrl(record.startUrl)
  if (tabId < 0 || !startUrl) return null
  const actions = Array.isArray(record.actions)
    ? record.actions.map(sanitizeAction).filter((item): item is AgentAction => Boolean(item))
    : []
  const redactedFields = Array.isArray(record.redactedFields)
    ? record.redactedFields
        .map(sanitizeRedactedField)
        .filter((item): item is AgentWorkflowRedactedField => Boolean(item))
    : []
  const startedAt = normalizeTimestamp(record.startedAt)
  return {
    id: cleanText(record.id, 100) || makeId('recording'),
    tabId,
    startedAt,
    updatedAt: normalizeTimestamp(record.updatedAt, startedAt),
    startUrl: startUrl.url,
    startTitle: cleanText(record.startTitle, 240) || undefined,
    lastUrl: sanitizeAgentWorkflowUrl(record.lastUrl)?.url || startUrl.url,
    actions: actions.slice(0, MAX_WORKFLOW_ACTIONS),
    redactedFields: redactedFields.slice(0, MAX_REDACTED_FIELDS)
  }
}

export function createAgentBrowserWorkflow(
  session: AgentRecordingSession,
  name: string
): AgentBrowserWorkflow {
  const now = Date.now()
  const workflowName = cleanText(name, 80) || session.startTitle || '未命名工作流'
  return {
    id: makeId('workflow'),
    name: workflowName,
    shortcut: normalizeWorkflowShortcut(workflowName),
    createdAt: now,
    updatedAt: now,
    startUrl: session.startUrl,
    startTitle: session.startTitle,
    actions: session.actions.map(action => ({ ...action })),
    redactedFields: session.redactedFields.map(field => ({ ...field }))
  }
}

export function sanitizeAgentBrowserWorkflow(raw: unknown): AgentBrowserWorkflow | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const id = cleanText(record.id, 100)
  const name = cleanText(record.name, 80)
  const startUrl = sanitizeAgentWorkflowUrl(record.startUrl)
  if (!id || !name || !startUrl) return null
  const actions = Array.isArray(record.actions)
    ? record.actions.map(sanitizeAction).filter((item): item is AgentAction => Boolean(item))
    : []
  const redactedFields = Array.isArray(record.redactedFields)
    ? record.redactedFields
        .map(sanitizeRedactedField)
        .filter((item): item is AgentWorkflowRedactedField => Boolean(item))
    : []
  const createdAt = normalizeTimestamp(record.createdAt)
  const updatedAt = normalizeTimestamp(record.updatedAt, createdAt)
  const lastRunStatus = ['success', 'failed', 'denied'].includes(String(record.lastRunStatus))
    ? (record.lastRunStatus as AgentBrowserWorkflow['lastRunStatus'])
    : undefined
  return {
    id,
    name,
    description: cleanText(record.description, 500) || undefined,
    shortcut: normalizeWorkflowShortcut(record.shortcut, name),
    createdAt,
    updatedAt,
    startUrl: startUrl.url,
    startTitle: cleanText(record.startTitle, 240) || undefined,
    actions: actions.slice(0, MAX_WORKFLOW_ACTIONS),
    redactedFields: redactedFields.slice(0, MAX_REDACTED_FIELDS),
    lastRunAt: record.lastRunAt ? normalizeTimestamp(record.lastRunAt) : undefined,
    lastRunStatus,
    lastRunError: cleanText(record.lastRunError, 500) || undefined
  }
}

export function sanitizeAgentBrowserWorkflows(raw: unknown): AgentBrowserWorkflow[] {
  if (!Array.isArray(raw)) return []
  const deduplicated = new Map<string, AgentBrowserWorkflow>()
  for (const item of raw) {
    const workflow = sanitizeAgentBrowserWorkflow(item)
    if (workflow) deduplicated.set(workflow.id, workflow)
  }
  return [...deduplicated.values()]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_WORKFLOWS)
}

export function sanitizeAgentWorkflowSchedule(raw: unknown): AgentWorkflowSchedule | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const id = cleanText(record.id, 100)
  const workflowId = cleanText(record.workflowId, 100)
  if (!id || !workflowId) return null
  const allowedOrigins = Array.isArray(record.allowedOrigins)
    ? [
        ...new Set(
          record.allowedOrigins
            .map(origin => normalizeAgentSite(origin)?.key)
            .filter((origin): origin is string => Boolean(origin))
        )
      ]
    : []
  const createdAt = normalizeTimestamp(record.createdAt)
  const updatedAt = normalizeTimestamp(record.updatedAt, createdAt)
  const status = ['success', 'failed', 'running'].includes(String(record.lastRunStatus))
    ? (record.lastRunStatus as AgentWorkflowSchedule['lastRunStatus'])
    : undefined
  const cadence = SCHEDULE_CADENCES.has(record.cadence as AgentWorkflowScheduleCadence)
    ? (record.cadence as AgentWorkflowScheduleCadence)
    : 'interval'
  const intervalMinutes = clampInteger(
    record.intervalMinutes,
    DEFAULT_INTERVAL_BY_CADENCE[cadence],
    MIN_SCHEDULE_INTERVAL_MINUTES,
    MAX_SCHEDULE_INTERVAL_MINUTES
  )
  const nextRunAt = normalizeTimestamp(record.nextRunAt, Date.now() + intervalMinutes * 60 * 1000)
  return {
    id,
    workflowId,
    enabled: record.enabled !== false,
    cadence,
    intervalMinutes,
    anchorAt: normalizeTimestamp(record.anchorAt, nextRunAt),
    nextRunAt,
    allowedOrigins,
    closeTabWhenDone: record.closeTabWhenDone !== false,
    createdAt,
    updatedAt,
    lastRunAt: record.lastRunAt ? normalizeTimestamp(record.lastRunAt) : undefined,
    lastRunStatus: status,
    lastRunError: cleanText(record.lastRunError, 500) || undefined
  }
}

export function sanitizeAgentWorkflowSchedules(raw: unknown): AgentWorkflowSchedule[] {
  if (!Array.isArray(raw)) return []
  const deduplicated = new Map<string, AgentWorkflowSchedule>()
  for (const item of raw) {
    const schedule = sanitizeAgentWorkflowSchedule(item)
    if (schedule) deduplicated.set(schedule.id, schedule)
  }
  return [...deduplicated.values()]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_SCHEDULES)
}

const readFallbackValue = (key: string): unknown => {
  if (typeof localStorage === 'undefined') return undefined
  const raw = localStorage.getItem(key)
  if (!raw) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

const writeFallbackValue = (key: string, value: unknown) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(key, JSON.stringify(value))
}

async function readStoredValue(key: string): Promise<unknown> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local?.get) {
    try {
      const result = await chrome.storage.local.get(key)
      return result[key]
    } catch {
      // Web previews and partially mocked extension APIs use localStorage.
    }
  }
  return readFallbackValue(key)
}

async function writeStoredValue(key: string, value: unknown): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local?.set) {
    try {
      await chrome.storage.local.set({ [key]: value })
      return
    } catch {
      // Web previews and partially mocked extension APIs use localStorage.
    }
  }
  writeFallbackValue(key, value)
}

export async function loadAgentBrowserWorkflows(): Promise<AgentBrowserWorkflow[]> {
  return sanitizeAgentBrowserWorkflows(await readStoredValue(AGENT_BROWSER_WORKFLOWS_STORAGE_KEY))
}

export async function saveAgentBrowserWorkflows(
  workflows: AgentBrowserWorkflow[]
): Promise<AgentBrowserWorkflow[]> {
  const sanitized = sanitizeAgentBrowserWorkflows(workflows)
  await writeStoredValue(AGENT_BROWSER_WORKFLOWS_STORAGE_KEY, sanitized)
  return sanitized
}

export async function upsertAgentBrowserWorkflow(
  workflow: AgentBrowserWorkflow
): Promise<AgentBrowserWorkflow[]> {
  const current = await loadAgentBrowserWorkflows()
  const existingShortcuts = new Set(
    current.filter(item => item.id !== workflow.id).map(item => item.shortcut)
  )
  let shortcut = normalizeWorkflowShortcut(workflow.shortcut, workflow.name)
  if (existingShortcuts.has(shortcut)) {
    shortcut = `${shortcut.slice(0, 32)}-${workflow.id.slice(-6)}`
  }
  return saveAgentBrowserWorkflows([
    { ...workflow, shortcut, updatedAt: Date.now() },
    ...current.filter(item => item.id !== workflow.id)
  ])
}

export async function removeAgentBrowserWorkflow(id: string): Promise<AgentBrowserWorkflow[]> {
  const current = await loadAgentBrowserWorkflows()
  const next = await saveAgentBrowserWorkflows(current.filter(item => item.id !== id))
  const schedules = await loadAgentWorkflowSchedules()
  await saveAgentWorkflowSchedules(schedules.filter(schedule => schedule.workflowId !== id))
  return next
}

export async function loadAgentWorkflowSchedules(): Promise<AgentWorkflowSchedule[]> {
  return sanitizeAgentWorkflowSchedules(await readStoredValue(AGENT_WORKFLOW_SCHEDULES_STORAGE_KEY))
}

export async function saveAgentWorkflowSchedules(
  schedules: AgentWorkflowSchedule[]
): Promise<AgentWorkflowSchedule[]> {
  const sanitized = sanitizeAgentWorkflowSchedules(schedules)
  await writeStoredValue(AGENT_WORKFLOW_SCHEDULES_STORAGE_KEY, sanitized)
  return sanitized
}

export async function upsertAgentWorkflowSchedule(
  schedule: AgentWorkflowSchedule
): Promise<AgentWorkflowSchedule[]> {
  const current = await loadAgentWorkflowSchedules()
  return saveAgentWorkflowSchedules([
    { ...schedule, updatedAt: Date.now() },
    ...current.filter(item => item.id !== schedule.id)
  ])
}

export async function removeAgentWorkflowSchedule(id: string): Promise<AgentWorkflowSchedule[]> {
  const current = await loadAgentWorkflowSchedules()
  return saveAgentWorkflowSchedules(current.filter(item => item.id !== id))
}

export function assessWorkflowScheduleEligibility(
  workflow: AgentBrowserWorkflow
): AgentWorkflowScheduleEligibility {
  const reasons: string[] = []
  const origins = new Set<string>()
  if (workflow.actions.length === 0) reasons.push('工作流没有可执行动作')
  if (workflow.redactedFields.length > 0) reasons.push('工作流包含需要手动填写的敏感字段')

  const startSite = normalizeAgentSite(workflow.startUrl)
  if (!startSite?.persistable || !/^https?:/i.test(workflow.startUrl)) {
    reasons.push('起始页面不是可调度的 HTTP(S) 站点')
  } else {
    origins.add(startSite.key)
  }

  for (const action of workflow.actions) {
    if (!SCHEDULE_SAFE_ACTION_TYPES.has(action.type)) {
      reasons.push(`定时运行不支持 ${action.type} 动作`)
    }
    const protection = classifyProtectedAgentAction(action)
    if (protection) reasons.push(protection.reason)
    if (action.type === 'navigate') {
      const site = normalizeAgentSite(action.url)
      if (!site?.persistable || !/^https?:/i.test(action.url)) {
        reasons.push('工作流包含无法验证的跳转地址')
      } else {
        origins.add(site.key)
      }
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons: [...new Set(reasons)],
    origins: [...origins]
  }
}

const daysInMonth = (year: number, month: number): number => new Date(year, month + 1, 0).getDate()

const createCalendarOccurrence = (
  anchorAt: number,
  cadence: Exclude<AgentWorkflowScheduleCadence, 'interval'>,
  step: number
): number => {
  const anchor = new Date(anchorAt)
  const year = anchor.getFullYear()
  const month = anchor.getMonth()
  const day = anchor.getDate()
  const hours = anchor.getHours()
  const minutes = anchor.getMinutes()
  const seconds = anchor.getSeconds()
  const milliseconds = anchor.getMilliseconds()

  if (cadence === 'daily' || cadence === 'weekly') {
    const occurrence = new Date(anchorAt)
    occurrence.setDate(day + step * (cadence === 'weekly' ? 7 : 1))
    return occurrence.getTime()
  }

  if (cadence === 'monthly') {
    const targetMonthStart = new Date(year, month + step, 1, hours, minutes, seconds, milliseconds)
    targetMonthStart.setDate(
      Math.min(day, daysInMonth(targetMonthStart.getFullYear(), targetMonthStart.getMonth()))
    )
    return targetMonthStart.getTime()
  }

  const targetYear = year + step
  return new Date(
    targetYear,
    month,
    Math.min(day, daysInMonth(targetYear, month)),
    hours,
    minutes,
    seconds,
    milliseconds
  ).getTime()
}

/** Return the first occurrence strictly after `after`. */
export function computeNextAgentWorkflowRun(
  schedule: Pick<AgentWorkflowSchedule, 'cadence' | 'intervalMinutes' | 'anchorAt' | 'nextRunAt'>,
  after = Date.now()
): number {
  const anchorAt = normalizeTimestamp(schedule.anchorAt, schedule.nextRunAt)
  if (after < anchorAt) return anchorAt

  if (schedule.cadence === 'interval') {
    const intervalMs =
      clampInteger(
        schedule.intervalMinutes,
        DEFAULT_INTERVAL_BY_CADENCE.interval,
        MIN_SCHEDULE_INTERVAL_MINUTES,
        MAX_SCHEDULE_INTERVAL_MINUTES
      ) *
      60 *
      1000
    const elapsedIntervals = Math.floor((after - anchorAt) / intervalMs) + 1
    return anchorAt + elapsedIntervals * intervalMs
  }

  const anchor = new Date(anchorAt)
  const cursor = new Date(after)
  let step = 1
  if (schedule.cadence === 'daily') {
    step = Math.max(1, Math.floor((after - anchorAt) / (24 * 60 * 60 * 1000)) - 1)
  } else if (schedule.cadence === 'weekly') {
    step = Math.max(1, Math.floor((after - anchorAt) / (7 * 24 * 60 * 60 * 1000)) - 1)
  } else if (schedule.cadence === 'monthly') {
    step = Math.max(
      1,
      (cursor.getFullYear() - anchor.getFullYear()) * 12 + cursor.getMonth() - anchor.getMonth() - 1
    )
  } else {
    step = Math.max(1, cursor.getFullYear() - anchor.getFullYear() - 1)
  }

  let occurrence = createCalendarOccurrence(anchorAt, schedule.cadence, step)
  while (occurrence <= after) {
    step += 1
    occurrence = createCalendarOccurrence(anchorAt, schedule.cadence, step)
  }
  return occurrence
}

export function createAgentWorkflowSchedule(
  workflow: AgentBrowserWorkflow,
  intervalOrOptions: number | AgentWorkflowScheduleOptions,
  now = Date.now()
): AgentWorkflowSchedule {
  const eligibility = assessWorkflowScheduleEligibility(workflow)
  if (!eligibility.eligible) {
    throw new Error(eligibility.reasons.join('；') || '该工作流不能定时运行')
  }
  const options =
    typeof intervalOrOptions === 'number'
      ? { cadence: 'interval' as const, intervalMinutes: intervalOrOptions }
      : intervalOrOptions || {}
  const cadence = SCHEDULE_CADENCES.has(options.cadence as AgentWorkflowScheduleCadence)
    ? (options.cadence as AgentWorkflowScheduleCadence)
    : 'interval'
  const interval = clampInteger(
    options.intervalMinutes,
    DEFAULT_INTERVAL_BY_CADENCE[cadence],
    MIN_SCHEDULE_INTERVAL_MINUTES,
    MAX_SCHEDULE_INTERVAL_MINUTES
  )
  const requestedFirstRun =
    typeof options.firstRunAt === 'number' && Number.isFinite(options.firstRunAt)
      ? Math.floor(options.firstRunAt)
      : now + interval * 60 * 1000
  const firstRunAt = Math.max(requestedFirstRun, now + 1000)
  return {
    id: makeId('schedule'),
    workflowId: workflow.id,
    enabled: true,
    cadence,
    intervalMinutes: interval,
    anchorAt: firstRunAt,
    nextRunAt: firstRunAt,
    allowedOrigins: eligibility.origins,
    closeTabWhenDone: true,
    createdAt: now,
    updatedAt: now
  }
}

export function buildWorkflowReplayActions(
  workflow: AgentBrowserWorkflow,
  currentUrl?: string
): AgentAction[] {
  const actions: AgentAction[] = []
  if (currentUrl !== workflow.startUrl) {
    actions.push({
      id: makeId('workflow-start'),
      type: 'navigate',
      url: workflow.startUrl,
      waitForLoad: true,
      note: `打开工作流起始页：${workflow.name}`
    })
  }
  workflow.actions.forEach(action => {
    actions.push({ ...action, id: makeId('workflow-action') })
  })
  return actions
}
