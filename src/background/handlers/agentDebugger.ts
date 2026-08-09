import { getChromeAPI } from '../utils/main'

const MAX_CONSOLE_ENTRIES = 500
const MAX_NETWORK_ENTRIES = 500
const DEFAULT_READ_LIMIT = 100
const MAX_READ_LIMIT = 500

export type AgentConsoleEntry = {
  timestamp: number
  level: string
  source: string
  text: string
  url?: string
  lineNumber?: number
  columnNumber?: number
}

export type AgentNetworkEntry = {
  requestId: string
  url: string
  method?: string
  resourceType?: string
  status?: number
  statusText?: string
  mimeType?: string
  fromDiskCache?: boolean
  fromServiceWorker?: boolean
  encodedDataLength?: number
  startedAt: number
  completedAt?: number
  durationMs?: number
  failed?: boolean
  errorText?: string
}

type InternalNetworkEntry = AgentNetworkEntry & {
  protocolStartedAt?: number
}

type AgentDebugSession = {
  tabId: number
  attachedAt: number
  attached: boolean
  captureConsole: boolean
  captureNetwork: boolean
  detachReason?: string
  consoleEntries: AgentConsoleEntry[]
  networkEntries: Map<string, InternalNetworkEntry>
}

export type AgentDebugStartOptions = {
  captureConsole?: boolean
  captureNetwork?: boolean
  clear?: boolean
}

export type AgentDebugReadOptions = {
  clear?: boolean
  limit?: number
}

const sessions = new Map<number, AgentDebugSession>()
let listenerOwner: typeof chrome | null = null

const clampLimit = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return DEFAULT_READ_LIMIT
  return Math.min(MAX_READ_LIMIT, Math.max(1, Math.floor(parsed)))
}

const trimArray = <T>(items: T[], max: number) => {
  if (items.length > max) items.splice(0, items.length - max)
}

const sanitizeUrl = (raw: unknown): string => {
  const value = typeof raw === 'string' ? raw : ''
  if (!value) return ''
  try {
    const url = new URL(value)
    for (const key of [...url.searchParams.keys()]) {
      if (/(?:token|key|secret|password|passwd|auth|code|session)/i.test(key)) {
        url.searchParams.set(key, '<redacted>')
      }
    }
    return url.toString()
  } catch {
    return value
  }
}

const remoteObjectText = (value: any): string => {
  if (!value || typeof value !== 'object') return String(value ?? '')
  if (value.type === 'string' && typeof value.value === 'string') return value.value
  if ('value' in value) {
    try {
      return typeof value.value === 'string' ? value.value : JSON.stringify(value.value)
    } catch {
      return String(value.value)
    }
  }
  if (typeof value.unserializableValue === 'string') return value.unserializableValue
  if (typeof value.description === 'string') return value.description
  return value.type || 'unknown'
}

const addConsoleEntry = (session: AgentDebugSession, entry: AgentConsoleEntry) => {
  session.consoleEntries.push(entry)
  trimArray(session.consoleEntries, MAX_CONSOLE_ENTRIES)
}

const trimNetworkEntries = (session: AgentDebugSession) => {
  while (session.networkEntries.size > MAX_NETWORK_ENTRIES) {
    const oldest = session.networkEntries.keys().next().value
    if (typeof oldest !== 'string') break
    session.networkEntries.delete(oldest)
  }
}

const handleConsoleEvent = (session: AgentDebugSession, method: string, params: any) => {
  if (!session.captureConsole) return

  if (method === 'Runtime.consoleAPICalled') {
    const frame = params?.stackTrace?.callFrames?.[0]
    addConsoleEntry(session, {
      timestamp: Number(params?.timestamp) || Date.now(),
      level: String(params?.type || 'log'),
      source: 'console-api',
      text: Array.isArray(params?.args) ? params.args.map(remoteObjectText).join(' ') : '',
      url: sanitizeUrl(frame?.url) || undefined,
      lineNumber: typeof frame?.lineNumber === 'number' ? frame.lineNumber : undefined,
      columnNumber: typeof frame?.columnNumber === 'number' ? frame.columnNumber : undefined
    })
    return
  }

  if (method === 'Runtime.exceptionThrown') {
    const details = params?.exceptionDetails || {}
    const frame = details?.stackTrace?.callFrames?.[0]
    addConsoleEntry(session, {
      timestamp: Number(params?.timestamp) || Date.now(),
      level: 'error',
      source: 'exception',
      text: remoteObjectText(details.exception) || String(details.text || 'Uncaught exception'),
      url: sanitizeUrl(details.url || frame?.url) || undefined,
      lineNumber:
        typeof details.lineNumber === 'number'
          ? details.lineNumber
          : typeof frame?.lineNumber === 'number'
            ? frame.lineNumber
            : undefined,
      columnNumber:
        typeof details.columnNumber === 'number'
          ? details.columnNumber
          : typeof frame?.columnNumber === 'number'
            ? frame.columnNumber
            : undefined
    })
    return
  }

  if (method === 'Log.entryAdded') {
    const entry = params?.entry || {}
    addConsoleEntry(session, {
      timestamp: Number(entry.timestamp) || Date.now(),
      level: String(entry.level || 'info'),
      source: String(entry.source || 'log'),
      text: String(entry.text || ''),
      url: sanitizeUrl(entry.url) || undefined,
      lineNumber: typeof entry.lineNumber === 'number' ? entry.lineNumber : undefined
    })
  }
}

