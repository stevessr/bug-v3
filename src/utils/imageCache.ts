/**
 * Image Cache Utility using IndexedDB
 * Environment-aware utility for browser extension and userscript contexts
 */

declare const chrome: any

export interface ImageCacheOptions {
  dbName?: string
  storeName?: string
  version?: number
  maxCacheSize?: number // in bytes
  maxCacheEntries?: number
  maxAge?: number // in milliseconds
}

export interface CacheEntry {
  id: string
  url: string
  blob: Blob
  timestamp: number
  size: number
  lastAccessed: number
  accessCount: number
}

/**
 * Environment detection utility
 */
function isExtensionContext(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    (chrome.runtime || chrome.extension) &&
    typeof chrome.storage !== 'undefined'
  )
}

function isUserscriptContext(): boolean {
  return (
    typeof (globalThis as any).GM_info !== 'undefined' ||
    typeof (globalThis as any).unsafeWindow !== 'undefined' ||
    (typeof window !== 'undefined' &&
      (window.location.protocol === 'http:' || window.location.protocol === 'https:') &&
      !isExtensionContext())
  )
}

/**
 * Safe IndexedDB access with environment checks
 */
function getIndexedDB(): IDBFactory | null {
  if (typeof indexedDB !== 'undefined') {
    return indexedDB
  }

  // Fallback for different environments
  if (typeof window !== 'undefined' && (window as any).indexedDB) {
    return (window as any).indexedDB
  }

  if (typeof globalThis !== 'undefined' && (globalThis as any).indexedDB) {
    return (globalThis as any).indexedDB
  }

  return null
}

/**
 * Image Cache class with IndexedDB backend
 */
export class ImageCache {
  private db: IDBDatabase | null = null
  private readonly options: Required<ImageCacheOptions>
  private isInitialized = false

  constructor(options: ImageCacheOptions = {}) {
    this.options = {
      dbName: options.dbName || 'ImageCacheDB',
      storeName: options.storeName || 'images',
      version: options.version || 1,
      maxCacheSize: options.maxCacheSize || 50 * 1024 * 1024, // 50MB
      maxCacheEntries: options.maxCacheEntries || 1000,
      maxAge: options.maxAge || 7 * 24 * 60 * 60 * 1000 // 7 days
    }
  }

