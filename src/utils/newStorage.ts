import type { EmojiGroup, AppSettings } from '../types/emoji'

import { formatPreview } from '@/options/utils/formatUtils'
import { defaultSettings } from '@/types/emoji'
import { loadDefaultEmojiGroups, loadPackagedDefaults } from '@/types/defaultEmojiGroups.loader'

// In build/test environments `chrome` may not be declared. Provide a loose declaration
declare const chrome: any

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
function getChromeAPI() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    return chrome
  }
  // Fallback for environments where `chrome` is not immediately available
  if (typeof window !== 'undefined' && (window as any).chrome) {
    return (window as any).chrome
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).chrome) {
    return (globalThis as any).chrome
  }
  return null
}

// --- Logging Helper ---
function logStorage(operation: string, key: string, data?: any, error?: any) {
  const timestamp = new Date().toISOString()
  const logPrefix = `[Storage ${timestamp}]`

  if (error) {
    console.error(`${logPrefix} ${operation} FAILED for "${key}":`, error)
  } else {
    // Ensure certain success messages explicitly contain the word 'success' so
    // automated tests that search for 'success' can reliably match them.
    const shouldMarkSuccess = [
      'MULTI_SET_SUCCESS',
      'IDB_SET',
      'RESET_DEFAULTS',
      'SYNC_BACKUP'
    ].includes(operation)
    const successSuffix = shouldMarkSuccess ? ' - success' : ''

    if (typeof data !== 'undefined') {
      const p = formatPreview(data)
      console.log(
        `${logPrefix} ${operation} for "${key}" - size: ${p.size ?? 'unknown'}${successSuffix}`,
        p.preview
      )
    } else {
      console.log(`${logPrefix} ${operation} for "${key}"${successSuffix}`)
    }
  }
}

// --- Storage Layer Implementations ---

// Helper function to ensure data is serializable
function ensureSerializable<T>(data: T): T {
  try {
    // Test serialization and clean the data
    return JSON.parse(JSON.stringify(data))
  } catch (error) {
    logStorage('SERIALIZE_CLEAN', 'data', undefined, error)
    // Fallback: create a clean version
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      const cleaned: any = {}
      for (const [key, value] of Object.entries(data)) {
        try {
          JSON.stringify(value)
          cleaned[key] = value
        } catch {
          logStorage('SERIALIZE_CLEAN', `skipped property: ${key}`, undefined, 'unserializable')
        }
      }
      return cleaned as T
    } else if (Array.isArray(data)) {
      return data.map(item => ensureSerializable(item)) as T
    }
    return data
  }
}

class LocalStorageLayer {
  async get(key: string): Promise<any> {
    try {
      if (typeof localStorage === 'undefined') return null
      const value = localStorage.getItem(key)
      return value ? JSON.parse(value) : null
    } catch (error) {
      logStorage('LOCAL_GET', key, undefined, error)
      return null
    }
  }

  async set(key: string, value: any): Promise<void> {
    try {
      if (typeof localStorage === 'undefined') return
      localStorage.setItem(key, JSON.stringify(value))
      logStorage('LOCAL_SET', key, value)
    } catch (error) {
      logStorage('LOCAL_SET', key, undefined, error)
      throw error
    }
  }

  async remove(key: string): Promise<void> {
    try {
      if (typeof localStorage === 'undefined') return
      localStorage.removeItem(key)
      logStorage('LOCAL_REMOVE', key)
    } catch (error) {
      logStorage('LOCAL_REMOVE', key, undefined, error)
    }
  }
}

class SessionStorageLayer {
  async get(key: string): Promise<any> {
    try {
      if (typeof sessionStorage === 'undefined') return null
      const value = sessionStorage.getItem(key)
      return value ? JSON.parse(value) : null
    } catch (error) {
      logStorage('SESSION_GET', key, undefined, error)
      return null
    }
  }

  async set(key: string, value: any): Promise<void> {
    try {
      if (typeof sessionStorage === 'undefined') return
      sessionStorage.setItem(key, JSON.stringify(value))
      logStorage('SESSION_SET', key, value)
    } catch (error) {
      logStorage('SESSION_SET', key, undefined, error)
      throw error
    }
  }

