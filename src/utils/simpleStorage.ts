/**
 * Simplified Storage Layer - Direct chrome.storage API wrapper
 *
 * 设计原则：
 * 1. 纯 I/O 层，无缓存逻辑
 * 2. Pinia stores 负责所有缓存和状态管理
 * 3. 简单的序列化/反序列化
 * 4. 最小化抽象层
 */

import { toRaw } from 'vue'

import type { EmojiGroup, AppSettings } from '@/types/type'

// Chrome API helper
declare const chrome: typeof globalThis.chrome | undefined

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

// ========================================
// Core Storage Functions (Pure I/O)
// ========================================

/**
 * 从 chrome.storage.local 读取数据
 */
export async function storageGet<T = unknown>(key: string): Promise<T | null> {
  const api = getChromeAPI()
  if (!api?.storage?.local) {
    console.warn('[Storage] chrome.storage.local not available')
    return null
  }

  return new Promise(resolve => {
    api.storage.local.get({ [key]: null }, result => {
      if (api.runtime.lastError) {
        console.error('[Storage] Get failed:', key, api.runtime.lastError)
        resolve(null)
      } else {
        const value = result[key] as { data?: T; timestamp?: number } | T | null
        // 解包包装格式 { data, timestamp }
        const data =
          (value && typeof value === 'object' && 'data' in value ? value.data : value) ?? null
        resolve(data as T | null)
      }
    })
  })
}

/**
 * 写入数据到 chrome.storage.local
 */
export async function storageSet(key: string, value: unknown): Promise<void> {
  const api = getChromeAPI()
  if (!api?.storage?.local) {
    console.warn('[Storage] chrome.storage.local not available')
    return
  }

  const cleanValue = ensureSerializable(value)
  const wrappedValue = {
    data: cleanValue,
    timestamp: Date.now()
  }

  return new Promise((resolve, reject) => {
    api.storage.local.set({ [key]: wrappedValue }, () => {
      if (api.runtime.lastError) {
        console.error('[Storage] Set failed:', key, api.runtime.lastError)
        reject(api.runtime.lastError)
      } else {
        resolve()
      }
    })
  })
}

/**
 * 批量写入
 */
export async function storageBatchSet(items: Record<string, unknown>): Promise<void> {
  const api = getChromeAPI()
  if (!api?.storage?.local) {
    console.warn('[Storage] chrome.storage.local not available')
    return
  }

  const timestamp = Date.now()
  const wrappedItems: Record<string, { data: unknown; timestamp: number }> = {}

  for (const [key, value] of Object.entries(items)) {
    wrappedItems[key] = {
      data: ensureSerializable(value),
      timestamp
    }
  }

  return new Promise((resolve, reject) => {
    api.storage.local.set(wrappedItems, () => {
      if (api.runtime.lastError) {
        console.error('[Storage] Batch set failed:', api.runtime.lastError)
        reject(api.runtime.lastError)
      } else {
        resolve()
      }
    })
  })
}

/**
 * 删除数据
 */
export async function storageRemove(key: string): Promise<void> {
  const api = getChromeAPI()
  if (!api?.storage?.local) {
    console.warn('[Storage] chrome.storage.local not available')
    return
  }

  return new Promise(resolve => {
    api.storage.local.remove([key], () => {
      resolve()
    })
  })
}

/**
 * 批量删除
 */
export async function storageBatchRemove(keys: string[]): Promise<void> {
  const api = getChromeAPI()
  if (!api?.storage?.local) {
    console.warn('[Storage] chrome.storage.local not available')
    return
  }

  return new Promise(resolve => {
    api.storage.local.remove(keys, () => {
      resolve()
    })
  })
}

// ========================================
// Serialization Helpers
// ========================================

const SAFE_TYPES = new Set(['string', 'number', 'boolean', 'undefined'])

/**
 * 确保数据可序列化（移除 Vue proxy）
 */
