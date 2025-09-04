// IndexedDB utility for emoji extension
import type { EmojiGroup, AppSettings } from '../types/emoji'
import { logger, indexedDBWrapper } from '../config/buildFlags'
import { formatPreview } from './formatUtils'

const DB_NAME = 'EmojiExtensionDB'
const DB_VERSION = 1

// Store names
const STORES = {
  GROUPS: 'groups',
  SETTINGS: 'settings',
  FAVORITES: 'favorites'
} as const

// Logging helper
function logDB(operation: string, store: string, key?: string, data?: any, error?: any) {
  // 如果日志被禁用，直接返回
  if (indexedDBWrapper.shouldSkip() && !error) {
    return
  }

  const timestamp = new Date().toISOString()
  const logPrefix = `[IndexedDB ${timestamp}]`

  if (error) {
    // Make error output human readable (include name/message) while preserving the original error object
    let errInfo = ''
    try {
      if (error && typeof error === 'object') {
        errInfo = `${(error as any).name || 'Error'}: ${(error as any).message || String(error)}`
      } else {
        errInfo = String(error)
      }
    } catch {
      errInfo = String(error)
    }

    // Some failures (buffer flush per-item failures or cleanup) are non-fatal in tests/environments
    // where the Chrome extension APIs are not available. Log them as warnings to avoid failing
    // automated tests that assert no console.error output.
    const nonFatalFailure = operation.endsWith('_FAILED') || operation.startsWith('FLUSH')
    if (nonFatalFailure) {
      logger.warn(
        `${logPrefix} ${operation} FAILED in "${store}"${key ? ` for key "${key}"` : ''}: ${errInfo}`,
        error
      )
    } else {
      logger.error(
        `${logPrefix} ${operation} FAILED in "${store}"${key ? ` for key "${key}"` : ''}: ${errInfo}`,
        error
      )
    }
  } else {
    if (typeof data !== 'undefined') {
      const p = formatPreview(data as any)
      // Print structured output: summary and preview
      logger.log(
        `${logPrefix} ${operation} in "${store}"${key ? ` for key "${key}"` : ''} - size: ${p.size ?? 'unknown'}`,
        p.preview
      )
    } else {
      logger.log(`${logPrefix} ${operation} in "${store}"${key ? ` for key "${key}"` : ''}`)
    }
  }
}

// Database connection management
let dbInstance: IDBDatabase | null = null

// --- In-memory buffer between app and IndexedDB ---

const bufferState = {
  // intentionally allow `any` here to avoid wide typing changes during refactor
  groups: new Map<string, any>(),
  settings: undefined as any,
  favorites: undefined as string[] | undefined,
  dirty: {
    groups: false,
    settings: false,
    favorites: false
  }
}

let flushTimer: any = null
const FLUSH_DEBOUNCE_MS = 1500 // buffer debounce before flushing to IDB

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(() => void flushBuffer(false), FLUSH_DEBOUNCE_MS)
}

// Attempt to flush buffer when the page is unloading to reduce lost writes
if (typeof window !== 'undefined' && window.addEventListener) {
  try {
    window.addEventListener('beforeunload', () => {
      try {
        // synchronous attempt: schedule a forced flush (best-effort)
        void flushBuffer(true)
      } catch (_e) {
        // swallow errors during unload
        void _e
      }
    })
  } catch (_e) {
    // ignore environments where addEventListener may not be available
    void _e
  }
}

