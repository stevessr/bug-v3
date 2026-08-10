import { addEmojisToMap, clearEmojiMap, type EmojiShortcode } from '../bbcode'
import { pageFetch, extractData } from '../utils'

let currentOrigin: string | null = null
let loadingPromise: Promise<number> | null = null
// Emoji names and shortcode mappings are site-specific and expensive to load.
// Keep a high, persistent cache while still allowing callers to force refresh.
const EMOJI_GROUP_CACHE_TTL = 7 * 24 * 60 * 60 * 1000
const EMOJI_GROUP_STORAGE_PREFIX = 'discourse-browser:emoji-groups:v2:'

export interface DiscourseEmojiEntry extends EmojiShortcode {
  group?: string
  search_aliases?: string[]
  unicode?: string
}

export interface DiscourseEmojiGroup {
  id: string
  name: string
  icon?: string
  emojis: DiscourseEmojiEntry[]
}

const emojiGroupsCache = new Map<string, { expiresAt: number; groups: DiscourseEmojiGroup[] }>()
const emojiGroupsInFlight = new Map<string, Promise<DiscourseEmojiGroup[]>>()

interface StoredEmojiGroups {
  expiresAt: number
  groups: DiscourseEmojiGroup[]
}

const getEmojiStorageKey = (origin: string) =>
  `${EMOJI_GROUP_STORAGE_PREFIX}${encodeURIComponent(origin)}`

const isEmojiGroups = (value: unknown): value is DiscourseEmojiGroup[] =>
  Array.isArray(value) &&
  value.every(
    group =>
      isRecord(group) &&
      typeof group.id === 'string' &&
      typeof group.name === 'string' &&
      Array.isArray(group.emojis) &&
      group.emojis.every(
        entry =>
          isRecord(entry) &&
          typeof entry.name === 'string' &&
          (typeof entry.url === 'string' || typeof entry.unicode === 'string')
      )
  )

const readPersistentEmojiGroups = (origin: string): StoredEmojiGroups | null => {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(getEmojiStorageKey(origin))
    if (!raw) return null
    const value = JSON.parse(raw) as StoredEmojiGroups
    if (
      !value ||
      typeof value.expiresAt !== 'number' ||
      value.expiresAt <= Date.now() ||
      !isEmojiGroups(value.groups)
    ) {
      localStorage.removeItem(getEmojiStorageKey(origin))
      return null
    }
    return value
  } catch {
    return null
  }
}

const writePersistentEmojiGroups = (origin: string, value: StoredEmojiGroups) => {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(getEmojiStorageKey(origin), JSON.stringify(value))
  } catch {
    // A full localStorage should not prevent the picker from using memory.
  }
}

const normalizeEmojiUrl = (origin: string, url?: string | null) => {
  if (!url) return ''
  try {
    return new URL(url, origin).toString()
  } catch {
    return url
  }
}

const getOrigin = (baseUrl?: string | null) => {
  if (!baseUrl) return ''
  try {
    return new URL(baseUrl).origin
  } catch {
    return ''
  }
}

const isRecord = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const normalizeEmojiEntry = (
  origin: string,
  value: any,
  groupName: string
): DiscourseEmojiEntry | null => {
  const name = String(value?.name || value?.shortcode || value?.id || '').trim()
  if (!name) return null

  const url = normalizeEmojiUrl(
    origin,
    value?.url || value?.image_url || value?.sprite_url || value?.emoji_url
  )
  if (!url && !value?.unicode && !value?.emoji) return null

  const id = String(value?.id ?? name)
  const aliases = Array.isArray(value?.search_aliases)
    ? value.search_aliases.filter((item: unknown): item is string => typeof item === 'string')
    : undefined

  return {
    id,
    name,
    url,
    group: String(value?.group || groupName),
    search_aliases: aliases,
    unicode: typeof value?.unicode === 'string' ? value.unicode : value?.emoji,
    width: typeof value?.width === 'number' ? value.width : undefined,
    height: typeof value?.height === 'number' ? value.height : undefined
  }
}

/**
 * Normalize the shapes returned by Discourse's `/emojis.json` and the
 * `custom_emoji`/`custom_reactions` fields found in `/site.json`.
 *
 * Keeping this in one place is important: the chat reaction picker and the
 * boost shortcode picker must insert exactly the same site-supported name.
 */
