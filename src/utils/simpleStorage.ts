/**
 * Simplified Storage Layer - Direct chrome.storage API wrapper
 *
 * 设计原则：
 * 1. 纯 I/O 层，无缓存逻辑
 * 2. Pinia stores 负责所有缓存和状态管理
 * 3. 简单的序列化/反序列化
 * 4. 最小化抽象层
 * 5. 运行时类型验证提高数据可靠性
 */

import {
  decodeStorageValue,
  encodeStorageValue,
  isEmojiGroupStorageKey,
  isCompactStorageKey,
  initializeStorageCodec
} from './storage/emojiGroupCodec'
import { sanitizeEmojiGroup, isSettings } from './typeGuards'
import { resolveFavoriteGroup, packFavoriteGroup } from './favoriteReferences'

import type { EmojiGroup, AppSettings } from '@/types/type'

const log = createLogger('Storage')

// Chrome API helper
declare const chrome: typeof globalThis.chrome | undefined

const isLocalStorageAvailable = () => {
  try {
    return typeof localStorage !== 'undefined'
  } catch {
    return false
  }
}

function getChromeAPI(): typeof chrome | null {
  if (typeof chrome !== 'undefined' && chrome?.storage) {
    return chrome
  }
  if (typeof window !== 'undefined' && (window as any).chrome) {
    return (window as any).chrome ?? null
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).chrome) {
    return (globalThis as any).chrome ?? null
  }
  return null
}

let warnedNoChromeStorage = false
const warnNoChromeStorage = () => {
  if (!warnedNoChromeStorage) {
    warnedNoChromeStorage = true
    log.warn('chrome.storage.local not available, falling back to localStorage')
  }
}

const localStorageGet = <T = unknown>(key: string): T | null => {
  if (!isLocalStorageAvailable()) return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    const value = decodeStorageValue(key, parsed)
    if (isCompactStorageKey(key)) {
      const upgraded = JSON.stringify(encodeStorageValue(key, value))
      if (upgraded !== raw) {
        try {
          localStorage.setItem(key, upgraded)
        } catch (error) {
          log.warn('Group storage upgrade failed; preserving original value', key, error)
        }
      }
    }
    return value as T | null
  } catch (error) {
    log.error('localStorage get failed:', key, error)
    if (isCompactStorageKey(key)) throw error
    return null
  }
}

const localStorageRemove = (key: string) => {
  if (!isLocalStorageAvailable()) return
  try {
    localStorage.removeItem(key)
  } catch (error) {
    log.error('localStorage remove failed:', key, error)
    throw error
  }
}

// ========================================
// Core Storage Functions (Pure I/O)
// ========================================

let writeQueue: Promise<unknown> = Promise.resolve()
const serializeStorageWrite = <T>(task: () => Promise<T>): Promise<T> => {
  const run = async (): Promise<T> => {
    await initializeStorageCodec()
    return typeof navigator !== 'undefined' && navigator.locks
      ? navigator.locks.request('emoji-extension-storage-write', task)
      : task()
  }
  const pending = writeQueue.then(run, run)
  writeQueue = pending.catch(() => {})
  return pending
}

// A delayed save from another surface must not resurrect a group already archived.
async function filterArchivedWrites(values: Record<string, unknown>, restoringId?: string) {
  if (
    typeof indexedDB === 'undefined' ||
    !Object.keys(values).some(
      key => isEmojiGroupStorageKey(key) || key === STORAGE_KEYS.GROUP_INDEX
    )
  )
    return values
  const ids = new Set(await getDurableArchivedGroupIds())
  if (restoringId) ids.delete(restoringId)
  const safe = { ...values }
  for (const id of ids) delete safe[STORAGE_KEYS.GROUP_PREFIX + id]
  if (safe[STORAGE_KEYS.GROUP_INDEX]) {
    const index = decodeStorageValue(STORAGE_KEYS.GROUP_INDEX, safe[STORAGE_KEYS.GROUP_INDEX])
    safe[STORAGE_KEYS.GROUP_INDEX] = encodeStorageValue(
      STORAGE_KEYS.GROUP_INDEX,
      index.filter((item: { id: string }) => !ids.has(item.id))
    )
  }
  return safe
}

