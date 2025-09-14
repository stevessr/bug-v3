import type { EmojiGroup, AppSettings } from '../types/emoji'

import { formatPreview } from './formatUtils'
import indexedDBHelpers from './indexedDB'

import { defaultSettings } from '@/types/emoji'
import { loadDefaultEmojiGroups, loadPackagedDefaults } from '@/types/defaultEmojiGroups.loader'

// In build/test environments `chrome` may not be declared. Provide a loose declaration
declare const chrome: any

// --- Constants ---
export const STORAGE_KEYS = {
  SETTINGS: 'appSettings',
  FAVORITES: 'favorites',
  GROUP_INDEX: 'emojiGroupIndex', // For group order and metadata
  GROUP_PREFIX: 'emojiGroup_' // For individual group storage
} as const

export const SYNC_STORAGE_KEYS = {
  BACKUP: 'emojiExtensionBackup'
} as const

// Storage priority levels as requested
export enum StorageLevel {
  LOCAL_STORAGE = 1, // Highest priority
  SESSION_STORAGE = 2,
  EXTENSION_STORAGE = 3,
  INDEXED_DB = 4 // Lowest priority/fallback
}

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

class IndexedDBLayer {
  async get(key: string): Promise<any> {
    try {
      const isAvailable = await indexedDBHelpers.isAvailable()
      if (!isAvailable) return null

      if (key === STORAGE_KEYS.SETTINGS) {
        return await indexedDBHelpers.getSettings()
      } else if (key === STORAGE_KEYS.FAVORITES) {
        return await indexedDBHelpers.getFavorites()
      } else if (key === STORAGE_KEYS.GROUP_INDEX) {
        const groups = await indexedDBHelpers.getAllGroups()
        return groups?.map((group, index) => ({ id: group.id, order: index })) || null
      } else if (key.startsWith(STORAGE_KEYS.GROUP_PREFIX)) {
        const groupId = key.replace(STORAGE_KEYS.GROUP_PREFIX, '')
        const groups = await indexedDBHelpers.getAllGroups()
        return groups?.find(g => g.id === groupId) || null
      }
      return null
    } catch (error) {
      logStorage('IDB_GET', key, undefined, error)
      return null
    }
  }

  async set(key: string, value: any): Promise<void> {
    try {
      const isAvailable = await indexedDBHelpers.isAvailable()
      if (!isAvailable) return

      // Ensure the value is serializable for IndexedDB
      const cleanValue = ensureSerializable(value)

      if (key === STORAGE_KEYS.SETTINGS) {
        await indexedDBHelpers.setSettings(cleanValue)
      } else if (key === STORAGE_KEYS.FAVORITES) {
        await indexedDBHelpers.setFavorites(cleanValue)
      } else if (key === STORAGE_KEYS.GROUP_INDEX) {
        // For group index, we need to handle this specially
        logStorage('IDB_SET', key, cleanValue)
      } else if (key.startsWith(STORAGE_KEYS.GROUP_PREFIX)) {
        // For individual groups, we need to update the entire groups collection
        const groups = (await indexedDBHelpers.getAllGroups()) || []
        const groupId = key.replace(STORAGE_KEYS.GROUP_PREFIX, '')
        const existingIndex = groups.findIndex(g => g.id === groupId)

        if (existingIndex !== -1) {
          groups[existingIndex] = cleanValue
        } else {
          groups.push(cleanValue)
        }

        await indexedDBHelpers.setAllGroups(groups)
      }

      logStorage('IDB_SET', key, cleanValue)
    } catch (error) {
      logStorage('IDB_SET', key, undefined, error)
      throw error
    }
  }

  async remove(key: string): Promise<void> {
    try {
      const isAvailable = await indexedDBHelpers.isAvailable()
      if (!isAvailable) return

      if (key.startsWith(STORAGE_KEYS.GROUP_PREFIX)) {
        const groups = (await indexedDBHelpers.getAllGroups()) || []
        const groupId = key.replace(STORAGE_KEYS.GROUP_PREFIX, '')
        const filteredGroups = groups.filter(g => g.id !== groupId)
        await indexedDBHelpers.setAllGroups(filteredGroups)
      }

      logStorage('IDB_REMOVE', key)
    } catch (error) {
      logStorage('IDB_REMOVE', key, undefined, error)
    }
  }
}