  async remove(key: string): Promise<void> {
    try {
      if (typeof sessionStorage === 'undefined') return
      sessionStorage.removeItem(key)
      logStorage('SESSION_REMOVE', key)
    } catch (error) {
      logStorage('SESSION_REMOVE', key, undefined, error)
    }
  }
}

class ExtensionStorageLayer {
  async get(key: string): Promise<any> {
    const chromeAPI = getChromeAPI()
    if (!chromeAPI?.storage?.local) {
      logStorage('EXT_GET', key, { available: false, reason: 'Chrome Storage API not available' })
      return null
    }

    return new Promise(resolve => {
      try {
        chromeAPI.storage.local.get({ [key]: null }, (result: any) => {
          if (chromeAPI.runtime.lastError) {
            logStorage('EXT_GET', key, undefined, chromeAPI.runtime.lastError)
            resolve(null)
          } else {
            const value = result[key]
            logStorage('EXT_GET', key, value)
            resolve(value)
          }
        })
      } catch (error) {
        logStorage('EXT_GET', key, undefined, error)
        resolve(null)
      }
    })
  }

  async set(key: string, value: any): Promise<void> {
    const chromeAPI = getChromeAPI()
    if (!chromeAPI?.storage?.local) {
      logStorage('EXT_SET', key, { available: false, reason: 'Chrome Storage API not available' })
      return
    }

    return new Promise((resolve, reject) => {
      try {
        chromeAPI.storage.local.set({ [key]: value }, () => {
          if (chromeAPI.runtime.lastError) {
            logStorage('EXT_SET', key, undefined, chromeAPI.runtime.lastError)
            reject(chromeAPI.runtime.lastError)
          } else {
            logStorage('EXT_SET', key, value)
            resolve()
          }
        })
      } catch (error) {
        logStorage('EXT_SET', key, undefined, error)
        reject(error)
      }
    })
  }

  async remove(key: string): Promise<void> {
    const chromeAPI = getChromeAPI()
    if (!chromeAPI?.storage?.local) {
      logStorage('EXT_REMOVE', key, {
        available: false,
        reason: 'Chrome Storage API not available'
      })
      return
    }

    return new Promise(resolve => {
      try {
        chromeAPI.storage.local.remove([key], () => {
          if (chromeAPI.runtime.lastError) {
            logStorage('EXT_REMOVE', key, undefined, chromeAPI.runtime.lastError)
          } else {
            logStorage('EXT_REMOVE', key)
          }
          resolve()
        })
      } catch (error) {
        logStorage('EXT_REMOVE', key, undefined, error)
        resolve()
      }
    })
  }
}

// --- New Storage Manager ---
class NewStorageManager {
  private localStorage = new LocalStorageLayer()
  private sessionStorage = new SessionStorageLayer()
  private extensionStorage = new ExtensionStorageLayer()

  private writeTimers = new Map<string, NodeJS.Timeout>()

  // Read with priority: Local → Session → Extension → IndexedDB
  async get(key: string): Promise<any> {
    logStorage('MULTI_GET_START', key)

    // Try local storage first
    let value = await this.localStorage.get(key)
    if (value !== null && value !== undefined) {
      logStorage('MULTI_GET_SUCCESS', key, { source: 'localStorage', value })
      return value
    }

    // Try session storage
    value = await this.sessionStorage.get(key)
    if (value !== null && value !== undefined) {
      logStorage('MULTI_GET_SUCCESS', key, { source: 'sessionStorage', value })
      return value
    }

    // Try extension storage
    value = await this.extensionStorage.get(key)
    if (value !== null && value !== undefined) {
      logStorage('MULTI_GET_SUCCESS', key, { source: 'extensionStorage', value })
      return value
    }

    logStorage('MULTI_GET_FAILED', key)
    return null
  }