const writeExtensionValues = async (
  api: NonNullable<typeof chrome>,
  values: Record<string, unknown>,
  restoringId?: string
): Promise<void> => {
  const safe = await filterArchivedWrites(values, restoringId)
  if (!Object.keys(safe).length) return
  await new Promise<void>((resolve, reject) =>
    api.storage.local.set(safe, () => {
      const error = api.runtime.lastError
      if (error) reject(new Error(error.message || 'Storage write failed'))
      else resolve()
    })
  )
}

const upgradeGroupSnapshots = async (
  api: NonNullable<typeof chrome>,
  snapshots: Record<string, unknown>
) => {
  const candidates: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(snapshots)) {
    if (!isCompactStorageKey(key) || value == null) continue
    const upgraded = encodeStorageValue(key, value)
    if (JSON.stringify(upgraded) !== JSON.stringify(value)) candidates[key] = upgraded
  }
  if (!Object.keys(candidates).length) return
  try {
    await serializeStorageWrite(async () => {
      const current = await new Promise<Record<string, unknown>>((resolve, reject) => {
        api.storage.local.get(Object.keys(candidates), values => {
          const error = api.runtime.lastError
          if (error) reject(new Error(error.message || 'Storage read failed'))
          else resolve(values)
        })
      })
      const safe: Record<string, unknown> = {}
      for (const [key, upgraded] of Object.entries(candidates)) {
        if (JSON.stringify(current[key]) === JSON.stringify(snapshots[key])) safe[key] = upgraded
      }
      if (Object.keys(safe).length) await writeExtensionValues(api, safe)
    })
  } catch (error) {
    log.warn('Group storage upgrade failed; preserving original values', error)
  }
}

async function hydrateFavorites(key: string, value: any): Promise<any> {
  if (key !== 'emojiGroup_favorites' || !Array.isArray(value?.emojis)) return value
  const ids = [
    ...new Set(value.emojis.map((emoji: any) => emoji.sourceGroupId).filter(Boolean))
  ] as string[]
  if (!ids.length) return value
  const sources = await Promise.all(
    ids.map(id => storageGet<EmojiGroup>(`emojiGroup_${id}`, false))
  )
  return resolveFavoriteGroup(
    value,
    sources.filter((group): group is EmojiGroup => !!group)
  )
}

/**
 * 从 chrome.storage.local 读取数据
 */
export async function storageGet<T = unknown>(key: string, upgrade = true): Promise<T | null> {
  await initializeStorageCodec()
  const api = getChromeAPI()
  if (!api?.storage?.local) {
    warnNoChromeStorage()
    return hydrateFavorites(key, localStorageGet<T>(key))
  }

  const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
    api.storage.local.get({ [key]: null }, values => {
      const error = api.runtime.lastError
      if (error) reject(new Error(error.message || 'Storage read failed'))
      else resolve(values)
    })
  })
  const value = decodeStorageValue(key, result[key]) as T | null
  if (upgrade && isCompactStorageKey(key)) await upgradeGroupSnapshots(api, result)
  return hydrateFavorites(key, value)
}

/**
 * 写入数据到 chrome.storage.local
 */
export async function storageSet(key: string, value: unknown): Promise<void> {
  await storageBatchSet({ [key]: value })
}

async function writeStorageItems(
  items: Record<string, unknown>,
  restoringId?: string
): Promise<void> {
  const api = getChromeAPI()
  const timestamp = Date.now()
  const storedItems: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(items)) {
    storedItems[key] = encodeStorageValue(key, ensureSerializable(value), timestamp)
  }
  if (api?.storage?.local) {
    await writeExtensionValues(api, storedItems, restoringId)
  } else {
    warnNoChromeStorage()
    const safe = await filterArchivedWrites(storedItems, restoringId)
    if (!isLocalStorageAvailable()) throw new Error('No writable storage available')
    const originals = Object.fromEntries(
      Object.keys(safe).map(key => [key, localStorage.getItem(key)])
    )
    try {
      for (const [key, value] of Object.entries(safe))
        localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      // localStorage has no atomic batch API. Roll back a partially restored group.
      for (const [key, value] of Object.entries(originals)) {
        if (value === null) localStorage.removeItem(key)
        else localStorage.setItem(key, value)
      }
      throw error
    }
  }
}

export async function storageBatchSet(items: Record<string, unknown>): Promise<void> {
  await serializeStorageWrite(() => writeStorageItems(items))
}

