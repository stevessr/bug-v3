import type { EmojiGroup, AppSettings } from '../types/emoji'
import { defaultEmojiGroups, defaultSettings } from '../types/emoji'

// IndexedDB configuration
const DB_NAME = 'EmojiExtensionDB'
const DB_VERSION = 1
const STORE_NAME = 'emojiData'

// Storage keys
export const STORAGE_KEYS = {
  GROUPS: 'emojiGroups',
  SETTINGS: 'appSettings', 
  FAVORITES: 'favorites',
  LAST_SYNC: 'lastSync'
} as const

// IndexedDB wrapper class
class EmojiStorage {
  private db: IDBDatabase | null = null
  private isInitialized = false

  async init(): Promise<void> {
    if (this.isInitialized && this.db) {
      return
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        this.isInitialized = true
        console.log('IndexedDB initialized successfully')
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' })
          
          // Add initial data
          this.setDefaultData(store)
        }
      }
    })
  }

  private setDefaultData(store: IDBObjectStore): void {
    store.put({ key: STORAGE_KEYS.GROUPS, value: defaultEmojiGroups, timestamp: Date.now() })
    store.put({ key: STORAGE_KEYS.SETTINGS, value: defaultSettings, timestamp: Date.now() })
    store.put({ key: STORAGE_KEYS.FAVORITES, value: [], timestamp: Date.now() })
    store.put({ key: STORAGE_KEYS.LAST_SYNC, value: null, timestamp: Date.now() })
  }

  async get<T>(key: string, defaultValue: T): Promise<T> {
    await this.init()

    if (!this.db) {
      console.warn('IndexedDB not available, trying Chrome storage')
      // Fallback to Chrome storage
      try {
        const chromeAPI = this.getChromeAPI()
        if (chromeAPI?.storage?.local) {
          return new Promise((resolve) => {
            chromeAPI.storage.local.get([key], (result: any) => {
              if (result && result[key] !== undefined) {
                resolve(result[key])
              } else {
                resolve(defaultValue)
              }
            })
          })
        }
      } catch (error) {
        console.error('Chrome storage also failed:', error)
      }
      return defaultValue
    }

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(key)

      request.onsuccess = () => {
        if (request.result && request.result.value !== undefined) {
          resolve(request.result.value)
        } else {
          console.log(`No data found for key ${key} in IndexedDB, trying Chrome storage`)
          // Try Chrome storage as fallback
          try {
            const chromeAPI = this.getChromeAPI()
            if (chromeAPI?.storage?.local) {
              chromeAPI.storage.local.get([key], (result: any) => {
                if (result && result[key] !== undefined) {
                  console.log(`Found ${key} in Chrome storage`)
                  resolve(result[key])
                } else {
                  console.log(`No data found for key ${key} anywhere, returning default value`)
                  resolve(defaultValue)
                }
              })
            } else {
              resolve(defaultValue)
            }
          } catch (error) {
            console.error('Chrome storage fallback failed:', error)
            resolve(defaultValue)
          }
        }
      }

      request.onerror = () => {
        console.error(`Failed to get data for key ${key}:`, request.error)
        resolve(defaultValue)
      }
    })
  }

  async set<T>(key: string, value: T): Promise<boolean> {
    await this.init()

    if (!this.db) {
      console.error('IndexedDB not available')
      return false
    }

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put({ 
        key, 
        value, 
        timestamp: Date.now() 
      })

      request.onsuccess = () => {
        console.log(`Successfully saved data for key ${key}`)
        
        // Also save to Chrome storage for content script synchronization
        const chromeAPI = this.getChromeAPI()
        if (chromeAPI?.storage?.local) {
          chromeAPI.storage.local.set({ [key]: value }).then(() => {
            console.log(`Also saved ${key} to Chrome storage for content script sync`)
          }).catch((error: any) => {
            console.warn(`Failed to sync ${key} to Chrome storage:`, error)
          })
        }
        
        resolve(true)
      }

      request.onerror = () => {
        console.error(`Failed to save data for key ${key}:`, request.error)
        resolve(false)
      }
    })
  }

  async getAll(): Promise<Record<string, any>> {
    await this.init()

    if (!this.db) {
      return {}
    }

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onsuccess = () => {
        const result: Record<string, any> = {}
        request.result.forEach(item => {
          result[item.key] = item.value
        })
        resolve(result)
      }

      request.onerror = () => {
        console.error('Failed to get all data:', request.error)
        resolve({})
      }
    })
  }

  async clear(): Promise<boolean> {
    await this.init()

    if (!this.db) {
      return false
    }

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()

      request.onsuccess = () => {
        console.log('All data cleared from IndexedDB')
        resolve(true)
      }

      request.onerror = () => {
        console.error('Failed to clear data:', request.error)
        resolve(false)
      }
    })
  }

  async resetToDefaults(): Promise<boolean> {
    const success = await this.clear()
    if (success) {
      await this.set(STORAGE_KEYS.GROUPS, defaultEmojiGroups)
      await this.set(STORAGE_KEYS.SETTINGS, defaultSettings)
      await this.set(STORAGE_KEYS.FAVORITES, [])
      await this.set(STORAGE_KEYS.LAST_SYNC, null)
      return true
    }
    return false
  }

  // Backup to Chrome storage (optional fallback)
  async syncToChrome(): Promise<boolean> {
    try {
      const chromeAPI = this.getChromeAPI()
      if (!chromeAPI?.storage?.sync) {
        return false
      }

      const allData = await this.getAll()
      await chromeAPI.storage.sync.set({ 
        emojiExtensionBackup: {
          ...allData,
          backupTime: new Date().toISOString()
        }
      })
      
      await this.set(STORAGE_KEYS.LAST_SYNC, new Date().toISOString())
      return true
    } catch (error) {
      console.error('Failed to sync to Chrome storage:', error)
      return false
    }
  }

  // Restore from Chrome storage
  async restoreFromChrome(): Promise<boolean> {
    try {
      const chromeAPI = this.getChromeAPI()
      if (!chromeAPI?.storage?.sync) {
        return false
      }

      return new Promise((resolve) => {
        chromeAPI.storage.sync.get(['emojiExtensionBackup'], async (result: any) => {
          if (result.emojiExtensionBackup) {
            const backup = result.emojiExtensionBackup
            
            // Restore data to IndexedDB
            await this.set(STORAGE_KEYS.GROUPS, backup[STORAGE_KEYS.GROUPS] || defaultEmojiGroups)
            await this.set(STORAGE_KEYS.SETTINGS, backup[STORAGE_KEYS.SETTINGS] || defaultSettings)
            await this.set(STORAGE_KEYS.FAVORITES, backup[STORAGE_KEYS.FAVORITES] || [])
            await this.set(STORAGE_KEYS.LAST_SYNC, backup.backupTime)
            
            console.log('Successfully restored from Chrome storage')
            resolve(true)
          } else {
            console.log('No backup found in Chrome storage')
            resolve(false)
          }
        })
      })
    } catch (error) {
      console.error('Failed to restore from Chrome storage:', error)
      return false
    }
  }

  private getChromeAPI() {
    if (typeof window !== 'undefined' && (window as any).chrome) {
      return (window as any).chrome
    }
    if (typeof globalThis !== 'undefined' && (globalThis as any).chrome) {
      return (globalThis as any).chrome
    }
    return null
  }
}