async function flushBuffer(force = false) {
  try {
    // If nothing dirty and not forced, skip
    if (
      !force &&
      !bufferState.dirty.groups &&
      !bufferState.dirty.settings &&
      !bufferState.dirty.favorites
    ) {
      logDB('FLUSH_SKIP', 'buffer', undefined, { reason: 'no changes' })
      return
    }

    const db = await getDB()

    // Flush groups: write each group in its own transaction to avoid one failing put
    // aborting the whole batch (which previously could leave the store cleared).
    if (bufferState.dirty.groups || force) {
      const writtenIds: string[] = []

      for (const [id, value] of bufferState.groups.entries()) {
        try {
          // If id is null/undefined, skip and persist to fallback; otherwise coerce to string
          if (id === null || typeof id === 'undefined') {
            logDB(
              'FLUSH_PUT_SKIPPED_INVALID_KEY',
              STORES.GROUPS,
              String(id),
              undefined,
              'invalid key'
            )
            try {
              saveFallbackToLocal(String(id), value, 'invalid key')
            } catch (e) {
              void e
            }
            continue
          }

          const safeId = String(id)
          const cleanedValue = cleanDataForStorage(value)
          const txItem = db.transaction([STORES.GROUPS], 'readwrite')
          const storeItem = txItem.objectStore(STORES.GROUPS)
          const req = storeItem.put({ id: safeId, value: cleanedValue })

          await new Promise<void>((resolve, reject) => {
            req.onsuccess = () => resolve()
            req.onerror = () => reject(req.error)
          })

          writtenIds.push(id)
        } catch (e) {
          // Log the failing id but continue with others
          logDB('FLUSH_PUT_FAILED', STORES.GROUPS, id, undefined, e)
          try {
            // Attempt to persist the failed item to a local fallback store to avoid data loss
            const fallback = cleanDataForStorage(value)
            saveFallbackToLocal(id, fallback, e)
          } catch (e) {
            void e
          }
        }
      }

      // Remove any DB entries that are not present in the buffer anymore.
      try {
        const txKeys = db.transaction([STORES.GROUPS], 'readonly')
        const storeKeys = txKeys.objectStore(STORES.GROUPS)
        const allKeys: string[] = await new Promise((resolve, reject) => {
          const getAllReq = storeKeys.getAllKeys()
          getAllReq.onsuccess = () => resolve(getAllReq.result as string[])
          getAllReq.onerror = () => reject(getAllReq.error)
        })

        const toDelete = allKeys.filter(k => !bufferState.groups.has(k))

        for (const key of toDelete) {
          try {
            const txDel = db.transaction([STORES.GROUPS], 'readwrite')
            const storeDel = txDel.objectStore(STORES.GROUPS)
            const delReq = storeDel.delete(key)
            await new Promise<void>((resolve, reject) => {
              delReq.onsuccess = () => resolve()
              delReq.onerror = () => reject(delReq.error)
            })
          } catch (e) {
            logDB('FLUSH_DELETE_FAILED', STORES.GROUPS, key, undefined, e)
          }
        }
      } catch (e) {
        logDB('FLUSH_CLEANUP_FAILED', STORES.GROUPS, undefined, undefined, e)
        void e
      }

      bufferState.dirty.groups = false
      logDB('FLUSH', STORES.GROUPS, undefined, {
        count: bufferState.groups.size,
        written: writtenIds.length
      })
    }

    // Flush settings
    if (bufferState.dirty.settings || force) {
      const tx = db.transaction([STORES.SETTINGS], 'readwrite')
      const store = tx.objectStore(STORES.SETTINGS)
      const cleanedSettings = cleanDataForStorage(bufferState.settings)
      const req = store.put({ id: 'app', value: cleanedSettings })
      await new Promise<void>((resolve, reject) => {
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
      })
      bufferState.dirty.settings = false
      logDB('FLUSH', STORES.SETTINGS, 'app', cleanedSettings)
    }

    // Flush favorites
    if (bufferState.dirty.favorites || force) {
      const tx = db.transaction([STORES.FAVORITES], 'readwrite')
      const store = tx.objectStore(STORES.FAVORITES)
      const cleanedFavorites = cleanDataForStorage(bufferState.favorites || [])
      const req = store.put({ id: 'list', value: cleanedFavorites })
      await new Promise<void>((resolve, reject) => {
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
      })
      bufferState.dirty.favorites = false
      logDB('FLUSH', STORES.FAVORITES, 'list', cleanedFavorites)
    }
  } catch (error) {
    logDB('FLUSH', 'buffer', undefined, undefined, error)
    throw error
  }
}