async function removeStorageValues(keys: string[]): Promise<void> {
  const api = getChromeAPI()
  if (!api?.storage?.local) {
    keys.forEach(key => localStorageRemove(key))
    return
  }
  await new Promise<void>((resolve, reject) => {
    api.storage.local.remove(keys, () => {
      const error = api.runtime.lastError
      if (error) reject(new Error(error.message || 'Storage removal failed'))
      else resolve()
    })
  })
}

export async function storageRemove(key: string): Promise<void> {
  await storageBatchRemove([key])
}

export async function storageBatchRemove(keys: string[]): Promise<void> {
  await serializeStorageWrite(() => removeStorageValues(keys))
}

/**
 * 批量读取存储数据
 * @param keys 要读取的 key 数组
 * @returns 包含所有数据的对象
 */
export async function storageBatchGet(keys: string[]): Promise<Record<string, any>> {
  await initializeStorageCodec()
  const api = getChromeAPI()
  if (!api?.storage?.local) {
    warnNoChromeStorage()
    return Object.fromEntries(
      await Promise.all(
        keys.map(async key => [key, await hydrateFavorites(key, localStorageGet(key))])
      )
    )
  }
  const values = await new Promise<Record<string, unknown>>((resolve, reject) => {
    api.storage.local.get(keys, result => {
      const error = api.runtime.lastError
      if (error) reject(new Error(error.message || 'Storage read failed'))
      else resolve(result)
    })
  })
  const unpacked = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, decodeStorageValue(key, value)])
  )
  await upgradeGroupSnapshots(api, values)
  if (unpacked.emojiGroup_favorites)
    unpacked.emojiGroup_favorites = await hydrateFavorites(
      'emojiGroup_favorites',
      unpacked.emojiGroup_favorites
    )
  return unpacked
}

// ========================================
// Serialization Helpers
// ========================================

const SAFE_TYPES = new Set(['string', 'number', 'boolean', 'undefined'])

/**
 * 确保数据可序列化（移除 Vue proxy）
 * 优化：对于已经是普通对象的数据，使用 structuredClone (如果可用) 或 JSON 方法快速处理
 */
function ensureSerializable<T>(data: T, depth = 0): T {
  if (depth > 10) {
    log.warn('Max depth reached, returning null to prevent unsafe references')
    return null as T
  }

  if (data === null || data === undefined) return data

  const type = typeof data
  if (SAFE_TYPES.has(type)) return data

  try {
    // Avoid importing the Vue runtime into the background service worker just
    // to serialize Pinia proxies. Vue proxies expose their raw target through
    // `__v_raw`; plain values simply fall back to themselves.
    const vueRaw =
      typeof data === 'object' && data !== null ? (data as { __v_raw?: T }).__v_raw : undefined
    const raw = vueRaw ?? data

    // 优化：对于大对象，尝试使用 structuredClone (Chrome 98+)
    // 这比手动递归快 2-5 倍
    if (
      depth === 0 &&
      typeof raw === 'object' &&
      raw !== null &&
      typeof structuredClone === 'function'
    ) {
      try {
        // structuredClone 会自动处理 Set, Map, Date, RegExp 等
        return structuredClone(raw) as T
      } catch {
        // Fallback 到手动处理（某些类型可能不支持）
      }
    }

    if (raw instanceof Set) {
      return Array.from(raw).map(item => ensureSerializable(item, depth + 1)) as T
    }

    if (raw instanceof Map) {
      return Array.from(raw.entries()).map(([k, v]) => [
        ensureSerializable(k, depth + 1),
        ensureSerializable(v, depth + 1)
      ]) as T
    }

    if (Array.isArray(raw)) {
      return raw.map(item => ensureSerializable(item, depth + 1)) as T
    }

    if (typeof raw === 'object' && raw !== null) {
      const result: Record<string, unknown> = {}
      for (const key in raw) {
        if (Object.prototype.hasOwnProperty.call(raw, key)) {
          result[key] = ensureSerializable((raw as Record<string, unknown>)[key], depth + 1)
        }
      }
      return result as T
    }

    return raw
  } catch (error) {
    log.error('Serialization failed, returning null:', error)
    return null as T
  }
}

// ========================================
// High-Level Domain Functions
// (Thin wrappers for type safety and consistency)
// ========================================

export const STORAGE_KEYS = {
  SETTINGS: 'appSettings',
  FAVORITES: 'favorites',
  GROUP_INDEX: 'emojiGroupIndex',
  GROUP_PREFIX: 'emojiGroup_',
  ARCHIVED_GROUPS: 'archivedGroupIds',
  DISCOURSE_DOMAINS: 'discourseDomains'
} as const