const getNetworkEntry = (
  session: AgentDebugSession,
  requestId: string
): InternalNetworkEntry | undefined => session.networkEntries.get(requestId)

const handleNetworkEvent = (session: AgentDebugSession, method: string, params: any) => {
  if (!session.captureNetwork) return
  const requestId = typeof params?.requestId === 'string' ? params.requestId : ''
  if (!requestId) return

  if (method === 'Network.requestWillBeSent') {
    const request = params?.request || {}
    session.networkEntries.set(requestId, {
      requestId,
      url: sanitizeUrl(request.url),
      method: typeof request.method === 'string' ? request.method : undefined,
      resourceType: typeof params?.type === 'string' ? params.type : undefined,
      startedAt:
        typeof params?.wallTime === 'number' ? Math.round(params.wallTime * 1000) : Date.now(),
      protocolStartedAt: typeof params?.timestamp === 'number' ? params.timestamp : undefined
    })
    trimNetworkEntries(session)
    return
  }

  const entry = getNetworkEntry(session, requestId)
  if (!entry) return

  if (method === 'Network.responseReceived') {
    const response = params?.response || {}
    entry.url = sanitizeUrl(response.url) || entry.url
    entry.resourceType = typeof params?.type === 'string' ? params.type : entry.resourceType
    entry.status = typeof response.status === 'number' ? response.status : undefined
    entry.statusText = typeof response.statusText === 'string' ? response.statusText : undefined
    entry.mimeType = typeof response.mimeType === 'string' ? response.mimeType : undefined
    entry.fromDiskCache = Boolean(response.fromDiskCache)
    entry.fromServiceWorker = Boolean(response.fromServiceWorker)
    return
  }

  if (method === 'Network.loadingFinished' || method === 'Network.loadingFailed') {
    entry.completedAt = Date.now()
    if (typeof params?.timestamp === 'number' && typeof entry.protocolStartedAt === 'number') {
      entry.durationMs = Math.max(
        0,
        Math.round((params.timestamp - entry.protocolStartedAt) * 1000)
      )
    }
    if (method === 'Network.loadingFinished') {
      entry.encodedDataLength =
        typeof params?.encodedDataLength === 'number' ? params.encodedDataLength : undefined
    } else {
      entry.failed = true
      entry.errorText = typeof params?.errorText === 'string' ? params.errorText : 'Request failed'
    }
  }
}

const ensureDebuggerListeners = (chromeAPI: typeof chrome) => {
  if (listenerOwner === chromeAPI) return
  listenerOwner = chromeAPI

  chromeAPI.debugger.onEvent.addListener((source, method, params) => {
    if (typeof source.tabId !== 'number') return
    const session = sessions.get(source.tabId)
    if (!session) return
    handleConsoleEvent(session, method, params)
    handleNetworkEvent(session, method, params)
  })

  chromeAPI.debugger.onDetach.addListener((source, reason) => {
    if (typeof source.tabId !== 'number') return
    const session = sessions.get(source.tabId)
    if (!session) return
    session.attached = false
    session.detachReason = reason
  })

  chromeAPI.tabs?.onRemoved?.addListener(tabId => {
    sessions.delete(tabId)
  })
}

const requireDebugger = (chromeAPI: typeof chrome | undefined): typeof chrome => {
  if (!chromeAPI?.debugger) throw new Error('chrome.debugger 不可用，请确认扩展已授予调试权限')
  return chromeAPI
}