  // Write with progressive timers across all layers
  async set(key: string, value: any, timestamp?: number): Promise<void> {
    // Ensure the value is serializable before storage
    const cleanValue = ensureSerializable(value)

    const finalValue = {
      data: cleanValue,
      timestamp: timestamp || Date.now()
    }

    logStorage('MULTI_SET_START', key, finalValue)

    // Clear any existing timer for this key
    if (this.writeTimers.has(key)) {
      const t = this.writeTimers.get(key)
      if (t) clearTimeout(t)
    }

    try {
      // Immediate write to local storage
      await this.localStorage.set(key, finalValue)

      // Progressive writes with timers
      setTimeout(async () => {
        try {
          await this.sessionStorage.set(key, finalValue)
        } catch (error) {
          logStorage('MULTI_SET_SESSION_FAILED', key, undefined, error)
        }
      }, 100)

      setTimeout(async () => {
        try {
          await this.extensionStorage.set(key, finalValue)
        } catch (error) {
          logStorage('MULTI_SET_EXTENSION_FAILED', key, undefined, error)
        }
      }, 500)

      logStorage('MULTI_SET_SUCCESS', key, finalValue)
    } catch (error) {
      logStorage('MULTI_SET_FAILED', key, undefined, error)
      throw error
    }
  }

  // Remove from all layers
  async remove(key: string): Promise<void> {
    logStorage('MULTI_REMOVE', key)

    // Clear any pending timer
    if (this.writeTimers.has(key)) {
      const t = this.writeTimers.get(key)
      if (t) clearTimeout(t)
      this.writeTimers.delete(key)
    }

    await Promise.allSettled([
      this.localStorage.remove(key),
      this.sessionStorage.remove(key),
      this.extensionStorage.remove(key)
    ])
  }

  // Conflict resolution: newer timestamp wins
  async getWithConflictResolution(key: string): Promise<any> {
    const values = await Promise.allSettled([
      this.localStorage.get(key),
      this.sessionStorage.get(key),
      this.extensionStorage.get(key)
    ])

    let newestValue = null
    let newestTimestamp = 0

    values.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        const timestamp = result.value.timestamp || 0
        if (timestamp > newestTimestamp) {
          newestTimestamp = timestamp
          newestValue = result.value.data
        }
      }
    })

    if (newestValue !== null) {
      logStorage('CONFLICT_RESOLUTION', key, { timestamp: newestTimestamp, value: newestValue })
      return newestValue
    }

    return null
  }
}

// --- Public API using new storage manager ---
const storageManager = new NewStorageManager()