// ========================================
// IndexedDB for Archived Groups
// ========================================

const ARCHIVE_DB_NAME = 'emojiArchive'
const ARCHIVE_DB_VERSION = 1
const ARCHIVE_STORE_NAME = 'archivedGroups'

let archiveDb: IDBDatabase | null = null

async function getArchiveDb(): Promise<IDBDatabase> {
  if (archiveDb) return archiveDb
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB is not available in this environment')
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(ARCHIVE_DB_NAME, ARCHIVE_DB_VERSION)

    request.onerror = () => {
      reject(new Error('Failed to open archive database'))
    }

    request.onsuccess = () => {
      archiveDb = request.result
      resolve(archiveDb)
    }

    request.onupgradeneeded = event => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(ARCHIVE_STORE_NAME)) {
        db.createObjectStore(ARCHIVE_STORE_NAME, { keyPath: 'id' })
      }
    }
  })
}

// ========================================
// Storage Health Check
// ========================================

// Query keys only: saves should not deserialize all potentially large archived packs.
async function getDurableArchivedGroupIds(): Promise<string[]> {
  const db = await getArchiveDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([ARCHIVE_STORE_NAME], 'readonly')
    const request = transaction.objectStore(ARCHIVE_STORE_NAME).getAllKeys()
    request.onsuccess = () =>
      resolve(request.result.filter((id): id is string => typeof id === 'string'))
    request.onerror = () => reject(request.error || new Error('Failed to read archive IDs'))
  })
}

/**
 * 检查存储数据的完整性
 */
export async function checkStorageHealth(): Promise<{
  hasGroups: boolean
  hasSettings: boolean
  hasFavorites: boolean
  groupCount: number
  details: any
}> {
  try {
    const [groupIndex, settings, favorites] = await Promise.all([
      getEmojiGroupIndex(),
      getSettings(),
      getFavorites()
    ])

    const hasGroups = Array.isArray(groupIndex) && groupIndex.length > 0
    const hasSettings = !!(
      settings &&
      typeof settings === 'object' &&
      Object.keys(settings).length > 0
    )
    const hasFavorites = Array.isArray(favorites)

    log.info('Health check:', {
      groupIndex,
      settings,
      favorites,
      hasGroups,
      hasSettings,
      hasFavorites
    })

    return {
      hasGroups,
      hasSettings,
      hasFavorites,
      groupCount: groupIndex.length,
      details: { groupIndex, settings, favorites }
    }
  } catch (error) {
    log.error('Health check failed:', error)
    return {
      hasGroups: false,
      hasSettings: false,
      hasFavorites: false,
      groupCount: 0,
      details: { error }
    }
  }
}

/**
 * 修复空的存储数据
 */
export async function repairEmptyStorage(): Promise<void> {
  log.info('Starting storage repair')

  const health = await checkStorageHealth()

  if (!health.hasGroups) {
    log.info('No groups found, creating defaults')
    try {
      const { loadPackagedDefaults } = await import('@/types/defaultEmojiGroups.loader')
      const defaults = await loadPackagedDefaults()
      if (defaults?.groups?.length > 0) {
        await setAllEmojiGroups(defaults.groups)
        log.info('Created default groups:', defaults.groups.length)
      }
    } catch (error) {
      log.error('Failed to create default groups:', error)
    }
  }

  if (!health.hasSettings) {
    log.info('No settings found, creating defaults')
    try {
      const { defaultSettings } = await import('@/types/defaultSettings')
      await setSettings(defaultSettings)
      log.info('Created default settings')
    } catch (error) {
      log.error('Failed to create default settings:', error)
    }
  }

  if (!health.hasFavorites) {
    log.info('No favorites found, creating empty array')
    await setFavorites([])
  }
}

/**
 * 表情分组相关
 */
export async function getEmojiGroup(groupId: string): Promise<EmojiGroup | null> {
  const data = await storageGet<EmojiGroup>(STORAGE_KEYS.GROUP_PREFIX + groupId)
  if (!data) return null

  // 运行时类型验证和清理
  const sanitized = sanitizeEmojiGroup(data)
  if (!sanitized) {
    log.warn(`Invalid EmojiGroup data for ${groupId}, skipping`)
    return null
  }

  return sanitized
}