function normalizeEmojiGroups(origin: string, payload: any): DiscourseEmojiGroup[] {
  const groups = new Map<string, DiscourseEmojiGroup>()
  const seen = new Set<string>()

  const ensureGroup = (id: string, name = id) => {
    const normalizedId = id.trim() || 'site'
    const existing = groups.get(normalizedId)
    if (existing) return existing
    const group: DiscourseEmojiGroup = {
      id: normalizedId,
      name: name.trim() || normalizedId,
      emojis: []
    }
    groups.set(normalizedId, group)
    return group
  }

  const addItems = (groupId: string, groupName: string, items: unknown) => {
    if (!Array.isArray(items)) return
    const group = ensureGroup(groupId, groupName)
    items.forEach(item => {
      const entry = normalizeEmojiEntry(origin, item, group.name)
      if (!entry) return
      const key = `${entry.name}|${entry.url || entry.unicode || entry.id}`
      if (seen.has(key)) return
      seen.add(key)
      group.emojis.push(entry)
    })
  }

  const addSource = (source: unknown, fallbackGroup = 'site') => {
    if (Array.isArray(source)) {
      const grouped = new Map<string, any[]>()
      source.forEach(item => {
        const group = String(item?.group || item?.category || fallbackGroup)
        const items = grouped.get(group) || []
        items.push(item)
        grouped.set(group, items)
      })
      grouped.forEach((items, group) => addItems(group, group, items))
      return
    }

    if (!isRecord(source)) return
    Object.entries(source).forEach(([group, value]) => {
      if (Array.isArray(value)) {
        addItems(group, group, value)
        return
      }
      if (isRecord(value) && Array.isArray(value.emojis)) {
        addItems(group, String(value.name || group), value.emojis)
      }
    })
  }

  if (isRecord(payload)) {
    // `/emojis.json` is usually a group -> entries map. Some Discourse
    // versions wrap the same map in `emojis`.
    addSource(payload.emojis, 'site')
    addSource(payload.custom_emoji, 'custom')
    addSource(payload.custom_emojis, 'custom')
    addSource(payload.custom_reactions, 'reactions')
    addSource(payload.reactions, 'reactions')
    addSource(payload, 'site')
  } else {
    addSource(payload, 'site')
  }

  return [...groups.values()].filter(group => group.emojis.length > 0)
}

export async function fetchDiscourseEmojiGroups(
  baseUrl?: string | null,
  force = false
): Promise<DiscourseEmojiGroup[]> {
  const origin = getOrigin(baseUrl)
  if (!origin) return []

  const cached = emojiGroupsCache.get(origin)
  if (!force && cached && cached.expiresAt > Date.now()) return cached.groups

  if (!force) {
    const persistent = readPersistentEmojiGroups(origin)
    if (persistent) {
      emojiGroupsCache.set(origin, persistent)
      return persistent.groups
    }
  }

  const inFlight = emojiGroupsInFlight.get(origin)
  if (!force && inFlight) return inFlight

  const request = (async () => {
    const endpoints = [`${origin}/emojis.json`, `${origin}/site.json`]
    let lastError: Error | null = null

    for (const url of endpoints) {
      try {
        const response = await pageFetch<any>(
          url,
          {
            headers: {
              accept: 'application/json, text/javascript, */*; q=0.01',
              'X-Requested-With': 'XMLHttpRequest'
            }
          },
          'json'
        )
        const data = extractData(response)
        if (!response.ok || !data || typeof data !== 'object') {
          lastError = new Error(`Emoji endpoint returned HTTP ${response.status}`)
          continue
        }

        const groups = normalizeEmojiGroups(origin, data)
        if (groups.length > 0) {
          const cacheEntry = {
            expiresAt: Date.now() + EMOJI_GROUP_CACHE_TTL,
            groups
          }
          emojiGroupsCache.set(origin, cacheEntry)
          writePersistentEmojiGroups(origin, cacheEntry)
          return groups
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
      }
    }

    if (lastError) {
      console.warn('[DiscourseEmoji] Failed to load site emoji groups:', lastError.message)
    }
    return []
  })().finally(() => {
    emojiGroupsInFlight.delete(origin)
  })

  emojiGroupsInFlight.set(origin, request)
  return request
}

export function findDiscourseEmoji(
  groups: DiscourseEmojiGroup[],
  name: string
): DiscourseEmojiEntry | null {
  const normalized = String(name || '').replace(/^:([^:]+):$/, '$1')
  for (const group of groups) {
    const entry = group.emojis.find(emoji => emoji.name === normalized || emoji.id === normalized)
    if (entry) return entry
  }
  return null
}

export async function ensureEmojiShortcodesLoaded(baseUrl?: string | null): Promise<number> {
  const origin = getOrigin(baseUrl)
  if (!origin) return 0

  if (currentOrigin !== origin) {
    currentOrigin = origin
    clearEmojiMap()
    loadingPromise = null
  }

  if (loadingPromise) return loadingPromise

  loadingPromise = (async () => {
    const groups = await fetchDiscourseEmojiGroups(origin)
    // The shortcode renderer needs an image URL. Unicode-only entries remain
    // available to the picker but must not overwrite the BBCode map with an
    // empty image source.
    const list: EmojiShortcode[] = groups
      .flatMap(group => group.emojis)
      .filter((entry): entry is EmojiShortcode => Boolean(entry.url))

    if (list.length > 0) {
      addEmojisToMap(list)
    }

    return list.length
  })().finally(() => {
    loadingPromise = null
  })

  return loadingPromise
}