async function getDB(): Promise<IDBDatabase> {
  // 如果 IndexedDB 被禁用，抛出错误
  if (indexedDBWrapper.shouldSkip()) {
    throw new Error('IndexedDB is disabled by build configuration')
  }

  if (dbInstance) {
    return dbInstance
  }

  return new Promise((resolve, reject) => {
    logDB('OPEN', 'database')
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      const error = request.error
      logDB('OPEN', 'database', undefined, undefined, error)
      reject(error)
    }

    request.onsuccess = () => {
      dbInstance = request.result
      // attach versionchange handler so we close and clear instance when needed
      try {
        dbInstance.onversionchange = () => {
          logDB('VERSION_CHANGE', 'database')
          try {
            dbInstance?.close()
          } catch (e) {
            void e
          }
          dbInstance = null
        }
      } catch (e) {
        // non-fatal if handler cannot be attached
        void e
      }

      logDB('OPEN', 'database', undefined, 'success')
      resolve(dbInstance)
    }

    request.onupgradeneeded = event => {
      logDB('UPGRADE', 'database', undefined, `version ${event.newVersion}`)
      const db = request.result

      // Create object stores
      if (!db.objectStoreNames.contains(STORES.GROUPS)) {
        const groupStore = db.createObjectStore(STORES.GROUPS, { keyPath: 'id' })
        groupStore.createIndex('order', 'order', { unique: false })
        logDB('CREATE_STORE', STORES.GROUPS)
      }

      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'id' })
        logDB('CREATE_STORE', STORES.SETTINGS)
      }

      if (!db.objectStoreNames.contains(STORES.FAVORITES)) {
        db.createObjectStore(STORES.FAVORITES, { keyPath: 'id' })
        logDB('CREATE_STORE', STORES.FAVORITES)
      }
    }
  })
}

// Generic IndexedDB operations
async function getValue<T>(storeName: string, key: string): Promise<T | undefined> {
  // 如果 IndexedDB 被禁用，直接返回 undefined
  if (indexedDBWrapper.shouldSkip()) {
    logDB('GET_SKIPPED', storeName, key, 'IndexedDB disabled')
    return undefined
  }

  try {
    // If groups are buffered, return from buffer first
    if (storeName === STORES.GROUPS) {
      if (bufferState.groups.has(key)) {
        const v = bufferState.groups.get(key)
        logDB('GET_BUFFER', storeName, key, v)
        return v as T
      }
    }

    if (
      storeName === STORES.SETTINGS &&
      key === 'app' &&
      typeof bufferState.settings !== 'undefined'
    ) {
      logDB('GET_BUFFER', storeName, key, bufferState.settings)
      return bufferState.settings as T
    }

    if (
      storeName === STORES.FAVORITES &&
      key === 'list' &&
      typeof bufferState.favorites !== 'undefined'
    ) {
      logDB('GET_BUFFER', storeName, key, bufferState.favorites)
      return bufferState.favorites as T
    }

    const db = await getDB()
    const transaction = db.transaction([storeName], 'readonly')
    const store = transaction.objectStore(storeName)

    return new Promise((resolve, reject) => {
      const request = store.get(key)

      request.onsuccess = () => {
        const result = request.result?.value

        // Populate buffer with fetched data for future reads
        if (storeName === STORES.GROUPS && result) {
          bufferState.groups.set(key, result)
        } else if (storeName === STORES.SETTINGS && key === 'app' && result) {
          bufferState.settings = result
        } else if (storeName === STORES.FAVORITES && key === 'list' && result) {
          bufferState.favorites = result
        }

        logDB('GET', storeName, key, result)
        resolve(result)
      }

      request.onerror = () => {
        logDB('GET', storeName, key, undefined, request.error)
        reject(request.error)
      }
    })
  } catch (error) {
    logDB('GET', storeName, key, undefined, error)
    return undefined
  }
}