export async function setEmojiGroup(groupId: string, group: EmojiGroup): Promise<void> {
  return storageSet(STORAGE_KEYS.GROUP_PREFIX + groupId, group)
}

export async function removeEmojiGroup(groupId: string): Promise<void> {
  return storageRemove(STORAGE_KEYS.GROUP_PREFIX + groupId)
}

/**
 * 分组索引
 */
export async function getEmojiGroupIndex(): Promise<Array<{ id: string; order: number }>> {
  const index = await storageGet<Array<{ id: string; order: number }>>(STORAGE_KEYS.GROUP_INDEX)
  return index ?? []
}

export async function setEmojiGroupIndex(
  index: Array<{ id: string; order: number }>
): Promise<void> {
  return storageSet(STORAGE_KEYS.GROUP_INDEX, index)
}

/**
 * 设置
 */
export async function getSettings(): Promise<AppSettings | null> {
  const data = await storageGet<AppSettings>(STORAGE_KEYS.SETTINGS)
  if (!data) return null

  // 运行时类型验证
  if (!isSettings(data)) {
    log.warn('Invalid Settings data, returning null')
    return null
  }

  const migrated = migrateMd3Settings(data)
  if (migrated !== data) {
    await storageSet(STORAGE_KEYS.SETTINGS, migrated)
  }

  return migrated
}

const md3Schemes = [
  'default',
  'blue',
  'green',
  'purple',
  'orange',
  'red',
  'macaron',
  'dopamine',
  'morandi',
  'matcha'
] as const
const isMd3Scheme = (value?: string): value is AppSettings['md3ColorScheme'] =>
  !!value && (md3Schemes as readonly string[]).includes(value)

const migrateMd3Settings = (settings: AppSettings): AppSettings => {
  const legacySeed = (settings as { customPrimaryColor?: string }).customPrimaryColor
  const legacyScheme = (settings as { customColorScheme?: string }).customColorScheme
  const hasMd3Seed = Object.prototype.hasOwnProperty.call(settings, 'md3SeedColor')
  const hasMd3Scheme = Object.prototype.hasOwnProperty.call(settings, 'md3ColorScheme')

  if (!legacySeed && !legacyScheme && hasMd3Seed && hasMd3Scheme) {
    return settings
  }

  const migrated = { ...settings } as AppSettings & {
    customPrimaryColor?: string
    customColorScheme?: string
  }

  if (!hasMd3Seed && legacySeed) {
    migrated.md3SeedColor = legacySeed
  }
  if (!hasMd3Scheme && isMd3Scheme(legacyScheme)) {
    migrated.md3ColorScheme = legacyScheme
  }

  delete migrated.customPrimaryColor
  delete migrated.customColorScheme

  return migrated
}

export async function setSettings(settings: AppSettings): Promise<void> {
  return storageSet(STORAGE_KEYS.SETTINGS, settings)
}

/**
 * 收藏夹
 */
export async function getFavorites(): Promise<string[]> {
  const favorites = await storageGet<string[]>(STORAGE_KEYS.FAVORITES)
  return favorites ?? []
}

export async function setFavorites(favorites: string[]): Promise<void> {
  return storageSet(STORAGE_KEYS.FAVORITES, favorites)
}

/**
 * 批量保存所有数据（用于 endBatch）
 */
export async function saveAllData(data: {
  groupIndex?: Array<{ id: string; order: number }>
  groups?: EmojiGroup[]
  settings?: AppSettings
  favorites?: string[]
}): Promise<void> {
  const items: Record<string, unknown> = {}

  if (data.groupIndex) {
    items[STORAGE_KEYS.GROUP_INDEX] = data.groupIndex
  }

  if (data.groups) {
    for (const group of data.groups) {
      items[STORAGE_KEYS.GROUP_PREFIX + group.id] = group
    }
  }

  if (data.settings) {
    items[STORAGE_KEYS.SETTINGS] = data.settings
  }

  if (data.favorites) {
    items[STORAGE_KEYS.FAVORITES] = data.favorites
  }

  if (Object.keys(items).length > 0) {
    await storageBatchSet(items)
  }
}

/**
 * 加载所有分组（用于初始化）
 * 优化：使用批量读取，将 N+1 次查询优化为 2 次
 */
