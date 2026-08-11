import { addEmojisToMap, clearEmojiMap, type EmojiShortcode } from '../bbcode'
import { pageFetch, extractData, rewriteEmojiUrlForCdn } from '../utils'

let currentOrigin: string | null = null
let loadingPromise: Promise<number> | null = null
// Emoji names and shortcode mappings are site-specific and expensive to load.
// Keep a high, persistent cache while still allowing callers to force refresh.
const EMOJI_GROUP_CACHE_TTL = 30 * 24 * 60 * 60 * 1000
const EMOJI_GROUP_STORAGE_PREFIX = 'discourse-browser:emoji-groups:v3:'

const DISCOURSE_EMOJI_GROUP_META: Record<string, { name: string; icon: string }> = {
  'smileys_&_emotion': { name: '笑脸与情感', icon: '😀' },
  'people_&_body': { name: '人与身体', icon: '👋' },
  'animals_&_nature': { name: '动物与自然', icon: '🐵' },
  'food_&_drink': { name: '食物和饮料', icon: '🍇' },
  'travel_&_places': { name: '旅行与地点', icon: '🚗' },
  activities: { name: '活动', icon: '⚽' },
  objects: { name: '对象', icon: '💡' },
  symbols: { name: '符号', icon: '❤' },
  flags: { name: '旗帜', icon: '🏳' },
  default: { name: '自定义表情符号', icon: '✨' },
  custom: { name: '自定义表情符号', icon: '✨' },
  reactions: { name: '站点反应', icon: '💬' },
  site: { name: '站点表情', icon: '📌' }
}

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
    // linux.do 站点表情改走 CDN，减少对主站请求
    return rewriteEmojiUrlForCdn(new URL(url, origin).toString())
  } catch {
    return url
  }
}

// Older persistent picker caches may have been written before the CDN rewrite
// was introduced. Normalize both in-memory and restored entries so every
// emoji surface (pickers, reaction chips and reaction details) gets the same
// direct CDN URL without waiting for the 30-day cache to expire.
const normalizeCachedEmojiGroups = (origin: string, groups: DiscourseEmojiGroup[]) =>
  groups.map(group => ({
    ...group,
    emojis: group.emojis.map(emoji => ({
      ...emoji,
      url: normalizeEmojiUrl(origin, emoji.url)
    }))
  }))

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
    const meta = DISCOURSE_EMOJI_GROUP_META[normalizedId]
    const group: DiscourseEmojiGroup = {
      id: normalizedId,
      name: meta?.name || name.trim() || normalizedId,
      icon: meta?.icon,
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

function applyEmojiSearchAliases(groups: DiscourseEmojiGroup[], payload: unknown) {
  if (!isRecord(payload)) return groups
  const aliasMap = isRecord(payload.search_aliases) ? payload.search_aliases : payload

  groups.forEach(group => {
    group.emojis.forEach(emoji => {
      const rawAliases = aliasMap[emoji.name]
      const aliases = Array.isArray(rawAliases)
        ? rawAliases.filter((value: unknown): value is string => typeof value === 'string')
        : typeof rawAliases === 'string'
          ? rawAliases.split(/[,|\s]+/).filter(Boolean)
          : []
      if (!aliases.length) return
      emoji.search_aliases = Array.from(new Set([...(emoji.search_aliases || []), ...aliases]))
    })
  })
  return groups
}

export async function fetchDiscourseEmojiGroups(
  baseUrl?: string | null,
  force = false
): Promise<DiscourseEmojiGroup[]> {
  const origin = getOrigin(baseUrl)
  if (!origin) return []

  const cached = emojiGroupsCache.get(origin)
  if (!force && cached && cached.expiresAt > Date.now()) {
    const groups = normalizeCachedEmojiGroups(origin, cached.groups)
    cached.groups = groups
    return groups
  }

  if (!force) {
    const persistent = readPersistentEmojiGroups(origin)
    if (persistent) {
      const normalized = {
        ...persistent,
        groups: normalizeCachedEmojiGroups(origin, persistent.groups)
      }
      emojiGroupsCache.set(origin, normalized)
      writePersistentEmojiGroups(origin, normalized)
      return normalized.groups
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

        let groups = normalizeEmojiGroups(origin, data)
        if (groups.length > 0) {
          if (url.endsWith('/emojis.json')) {
            try {
              const aliasResponse = await pageFetch<any>(
                `${origin}/emojis/search-aliases.json`,
                {
                  headers: {
                    accept: 'application/json, text/javascript, */*; q=0.01',
                    'X-Requested-With': 'XMLHttpRequest'
                  }
                },
                'json'
              )
              if (aliasResponse.ok) {
                groups = applyEmojiSearchAliases(groups, extractData(aliasResponse))
              }
            } catch {
              // Search aliases improve filtering but are not required to use
              // the site's canonical shortcode groups.
            }
          }
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
