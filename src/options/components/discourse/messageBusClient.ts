import { ref } from 'vue'

import { pageFetch } from './utils'

export type MessageBusConnectionState = 'idle' | 'connecting' | 'connected' | 'error' | 'paused'

export type MessageBusCallback = (data: unknown, channel: string, messageId: number | null) => void

export type MessageBusSubscriptionSpec = {
  channel: string
  callback: MessageBusCallback
  lastId?: number
}

type MessageBusPayload = {
  channel?: string
  message_id?: number
  data?: unknown
}

type MessageBusSubscription = {
  callbacks: Set<MessageBusCallback>
  lastId: number
}

type MessageBusOptions = {
  getBaseUrl: () => string
  callbackInterval?: number
  backgroundCallbackInterval?: number
  minPollInterval?: number
  maxPollInterval?: number
  minHiddenPollInterval?: number
  retryAfter429Ms?: number
}

const LAST_POLL_STORAGE_KEY = '__discourse_browser_mb_last_poll_at'

function createClientId(): string {
  return `mb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

function supportsLocalStorage(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    localStorage.setItem('__discourse_browser_mb_test', '1')
    localStorage.removeItem('__discourse_browser_mb_test')
    return true
  } catch {
    return false
  }
}

const canUseLocalStorage = supportsLocalStorage()

function touchLastPollAt() {
  if (!canUseLocalStorage) return
  try {
    localStorage.setItem(LAST_POLL_STORAGE_KEY, String(Date.now()))
  } catch {
    // ignore localStorage write failures
  }
}

function hiddenTabShouldWait(minHiddenPollInterval: number): boolean {
  if (!canUseLocalStorage) return false
  if (typeof document === 'undefined' || !document.hidden) return false
  try {
    const raw = localStorage.getItem(LAST_POLL_STORAGE_KEY)
    const lastPollAt = Number(raw)
    if (!Number.isFinite(lastPollAt) || lastPollAt <= 0) return false
    const delta = Date.now() - lastPollAt
    return delta >= 0 && delta < minHiddenPollInterval
  } catch {
    return false
  }
}

function randomHiddenPollDelay() {
  return Math.floor(500 + Math.random() * 500)
}

export function createDiscourseMessageBusClient(options: MessageBusOptions) {
  const callbackInterval = Math.max(1000, options.callbackInterval ?? 15000)
  const backgroundCallbackInterval = Math.max(
    callbackInterval,
    options.backgroundCallbackInterval ?? 60000
  )
  const minPollInterval = Math.max(0, options.minPollInterval ?? 100)
  const maxPollInterval = Math.max(callbackInterval, options.maxPollInterval ?? 3 * 60 * 1000)
  const minHiddenPollInterval = Math.max(1000, options.minHiddenPollInterval ?? 1500)
  const retryAfter429Ms = Math.max(minPollInterval, options.retryAfter429Ms ?? 15000)

  const state = ref<MessageBusConnectionState>('idle')

  const subscriptions = new Map<string, MessageBusSubscription>()
  const deferredMessages: MessageBusPayload[] = []

  let clientId = createClientId()
  let seq = 0
  let failCount = 0
  let started = false
  let pollInFlight = false
  let paused = false
  let pollTimer: ReturnType<typeof globalThis.setTimeout> | null = null
  let restartRequested = false

  const clearPollTimer = () => {
    if (pollTimer === null) return
    globalThis.clearTimeout(pollTimer)
    pollTimer = null
  }

  const schedulePoll = (delayMs: number) => {
    if (!started) return
    clearPollTimer()

    if (subscriptions.size === 0) {
      state.value = paused ? 'paused' : 'idle'
      return
    }

    const delay = Math.max(0, Math.floor(delayMs))
    pollTimer = globalThis.setTimeout(() => {
      pollTimer = null
      void poll()
    }, delay)
  }

  const mergeLastId = (current: number, incoming: number) => {
    if (!Number.isFinite(incoming)) return current
    if (current < 0 && incoming < 0) return Math.min(current, incoming)
    if (current < 0 || incoming < 0) return Math.max(current, incoming)
    return Math.max(current, incoming)
  }

  const buildPayload = () => {
    const payload: Record<string, number> = { __seq: seq }
    seq += 1
    subscriptions.forEach((subscription, channel) => {
      payload[channel] = subscription.lastId
    })
    return payload
  }

  const parseMaybeJsonPayload = (value: unknown): unknown => {
    if (typeof value !== 'string') return value
    const trimmed = value.trim()
    if (!trimmed) return value
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value
    try {
      return JSON.parse(trimmed)
    } catch {
      return value
    }
  }

  const dispatchMessage = (message: MessageBusPayload) => {
    const channel = typeof message.channel === 'string' ? message.channel : ''
    if (!channel) return

    const subscription = subscriptions.get(channel)
    if (!subscription || subscription.callbacks.size === 0) return

    const messageId = Number(message.message_id)
    const normalizedMessageId = Number.isFinite(messageId) ? messageId : null

    if (normalizedMessageId !== null) {
      subscription.lastId = Math.max(subscription.lastId, normalizedMessageId)
    }

    const payload = parseMaybeJsonPayload(message.data)

    subscription.callbacks.forEach(callback => {
      try {
        callback(payload, channel, normalizedMessageId)
      } catch (error) {
        console.warn('[DiscourseBrowser] message_bus callback failed:', error)
      }
    })
  }

  const syncStatusLastIds = (statusData: unknown) => {
    if (!statusData || typeof statusData !== 'object') return
    Object.entries(statusData as Record<string, unknown>).forEach(([channel, statusId]) => {
      const subscription = subscriptions.get(channel)
      if (!subscription) return
      const numericId = Number(statusId)
      if (!Number.isFinite(numericId)) return
      subscription.lastId = Math.max(subscription.lastId, numericId)
    })
  }

  const processMessages = (messages: MessageBusPayload[]) => {
    if (messages.length === 0) return false

    if (paused) {
      deferredMessages.push(...messages)
      return true
    }

    messages.forEach(message => {
      if (message.channel === '/__status') {
        syncStatusLastIds(message.data)
        return
      }
      dispatchMessage(message)
    })

    return true
  }

  const computeSuccessDelay = (gotData: boolean, startedAt: number) => {
    if (gotData) {
      return minPollInterval
    }

    const isForeground = typeof document === 'undefined' || !document.hidden
    const targetInterval = isForeground ? callbackInterval : backgroundCallbackInterval
    const elapsed = Date.now() - startedAt
    const nextDelay = targetInterval - elapsed

    return nextDelay < 100 ? 100 : nextDelay
  }

  const requestRestart = () => {
    if (!started) return
    if (pollInFlight) {
      restartRequested = true
      return
    }
    schedulePoll(minPollInterval)
  }

  const poll = async () => {
    if (!started) return
    if (paused) {
      state.value = 'paused'
      return
    }

    if (subscriptions.size === 0) {
      state.value = 'idle'
      return
    }

    if (pollInFlight) {
      restartRequested = true
      return
    }

    if (hiddenTabShouldWait(minHiddenPollInterval)) {
      schedulePoll(randomHiddenPollDelay())
      return
    }

    pollInFlight = true
    state.value = 'connecting'

    let nextDelay = callbackInterval
    let failureDelay: number | null = null
    const requestStartedAt = Date.now()

    touchLastPollAt()

    try {
      const payload = buildPayload()
      const result = await pageFetch<unknown[]>(
        `${normalizeBaseUrl(options.getBaseUrl())}/message-bus/${clientId}/poll`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'X-SILENCE-LOGGER': 'true',
            'Dont-Chunk': 'true'
          },
          body: JSON.stringify(payload),
          passHeaders: ['X-Shared-Session-Key']
        }
      )

      if (!result.ok) {
        if (result.status === 429) {
          failureDelay = retryAfter429Ms
        }
        throw new Error(`message_bus poll failed: ${result.status}`)
      }

      failCount = 0
      const messages = Array.isArray(result.data) ? (result.data as MessageBusPayload[]) : []
      const gotData = processMessages(messages)
      state.value = 'connected'
      nextDelay = computeSuccessDelay(gotData, requestStartedAt)
    } catch (error) {
      if (failureDelay === null) {
        failCount += 1
        failureDelay = Math.min(callbackInterval * failCount, maxPollInterval)
      }
      nextDelay = failureDelay
      state.value = 'error'
      console.warn('[DiscourseBrowser] message_bus poll failed:', error)
    } finally {
      pollInFlight = false

      if (started) {
        if (restartRequested) {
          restartRequested = false
          schedulePoll(minPollInterval)
        } else {
          schedulePoll(nextDelay)
        }
      }
    }
  }

  const subscribe = (channel: string, callback: MessageBusCallback, lastId = -1) => {
    if (typeof channel !== 'string' || channel.length === 0) {
      throw new Error('Channel name must be a non-empty string')
    }

    if (typeof callback !== 'function') {
      throw new Error('Message bus callback must be a function')
    }

    if (!Number.isFinite(lastId)) {
      throw new Error('lastId must be a finite number')
    }

    const existing = subscriptions.get(channel)
    if (existing) {
      existing.callbacks.add(callback)
      existing.lastId = mergeLastId(existing.lastId, lastId)
    } else {
      subscriptions.set(channel, {
        callbacks: new Set([callback]),
        lastId
      })
    }

    if (!started) {
      start()
    } else {
      requestRestart()
    }

    return () => {
      unsubscribe(channel, callback)
    }
  }

  const unsubscribe = (channel: string, callback?: MessageBusCallback) => {
    const subscription = subscriptions.get(channel)
    if (!subscription) return false

    let changed = false

    if (callback) {
      changed = subscription.callbacks.delete(callback)
    } else {
      changed = subscription.callbacks.size > 0
      subscription.callbacks.clear()
    }

    if (subscription.callbacks.size === 0) {
      subscriptions.delete(channel)
      changed = true
    }

    if (changed) {
      requestRestart()
    }

    return changed
  }

  const clearSubscriptions = () => {
    if (subscriptions.size === 0) return
    subscriptions.clear()
    deferredMessages.length = 0
    requestRestart()
  }

  const replaceSubscriptions = (
    nextSubscriptions: MessageBusSubscriptionSpec[],
    defaultLastId = -1
  ) => {
    const normalized = new Map<string, { callback: MessageBusCallback; lastId: number }>()

    nextSubscriptions.forEach(item => {
      if (!item || typeof item.channel !== 'string' || item.channel.length === 0) return
      if (typeof item.callback !== 'function') return
      const providedLastId = item.lastId ?? defaultLastId
      const lastId = Number.isFinite(providedLastId) ? providedLastId : defaultLastId
      normalized.set(item.channel, {
        callback: item.callback,
        lastId
      })
    })

    let changed = false

    for (const channel of Array.from(subscriptions.keys())) {
      if (!normalized.has(channel)) {
        subscriptions.delete(channel)
        changed = true
      }
    }

    normalized.forEach((item, channel) => {
      const existing = subscriptions.get(channel)
      if (!existing) {
        subscriptions.set(channel, {
          callbacks: new Set([item.callback]),
          lastId: item.lastId
        })
        changed = true
        return
      }

      if (existing.callbacks.size !== 1 || !existing.callbacks.has(item.callback)) {
        existing.callbacks.clear()
        existing.callbacks.add(item.callback)
        changed = true
      }

      if (existing.lastId < 0 || item.lastId < 0) {
        const merged = mergeLastId(existing.lastId, item.lastId)
        if (merged !== existing.lastId) {
          existing.lastId = merged
          changed = true
        }
      }
    })

    if (normalized.size > 0 && !started) {
      start()
      return
    }

    if (changed) {
      requestRestart()
    }
  }

  const start = () => {
    if (started) return
    started = true
    if (paused) {
      state.value = 'paused'
      return
    }
    requestRestart()
  }

  const stop = () => {
    started = false
    restartRequested = false
    clearPollTimer()
    state.value = paused ? 'paused' : 'idle'
  }

  const pause = () => {
    paused = true
    state.value = 'paused'
  }

  const resume = () => {
    if (!paused) return
    paused = false
    if (deferredMessages.length > 0) {
      const buffered = deferredMessages.splice(0, deferredMessages.length)
      processMessages(buffered)
    }
    requestRestart()
  }

  const reset = () => {
    clientId = createClientId()
    seq = 0
    failCount = 0
    subscriptions.forEach(subscription => {
      subscription.lastId = -1
    })
    deferredMessages.length = 0
    requestRestart()
  }

  return {
    state,
    start,
    stop,
    pause,
    resume,
    reset,
    subscribe,
    unsubscribe,
    clearSubscriptions,
    replaceSubscriptions
  }
}
