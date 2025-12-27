import { toRaw } from 'vue'

import type { EmojiGroup, AppSettings } from '@/types/type'
import { defaultSettings } from '@/types/defaultSettings'
import { loadDefaultEmojiGroups, loadPackagedDefaults } from '@/types/defaultEmojiGroups.loader'

// In build/test environments `chrome` may not be declared. Provide a loose declaration
declare const chrome: typeof globalThis.chrome | undefined

// --- Constants ---
export const STORAGE_KEYS = {
  SETTINGS: 'appSettings',
  FAVORITES: 'favorites',
  GROUP_INDEX: 'emojiGroupIndex', // For group order and metadata
  GROUP_PREFIX: 'emojiGroup_', // For individual group storage
  ARCHIVED_GROUPS: 'archivedGroupIds', // 已归档分组 ID 列表
  // Discourse domain configuration: stores array of { domain: string, enabledGroups: string[] }
  DISCOURSE_DOMAINS: 'discourseDomains'
} as const

export const SYNC_STORAGE_KEYS = {
  BACKUP: 'emojiExtensionBackup'
} as const

// --- IndexedDB for Archived Groups ---
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

// --- Chrome API Helper ---
function getChromeAPI(): typeof chrome | null {
  if (typeof chrome !== 'undefined' && chrome?.storage) {
    return chrome
  }
  // Fallback for environments where `chrome` is not immediately available
  if (typeof window !== 'undefined' && (window as { chrome?: typeof chrome }).chrome) {
    return (window as { chrome?: typeof chrome }).chrome ?? null
  }
  if (typeof globalThis !== 'undefined' && (globalThis as { chrome?: typeof chrome }).chrome) {
    return (globalThis as { chrome?: typeof chrome }).chrome ?? null
  }
  return null
}

// --- Helper function to ensure data is serializable ---
// Use toRaw() to strip Vue reactive proxy, then recursively process
/**
 * 优化：缓存已知安全的数据类型，避免重复序列化检查
 */
const SAFE_TYPES = new Set(['string', 'number', 'boolean', 'undefined'])

/**
 * 优化版本：减少递归深度，针对 EmojiGroup 结构优化
 */
function ensureSerializable<T>(data: T, depth = 0): T {
  // 防止无限递归
  if (depth > 10) {
    console.warn('[ensureSerializable] Max depth reached, returning as-is')
    return data
  }

  if (data === null || data === undefined) return data

  // 基础类型直接返回（最常见的情况）
  const type = typeof data
  if (SAFE_TYPES.has(type)) {
    return data
  }

  try {
    // Strip Vue reactive proxy first
    const raw = toRaw(data)

    // Handle Set - convert to array
    if (raw instanceof Set) {
      return Array.from(raw).map(item => ensureSerializable(item, depth + 1)) as T
    }

    // Handle Map - convert to array of [key, value] pairs
    if (raw instanceof Map) {
      return Array.from(raw.entries()).map(([k, v]) => [
        ensureSerializable(k, depth + 1),
        ensureSerializable(v, depth + 1)
      ]) as T
    }

    // 优化：针对数组进行浅检查
    // 如果数组中所有元素都是基本类型，直接返回
    if (Array.isArray(raw)) {
      // 快速路径：检查第一个元素
      if (raw.length > 0) {
        const firstType = typeof raw[0]
        if (SAFE_TYPES.has(firstType)) {
          // 假设同质数组（常见于 tags 数组）
          return raw as T
        }
      }
      // 慢速路径：递归处理
      return raw.map(item => ensureSerializable(item, depth + 1)) as T
    }

    // 优化：对于已知的 Emoji 对象结构，使用快速路径
    if (typeof raw === 'object' && raw !== null) {
      const obj = raw as Record<string, unknown>

      // 快速检测是否为 Emoji 对象（有 id 和 url 字段）
      if ('id' in obj && 'url' in obj && depth <= 2) {
        // 已知 Emoji 对象只有浅层嵌套，不需要深度递归
        const result: Record<string, unknown> = {}
        for (const key of Object.keys(obj)) {
          const value = obj[key]
          const valueType = typeof value
          if (SAFE_TYPES.has(valueType) || value === null) {
            result[key] = value
          } else if (Array.isArray(value)) {
            // tags 数组通常是字符串数组
            result[key] = value.map(item =>
              typeof item === 'string' ? item : ensureSerializable(item, depth + 1)
            )
          } else {
            result[key] = ensureSerializable(value, depth + 1)
          }
        }
        return result as T
      }

      // 通用对象处理
      const result: Record<string, unknown> = {}
      for (const key of Object.keys(obj)) {
        result[key] = ensureSerializable(obj[key], depth + 1)
      }
      return result as T
    }

    return raw as T
  } catch (error) {
    // Fallback to JSON method if toRaw fails
    try {
      return JSON.parse(JSON.stringify(data))
    } catch {
      return data
    }
  }
}