export async function getAllEmojiGroups(): Promise<EmojiGroup[]> {
  await initializeStorageCodec()
  if (typeof indexedDB !== 'undefined') {
    await cleanupArchivedGroupStorage()
  }
  // Upgrade every existing group key, including legacy keys not referenced by the index.
  const api = getChromeAPI()
  if (api?.storage?.local) {
    const snapshots = await new Promise<Record<string, unknown>>((resolve, reject) => {
      api.storage.local.get(null, values => {
        const error = api.runtime.lastError
        if (error) reject(new Error(error.message || 'Storage read failed'))
        else resolve(values)
      })
    })
    await upgradeGroupSnapshots(api, snapshots)
  } else if (isLocalStorageAvailable()) {
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
    for (const key of keys) if (key && isCompactStorageKey(key)) localStorageGet(key)
  }
  const index = await getEmojiGroupIndex()
  if (index.length === 0) {
    return []
  }

  // 批量读取所有分组
  const groupKeys = index.map(({ id }) => `${STORAGE_KEYS.GROUP_PREFIX}${id}`)
  const results = await storageBatchGet(groupKeys)

  // 按索引顺序重组分组数据
  const groups: EmojiGroup[] = []
  for (const { id } of index) {
    const groupData = results[`${STORAGE_KEYS.GROUP_PREFIX}${id}`]
    if (groupData) {
      groups.push(groupData as EmojiGroup)
    }
  }

  const favoriteIndex = groups.findIndex(group => group.id === 'favorites')
  if (favoriteIndex !== -1) {
    const original = groups[favoriteIndex]
    const resolved = resolveFavoriteGroup(original, groups)
    groups[favoriteIndex] = resolved
    // Lossless migration of copied favorites to owner references; don't re-save
    // already packed references simply because reads hydrated their metadata.
    if (
      JSON.stringify(packFavoriteGroup(original)) !== JSON.stringify(packFavoriteGroup(resolved))
    ) {
      try {
        await serializeStorageWrite(async () => {
          const current = await storageGet<EmojiGroup>('emojiGroup_favorites', false)
          if (
            JSON.stringify(packFavoriteGroup(current)) !==
            JSON.stringify(packFavoriteGroup(original))
          )
            return
          await writeStorageItems({
            emojiGroup_favorites: resolved,
            favorites: resolved.emojis.map(emoji => emoji.id)
          })
        })
      } catch (error) {
        log.warn('Favorite reference migration failed; preserving existing data', error)
      }
    }
  }
  return groups
}

/**
 * 保存所有分组（用于批量操作）
 */
export async function setAllEmojiGroups(groups: EmojiGroup[]): Promise<void> {
  const index = groups.map((g, i) => ({ id: g.id, order: i }))
  await saveAllData({ groupIndex: index, groups })
}

// ========================================
// Archived Groups (IndexedDB)
// ========================================

/**
 * 获取已归档分组 ID 列表
 */
export async function getArchivedGroupIds(): Promise<string[]> {
  const ids = await storageGet<string[]>(STORAGE_KEYS.ARCHIVED_GROUPS)
  return ids ?? []
}

/**
 * 设置已归档分组 ID 列表
 */
export async function setArchivedGroupIds(ids: string[]): Promise<void> {
  await storageSet(STORAGE_KEYS.ARCHIVED_GROUPS, ids)
}

/**
 * 归档一个分组（存储到 IndexedDB）
 */
// Resolve only after the transaction commits, not after an individual request.
async function mutateArchive(action: (store: IDBObjectStore) => void): Promise<void> {
  const db = await getArchiveDb()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([ARCHIVE_STORE_NAME], 'readwrite')
    transaction.oncomplete = () => resolve()
    transaction.onabort = transaction.onerror = () =>
      reject(transaction.error || new Error('Archive transaction failed'))
    action(transaction.objectStore(ARCHIVE_STORE_NAME))
  })
}

/** Clean only IDs with an actual durable archive record; never guess from the index. */
export async function cleanupArchivedGroupStorage(): Promise<void> {
  await serializeStorageWrite(cleanupArchivedGroupStorageUnlocked)
}

