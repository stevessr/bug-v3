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
  // Discourse domain configuration: stores array of { domain: string, enabledGroups: string[] }
  DISCOURSE_DOMAINS: 'discourseDomains'
} as const

export const SYNC_STORAGE_KEYS = {
  BACKUP: 'emojiExtensionBackup'
} as const

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
function ensureSerializable<T>(data: T): T {
  if (data === null || data === undefined) return data

  // 基础类型直接返回
  const type = typeof data
  if (type === 'string' || type === 'number' || type === 'boolean') {
    return data
  }

  try {
    // Strip Vue reactive proxy first
    const raw = toRaw(data)

    // Handle Set - convert to array
    if (raw instanceof Set) {
      return Array.from(raw).map(item => ensureSerializable(item)) as T
    }

    // Handle Map - convert to array of [key, value] pairs
    if (raw instanceof Map) {
      return Array.from(raw.entries()).map(([k, v]) => [
        ensureSerializable(k),
        ensureSerializable(v)
      ]) as T
    }

    // For arrays with reactive elements, we need to process recursively
    if (Array.isArray(raw)) {
      return raw.map(item => ensureSerializable(item)) as T
    }

    // For plain objects, recursively process to handle nested reactivity
    if (typeof raw === 'object' && raw !== null) {
      const result: Record<string, unknown> = {}
      for (const key of Object.keys(raw)) {
        result[key] = ensureSerializable((raw as Record<string, unknown>)[key])
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

// --- Simple Storage Manager ---
// 直接写入 localStorage，异步写入 extension storage
class SimpleStorageManager {
  // 直接读取 - 优先 localStorage，回退到 extension storage
  async get(key: string): Promise<unknown> {
    // 先尝试 localStorage
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

  // 直接写入 localStorage，异步写入 extension storage
  async set(key: string, value: unknown): Promise<void> {
    const cleanValue = ensureSerializable(value)
    const finalValue = {
      data: cleanValue,
      timestamp: Date.now()
    }

    // 直接写入 localStorage（同步）
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(finalValue))
      }
    } catch (error) {
      console.error('[Storage] localStorage.set failed:', key, error)
    }

    // 异步写入 extension storage（不等待）
    const chromeAPI = getChromeAPI()
    if (chromeAPI?.storage?.local) {
      chromeAPI.storage.local.set({ [key]: finalValue }, () => {
        if (chromeAPI.runtime.lastError) {
          console.error('[Storage] extensionStorage.set failed:', key, chromeAPI.runtime.lastError)
        }
      })
    }
  }

  // 同步写入所有存储层（等待 extension storage 完成）
  async setSync(key: string, value: unknown): Promise<void> {
    const cleanValue = ensureSerializable(value)
    const finalValue = {
      data: cleanValue,
      timestamp: Date.now()
    }

    // 写入 localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(finalValue))
      }
    } catch (error) {
      console.error('[Storage] localStorage.set failed:', key, error)
    }

    // 同步等待 extension storage 完成
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

    // 异步删除 extension storage
    const chromeAPI = getChromeAPI()
    if (chromeAPI?.storage?.local) {
      chromeAPI.storage.local.remove([key], () => {
        // ignore errors
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
      emojis: Array.isArray(group.emojis) ? group.emojis : [],
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
      emojis: Array.isArray(group.emojis) ? group.emojis : [],
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

    await this.setEmojiGroupIndexSync(index)
    await Promise.all(groups.map(group => this.setEmojiGroupSync(group.id, group)))
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
  }
}

// Export the storage manager instance for advanced usage
export { storageManager }