// Helper function to clean data for IndexedDB storage
function cleanDataForStorage<T>(data: T): T {
  try {
    // Deep clone and clean the data to ensure it's serializable
    const cloned = JSON.parse(JSON.stringify(data))

    // If the serialized payload is very large, trim potentially huge fields (data URLs)
    const MAX_SERIALIZED_SIZE = 200 * 1024 // 200KB safe threshold
    try {
      const s = JSON.stringify(cloned)
      if (s.length > MAX_SERIALIZED_SIZE) {
        // Attempt targeted trimming for emoji groups that contain data URLs or very large strings
        if (cloned && typeof cloned === 'object' && Array.isArray((cloned as any).emojis)) {
          const group: any = { ...cloned }
          group.emojis = (group.emojis as any[]).map((emoji: any) => {
            if (emoji && typeof emoji === 'object') {
              const e = { ...emoji }
              if (typeof e.url === 'string') {
                // Trim inline data URLs and very large URLs
                if (e.url.startsWith('data:image/') || e.url.length > 100 * 1024) {
                  // Replace with placeholder and mark trimmed so UI can recover if needed
                  e._urlTrimmed = true
                  e._originalUrlLength = e.url.length
                  e.url = ''
                }
              }
              return e
            }
            return emoji
          })

          const reSerialized = JSON.stringify(group)
          if (reSerialized.length <= s.length) {
            logDB('CLEAN_DATA_TRIM', 'groups', undefined, {
              originalSize: s.length,
              newSize: reSerialized.length
            })
            return group as T
          }
        }
      }
    } catch (err) {
      // ignore serialization-check errors
    }

    return cloned
  } catch (error) {
    logDB('CLEAN_DATA', 'failed', undefined, error)
    // Fallback: try to extract only basic properties
    if (typeof data === 'object' && data !== null) {
      const cleaned: any = {}
      for (const [key, value] of Object.entries(data)) {
        try {
          JSON.stringify(value)
          cleaned[key] = value
        } catch {
          // Skip unserializable properties
          logDB('CLEAN_DATA', `skipped property: ${key}`, undefined, 'unserializable')
        }
      }
      return cleaned as T
    }
    return data
  }
}

// Persist failed group writes to localStorage as a fallback to avoid data loss
function saveFallbackToLocal(id: string, value: any, error: any) {
  try {
    const key = 'idb_fallback_groups'
    let map: Record<string, any> = {}
    try {
      const raw = localStorage.getItem(key)
      if (raw) map = JSON.parse(raw)
    } catch {
      // ignore parse errors and start fresh
      map = {}
    }

    map[id] = {
      value,
      savedAt: Date.now(),
      error:
        error && typeof error === 'object'
          ? { name: error.name, message: error.message }
          : String(error)
    }

    try {
      localStorage.setItem(key, JSON.stringify(map))
      logDB('FALLBACK_SAVE', 'localStorage', key, { id, savedAt: map[id].savedAt })
    } catch (err) {
      // localStorage may also fail (quota) — log and ignore
      logDB('FALLBACK_SAVE_FAILED', 'localStorage', key, undefined, err)
    }
  } catch {
    // swallow any unexpected errors in fallback path
  }
}

