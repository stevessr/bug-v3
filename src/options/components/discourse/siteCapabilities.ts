import type { DiscourseSiteSettingsResponse } from '@/types/messages'

const REACTION_SETTING_KEYS = [
  'discourse_reactions_enabled',
  'discourse_reactions_enabled_reactions',
  'discourse_reactions_reaction_for_like',
  'discourse_reactions_allow_any_emoji'
] as const

const CAPABILITIES_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const CAPABILITIES_STORAGE_PREFIX = 'discourse-browser:site-capabilities:v1:'

export interface DiscourseReactionCapabilities {
  enabled: boolean
  enabledReactions: string[]
  mainReaction: string
  allowAnyEmoji: boolean
  source: 'site' | 'unavailable'
}

interface StoredCapabilities {
  expiresAt: number
  value: DiscourseReactionCapabilities
}

const memoryCache = new Map<string, StoredCapabilities>()
const inFlight = new Map<string, Promise<DiscourseReactionCapabilities>>()

const getOrigin = (baseUrl: string) => {
  try {
    return new URL(baseUrl).origin
  } catch {
    return ''
  }
}

const storageKey = (origin: string) => `${CAPABILITIES_STORAGE_PREFIX}${encodeURIComponent(origin)}`

const readStoredCapabilities = (origin: string): StoredCapabilities | null => {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(storageKey(origin))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredCapabilities
    if (
      !parsed ||
      typeof parsed.expiresAt !== 'number' ||
      parsed.expiresAt <= Date.now() ||
      !parsed.value ||
      !Array.isArray(parsed.value.enabledReactions)
    ) {
      localStorage.removeItem(storageKey(origin))
      return null
    }
    return parsed
  } catch {
    return null
  }
}

const writeStoredCapabilities = (origin: string, entry: StoredCapabilities) => {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(storageKey(origin), JSON.stringify(entry))
  } catch {
    // The in-memory cache is still useful when extension storage is full.
  }
}

const asBoolean = (value: unknown, fallback = false) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'yes'].includes(normalized)) return true
    if (['false', '0', 'no', ''].includes(normalized)) return false
  }
  return fallback
}

const parseReactionNames = (value: unknown): string[] => {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split('|') : []
  return Array.from(
    new Set(
      raw
        .map(item =>
          String(item || '')
            .trim()
            .replace(/^:([^:]+):$/, '$1')
        )
        .filter(Boolean)
    )
  )
}

const unavailableCapabilities = (): DiscourseReactionCapabilities => ({
  enabled: false,
  enabledReactions: [],
  mainReaction: 'heart',
  allowAnyEmoji: false,
  source: 'unavailable'
})

const sendSettingsMessage = async (
  origin: string
): Promise<DiscourseSiteSettingsResponse | null> => {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return null
  try {
    return await new Promise(resolve => {
      chrome.runtime.sendMessage(
        {
          type: 'GET_DISCOURSE_SITE_SETTINGS',
          url: origin,
          keys: [...REACTION_SETTING_KEYS]
        },
        (response: DiscourseSiteSettingsResponse) => {
          if (chrome.runtime.lastError) {
            resolve(null)
            return
          }
          resolve(response || null)
        }
      )
    })
  } catch {
    return null
  }
}

/**
 * Loads the reaction contract from the active forum tab. We intentionally do
 * not fall back to a hard-coded emoji list: when the setting is unavailable,
 * existing reactions remain readable but adding a new reaction is disabled.
 */
export async function fetchDiscourseReactionCapabilities(
  baseUrl: string,
  force = false
): Promise<DiscourseReactionCapabilities> {
  const origin = getOrigin(baseUrl)
  if (!origin) return unavailableCapabilities()

  const now = Date.now()
  const memory = memoryCache.get(origin)
  if (!force && memory && memory.expiresAt > now) return memory.value

  if (!force) {
    const stored = readStoredCapabilities(origin)
    if (stored) {
      memoryCache.set(origin, stored)
      return stored.value
    }
  }

  const pending = inFlight.get(origin)
  if (!force && pending) return pending

  const request = (async () => {
    const response = await sendSettingsMessage(origin)
    if (!response?.success || !response.settings) return unavailableCapabilities()

    const settings = response.settings
    const mainReaction =
      String(settings.discourse_reactions_reaction_for_like || 'heart')
        .trim()
        .replace(/^:([^:]+):$/, '$1') || 'heart'
    const enabledReactions = parseReactionNames(settings.discourse_reactions_enabled_reactions)
    if (mainReaction && !enabledReactions.includes(mainReaction)) {
      enabledReactions.push(mainReaction)
    }

    const value: DiscourseReactionCapabilities = {
      enabled: asBoolean(settings.discourse_reactions_enabled, enabledReactions.length > 0),
      enabledReactions,
      mainReaction,
      allowAnyEmoji: asBoolean(settings.discourse_reactions_allow_any_emoji),
      source: 'site'
    }
    const entry = { expiresAt: Date.now() + CAPABILITIES_CACHE_TTL_MS, value }
    memoryCache.set(origin, entry)
    writeStoredCapabilities(origin, entry)
    return value
  })().finally(() => inFlight.delete(origin))

  inFlight.set(origin, request)
  return request
}