async function cleanupArchivedGroupStorageUnlocked(): Promise<void> {
  const archivedIds = await getDurableArchivedGroupIds()
  if (!archivedIds.length) return
  const ids = new Set(archivedIds)
  // Free the large values FIRST, so even an already-full storage can update metadata.
  await removeStorageValues([...ids].map(id => STORAGE_KEYS.GROUP_PREFIX + id))
  if (isLocalStorageAvailable()) {
    for (const id of ids) localStorageRemove(STORAGE_KEYS.GROUP_PREFIX + id)
  }
  const index =
    (await storageGet<Array<{ id: string; order: number }>>(STORAGE_KEYS.GROUP_INDEX, false)) ?? []
  const active = index.filter(item => !ids.has(item.id))
  const previousIds = (await storageGet<string[]>(STORAGE_KEYS.ARCHIVED_GROUPS, false)) ?? []
  const items: Record<string, unknown> = {}
  if (active.length !== index.length) items[STORAGE_KEYS.GROUP_INDEX] = active
  if (JSON.stringify(previousIds) !== JSON.stringify([...ids]))
    items[STORAGE_KEYS.ARCHIVED_GROUPS] = [...ids]
  if (Object.keys(items).length) await writeStorageItems(items)
}

export async function archiveGroup(group: EmojiGroup): Promise<void> {
  await serializeStorageWrite(async () => {
    await mutateArchive(store => {
      store.put(ensureSerializable(group))
    })
    await cleanupArchivedGroupStorageUnlocked()
  })
}

/** Restore the active copy BEFORE deleting the archive. Quota errors keep it recoverable. */
export async function unarchiveGroup(groupId: string): Promise<EmojiGroup | null> {
  return serializeStorageWrite(async () => {
    const group = await getArchivedGroup(groupId)
    if (!group) return null
    const index =
      (await storageGet<Array<{ id: string; order: number }>>(STORAGE_KEYS.GROUP_INDEX, false)) ??
      []
    if (!index.some(item => item.id === groupId)) index.push({ id: groupId, order: index.length })
    const archivedIds = (
      (await storageGet<string[]>(STORAGE_KEYS.ARCHIVED_GROUPS, false)) ?? []
    ).filter(id => id !== groupId)
    await writeStorageItems(
      {
        [STORAGE_KEYS.GROUP_PREFIX + groupId]: group,
        [STORAGE_KEYS.GROUP_INDEX]: index,
        [STORAGE_KEYS.ARCHIVED_GROUPS]: archivedIds
      },
      groupId
    )
    await mutateArchive(store => {
      store.delete(groupId)
    })
    return group
  })
}

/**
 * 获取单个归档分组
 */