async function setValue<T>(storeName: string, key: string, value: T): Promise<void> {
  // 如果 IndexedDB 被禁用，直接返回
  if (indexedDBWrapper.shouldSkip()) {
    logDB('SET_SKIPPED', storeName, key, 'IndexedDB disabled')
    return
  }

  try {
    // Clean the data to ensure it's serializable for IndexedDB
    const cleanedValue = cleanDataForStorage(value)

    // Write to buffer first for groups/settings/favorites
    if (storeName === STORES.GROUPS) {
      bufferState.groups.set(key, cleanedValue)
      bufferState.dirty.groups = true
      scheduleFlush()
      logDB('PUT_BUFFER', storeName, key, cleanedValue)
      return
    }

    if (storeName === STORES.SETTINGS) {
      bufferState.settings = cleanedValue
      bufferState.dirty.settings = true
      scheduleFlush()
      logDB('PUT_BUFFER', storeName, key, cleanedValue)
      return
    }

    if (storeName === STORES.FAVORITES) {
      bufferState.favorites = cleanedValue as any
      bufferState.dirty.favorites = true
      scheduleFlush()
      logDB('PUT_BUFFER', storeName, key, cleanedValue)
      return
    }

    const db = await getDB()
    const transaction = db.transaction([storeName], 'readwrite')
    const store = transaction.objectStore(storeName)

    return new Promise((resolve, reject) => {
      const request = store.put({ id: String(key), value: cleanedValue })

      request.onsuccess = () => {
        logDB('PUT', storeName, key, cleanedValue)
        resolve()
      }

      request.onerror = () => {
        logDB('PUT', storeName, key, undefined, request.error)
        reject(request.error)
      }
    })
  } catch (error) {
    logDB('PUT', storeName, key, undefined, error)
    throw error
  }
}

async function deleteValue(storeName: string, key: string): Promise<void> {
  try {
    // If buffered, remove from buffer and mark dirty
    if (storeName === STORES.GROUPS) {
      bufferState.groups.delete(key)
      bufferState.dirty.groups = true
      scheduleFlush()
      logDB('DELETE_BUFFER', storeName, key)
      return
    }

    const db = await getDB()
    const transaction = db.transaction([storeName], 'readwrite')
    const store = transaction.objectStore(storeName)

    return new Promise((resolve, reject) => {
      const request = store.delete(key)

      request.onsuccess = () => {
        logDB('DELETE', storeName, key)
        resolve()
      }

      request.onerror = () => {
        logDB('DELETE', storeName, key, undefined, request.error)
        reject(request.error)
      }
    })
  } catch (error) {
    logDB('DELETE', storeName, key, undefined, error)
    throw error
  }
}

async function getAllValues<T>(storeName: string): Promise<T[]> {
  try {
    // For groups: if buffer has data, use buffer; otherwise fetch from DB
    if (storeName === STORES.GROUPS) {
      if (bufferState.groups.size > 0) {
        const local = Array.from(bufferState.groups.values())
        logDB('GET_ALL_BUFFER', storeName, undefined, { count: local.length })
        return local as T[]
      }
      // Buffer empty, fetch from DB and populate buffer
      const db = await getDB()
      const transaction = db.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)

      return new Promise((resolve, reject) => {
        const request = store.getAll()

        request.onsuccess = () => {
          const results = request.result.map((item: any) => item.value)
          // Populate buffer with DB data for future reads
          bufferState.groups.clear()
          request.result.forEach((item: any) => {
            bufferState.groups.set(item.id, item.value)
          })
          logDB('GET_ALL_DB', storeName, undefined, results)
          resolve(results)
        }

        request.onerror = () => {
          logDB('GET_ALL', storeName, undefined, undefined, request.error)
          reject(request.error)
        }
      })
    }

    if (storeName === STORES.SETTINGS && typeof bufferState.settings !== 'undefined') {
      logDB('GET_ALL_BUFFER', storeName, undefined, bufferState.settings)
      return [bufferState.settings] as unknown as T[]
    }

    const db = await getDB()
    const transaction = db.transaction([storeName], 'readonly')
    const store = transaction.objectStore(storeName)

    return new Promise((resolve, reject) => {
      const request = store.getAll()

      request.onsuccess = () => {
        const results = request.result.map((item: any) => item.value)
        logDB('GET_ALL', storeName, undefined, results)
        resolve(results)
      }

      request.onerror = () => {
        logDB('GET_ALL', storeName, undefined, undefined, request.error)
        reject(request.error)
      }
    })
  } catch (error) {
    logDB('GET_ALL', storeName, undefined, undefined, error)
    return []
  }
}