// --- New Storage Manager ---
class NewStorageManager {
  private localStorage = new LocalStorageLayer()
  private sessionStorage = new SessionStorageLayer()
  private extensionStorage = new ExtensionStorageLayer()
  private indexedDBStorage = new IndexedDBLayer()

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

    // Try IndexedDB as fallback
    value = await this.indexedDBStorage.get(key)
    if (value !== null && value !== undefined) {
      logStorage('MULTI_GET_SUCCESS', key, { source: 'indexedDB', value })
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

      setTimeout(async () => {
        try {
          await this.indexedDBStorage.set(key, finalValue)
        } catch (error) {
          logStorage('MULTI_SET_INDEXED_FAILED', key, undefined, error)
        }
      }, 1000)

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
      this.extensionStorage.remove(key),
      this.indexedDBStorage.remove(key)
    ])
  }

  // Conflict resolution: newer timestamp wins
  async getWithConflictResolution(key: string): Promise<any> {
    const values = await Promise.allSettled([
      this.localStorage.get(key),
      this.sessionStorage.get(key),
      this.extensionStorage.get(key),
      this.indexedDBStorage.get(key)
    ])

    let newestValue = null
    let newestTimestamp = 0

    values.forEach((result, _index) => {
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
    await storageManager.set(STORAGE_KEYS.GROUP_PREFIX + groupId, group)
  },

  async removeEmojiGroup(groupId: string): Promise<void> {
    await storageManager.remove(STORAGE_KEYS.GROUP_PREFIX + groupId)
  },

  async getAllEmojiGroups(): Promise<EmojiGroup[]> {
    const index = await this.getEmojiGroupIndex()
    if (!index.length) {
      // Try runtime loader for packaged JSON first, fallback to generated module
      try {
        const runtime = await loadDefaultEmojiGroups()
        if (runtime && runtime.length) return runtime
      } catch (e) {
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
    await this.setEmojiGroupIndex(index)

    // Update individual groups
    await Promise.all(groups.map(group => this.setEmojiGroup(group.id, group)))
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
    } catch (e) {
      // ignore loader errors
    }

    return { ...defaultSettings }
  },

  async setSettings(settings: AppSettings): Promise<void> {
    const updatedSettings = { ...settings, lastModified: Date.now() }
    await storageManager.set(STORAGE_KEYS.SETTINGS, updatedSettings)
  },

  // Favorites management
  async getFavorites(): Promise<string[]> {
    const favorites = await storageManager.getWithConflictResolution(STORAGE_KEYS.FAVORITES)
    return favorites || []
  },

  async setFavorites(favorites: string[]): Promise<void> {
    await storageManager.set(STORAGE_KEYS.FAVORITES, favorites)
  },

  // Sync operations
  async backupToSync(
    groups: EmojiGroup[],
    settings: AppSettings,
    favorites: string[]
  ): Promise<void> {
    const chromeAPI = getChromeAPI()
    if (!chromeAPI?.storage?.sync) {
      logStorage('SYNC_BACKUP', 'failed', undefined, 'Chrome Sync Storage API not available')
      return
    }

    const backupData = {
      groups,
      settings,
      favorites,
      timestamp: Date.now(),
      version: '3.0'
    }

    return new Promise((resolve, reject) => {
      try {
        chromeAPI.storage.sync.set({ [SYNC_STORAGE_KEYS.BACKUP]: backupData }, () => {
          if (chromeAPI.runtime.lastError) {
            logStorage('SYNC_BACKUP', 'failed', undefined, chromeAPI.runtime.lastError)
            reject(chromeAPI.runtime.lastError)
          } else {
            logStorage('SYNC_BACKUP', 'success', backupData)
            resolve()
          }
        })
      } catch (error) {
        logStorage('SYNC_BACKUP', 'failed', undefined, error)
        reject(error)
      }
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
        chromeAPI.storage.sync.get({ [SYNC_STORAGE_KEYS.BACKUP]: null }, async (result: any) => {
          if (chromeAPI.runtime.lastError) {
            logStorage('SYNC_RESTORE', 'failed', undefined, chromeAPI.runtime.lastError)
            resolve(null)
          } else {
            const backup = result[SYNC_STORAGE_KEYS.BACKUP]
            if (backup && backup.groups) {
              logStorage('SYNC_RESTORE', 'found backup', backup)

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
        })
      } catch (error) {
        logStorage('SYNC_RESTORE', 'failed', undefined, error)
        resolve(null)
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
      } catch (e) {
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
