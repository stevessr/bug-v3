/**
 * Utility for sending messages to tabs that match a target URL origin.
 */

import { getChromeAPI } from './main'

import * as storage from '@/utils/simpleStorage'

export interface DomainTabMessage {
  type: string
  options?: Record<string, unknown>
}

export interface DomainTabResponse {
  success: boolean
  data?: unknown
  error?: string
  [key: string]: unknown
}

const DISCOURSE_BASE_DOMAINS = ['linux.do', 'meta.discourse.org', 'idcflare.com']
const X_BASE_DOMAINS = ['x.com', 'twitter.com', 'twimg.com']

let cachedDiscourseTabUrlPatterns: string[] | null = null
let discoursePatternsCacheAt = 0
let discourseDomainsCacheListenerAttached = false
const DISCOURSE_PATTERNS_CACHE_TTL_MS = 60_000

function buildDomainUrlPatterns(domain: string): string[] {
  const normalized = String(domain || '')
    .trim()
    .toLowerCase()
  if (!normalized) return []

  return [`*://${normalized}/*`, `*://*.${normalized}/*`]
}

function invalidateDiscourseTabUrlPatternsCache() {
  cachedDiscourseTabUrlPatterns = null
  discoursePatternsCacheAt = 0
}

function ensureDiscourseDomainsCacheInvalidationListener() {
  if (discourseDomainsCacheListenerAttached) return

  const chromeAPI = getChromeAPI()
  if (!chromeAPI?.storage?.onChanged) return

  chromeAPI.storage.onChanged.addListener(
    (changes: { [key: string]: chrome.storage.StorageChange }, namespace: string) => {
      if (namespace !== 'local') return
      if (!changes[storage.STORAGE_KEYS.DISCOURSE_DOMAINS]) return

      invalidateDiscourseTabUrlPatternsCache()
      console.log('[DomainTabMessenger] discourseDomains changed, invalidated tab pattern cache')
    }
  )

  discourseDomainsCacheListenerAttached = true
}

ensureDiscourseDomainsCacheInvalidationListener()

export function getXTabUrlPatterns(): string[] {
  return X_BASE_DOMAINS.flatMap(domain => buildDomainUrlPatterns(domain))
}

export async function getDiscourseTabUrlPatterns(): Promise<string[]> {
  const now = Date.now()
  if (
    cachedDiscourseTabUrlPatterns &&
    now - discoursePatternsCacheAt < DISCOURSE_PATTERNS_CACHE_TTL_MS
  ) {
    return cachedDiscourseTabUrlPatterns
  }

  const patternSet = new Set<string>()

  DISCOURSE_BASE_DOMAINS.forEach(domain => {
    buildDomainUrlPatterns(domain).forEach(pattern => patternSet.add(pattern))
  })

  try {
    const domains = await storage.getDiscourseDomains()
    domains.forEach(entry => {
      buildDomainUrlPatterns(entry?.domain || '').forEach(pattern => patternSet.add(pattern))
    })
  } catch (error) {
    console.warn('[DomainTabMessenger] Failed to load discourse domains for tab filtering:', error)
  }

  const patterns = Array.from(patternSet)
  cachedDiscourseTabUrlPatterns = patterns
  discoursePatternsCacheAt = now
  return patterns
}

const getTabOrigin = (tabUrl?: string | null) => {
  if (!tabUrl) return null
  try {
    return new URL(tabUrl).origin
  } catch {
    return null
  }
}

export async function sendMessageToDomainTab<T extends { success: boolean; error?: string }>(
  targetUrl: string,
  message: DomainTabMessage,
  successCheck?: (resp: T) => boolean
): Promise<T> {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI || !chromeAPI.tabs) {
    return { success: false, error: 'Chrome API not available' } as T
  }

  let targetOrigin: string
  let host: string
  try {
    const parsed = new URL(targetUrl)
    targetOrigin = parsed.origin
    host = parsed.host
  } catch {
    return { success: false, error: 'Invalid url' } as T
  }

  try {
    const pattern = `*://${host}/*`
    let tabs = await chromeAPI.tabs.query({ url: pattern })

    if (!tabs.length) {
      const allTabs = await chromeAPI.tabs.query({})
      tabs = allTabs.filter((tab: chrome.tabs.Tab) => getTabOrigin(tab.url) === targetOrigin)
    }

    if (!tabs.length) {
      return { success: false, error: `No tabs found for ${host}` } as T
    }

    for (const tab of tabs) {
      if (!tab.id) continue
      try {
        const resp = await chromeAPI.tabs.sendMessage(tab.id, message)
        const isSuccess = successCheck ? successCheck(resp) : resp?.success
        if (isSuccess) {
          return resp as T
        }
      } catch {
        continue
      }
    }

    return { success: false, error: `${message.type} failed on all ${host} tabs` } as T
  } catch (error) {
    console.error(`[DomainTabMessenger] Failed to send ${message.type}`, error)
    return { success: false, error: 'Unknown error' } as T
  }
}