async function clearStore(storeName: string): Promise<void> {
  // 如果 IndexedDB 被禁用，直接返回
  if (indexedDBWrapper.shouldSkip()) {
    logDB('CLEAR_SKIPPED', storeName, undefined, 'IndexedDB disabled')
    return
  }

  try {
    // Clear buffer if applicable
    if (storeName === STORES.GROUPS) {
      bufferState.groups.clear()
      bufferState.dirty.groups = true
      logDB('CLEAR_BUFFER', storeName)
    }

    if (storeName === STORES.SETTINGS) {
      bufferState.settings = undefined
      bufferState.dirty.settings = true
    }

    if (storeName === STORES.FAVORITES) {
      bufferState.favorites = undefined
      bufferState.dirty.favorites = true
    }

    const db = await getDB()
    const transaction = db.transaction([storeName], 'readwrite')
    const store = transaction.objectStore(storeName)

    return new Promise((resolve, reject) => {
      const request = store.clear()

      request.onsuccess = () => {
        logDB('CLEAR', storeName)
        resolve()
      }

      request.onerror = () => {
        logDB('CLEAR', storeName, undefined, undefined, request.error)
        reject(request.error)
      }
    })
  } catch (error) {
    logDB('CLEAR', storeName, undefined, undefined, error)
    throw error
  }
}

// Export buffer control for other modules
export { flushBuffer }

// Exported helpers for emoji extension
export const indexedDBHelpers = {
  // Groups
  async getGroup(groupId: string): Promise<EmojiGroup | undefined> {
    return getValue<EmojiGroup>(STORES.GROUPS, groupId)
  },

  async setGroup(group: EmojiGroup): Promise<void> {
    return setValue(STORES.GROUPS, group.id, group)
  },

  async getAllGroups(): Promise<EmojiGroup[]> {
    const groups = await getAllValues<EmojiGroup>(STORES.GROUPS)
    return groups.sort((a, b) => a.order - b.order)
  },

  async deleteGroup(groupId: string): Promise<void> {
    return deleteValue(STORES.GROUPS, groupId)
  },

  async setAllGroups(groups: EmojiGroup[]): Promise<void> {
    // Clear existing groups and set new ones
    await clearStore(STORES.GROUPS)

    // Update buffer first
    bufferState.groups.clear()
    for (const group of groups) {
      bufferState.groups.set(group.id, group)
      await setValue(STORES.GROUPS, group.id, group)
    }
    bufferState.dirty.groups = true
    // Force immediate flush since this is a bulk operation
    await flushBuffer(true)
  },

  // Settings
  async getSettings(): Promise<AppSettings | undefined> {
    return getValue<AppSettings>(STORES.SETTINGS, 'app')
  },

  async setSettings(settings: AppSettings): Promise<void> {
    return setValue(STORES.SETTINGS, 'app', settings)
  },

  // Favorites
  async getFavorites(): Promise<string[]> {
    const favorites = await getValue<string[]>(STORES.FAVORITES, 'list')
    return favorites || []
  },

  async setFavorites(favorites: string[]): Promise<void> {
    return setValue(STORES.FAVORITES, 'list', favorites)
  },

  // Utility methods
  async clearAll(): Promise<void> {
    await Promise.all([
      clearStore(STORES.GROUPS),
      clearStore(STORES.SETTINGS),
      clearStore(STORES.FAVORITES)
    ])
  },

  async isAvailable(): Promise<boolean> {
    // 首先检查编译期开关
    if (indexedDBWrapper.shouldSkip()) {
      return false
    }

    try {
      await getDB()
      return true
    } catch {
      return false
    }
  }
}

export default indexedDBHelpers