function ensureSerializable<T>(data: T, depth = 0): T {
  if (depth > 10) {
    console.warn('[Storage] Max depth reached')
    return data
  }

  if (data === null || data === undefined) return data

  const type = typeof data
  if (SAFE_TYPES.has(type)) return data

  try {
    const raw = toRaw(data)

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
    console.error('[Storage] Serialization failed:', error)
    return data
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

/**
 * 表情分组相关
 */
export async function getEmojiGroup(groupId: string): Promise<EmojiGroup | null> {
  return storageGet<EmojiGroup>(STORAGE_KEYS.GROUP_PREFIX + groupId)
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
  return storageGet<AppSettings>(STORAGE_KEYS.SETTINGS)
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
 */
export async function getAllEmojiGroups(): Promise<EmojiGroup[]> {
  const index = await getEmojiGroupIndex()
  const groups: EmojiGroup[] = []

  for (const { id } of index) {
    const group = await getEmojiGroup(id)
    if (group) {
      groups.push(group)
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
export async function archiveGroup(group: EmojiGroup): Promise<void> {
  const db = await getArchiveDb()

  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([ARCHIVE_STORE_NAME], 'readwrite')
      const store = transaction.objectStore(ARCHIVE_STORE_NAME)

      const request = store.put(group)

      request.onsuccess = async () => {
        try {
          const archivedIds = await getArchivedGroupIds()
          if (!archivedIds.includes(group.id)) {
            archivedIds.push(group.id)
            await setArchivedGroupIds(archivedIds)
          }
          resolve()
        } catch (error) {
          reject(error)
        }
      }

      request.onerror = () => {
        reject(new Error('Failed to archive group'))
      }
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * 取消归档并返回分组数据
 */
export async function unarchiveGroup(groupId: string): Promise<EmojiGroup | null> {
  const db = await getArchiveDb()

  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([ARCHIVE_STORE_NAME], 'readwrite')
      const store = transaction.objectStore(ARCHIVE_STORE_NAME)

      const getRequest = store.get(groupId)

      getRequest.onsuccess = async () => {
        const group = getRequest.result as EmojiGroup | undefined

        if (group) {
          // 从 IndexedDB 删除
          const deleteRequest = store.delete(groupId)

          deleteRequest.onsuccess = async () => {
            try {
              // 从归档 ID 列表移除
              const archivedIds = await getArchivedGroupIds()
              const newIds = archivedIds.filter(id => id !== groupId)
              await setArchivedGroupIds(newIds)
              resolve(group)
            } catch (error) {
              reject(error)
            }
          }

          deleteRequest.onerror = () => {
            reject(new Error('Failed to delete from archive'))
          }
        } else {
          resolve(null)
        }
      }

      getRequest.onerror = () => {
        reject(new Error('Failed to get archived group'))
      }
    } catch (error) {
      reject(error)
    }
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
  const db = await getArchiveDb()

  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([ARCHIVE_STORE_NAME], 'readwrite')
      const store = transaction.objectStore(ARCHIVE_STORE_NAME)
      const request = store.delete(groupId)

      request.onsuccess = async () => {
        try {
          const archivedIds = await getArchivedGroupIds()
          const newIds = archivedIds.filter(id => id !== groupId)
          await setArchivedGroupIds(newIds)
          resolve()
        } catch (error) {
          reject(error)
        }
      }

      request.onerror = () => {
        reject(new Error('Failed to delete archived group'))
      }
    } catch (error) {
      reject(error)
    }
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
    console.warn('[Storage] chrome.storage.onChanged not available')
    return () => {}
  }

  const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName !== 'local') return

    for (const [key, change] of Object.entries(changes)) {
      const oldVal = change.oldValue as { data?: unknown } | unknown
      const newVal = change.newValue as { data?: unknown } | unknown

      callback({
        key,
        oldValue:
          (oldVal && typeof oldVal === 'object' && 'data' in oldVal ? oldVal.data : oldVal) ?? null,
        newValue:
          (newVal && typeof newVal === 'object' && 'data' in newVal ? newVal.data : newVal) ?? null
      })
    }
  }

  api.storage.onChanged.addListener(listener)

  // 返回取消监听函数
  return () => {
    api.storage?.onChanged.removeListener(listener)
  }
}