// --- Helper function to clean emoji data before saving ---
// Remove empty tags array and other empty optional fields
function cleanEmojiForStorage(emoji: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...emoji }
  // Remove empty tags array
  if (Array.isArray(cleaned.tags) && cleaned.tags.length === 0) {
    delete cleaned.tags
  }
  return cleaned
}

// --- Helper function to clean emojis in a group ---
function cleanGroupEmojis(emojis: unknown[]): unknown[] {
  return emojis.map(emoji => {
    if (emoji && typeof emoji === 'object') {
      return cleanEmojiForStorage(emoji as Record<string, unknown>)
    }
    return emoji
  })
}

// --- Simple Storage Manager ---
// 优先写入 extension storage，localStorage 作为缓存加速读取
class SimpleStorageManager {
  // 读取 - 优先 localStorage，回退到 extension storage
  async get(key: string): Promise<unknown> {
    // 先尝试 localStorage（快速缓存）
    try {
      if (typeof localStorage !== 'undefined') {
        const value = localStorage.getItem(key)
        if (value !== null) {
          const parsed = JSON.parse(value)
          return parsed?.data ?? parsed
        }
      }
    } catch {
      // ignore localStorage errors
    }

    // 回退到 extension storage
    const chromeAPI = getChromeAPI()
    if (chromeAPI?.storage?.local) {
      return new Promise(resolve => {
        try {
          chromeAPI.storage.local.get({ [key]: null }, (result: Record<string, unknown>) => {
            if (chromeAPI.runtime.lastError) {
              resolve(null)
            } else {
              const value = result[key] as { data?: unknown } | undefined
              resolve(value?.data ?? value)
            }
          })
        } catch {
          resolve(null)
        }
      })
    }

    return null
  }

  // 写入 - 主要写入 extension storage，localStorage 作为可选缓存
  async set(key: string, value: unknown): Promise<void> {
    const cleanValue = ensureSerializable(value)
    const finalValue = {
      data: cleanValue,
      timestamp: Date.now()
    }

    // 尝试写入 localStorage（可选缓存，失败不影响）
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(finalValue))
      }
    } catch {
      // localStorage 满了或不可用，忽略
    }

    // 写入 extension storage（必须成功）
    const chromeAPI = getChromeAPI()
    if (chromeAPI?.storage?.local) {
      return new Promise((resolve, reject) => {
        try {
          chromeAPI.storage.local.set({ [key]: finalValue }, () => {
            if (chromeAPI.runtime.lastError) {
              console.error(
                '[Storage] extensionStorage.set failed:',
                key,
                chromeAPI.runtime.lastError
              )
              reject(chromeAPI.runtime.lastError)
            } else {
              resolve()
            }
          })
        } catch (error) {
          reject(error)
        }
      })
    }
  }

  // setSync 现在等同于 set
  async setSync(key: string, value: unknown): Promise<void> {
    return this.set(key, value)
  }

  // 从所有存储层删除
  async remove(key: string): Promise<void> {
    // 删除 localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key)
      }
    } catch {
      // ignore
    }

    // 删除 extension storage
    const chromeAPI = getChromeAPI()
    if (chromeAPI?.storage?.local) {
      return new Promise(resolve => {
        chromeAPI.storage.local.remove([key], () => {
          resolve()
        })
      })
    }
  }

  // 批量写入
  async setBatchSync(items: Record<string, unknown>): Promise<void> {
    const timestamp = Date.now()
    const finalItems: Record<string, { data: unknown; timestamp: number }> = {}

    for (const key of Object.keys(items)) {
      const cleanValue = ensureSerializable(items[key])
      finalItems[key] = { data: cleanValue, timestamp }
    }

    // 尝试写入 localStorage（可选缓存）
    try {
      if (typeof localStorage !== 'undefined') {
        for (const key of Object.keys(finalItems)) {
          try {
            localStorage.setItem(key, JSON.stringify(finalItems[key]))
          } catch {
            // 单个 key 写入失败，继续其他
          }
        }
      }
    } catch {
      // ignore
    }

    // 写入 extension storage
    const chromeAPI = getChromeAPI()
    if (chromeAPI?.storage?.local) {
      return new Promise((resolve, reject) => {
        try {
          chromeAPI.storage.local.set(finalItems, () => {
            if (chromeAPI.runtime.lastError) {
              console.error(
                '[Storage] extensionStorage.setBatch failed:',
                chromeAPI.runtime.lastError
              )
              reject(chromeAPI.runtime.lastError)
            } else {
              resolve()
            }
          })
        } catch (error) {
          reject(error)
        }
      })
    }
  }
}