// Create singleton instance
export const emojiStorage = new EmojiStorage()

// Helper functions for easier usage
export const storageHelpers = {
  // Groups
  async getGroups(): Promise<EmojiGroup[]> {
    return emojiStorage.get(STORAGE_KEYS.GROUPS, defaultEmojiGroups)
  },

  async setGroups(groups: EmojiGroup[]): Promise<boolean> {
    return emojiStorage.set(STORAGE_KEYS.GROUPS, groups)
  },

  // Settings
  async getSettings(): Promise<AppSettings> {
    return emojiStorage.get(STORAGE_KEYS.SETTINGS, defaultSettings)
  },

  async setSettings(settings: AppSettings): Promise<boolean> {
    return emojiStorage.set(STORAGE_KEYS.SETTINGS, settings)
  },

  // Favorites
  async getFavorites(): Promise<string[]> {
    return emojiStorage.get(STORAGE_KEYS.FAVORITES, [])
  },

  async setFavorites(favorites: string[]): Promise<boolean> {
    return emojiStorage.set(STORAGE_KEYS.FAVORITES, favorites)
  },

  // Sync status
  async getLastSync(): Promise<string | null> {
    return emojiStorage.get(STORAGE_KEYS.LAST_SYNC, null)
  },

  // Complete data operations
  async exportAll() {
    const data = await emojiStorage.getAll()
    return {
      ...data,
      exportDate: new Date().toISOString(),
      version: '1.0'
    }
  },

  async importAll(data: any): Promise<boolean> {
    try {
      if (data.emojiGroups) {
        await emojiStorage.set(STORAGE_KEYS.GROUPS, data.emojiGroups)
      }
      if (data.appSettings) {
        await emojiStorage.set(STORAGE_KEYS.SETTINGS, data.appSettings)
      }
      if (data.favorites) {
        await emojiStorage.set(STORAGE_KEYS.FAVORITES, data.favorites)
      }
      return true
    } catch (error) {
      console.error('Failed to import data:', error)
      return false
    }
  }
}

export default emojiStorage