export async function getArchivedGroup(groupId: string): Promise<EmojiGroup | null> {
  const db = await getArchiveDb()

  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([ARCHIVE_STORE_NAME], 'readonly')
      const store = transaction.objectStore(ARCHIVE_STORE_NAME)
      const request = store.get(groupId)

      request.onsuccess = () => {
        resolve((request.result as EmojiGroup) || null)
      }

      request.onerror = () => {
        reject(new Error('Failed to get archived group'))
      }
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * 获取所有归档分组
 */
export async function getAllArchivedGroups(): Promise<EmojiGroup[]> {
  const db = await getArchiveDb()

  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([ARCHIVE_STORE_NAME], 'readonly')
      const store = transaction.objectStore(ARCHIVE_STORE_NAME)
      const request = store.getAll()

      request.onsuccess = () => {
        resolve((request.result as EmojiGroup[]) || [])
      }

      request.onerror = () => {
        reject(new Error('Failed to get all archived groups'))
      }
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * 永久删除归档分组
 */
export async function deleteArchivedGroup(groupId: string): Promise<void> {
  await serializeStorageWrite(async () => {
    // Remove obsolete active duplicates while the durable archive still exists.
    await cleanupArchivedGroupStorageUnlocked()
    await mutateArchive(store => {
      store.delete(groupId)
    })
    await writeStorageItems({
      [STORAGE_KEYS.ARCHIVED_GROUPS]: (
        (await storageGet<string[]>(STORAGE_KEYS.ARCHIVED_GROUPS, false)) ?? []
      ).filter(id => id !== groupId)
    })
  })
}

// ========================================
// Other APIs
// ========================================

/**
 * Discourse Domains 配置
 */
export async function getDiscourseDomains(): Promise<
  Array<{ domain: string; enabledGroups: string[] }>
> {
  const domains = await storageGet<Array<{ domain: string; enabledGroups: string[] }>>(
    STORAGE_KEYS.DISCOURSE_DOMAINS
  )
  return domains ?? []
}

export async function setDiscourseDomains(
  domains: Array<{ domain: string; enabledGroups: string[] }>
): Promise<void> {
  await storageSet(STORAGE_KEYS.DISCOURSE_DOMAINS, domains)
}

/**
 * 获取单个 Discourse Domain
 */
export async function getDiscourseDomain(
  domain: string
): Promise<{ domain: string; enabledGroups: string[] } | null> {
  const domains = await getDiscourseDomains()
  return domains.find(d => d.domain === domain) || null
}

/**
 * 确保 Discourse Domain 存在
 */
export async function ensureDiscourseDomainExists(
  domain: string
): Promise<{ domain: string; enabledGroups: string[] }> {
  const existing = await getDiscourseDomain(domain)
  if (existing) return existing

  const entry = { domain, enabledGroups: [] }
  const domains = await getDiscourseDomains()
  domains.push(entry)
  await setDiscourseDomains(domains)
  return entry
}

export async function setDiscourseDomain(domain: string, enabledGroups: string[]): Promise<void> {
  const domains = await getDiscourseDomains()
  const idx = domains.findIndex(d => d.domain === domain)
  const entry = { domain, enabledGroups }
  if (idx >= 0) domains[idx] = entry
  else domains.push(entry)
  await setDiscourseDomains(domains)
}

export async function removeDiscourseDomain(domain: string): Promise<void> {
  const domains = await getDiscourseDomains()
  const filtered = domains.filter(d => d.domain !== domain)
  await setDiscourseDomains(filtered)
}

// ========================================
// Reset and Backup Functions
// ========================================

/**
 * 重置到默认配置
 */
export async function resetToDefaults(): Promise<void> {
  const { loadPackagedDefaults } = await import('@/types/defaultEmojiGroups.loader')
  const { defaultSettings } = await import('@/types/defaultSettings')

  try {
    const packaged = await loadPackagedDefaults()
    await setAllEmojiGroups(packaged?.groups?.length ? packaged.groups : [])
  } catch {
    await setAllEmojiGroups([])
  }
  await setSettings(defaultSettings)
  await setFavorites([])
}

/**
 * 备份到 chrome.storage.sync
 */
export async function backupToSync(
  groups: EmojiGroup[],
  settings: AppSettings,
  favorites: string[]
): Promise<void> {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI?.storage?.sync) {
    throw new Error('Chrome Sync Storage API not available')
  }

  const CHUNK_SIZE = 6000
  const groupData = JSON.stringify(groups)
  const chunks: string[] = []

  for (let i = 0; i < groupData.length; i += CHUNK_SIZE) {
    chunks.push(groupData.slice(i, i + CHUNK_SIZE))
  }

  const syncData: Record<string, unknown> = {
    emojiGroups_chunkCount: chunks.length,
    settings,
    favorites,
    timestamp: Date.now()
  }

  chunks.forEach((chunk, index) => {
    syncData[`emojiGroups_chunk_${index}`] = chunk
  })

  return new Promise((resolve, reject) => {
    chromeAPI.storage.sync.set(syncData, () => {
      if (chromeAPI.runtime.lastError) {
        reject(chromeAPI.runtime.lastError)
      } else {
        resolve()
      }
    })
  })
}

// ========================================
// Storage Change Listener
// ========================================

export type StorageChangeListener = (changes: {
  key: string
  oldValue: unknown
  newValue: unknown
}) => void

/**
 * 监听存储变化（用于多窗口同步）
 */
export function onStorageChanged(callback: StorageChangeListener): () => void {
  const api = getChromeAPI()
  if (!api?.storage?.onChanged) {
    log.warn('chrome.storage.onChanged not available')
    return () => {}
  }

  const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName !== 'local') return

    void initializeStorageCodec()
      .then(async () => {
        for (const [key, change] of Object.entries(changes)) {
          try {
            callback({
              key,
              oldValue:
                (await hydrateFavorites(key, decodeStorageValue(key, change.oldValue))) ?? null,
              newValue:
                (await hydrateFavorites(key, decodeStorageValue(key, change.newValue))) ?? null
            })
          } catch (error) {
            // Never leak the physical br2 representation to storage subscribers.
            log.error('Storage change decode failed:', key, error)
          }
        }
      })
      .catch(error => log.error('Storage change codec initialization failed:', error))
  }

  api.storage.onChanged.addListener(listener)

  // 返回取消监听函数
  return () => {
    api.storage?.onChanged.removeListener(listener)
  }
}