  /**
   * Initialize the IndexedDB database
   */
  async init(): Promise<void> {
    if (this.isInitialized) return

    const indexedDB = getIndexedDB()
    if (!indexedDB) {
      throw new Error('IndexedDB is not available in this environment')
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.options.dbName, this.options.version)

      request.onerror = () => {
        const error = request.error
        console.error(`[ImageCache] Failed to open database:`, error)
        reject(new Error(`Failed to open IndexedDB: ${error?.message || 'Unknown error'}`))
      }

      request.onsuccess = () => {
        this.db = request.result
        this.isInitialized = true

        // Handle database errors
        this.db.onerror = event => {
          console.error(`[ImageCache] Database error:`, event)
        }

        console.log(
          `[ImageCache] Database initialized (${isExtensionContext() ? 'extension' : 'userscript'} context)`
        )
        resolve()
      }

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.options.storeName)) {
          const store = db.createObjectStore(this.options.storeName, { keyPath: 'id' })

          // Create indexes for efficient queries
          store.createIndex('url', 'url', { unique: true })
          store.createIndex('timestamp', 'timestamp', { unique: false })
          store.createIndex('lastAccessed', 'lastAccessed', { unique: false })
          store.createIndex('size', 'size', { unique: false })

          console.log(`[ImageCache] Created object store and indexes`)
        }
      }
    })
  }

  /**
   * Generate a consistent ID from URL - use URL directly as key
   */
  private generateId(url: string): string {
    // Use the URL directly as the key - no hashing needed
    return url
  }

  /**
   * Ensure database is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.init()
    }
  }

  /**
   * Check if an image is cached
   */
  async isImageCached(url: string): Promise<boolean> {
    try {
      await this.ensureInitialized()
      if (!this.db) return false

      const id = this.generateId(url)
      const transaction = this.db.transaction([this.options.storeName], 'readonly')
      const store = transaction.objectStore(this.options.storeName)

      return new Promise(resolve => {
        const request = store.get(id)

        request.onsuccess = () => {
          const entry = request.result as CacheEntry | undefined
          if (!entry) {
            resolve(false)
            return
          }

          // Check if entry is too old
          const now = Date.now()
          const isExpired = now - entry.timestamp > this.options.maxAge

          if (isExpired) {
            // Remove expired entry
            this.removeEntry(id).catch(console.error)
            resolve(false)
          } else {
            resolve(true)
          }
        }

        request.onerror = () => {
          console.error(`[ImageCache] Error checking cache for ${url}:`, request.error)
          resolve(false)
        }
      })
    } catch (error) {
      console.error(`[ImageCache] Error in isImageCached:`, error)
      return false
    }
  }

  /**
   * Get cached image as blob URL
   */
  async getCachedImage(url: string): Promise<string | null> {
    try {
      await this.ensureInitialized()
      if (!this.db) return null

      const id = this.generateId(url)
      const transaction = this.db.transaction([this.options.storeName], 'readwrite')
      const store = transaction.objectStore(this.options.storeName)

      return new Promise(resolve => {
        const request = store.get(id)

        request.onsuccess = () => {
          const entry = request.result as CacheEntry | undefined

          if (!entry) {
            resolve(null)
            return
          }

          // Check if entry is expired
          const now = Date.now()
          const isExpired = now - entry.timestamp > this.options.maxAge

          if (isExpired) {
            // Remove expired entry
            this.removeEntry(id).catch(console.error)
            resolve(null)
            return
          }

          // Update access statistics
          entry.lastAccessed = now
          entry.accessCount++
          store.put(entry)

          // Create and return blob URL
          try {
            const blobUrl = URL.createObjectURL(entry.blob)
            resolve(blobUrl)
          } catch (error) {
            console.error(`[ImageCache] Error creating blob URL:`, error)
            resolve(null)
          }
        }

        request.onerror = () => {
          console.error(`[ImageCache] Error getting cached image for ${url}:`, request.error)
          resolve(null)
        }
      })
    } catch (error) {
      console.error(`[ImageCache] Error in getCachedImage:`, error)
      return null
    }
  }

  /**
   * Cache an image from URL
   */
  async cacheImage(url: string): Promise<string> {
    try {
      await this.ensureInitialized()
      if (!this.db) {
        throw new Error('Database not initialized')
      }

      // Check if already cached
      const cached = await this.getCachedImage(url)
      if (cached) {
        return cached
      }

      // Fetch the image
      const response = await fetch(url, {
        mode: 'cors',
        credentials: 'omit',
        headers: {
          Accept: 'image/*'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const blob = await response.blob()

      // Check cache size limits before adding
      await this.ensureCacheLimits()

      // Store in database
      const id = this.generateId(url)
      const now = Date.now()

      const entry: CacheEntry = {
        id,
        url,
        blob,
        timestamp: now,
        size: blob.size,
        lastAccessed: now,
        accessCount: 1
      }

      const transaction = this.db.transaction([this.options.storeName], 'readwrite')
      const store = transaction.objectStore(this.options.storeName)

      return new Promise((resolve, reject) => {
        const request = store.put(entry)

        request.onsuccess = () => {
          // Create and return blob URL
          try {
            const blobUrl = URL.createObjectURL(blob)
            console.log(`[ImageCache] Cached image: ${url} (${(blob.size / 1024).toFixed(2)} KB)`)
            resolve(blobUrl)
          } catch (error) {
            reject(new Error(`Failed to create blob URL: ${error}`))
          }
        }

        request.onerror = () => {
          reject(new Error(`Failed to cache image: ${request.error?.message || 'Unknown error'}`))
        }
      })
    } catch (error) {
      console.error(`[ImageCache] Error caching image ${url}:`, error)
      throw error
    }
  }

  /**
   * Remove a cache entry
   */
  private async removeEntry(id: string): Promise<void> {
    if (!this.db) return

    const transaction = this.db.transaction([this.options.storeName], 'readwrite')
    const store = transaction.objectStore(this.options.storeName)

    return new Promise(resolve => {
      const request = store.delete(id)
      request.onsuccess = () => resolve()
      request.onerror = () => console.error(`[ImageCache] Error removing entry:`, request.error)
    })
  }

  /**
   * Ensure cache doesn't exceed limits
   */
  private async ensureCacheLimits(): Promise<void> {
    if (!this.db) return

    const transaction = this.db.transaction([this.options.storeName], 'readonly')
    const store = transaction.objectStore(this.options.storeName)

    const getAllRequest = store.getAll()

    getAllRequest.onsuccess = async () => {
      const entries = getAllRequest.result as CacheEntry[]

      const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0)
      const needsCleanup =
        entries.length > this.options.maxCacheEntries || totalSize > this.options.maxCacheSize

      if (needsCleanup) {
        await this.cleanupCache(entries, totalSize)
      }
    }
  }

  /**
   * Clean up cache by removing least recently used entries
   */
  private async cleanupCache(entries: CacheEntry[], currentSize: number): Promise<void> {
    if (!this.db) return

    // Sort by last accessed time (LRU) and age
    const sortedEntries = entries.sort((a, b) => {
      const aAge = Date.now() - a.timestamp
      const bAge = Date.now() - b.timestamp

      // Prioritize removing very old entries
      if (aAge > this.options.maxAge && bAge <= this.options.maxAge) return -1
      if (bAge > this.options.maxAge && aAge <= this.options.maxAge) return 1

      // Then sort by last accessed (LRU)
      return a.lastAccessed - b.lastAccessed
    })

    // Remove entries until within limits
    const toRemove: string[] = []
    let size = currentSize
    let count = entries.length

    for (const entry of sortedEntries) {
      if (count <= this.options.maxCacheEntries && size <= this.options.maxCacheSize) {
        break
      }

      toRemove.push(entry.id)
      size -= entry.size
      count--
    }

    // Remove entries from database
    if (toRemove.length > 0) {
      const transaction = this.db.transaction([this.options.storeName], 'readwrite')
      const store = transaction.objectStore(this.options.storeName)

      for (const id of toRemove) {
        store.delete(id)
      }

      console.log(`[ImageCache] Cleaned up ${toRemove.length} cache entries`)
    }
  }

  /**
   * Clear all cached images
   */
  async clearCache(): Promise<void> {
    try {
      await this.ensureInitialized()
      if (!this.db) return

      const transaction = this.db.transaction([this.options.storeName], 'readwrite')
      const store = transaction.objectStore(this.options.storeName)

      return new Promise((resolve, reject) => {
        const request = store.clear()

        request.onsuccess = () => {
          console.log(`[ImageCache] Cache cleared`)
          resolve()
        }

        request.onerror = () => {
          reject(new Error(`Failed to clear cache: ${request.error?.message || 'Unknown error'}`))
        }
      })
    } catch (error) {
      console.error(`[ImageCache] Error clearing cache:`, error)
      throw error
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalEntries: number
    totalSize: number
    oldestEntry?: number
    newestEntry?: number
    context: 'extension' | 'userscript' | 'unknown'
  }> {
    try {
      await this.ensureInitialized()
      if (!this.db) {
        return {
          totalEntries: 0,
          totalSize: 0,
          context: isExtensionContext()
            ? ('extension' as const)
            : isUserscriptContext()
              ? ('userscript' as const)
              : ('unknown' as const)
        }
      }

      const transaction = this.db.transaction([this.options.storeName], 'readonly')
      const store = transaction.objectStore(this.options.storeName)

      return new Promise(resolve => {
        const getAllRequest = store.getAll()

        getAllRequest.onsuccess = () => {
          const entries = getAllRequest.result as CacheEntry[]

          const stats = {
            totalEntries: entries.length,
            totalSize: entries.reduce((sum, entry) => sum + entry.size, 0),
            oldestEntry:
              entries.length > 0 ? Math.min(...entries.map(e => e.timestamp)) : undefined,
            newestEntry:
              entries.length > 0 ? Math.max(...entries.map(e => e.timestamp)) : undefined,
            context: isExtensionContext()
              ? ('extension' as const)
              : isUserscriptContext()
                ? ('userscript' as const)
                : ('unknown' as const)
          }

          resolve(stats)
        }

        getAllRequest.onerror = () => {
          console.error(`[ImageCache] Error getting cache stats:`, getAllRequest.error)
          resolve({
            totalEntries: 0,
            totalSize: 0,
            context: isExtensionContext()
              ? ('extension' as const)
              : isUserscriptContext()
                ? ('userscript' as const)
                : ('unknown' as const)
          })
        }
      })
    } catch (error) {
      console.error(`[ImageCache] Error getting cache stats:`, error)
      return {
        totalEntries: 0,
        totalSize: 0,
        context: isExtensionContext()
          ? ('extension' as const)
          : isUserscriptContext()
            ? ('userscript' as const)
            : ('unknown' as const)
      }
    }
  }
}

// Default cache instance
export const imageCache = new ImageCache()

// Convenience functions that match the requested API
export async function cacheImage(url: string): Promise<string> {
  return imageCache.cacheImage(url)
}

export async function getCachedImage(url: string): Promise<string | null> {
  return imageCache.getCachedImage(url)
}

export async function isImageCached(url: string): Promise<boolean> {
  return imageCache.isImageCached(url)
}
