import { loadSessionUserFromExtension } from './routes/session'
import type { ChatCapabilities } from './types'
import { extractData, pageFetch } from './utils'

import type { DiscourseSiteSettingsResponse } from '@/types/messages'

const REACTION_SETTING_KEYS = [
  'discourse_reactions_enabled',
  'discourse_reactions_enabled_reactions',
  'discourse_reactions_reaction_for_like',
  'discourse_reactions_allow_any_emoji'
] as const

const CHAT_SETTING_KEYS = [
  'chat_enabled',
  'enable_public_channels',
  'max_chat_auto_joined_users'
] as const

const CAPABILITIES_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const CHAT_CAPABILITIES_CACHE_TTL_MS = 60 * 1000
const CAPABILITIES_STORAGE_PREFIX = 'discourse-browser:site-capabilities:v1:'

export interface DiscourseReactionCapabilities {
  enabled: boolean
  enabledReactions: string[]
  mainReaction: string
  allowAnyEmoji: boolean
  source: 'site' | 'unavailable'
}

export type DiscourseChatCapabilities = ChatCapabilities

interface StoredCapabilities {
  expiresAt: number
  value: DiscourseReactionCapabilities
}

const reactionMemoryCache = new Map<string, StoredCapabilities>()
const reactionInFlight = new Map<string, Promise<DiscourseReactionCapabilities>>()
const chatMemoryCache = new Map<string, { expiresAt: number; value: DiscourseChatCapabilities }>()
const chatInFlight = new Map<string, Promise<DiscourseChatCapabilities>>()

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

export const unavailableChatCapabilities = (): DiscourseChatCapabilities => ({
  loaded: true,
  chatEnabled: false,
  currentUserChatEnabled: false,
  canDirectMessage: false,
  publicChannelsEnabled: false,
  canCreatePublicChannel: false,
  maxAutoJoinedUsers: 0,
  source: 'unavailable'
})

const sendSettingsMessage = async (
  origin: string,
  keys: readonly string[]
): Promise<DiscourseSiteSettingsResponse | null> => {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return null
  try {
    return await new Promise(resolve => {
      chrome.runtime.sendMessage(
        {
          type: 'GET_DISCOURSE_SITE_SETTINGS',
          url: origin,
          keys: [...keys]
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
 * `/site/settings.json` is the official counterpart of
 * `data-preloaded.siteSettings`. Prefer the lightweight tab message, then use
 * this request path when the content script was not available yet. PAGE_FETCH
 * itself reuses the preloaded value when the forum tab has one.
 */
const fetchSettingsEndpoint = async (
  origin: string,
  keys: readonly string[]
): Promise<DiscourseSiteSettingsResponse | null> => {
  try {
    const result = await pageFetch<Record<string, unknown>>(`${origin}/site/settings.json`)
    const data = extractData(result)
    if (!result.ok || !data || typeof data !== 'object') return null

    const settings: Record<string, string | number | boolean | null> = {}
    keys.forEach(key => {
      const value = data[key]
      if (
        value === null ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        settings[key] = value
      }
    })
    return { success: true, settings }
  } catch {
    return null
  }
}

const loadSiteSettings = async (
  origin: string,
  keys: readonly string[]
): Promise<DiscourseSiteSettingsResponse | null> => {
  const preloaded = await sendSettingsMessage(origin, keys)
  if (preloaded?.success && preloaded.settings) return preloaded
  return fetchSettingsEndpoint(origin, keys)
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
  const memory = reactionMemoryCache.get(origin)
  if (!force && memory && memory.expiresAt > now) return memory.value

  if (!force) {
    const stored = readStoredCapabilities(origin)
    if (stored) {
      reactionMemoryCache.set(origin, stored)
      return stored.value
    }
  }

  const pending = reactionInFlight.get(origin)
  if (!force && pending) return pending

  const request = (async () => {
    const response = await loadSiteSettings(origin, REACTION_SETTING_KEYS)
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
    reactionMemoryCache.set(origin, entry)
    writeStoredCapabilities(origin, entry)
    return value
  })().finally(() => reactionInFlight.delete(origin))

  reactionInFlight.set(origin, request)
  return request
}

/**
 * Loads the current site's Chat contract and the authenticated user's Chat
 * preferences. Creation controls stay hidden unless Discourse explicitly
 * confirms the required permission.
 */
export async function fetchDiscourseChatCapabilities(
  baseUrl: string,
  force = false
): Promise<DiscourseChatCapabilities> {
  const origin = getOrigin(baseUrl)
  if (!origin) return unavailableChatCapabilities()

  const cached = chatMemoryCache.get(origin)
  if (!force && cached && cached.expiresAt > Date.now()) return cached.value

  const pending = chatInFlight.get(origin)
  if (!force && pending) return pending

  const request = (async () => {
    const [settingsResponse, sessionUser] = await Promise.all([
      loadSiteSettings(origin, CHAT_SETTING_KEYS),
      loadSessionUserFromExtension(origin)
    ])
    const settings = settingsResponse?.success ? settingsResponse.settings || {} : {}
    const hasChatSetting = Object.prototype.hasOwnProperty.call(settings, 'chat_enabled')
    const siteChatEnabled = hasChatSetting
      ? asBoolean(settings.chat_enabled)
      : sessionUser?.canChat === true
    const currentUserChatEnabled = sessionUser?.hasChatEnabled === true
    const chatEnabled = siteChatEnabled && sessionUser?.canChat === true && currentUserChatEnabled
    const publicChannelsEnabled = asBoolean(settings.enable_public_channels)
    const maxAutoJoinedUsers = Math.max(
      0,
      Number.parseInt(String(settings.max_chat_auto_joined_users ?? '0'), 10) || 0
    )

    const value: DiscourseChatCapabilities = {
      loaded: true,
      chatEnabled,
      currentUserChatEnabled,
      canDirectMessage: chatEnabled && sessionUser?.canDirectMessage === true,
      publicChannelsEnabled,
      canCreatePublicChannel: chatEnabled && publicChannelsEnabled && sessionUser?.staff === true,
      maxAutoJoinedUsers,
      source: settingsResponse?.success && sessionUser ? 'site' : 'unavailable'
    }
    chatMemoryCache.set(origin, {
      expiresAt: Date.now() + CHAT_CAPABILITIES_CACHE_TTL_MS,
      value
    })
    return value
  })().finally(() => chatInFlight.delete(origin))

  chatInFlight.set(origin, request)
  return request
}