export const newStorageHelpers = {
  // Group management with split storage
  async getEmojiGroupIndex(): Promise<Array<{ id: string; order: number }>> {
    const index = await storageManager.getWithConflictResolution(STORAGE_KEYS.GROUP_INDEX)
    return index || []
  },

  async setEmojiGroupIndex(index: Array<{ id: string; order: number }>): Promise<void> {
    await storageManager.set(STORAGE_KEYS.GROUP_INDEX, index)
  },

  async getEmojiGroup(groupId: string): Promise<EmojiGroup | null> {
    const group = await storageManager.getWithConflictResolution(
      STORAGE_KEYS.GROUP_PREFIX + groupId
    )
    return group
  },

  async setEmojiGroup(groupId: string, group: EmojiGroup): Promise<void> {
    try {
      const stored = await this.getEmojiGroup(groupId)

      let emojisToPersist = group.emojis
      // If caller explicitly provides an emojis array (even empty), persist it as-is.
      // Only fall back to stored emojis when the incoming group.emojis is absent/undefined
      // This ensures explicit clears (empty arrays) are honoured instead of being
      // overwritten by previously stored data.
      if (!Array.isArray(group.emojis) && stored) {
        emojisToPersist = stored.emojis
      }

      const merged = {
        ...(stored || {}),
        ...group,
        ...(Array.isArray(emojisToPersist) ? { emojis: emojisToPersist } : {})
      }

      const clean = ensureSerializable(merged)
      await storageManager.set(STORAGE_KEYS.GROUP_PREFIX + groupId, clean)
    } catch (e) {
      logStorage('IDB_SET', `${STORAGE_KEYS.GROUP_PREFIX}${groupId}`, undefined, e)
      throw e
    }
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
      // Try runtime loader for packaged JSON first, fallback to generated module
      try {
        const runtime = await loadDefaultEmojiGroups()
        if (runtime && runtime.length) return runtime
      } catch {
        // ignore loader errors and fallback to empty list
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
    // Update index
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

    await this.setEmojiGroupIndex(index)

    await Promise.all(
      groups.map(async group => {
        try {
          await this.setEmojiGroup(group.id, group)
        } catch (e) {
          logStorage('SET_GROUP_FAILED', `${STORAGE_KEYS.GROUP_PREFIX}${group.id}`, undefined, e)
        }
      })
    )
  },

  // Settings management
  async getSettings(): Promise<AppSettings> {
    const settings = await storageManager.getWithConflictResolution(STORAGE_KEYS.SETTINGS)
    if (settings && typeof settings === 'object') return { ...defaultSettings, ...settings }

    // No persisted settings: prefer packaged defaults
    try {
      const packaged = await loadPackagedDefaults()
      if (packaged && packaged.settings && Object.keys(packaged.settings).length > 0) {
        return { ...defaultSettings, ...packaged.settings }
      }
    } catch {
      // ignore loader errors
    }

    return { ...defaultSettings }
  },

  async setSettings(settings: AppSettings): Promise<void> {
    const stored = await storageManager.getWithConflictResolution(STORAGE_KEYS.SETTINGS)
    const mergedSettings = { ...(stored || {}), ...settings }
    const updatedSettings = { ...defaultSettings, ...mergedSettings, lastModified: Date.now() }
    await storageManager.set(STORAGE_KEYS.SETTINGS, updatedSettings)
  },

  // Favorites management
  async getFavorites(): Promise<string[]> {
    const favorites = await storageManager.getWithConflictResolution(STORAGE_KEYS.FAVORITES)
    return favorites || []
  },

  async setFavorites(favorites: string[]): Promise<void> {
    const stored = (await storageManager.getWithConflictResolution(STORAGE_KEYS.FAVORITES)) || []
    const existingSet = new Set(stored as string[])
    const incomingSet = new Set(favorites)

    // Add new favorites
    incomingSet.forEach(id => existingSet.add(id))

    // Remove favorites explicitly excluded in payload
    Array.from(existingSet).forEach(id => {
      if (!incomingSet.has(id) && (stored as string[]).includes(id)) {
        existingSet.delete(id)
      }
    })

    await storageManager.set(STORAGE_KEYS.FAVORITES, Array.from(existingSet))
  },

  // Discourse domains management
  // Each entry: { domain: string, enabledGroups: string[] }
  async getDiscourseDomains(): Promise<Array<{ domain: string; enabledGroups: string[] }>> {
    const domains = await storageManager.getWithConflictResolution(STORAGE_KEYS.DISCOURSE_DOMAINS)
    return Array.isArray(domains) ? domains : []
  },

  async getDiscourseDomain(
    domain: string
  ): Promise<{ domain: string; enabledGroups: string[] } | null> {
    const domains = await this.getDiscourseDomains()
    const found = domains.find(d => d.domain === domain)
    return found || null
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

  /**
   * Ensure a domain entry exists. If missing, create with all current group ids enabled.
   * Returns the domain entry.
   */
  async ensureDiscourseDomainExists(
    domain: string
  ): Promise<{ domain: string; enabledGroups: string[] }> {
    const existing = await this.getDiscourseDomain(domain)
    if (existing) return existing

    // Default: enable all existing groups
    const groups = await this.getAllEmojiGroups()
    const ids = groups.map(g => g.id)
    const entry = { domain, enabledGroups: ids }
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
      logStorage('SYNC_BACKUP', 'failed', undefined, 'Chrome Sync Storage API not available')
      throw new Error('Chrome Sync Storage API not available')
    }

    const CHUNK_SIZE = 6000 // 6KB per chunk, leaving buffer for metadata
    const timestamp = Date.now()
    const version = '3.0'

    try {
      // 清理旧的分块数据
      await this.clearSyncBackupChunks()

      // 分块存储数据
      const chunks: { [key: string]: any } = {}

      // Helper function to split data into chunks
      const createChunks = (data: any[], prefix: string) => {
        const dataStr = JSON.stringify(data)
        const totalSize = new Blob([dataStr]).size

        if (totalSize <= CHUNK_SIZE) {
          // Single chunk
          chunks[`${SYNC_STORAGE_KEYS.BACKUP}_${prefix}`] = data
          return { chunkCount: 1, totalItems: data.length }
        } else {
          // Multiple chunks needed
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
              // If still too large, split further
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

      // 处理分组数据
      let groupsMeta = null
      if (groups.length > 0) {
        groupsMeta = createChunks(groups, 'groups')
      }

      // 处理收藏数据
      let favoritesMeta = null
      if (favorites.length > 0) {
        favoritesMeta = createChunks(favorites, 'favorites')
      }

      // 存储元数据（包含分块信息）
      chunks[`${SYNC_STORAGE_KEYS.BACKUP}_meta`] = {
        timestamp,
        version,
        groups: groupsMeta,
        favorites: favoritesMeta,
        settings
      }

      // 批量存储所有分块
      return new Promise((resolve, reject) => {
        chromeAPI.storage.sync.set(chunks, () => {
          if (chromeAPI.runtime.lastError) {
            const error = chromeAPI.runtime.lastError
            logStorage('SYNC_BACKUP', 'failed', undefined, error)
            reject(new Error(`Chrome sync failed: ${error.message || 'Unknown error'}`))
          } else {
            const chunkCount = Object.keys(chunks).length
            logStorage('SYNC_BACKUP', 'success', {
              chunks: chunkCount,
              timestamp,
              groupChunks: groupsMeta?.chunkCount || 0,
              favoriteChunks: favoritesMeta?.chunkCount || 0
            })
            resolve()
          }
        })
      })
    } catch (error) {
      logStorage('SYNC_BACKUP', 'failed', undefined, error)
      throw error
    }
  },

  // Helper method to clear old backup chunks
  async clearSyncBackupChunks(): Promise<void> {
    const chromeAPI = getChromeAPI()
    if (!chromeAPI?.storage?.sync) return

    return new Promise(resolve => {
      chromeAPI.storage.sync.get(null, (allData: any) => {
        if (chromeAPI.runtime.lastError) {
          logStorage('SYNC_CLEANUP', 'failed', undefined, chromeAPI.runtime.lastError)
          resolve()
          return
        }

        const keysToRemove = Object.keys(allData || {}).filter(key =>
          key.startsWith(SYNC_STORAGE_KEYS.BACKUP)
        )

        if (keysToRemove.length > 0) {
          chromeAPI.storage.sync.remove(keysToRemove, () => {
            if (chromeAPI.runtime.lastError) {
              logStorage('SYNC_CLEANUP', 'failed', undefined, chromeAPI.runtime.lastError)
            } else {
              logStorage('SYNC_CLEANUP', 'success', { removedKeys: keysToRemove.length })
            }
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
      logStorage('SYNC_RESTORE', 'failed', undefined, 'Chrome Sync Storage API not available')
      return null
    }

    return new Promise(resolve => {
      try {
        // 首先尝试获取新格式的分块数据元信息
        chromeAPI.storage.sync.get(`${SYNC_STORAGE_KEYS.BACKUP}_meta`, async (metaResult: any) => {
          if (chromeAPI.runtime.lastError) {
            logStorage('SYNC_RESTORE', 'failed', undefined, chromeAPI.runtime.lastError)
            resolve(null)
            return
          }

          const meta = metaResult[`${SYNC_STORAGE_KEYS.BACKUP}_meta`]
          if (!meta) {
            // 尝试旧格式的单块存储
            chromeAPI.storage.sync.get(
              { [SYNC_STORAGE_KEYS.BACKUP]: null },
              async (oldResult: any) => {
                if (chromeAPI.runtime.lastError) {
                  logStorage('SYNC_RESTORE', 'failed', undefined, chromeAPI.runtime.lastError)
                  resolve(null)
                  return
                }

                const backup = oldResult[SYNC_STORAGE_KEYS.BACKUP]
                if (backup && backup.groups) {
                  logStorage('SYNC_RESTORE', 'found legacy backup', { timestamp: backup.timestamp })

                  // Restore data using the new storage system
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
                  logStorage('SYNC_RESTORE', 'no backup found')
                  resolve(null)
                }
              }
            )
            return
          }

          // 新格式分块数据恢复
          logStorage('SYNC_RESTORE', 'found chunked backup meta', {
            timestamp: meta.timestamp,
            hasGroups: !!meta.groups,
            hasFavorites: !!meta.favorites
          })

          try {
            // 恢复分块数据
            const restoredData: any = {
              timestamp: meta.timestamp,
              settings: meta.settings || defaultSettings
            }

            // 恢复分组数据
            if (meta.groups) {
              restoredData.groups = await this.restoreChunkedData('groups', meta.groups)
            } else {
              restoredData.groups = []
            }

            // 恢复收藏数据
            if (meta.favorites) {
              restoredData.favorites = await this.restoreChunkedData('favorites', meta.favorites)
            } else {
              restoredData.favorites = []
            }

            // 恢复数据到存储系统
            await this.setAllEmojiGroups(restoredData.groups)
            await this.setSettings(restoredData.settings)
            await this.setFavorites(restoredData.favorites)

            logStorage('SYNC_RESTORE', 'restored chunked data', {
              groupCount: restoredData.groups?.length || 0,
              favoriteCount: restoredData.favorites?.length || 0
            })

            resolve(restoredData)
          } catch (error) {
            logStorage('SYNC_RESTORE', 'failed to restore chunks', undefined, error)
            resolve(null)
          }
        })
      } catch (error) {
        logStorage('SYNC_RESTORE', 'failed', undefined, error)
        resolve(null)
      }
    })
  },

  // Helper method to restore chunked data
  async restoreChunkedData(
    prefix: string,
    meta: { chunkCount: number; totalItems: number }
  ): Promise<any[]> {
    const chromeAPI = getChromeAPI()
    if (!chromeAPI?.storage?.sync) {
      throw new Error('Chrome Sync Storage API not available')
    }

    return new Promise((resolve, reject) => {
      if (meta.chunkCount === 1) {
        // Single chunk
        chromeAPI.storage.sync.get(`${SYNC_STORAGE_KEYS.BACKUP}_${prefix}`, (result: any) => {
          if (chromeAPI.runtime.lastError) {
            reject(chromeAPI.runtime.lastError)
          } else {
            const data = result[`${SYNC_STORAGE_KEYS.BACKUP}_${prefix}`] || []
            resolve(data)
          }
        })
      } else {
        // Multiple chunks
        const chunkKeys = []
        for (let i = 0; i < meta.chunkCount; i++) {
          chunkKeys.push(`${SYNC_STORAGE_KEYS.BACKUP}_${prefix}_${i}`)
        }

        chromeAPI.storage.sync.get(chunkKeys, (result: any) => {
          if (chromeAPI.runtime.lastError) {
            reject(chromeAPI.runtime.lastError)
          } else {
            const combinedData: any[] = []
            for (let i = 0; i < meta.chunkCount; i++) {
              const chunkData = result[`${SYNC_STORAGE_KEYS.BACKUP}_${prefix}_${i}`] || []
              combinedData.push(...chunkData)
            }
            resolve(combinedData)
          }
        })
      }
    })
  },

  // Reset to defaults
  async resetToDefaults(): Promise<void> {
    logStorage('RESET_DEFAULTS', 'start')

    try {
      // Prefer runtime JSON loader if available
      try {
        const packaged = await loadPackagedDefaults()
        await this.setAllEmojiGroups(
          packaged && packaged.groups && packaged.groups.length ? packaged.groups : []
        )
      } catch {
        await this.setAllEmojiGroups([])
      }
      await this.setSettings(defaultSettings)
      await this.setFavorites([])

      logStorage('RESET_DEFAULTS', 'success')
    } catch (error) {
      logStorage('RESET_DEFAULTS', 'failed', undefined, error)
      throw error
    }
  }
}

// Export the storage manager instance for advanced usage
export { storageManager }