// --- Public API ---
const storageManager = new SimpleStorageManager()

export const newStorageHelpers = {
  // Group management
  async getEmojiGroupIndex(): Promise<Array<{ id: string; order: number }>> {
    const index = await storageManager.get(STORAGE_KEYS.GROUP_INDEX)
    return Array.isArray(index) ? (index as Array<{ id: string; order: number }>) : []
  },

  async setEmojiGroupIndex(index: Array<{ id: string; order: number }>): Promise<void> {
    await storageManager.set(STORAGE_KEYS.GROUP_INDEX, index)
  },

  async setEmojiGroupIndexSync(index: Array<{ id: string; order: number }>): Promise<void> {
    await storageManager.setSync(STORAGE_KEYS.GROUP_INDEX, index)
  },

  async getEmojiGroup(groupId: string): Promise<EmojiGroup | null> {
    const group = await storageManager.get(STORAGE_KEYS.GROUP_PREFIX + groupId)
    return group as EmojiGroup | null
  },

  async setEmojiGroup(groupId: string, group: EmojiGroup): Promise<void> {
    const clean = ensureSerializable({
      id: group.id || groupId,
      name: group.name || '',
      icon: group.icon || '',
      order: group.order ?? 0,
      emojis: cleanGroupEmojis(Array.isArray(group.emojis) ? group.emojis : []),
      detail: group.detail
    })
    await storageManager.set(STORAGE_KEYS.GROUP_PREFIX + groupId, clean)
  },

  async setEmojiGroupSync(groupId: string, group: EmojiGroup): Promise<void> {
    const clean = ensureSerializable({
      id: group.id || groupId,
      name: group.name || '',
      icon: group.icon || '',
      order: group.order ?? 0,
      emojis: cleanGroupEmojis(Array.isArray(group.emojis) ? group.emojis : []),
      detail: group.detail
    })
    await storageManager.setSync(STORAGE_KEYS.GROUP_PREFIX + groupId, clean)
  },

  async removeEmojiGroup(groupId: string): Promise<void> {
    const index = await this.getEmojiGroupIndex()
    const filtered = index.filter(entry => entry.id !== groupId)
    if (filtered.length !== index.length) {
      const reindexed = filtered.map((entry, order) => ({ id: entry.id, order }))
      await this.setEmojiGroupIndex(reindexed)
    }
    await storageManager.remove(STORAGE_KEYS.GROUP_PREFIX + groupId)
  },

  async getAllEmojiGroups(): Promise<EmojiGroup[]> {
    const index = await this.getEmojiGroupIndex()

    if (!index.length) {
      // Try runtime loader for packaged JSON first
      try {
        const runtime = await loadDefaultEmojiGroups()
        if (runtime && runtime.length) return runtime
      } catch {
        // ignore loader errors
      }
      return []
    }

    const groups = await Promise.all(
      index.map(async groupInfo => {
        const group = await this.getEmojiGroup(groupInfo.id)
        return group ? { ...group, order: groupInfo.order } : null
      })
    )

    return groups
      .filter((group): group is EmojiGroup => group !== null)
      .sort((a, b) => a.order - b.order)
  },

  async setAllEmojiGroups(groups: EmojiGroup[]): Promise<void> {
    const index = groups.map((group, order) => ({ id: group.id, order }))
    const existingIndex = await this.getEmojiGroupIndex()
    const existingIds = new Set(existingIndex.map(entry => entry.id))
    const incomingIds = new Set(groups.map(group => group.id))

    // Remove deleted groups
    const removedIds: string[] = []
    existingIds.forEach(id => {
      if (!incomingIds.has(id)) removedIds.push(id)
    })

    if (removedIds.length) {
      await Promise.allSettled(
        removedIds.map(id => storageManager.remove(STORAGE_KEYS.GROUP_PREFIX + id))
      )
    }

    await this.setEmojiGroupIndex(index)
    await Promise.all(groups.map(group => this.setEmojiGroup(group.id, group)))
  },

  async setAllEmojiGroupsSync(groups: EmojiGroup[]): Promise<void> {
    const index = groups.map((group, order) => ({ id: group.id, order }))
    const existingIndex = await this.getEmojiGroupIndex()
    const existingIds = new Set(existingIndex.map(entry => entry.id))
    const incomingIds = new Set(groups.map(group => group.id))

    const removedIds: string[] = []
    existingIds.forEach(id => {
      if (!incomingIds.has(id)) removedIds.push(id)
    })

    if (removedIds.length) {
      await Promise.allSettled(
        removedIds.map(id => storageManager.remove(STORAGE_KEYS.GROUP_PREFIX + id))
      )
    }

    // 使用批量写入，减少 storage.onChanged 事件次数
    const batchItems: Record<string, unknown> = {
      [STORAGE_KEYS.GROUP_INDEX]: index
    }

    for (const group of groups) {
      const clean = {
        id: group.id,
        name: group.name || '',
        icon: group.icon || '',
        order: group.order ?? 0,
        emojis: cleanGroupEmojis(Array.isArray(group.emojis) ? group.emojis : []),
        detail: group.detail
      }
      batchItems[STORAGE_KEYS.GROUP_PREFIX + group.id] = clean
    }

    await storageManager.setBatchSync(batchItems)
  },

  // 增量保存：只保存指定的 groups（用于部分更新）
  async setEmojiGroupsBatchSync(groups: EmojiGroup[]): Promise<void> {
    if (groups.length === 0) return

    const batchItems: Record<string, unknown> = {}

    for (const group of groups) {
      const clean = {
        id: group.id,
        name: group.name || '',
        icon: group.icon || '',
        order: group.order ?? 0,
        emojis: cleanGroupEmojis(Array.isArray(group.emojis) ? group.emojis : []),
        detail: group.detail
      }
      batchItems[STORAGE_KEYS.GROUP_PREFIX + group.id] = clean
    }

    await storageManager.setBatchSync(batchItems)
  },

  // 批量保存所有数据（groups, settings, favorites）到一次 storage.set 调用
  // 同时清理已删除的分组
  async saveAllBatchSync(options: {
    groups?: EmojiGroup[]
    settings?: AppSettings
    favorites?: string[]
  }): Promise<void> {
    const batchItems: Record<string, unknown> = {}

    // 添加 groups
    if (options.groups && options.groups.length > 0) {
      // 先获取现有索引，检查是否有需要删除的分组
      const existingIndex = await this.getEmojiGroupIndex()
      const existingIds = new Set(existingIndex.map(entry => entry.id))
      const incomingIds = new Set(options.groups.map(group => group.id))

      // 删除不再存在的分组
      const removedIds: string[] = []
      existingIds.forEach(id => {
        if (!incomingIds.has(id)) removedIds.push(id)
      })

      if (removedIds.length > 0) {
        await Promise.allSettled(
          removedIds.map(id => storageManager.remove(STORAGE_KEYS.GROUP_PREFIX + id))
        )
      }

      // 更新 group index
      const index = options.groups.map((group, order) => ({ id: group.id, order }))
      batchItems[STORAGE_KEYS.GROUP_INDEX] = index

      // 添加每个 group
      for (const group of options.groups) {
        const clean = {
          id: group.id,
          name: group.name || '',
          icon: group.icon || '',
          order: group.order ?? 0,
          emojis: cleanGroupEmojis(Array.isArray(group.emojis) ? group.emojis : []),
          detail: group.detail
        }
        batchItems[STORAGE_KEYS.GROUP_PREFIX + group.id] = clean
      }
    }

    // 添加 settings
    if (options.settings) {
      const updatedSettings = { ...defaultSettings, ...options.settings, lastModified: Date.now() }
      batchItems[STORAGE_KEYS.SETTINGS] = updatedSettings
    }

    // 添加 favorites
    if (options.favorites) {
      batchItems[STORAGE_KEYS.FAVORITES] = options.favorites
    }

    // 只有在有数据时才执行批量写入
    if (Object.keys(batchItems).length > 0) {
      await storageManager.setBatchSync(batchItems)
    }
  },

  // Settings management
  async getSettings(): Promise<AppSettings> {
    const settings = await storageManager.get(STORAGE_KEYS.SETTINGS)
    if (settings && typeof settings === 'object') return { ...defaultSettings, ...settings }

    // No persisted settings: prefer packaged defaults
    try {
      const packaged = await loadPackagedDefaults()
      if (packaged?.settings && Object.keys(packaged.settings).length > 0) {
        return { ...defaultSettings, ...packaged.settings }
      }
    } catch {
      // ignore loader errors
    }

    return { ...defaultSettings }
  },

  async setSettings(settings: AppSettings): Promise<void> {
    const updatedSettings = { ...defaultSettings, ...settings, lastModified: Date.now() }
    await storageManager.set(STORAGE_KEYS.SETTINGS, updatedSettings)
  },

  async setSettingsSync(settings: AppSettings): Promise<void> {
    const updatedSettings = { ...defaultSettings, ...settings, lastModified: Date.now() }
    await storageManager.setSync(STORAGE_KEYS.SETTINGS, updatedSettings)
  },

  // Favorites management
  async getFavorites(): Promise<string[]> {
    const favorites = await storageManager.get(STORAGE_KEYS.FAVORITES)
    return Array.isArray(favorites) ? (favorites as string[]) : []
  },

  async setFavorites(favorites: string[]): Promise<void> {
    await storageManager.set(STORAGE_KEYS.FAVORITES, favorites)
  },

  async setFavoritesSync(favorites: string[]): Promise<void> {
    await storageManager.setSync(STORAGE_KEYS.FAVORITES, favorites)
  },

  // Discourse domains management
  async getDiscourseDomains(): Promise<Array<{ domain: string; enabledGroups: string[] }>> {
    const domains = await storageManager.get(STORAGE_KEYS.DISCOURSE_DOMAINS)
    return Array.isArray(domains) ? domains : []
  },

  async getDiscourseDomain(
    domain: string
  ): Promise<{ domain: string; enabledGroups: string[] } | null> {
    const domains = await this.getDiscourseDomains()
    return domains.find(d => d.domain === domain) || null
  },

  async setDiscourseDomains(
    domains: Array<{ domain: string; enabledGroups: string[] }>
  ): Promise<void> {
    await storageManager.set(STORAGE_KEYS.DISCOURSE_DOMAINS, domains)
  },

  async setDiscourseDomain(domain: string, enabledGroups: string[]): Promise<void> {
    const domains = await this.getDiscourseDomains()
    const idx = domains.findIndex(d => d.domain === domain)
    const entry = { domain, enabledGroups }
    if (idx >= 0) domains[idx] = entry
    else domains.push(entry)
    await this.setDiscourseDomains(domains)
  },

  async removeDiscourseDomain(domain: string): Promise<void> {
    const domains = await this.getDiscourseDomains()
    const filtered = domains.filter(d => d.domain !== domain)
    await this.setDiscourseDomains(filtered)
  },

  async ensureDiscourseDomainExists(
    domain: string
  ): Promise<{ domain: string; enabledGroups: string[] }> {
    const existing = await this.getDiscourseDomain(domain)
    if (existing) return existing

    const entry = { domain, enabledGroups: [] }
    const domains = await this.getDiscourseDomains()
    domains.push(entry)
    await this.setDiscourseDomains(domains)
    return entry
  },

  // Sync operations with chunked storage
  async backupToSync(
    groups: EmojiGroup[],
    settings: AppSettings,
    favorites: string[]
  ): Promise<void> {
    const chromeAPI = getChromeAPI()
    if (!chromeAPI?.storage?.sync) {
      throw new Error('Chrome Sync Storage API not available')
    }

    const CHUNK_SIZE = 6000
    const timestamp = Date.now()
    const version = '3.0'

    await this.clearSyncBackupChunks()

    const chunks: Record<string, unknown> = {}

    const createChunks = (data: unknown[], prefix: string) => {
      const dataStr = JSON.stringify(data)
      const totalSize = new Blob([dataStr]).size

      if (totalSize <= CHUNK_SIZE) {
        chunks[`${SYNC_STORAGE_KEYS.BACKUP}_${prefix}`] = data
        return { chunkCount: 1, totalItems: data.length }
      } else {
        const estimatedChunks = Math.ceil(totalSize / CHUNK_SIZE)
        const itemsPerChunk = Math.ceil(data.length / estimatedChunks)
        let actualChunks = 0

        for (let i = 0; i < data.length; i += itemsPerChunk) {
          const chunkData = data.slice(i, i + itemsPerChunk)
          const chunkStr = JSON.stringify(chunkData)
          const chunkSize = new Blob([chunkStr]).size

          if (chunkSize <= CHUNK_SIZE) {
            chunks[`${SYNC_STORAGE_KEYS.BACKUP}_${prefix}_${actualChunks}`] = chunkData
            actualChunks++
          } else {
            const smallerChunks = Math.ceil(chunkData.length / 2)
            for (let j = 0; j < chunkData.length; j += smallerChunks) {
              chunks[`${SYNC_STORAGE_KEYS.BACKUP}_${prefix}_${actualChunks}`] = chunkData.slice(
                j,
                j + smallerChunks
              )
              actualChunks++
            }
          }
        }

        return { chunkCount: actualChunks, totalItems: data.length }
      }
    }

    let groupsMeta = null
    if (groups.length > 0) {
      groupsMeta = createChunks(groups, 'groups')
    }

    let favoritesMeta = null
    if (favorites.length > 0) {
      favoritesMeta = createChunks(favorites, 'favorites')
    }

    chunks[`${SYNC_STORAGE_KEYS.BACKUP}_meta`] = {
      timestamp,
      version,
      groups: groupsMeta,
      favorites: favoritesMeta,
      settings
    }

    return new Promise((resolve, reject) => {
      chromeAPI.storage.sync.set(chunks, () => {
        if (chromeAPI.runtime.lastError) {
          reject(
            new Error(
              `Chrome sync failed: ${chromeAPI.runtime.lastError.message || 'Unknown error'}`
            )
          )
        } else {
          resolve()
        }
      })
    })
  },

  async clearSyncBackupChunks(): Promise<void> {
    const chromeAPI = getChromeAPI()
    if (!chromeAPI?.storage?.sync) return

    return new Promise(resolve => {
      chromeAPI.storage.sync.get(null, (allData: Record<string, unknown>) => {
        if (chromeAPI.runtime.lastError) {
          resolve()
          return
        }

        const keysToRemove = Object.keys(allData || {}).filter(key =>
          key.startsWith(SYNC_STORAGE_KEYS.BACKUP)
        )

        if (keysToRemove.length > 0) {
          chromeAPI.storage.sync.remove(keysToRemove, () => {
            resolve()
          })
        } else {
          resolve()
        }
      })
    })
  },

  async restoreFromSync(): Promise<{
    groups?: EmojiGroup[]
    settings?: AppSettings
    favorites?: string[]
    timestamp?: number
  } | null> {
    const chromeAPI = getChromeAPI()
    if (!chromeAPI?.storage?.sync) {
      return null
    }

    return new Promise(resolve => {
      try {
        chromeAPI.storage.sync.get(
          `${SYNC_STORAGE_KEYS.BACKUP}_meta`,
          async (metaResult: Record<string, unknown>) => {
            if (chromeAPI.runtime.lastError) {
              resolve(null)
              return
            }

            const meta = metaResult[`${SYNC_STORAGE_KEYS.BACKUP}_meta`] as
              | {
                  timestamp?: number
                  settings?: AppSettings
                  groups?: { chunkCount: number; totalItems: number }
                  favorites?: { chunkCount: number; totalItems: number }
                }
              | null
              | undefined
            if (!meta) {
              // Try old format
              chromeAPI.storage.sync.get(
                { [SYNC_STORAGE_KEYS.BACKUP]: null },
                async (oldResult: Record<string, unknown>) => {
                  if (chromeAPI.runtime.lastError) {
                    resolve(null)
                    return
                  }

                  const backup = oldResult[SYNC_STORAGE_KEYS.BACKUP] as
                    | {
                        groups?: EmojiGroup[]
                        settings?: AppSettings
                        favorites?: string[]
                        timestamp?: number
                      }
                    | null
                    | undefined
                  if (backup?.groups) {
                    await this.setAllEmojiGroups(backup.groups)
                    await this.setSettings(backup.settings || defaultSettings)
                    await this.setFavorites(backup.favorites || [])

                    resolve({
                      groups: backup.groups,
                      settings: backup.settings || defaultSettings,
                      favorites: backup.favorites || [],
                      timestamp: backup.timestamp || 0
                    })
                  } else {
                    resolve(null)
                  }
                }
              )
              return
            }

            try {
              const restoredData: {
                timestamp: number
                settings: AppSettings
                groups: EmojiGroup[]
                favorites: string[]
              } = {
                timestamp: meta.timestamp as number,
                settings: (meta.settings as AppSettings) || defaultSettings,
                groups: [],
                favorites: []
              }

              if (meta.groups) {
                restoredData.groups = (await this.restoreChunkedData(
                  'groups',
                  meta.groups
                )) as EmojiGroup[]
              } else {
                restoredData.groups = []
              }

              if (meta.favorites) {
                restoredData.favorites = (await this.restoreChunkedData(
                  'favorites',
                  meta.favorites
                )) as string[]
              } else {
                restoredData.favorites = []
              }

              await this.setAllEmojiGroups(restoredData.groups)
              await this.setSettings(restoredData.settings)
              await this.setFavorites(restoredData.favorites)

              resolve(restoredData)
            } catch {
              resolve(null)
            }
          }
        )
      } catch {
        resolve(null)
      }
    })
  },

  async restoreChunkedData(
    prefix: string,
    meta: { chunkCount: number; totalItems: number }
  ): Promise<unknown[]> {
    const chromeAPI = getChromeAPI()
    if (!chromeAPI?.storage?.sync) {
      throw new Error('Chrome Sync Storage API not available')
    }

    return new Promise((resolve, reject) => {
      if (meta.chunkCount === 1) {
        chromeAPI.storage.sync.get(
          `${SYNC_STORAGE_KEYS.BACKUP}_${prefix}`,
          (result: Record<string, unknown>) => {
            if (chromeAPI.runtime.lastError) {
              reject(chromeAPI.runtime.lastError)
            } else {
              const data = result[`${SYNC_STORAGE_KEYS.BACKUP}_${prefix}`]
              resolve(Array.isArray(data) ? data : [])
            }
          }
        )
      } else {
        const chunkKeys = []
        for (let i = 0; i < meta.chunkCount; i++) {
          chunkKeys.push(`${SYNC_STORAGE_KEYS.BACKUP}_${prefix}_${i}`)
        }

        chromeAPI.storage.sync.get(chunkKeys, (result: Record<string, unknown>) => {
          if (chromeAPI.runtime.lastError) {
            reject(chromeAPI.runtime.lastError)
          } else {
            const combinedData: unknown[] = []
            for (let i = 0; i < meta.chunkCount; i++) {
              const chunkData = result[`${SYNC_STORAGE_KEYS.BACKUP}_${prefix}_${i}`]
              if (Array.isArray(chunkData)) {
                combinedData.push(...chunkData)
              }
            }
            resolve(combinedData)
          }
        })
      }
    })
  },

  async resetToDefaults(): Promise<void> {
    try {
      const packaged = await loadPackagedDefaults()
      await this.setAllEmojiGroups(packaged?.groups?.length ? packaged.groups : [])
    } catch {
      await this.setAllEmojiGroups([])
    }
    await this.setSettings(defaultSettings)
    await this.setFavorites([])
  },

  // --- 归档相关方法 ---

  // 获取已归档分组 ID 列表
  async getArchivedGroupIds(): Promise<string[]> {
    const ids = await storageManager.get(STORAGE_KEYS.ARCHIVED_GROUPS)
    return Array.isArray(ids) ? ids : []
  },

  // 设置已归档分组 ID 列表
  async setArchivedGroupIds(ids: string[]): Promise<void> {
    await storageManager.set(STORAGE_KEYS.ARCHIVED_GROUPS, ids)
  },

  // 归档分组：将分组移动到 IndexedDB
  async archiveGroup(group: EmojiGroup): Promise<void> {
    const db = await getArchiveDb()
    const cleanGroup = ensureSerializable(group)

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ARCHIVE_STORE_NAME], 'readwrite')
      const store = transaction.objectStore(ARCHIVE_STORE_NAME)
      const request = store.put(cleanGroup)

      request.onsuccess = async () => {
        // 添加到归档列表
        const archivedIds = await this.getArchivedGroupIds()
        if (!archivedIds.includes(group.id)) {
          archivedIds.push(group.id)
          await this.setArchivedGroupIds(archivedIds)
        }
        // 从主存储删除
        await this.removeEmojiGroup(group.id)
        resolve()
      }

      request.onerror = () => {
        reject(new Error('Failed to archive group'))
      }
    })
  },

  // 取消归档：将分组从 IndexedDB 恢复到主存储
  async unarchiveGroup(groupId: string): Promise<EmojiGroup | null> {
    const db = await getArchiveDb()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ARCHIVE_STORE_NAME], 'readwrite')
      const store = transaction.objectStore(ARCHIVE_STORE_NAME)
      const getRequest = store.get(groupId)

      getRequest.onsuccess = async () => {
        const group = getRequest.result as EmojiGroup | undefined
        if (!group) {
          resolve(null)
          return
        }

        // 从 IndexedDB 删除
        const deleteRequest = store.delete(groupId)
        deleteRequest.onsuccess = async () => {
          // 从归档列表移除
          const archivedIds = await this.getArchivedGroupIds()
          const newIds = archivedIds.filter(id => id !== groupId)
          await this.setArchivedGroupIds(newIds)

          // 添加到主存储
          const index = await this.getEmojiGroupIndex()
          index.push({ id: group.id, order: index.length })
          await this.setEmojiGroupIndex(index)
          await this.setEmojiGroup(group.id, group)

          resolve(group)
        }

        deleteRequest.onerror = () => {
          reject(new Error('Failed to delete from archive'))
        }
      }

      getRequest.onerror = () => {
        reject(new Error('Failed to get archived group'))
      }
    })
  },

  // 获取单个归档分组
  async getArchivedGroup(groupId: string): Promise<EmojiGroup | null> {
    const db = await getArchiveDb()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ARCHIVE_STORE_NAME], 'readonly')
      const store = transaction.objectStore(ARCHIVE_STORE_NAME)
      const request = store.get(groupId)

      request.onsuccess = () => {
        resolve(request.result as EmojiGroup | null)
      }

      request.onerror = () => {
        reject(new Error('Failed to get archived group'))
      }
    })
  },

  // 获取所有归档分组
  async getAllArchivedGroups(): Promise<EmojiGroup[]> {
    const db = await getArchiveDb()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ARCHIVE_STORE_NAME], 'readonly')
      const store = transaction.objectStore(ARCHIVE_STORE_NAME)
      const request = store.getAll()

      request.onsuccess = () => {
        resolve(request.result as EmojiGroup[])
      }

      request.onerror = () => {
        reject(new Error('Failed to get all archived groups'))
      }
    })
  },

  // 删除归档分组
  async deleteArchivedGroup(groupId: string): Promise<void> {
    const db = await getArchiveDb()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ARCHIVE_STORE_NAME], 'readwrite')
      const store = transaction.objectStore(ARCHIVE_STORE_NAME)
      const request = store.delete(groupId)

      request.onsuccess = async () => {
        // 从归档列表移除
        const archivedIds = await this.getArchivedGroupIds()
        const newIds = archivedIds.filter(id => id !== groupId)
        await this.setArchivedGroupIds(newIds)
        resolve()
      }

      request.onerror = () => {
        reject(new Error('Failed to delete archived group'))
      }
    })
  }
}

// Export the storage manager instance for advanced usage
export { storageManager }