const sessionSummary = (session: AgentDebugSession) => ({
  tabId: session.tabId,
  attached: session.attached,
  attachedAt: session.attachedAt,
  captureConsole: session.captureConsole,
  captureNetwork: session.captureNetwork,
  consoleCount: session.consoleEntries.length,
  networkCount: session.networkEntries.size,
  detachReason: session.detachReason
})

export async function startAgentDebugSession(
  tabId: number,
  options: AgentDebugStartOptions = {},
  chromeOverride?: typeof chrome
) {
  const chromeAPI = requireDebugger(chromeOverride || getChromeAPI())
  ensureDebuggerListeners(chromeAPI)

  const existing = sessions.get(tabId)
  if (existing?.attached) {
    existing.captureConsole = options.captureConsole !== false
    existing.captureNetwork = options.captureNetwork !== false
    if (options.clear) {
      existing.consoleEntries = []
      existing.networkEntries.clear()
    }
    return sessionSummary(existing)
  }

  const session: AgentDebugSession = {
    tabId,
    attachedAt: Date.now(),
    attached: false,
    captureConsole: options.captureConsole !== false,
    captureNetwork: options.captureNetwork !== false,
    consoleEntries: [],
    networkEntries: new Map()
  }

  const target: chrome.debugger.Debuggee = { tabId }
  await chromeAPI.debugger.attach(target, '1.3')
  session.attached = true
  sessions.set(tabId, session)

  try {
    if (session.captureConsole) {
      await chromeAPI.debugger.sendCommand(target, 'Runtime.enable')
      await chromeAPI.debugger.sendCommand(target, 'Log.enable')
    }
    if (session.captureNetwork) {
      await chromeAPI.debugger.sendCommand(target, 'Network.enable')
    }
  } catch (error) {
    sessions.delete(tabId)
    try {
      await chromeAPI.debugger.detach(target)
    } catch {
      // Ignore cleanup failure and preserve the original protocol error.
    }
    throw error
  }

  return sessionSummary(session)
}

export function readAgentConsole(tabId: number, options: AgentDebugReadOptions = {}) {
  const session = sessions.get(tabId)
  if (!session) throw new Error('该标签页尚未启动开发者观测')
  const entries = session.consoleEntries.slice(-clampLimit(options.limit))
  if (options.clear) session.consoleEntries = []
  return { ...sessionSummary(session), entries }
}

export function readAgentNetwork(tabId: number, options: AgentDebugReadOptions = {}) {
  const session = sessions.get(tabId)
  if (!session) throw new Error('该标签页尚未启动开发者观测')
  const entries = Array.from(session.networkEntries.values())
    .slice(-clampLimit(options.limit))
    .map(({ protocolStartedAt: _protocolStartedAt, ...entry }) => entry)
  if (options.clear) session.networkEntries.clear()
  return { ...sessionSummary(session), entries }
}

export async function stopAgentDebugSession(tabId: number, chromeOverride?: typeof chrome) {
  const chromeAPI = requireDebugger(chromeOverride || getChromeAPI())
  const session = sessions.get(tabId)
  if (!session) return { tabId, attached: false, stopped: true }

  sessions.delete(tabId)
  if (session.attached) {
    try {
      await chromeAPI.debugger.detach({ tabId })
    } catch (error: any) {
      if (!/not attached/i.test(error?.message || '')) throw error
    }
  }
  return { tabId, attached: false, stopped: true }
}

export type AgentDebugRequest =
  | ({ type: 'AGENT_DEBUG_START'; tabId: number } & AgentDebugStartOptions)
  | ({ type: 'AGENT_DEBUG_READ_CONSOLE'; tabId: number } & AgentDebugReadOptions)
  | ({ type: 'AGENT_DEBUG_READ_NETWORK'; tabId: number } & AgentDebugReadOptions)
  | { type: 'AGENT_DEBUG_STOP'; tabId: number }

export async function handleAgentDebugRequest(
  message: AgentDebugRequest,
  sendResponse: (response: any) => void
) {
  try {
    let data: unknown
    switch (message.type) {
      case 'AGENT_DEBUG_START':
        data = await startAgentDebugSession(message.tabId, message)
        break
      case 'AGENT_DEBUG_READ_CONSOLE':
        data = readAgentConsole(message.tabId, message)
        break
      case 'AGENT_DEBUG_READ_NETWORK':
        data = readAgentNetwork(message.tabId, message)
        break
      case 'AGENT_DEBUG_STOP':
        data = await stopAgentDebugSession(message.tabId)
        break
    }
    sendResponse({ success: true, data })
  } catch (error: any) {
    sendResponse({ success: false, error: error?.message || '开发者观测失败' })
  }
}
