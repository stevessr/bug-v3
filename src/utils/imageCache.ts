/**
 * Image Cache Utility using IndexedDB with Memory Cache Layer
 * 优化版本：添加内存缓存层、批量操作、更智能的预加载
 */

declare const chrome: any
declare const __ENABLE_LOGGING__: boolean

export interface ImageCacheOptions {
  dbName?: string
  storeName?: string
  version?: number
  maxCacheSize?: number // in bytes
  maxCacheEntries?: number
  maxAge?: number // in milliseconds
  memoryBudget?: number // 内存缓存预算 (bytes)
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

// 内存缓存条目
interface MemoryCacheEntry {
  blobUrl: string
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

  if (typeof window !== 'undefined' && (window as any).indexedDB) {
    return (window as any).indexedDB
  }

  if (typeof globalThis !== 'undefined' && (globalThis as any).indexedDB) {
    return (globalThis as any).indexedDB
  }

  return null
}

// 日志工具函数
function logCache(message: string, ...args: any[]) {
  if (typeof __ENABLE_LOGGING__ !== 'undefined' && __ENABLE_LOGGING__) {
    console.log(`[ImageCache] ${message}`, ...args)
  }
}

function warnCache(message: string, ...args: any[]) {
  console.warn(`[ImageCache] ${message}`, ...args)
}

function errorCache(message: string, ...args: any[]) {
  console.error(`[ImageCache] ${message}`, ...args)
}

/**
 * LRU 内存缓存
 */
class LRUMemoryCache {
  private cache = new Map<string, MemoryCacheEntry>()
  private currentSize = 0
  private readonly maxSize: number

  constructor(maxSize: number) {
    this.maxSize = maxSize
  }

  get(url: string): string | null {
    const entry = this.cache.get(url)
    if (!entry) return null

    // 更新访问信息并移到末尾（最近访问）
    entry.lastAccessed = Date.now()
    entry.accessCount++
    this.cache.delete(url)
    this.cache.set(url, entry)

    return entry.blobUrl
  }

  set(url: string, blobUrl: string, size: number): void {
    // 如果已存在，先移除旧的
    if (this.cache.has(url)) {
      const old = this.cache.get(url)!
      this.currentSize -= old.size
      // 不释放旧的 blobUrl，因为可能还在使用
      this.cache.delete(url)
    }

    // 确保有足够空间
    while (this.currentSize + size > this.maxSize && this.cache.size > 0) {
      this.evictOne()
    }

    // 如果单个条目太大，直接返回不缓存
    if (size > this.maxSize) {
      return
    }

    this.cache.set(url, {
      blobUrl,
      size,
      lastAccessed: Date.now(),
      accessCount: 1
    })
    this.currentSize += size
  }

  has(url: string): boolean {
    return this.cache.has(url)
  }

  delete(url: string): void {
    const entry = this.cache.get(url)
    if (entry) {
      this.currentSize -= entry.size
      try {
        URL.revokeObjectURL(entry.blobUrl)
      } catch {
        // 忽略释放失败
      }
      this.cache.delete(url)
    }
  }

  private evictOne(): void {
    // Map 的第一个元素是最旧的（LRU）
    const firstKey = this.cache.keys().next().value
    if (firstKey) {
      this.delete(firstKey)
    }
  }

  clear(): void {
    for (const entry of this.cache.values()) {
      try {
        URL.revokeObjectURL(entry.blobUrl)
      } catch {
        // 忽略释放失败
      }
    }
    this.cache.clear()
    this.currentSize = 0
  }

  getStats(): { entries: number; size: number; maxSize: number } {
    return {
      entries: this.cache.size,
      size: this.currentSize,
      maxSize: this.maxSize
    }
  }
}

/**
 * 正在进行的请求追踪器（避免重复请求）
 */
class RequestTracker {
  private pending = new Map<string, Promise<string>>()

  track<T extends string>(url: string, request: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(url)
    if (existing) {
      return existing as Promise<T>
    }

    const promise = request().finally(() => {
      this.pending.delete(url)
    })

    this.pending.set(url, promise as Promise<string>)
    return promise
  }

  isPending(url: string): boolean {
    return this.pending.has(url)
  }
}

/**
 * Image Cache class with IndexedDB backend and Memory Cache Layer
 */
export class ImageCache {
  private db: IDBDatabase | null = null
  private readonly options: Required<ImageCacheOptions>
  private isInitialized = false
  private initPromise: Promise<void> | null = null
  private memoryCache: LRUMemoryCache
  private requestTracker = new RequestTracker()

  constructor(options: ImageCacheOptions = {}) {
    this.options = {
      dbName: options.dbName || 'ImageCacheDB',
      storeName: options.storeName || 'images',
      version: options.version || 1,
      maxCacheSize: options.maxCacheSize || 100 * 1024 * 1024, // 100MB
      maxCacheEntries: options.maxCacheEntries || 5000, // 增加条目限制
      maxAge: options.maxAge || Infinity, // 永久缓存（S3 URL 唯一）
      memoryBudget: options.memoryBudget || 20 * 1024 * 1024 // 20MB 内存缓存
    }

    this.memoryCache = new LRUMemoryCache(this.options.memoryBudget)
  }

  /**
   * Initialize the IndexedDB database
   */
  async init(): Promise<void> {
    if (this.isInitialized) return
    if (this.initPromise) return this.initPromise

    this.initPromise = this._doInit()
    return this.initPromise
  }

  private async _doInit(): Promise<void> {
    const indexedDB = getIndexedDB()
    if (!indexedDB) {
      throw new Error('IndexedDB is not available in this environment')
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.options.dbName, this.options.version)

      request.onerror = () => {
        const error = request.error
        errorCache(`Failed to open database:`, error)
        reject(new Error(`Failed to open IndexedDB: ${error?.message || 'Unknown error'}`))
      }

      request.onsuccess = () => {
        this.db = request.result
        this.isInitialized = true

        this.db.onerror = event => {
          errorCache(`Database error:`, event)
        }

        logCache(
          `Database initialized (${isExtensionContext() ? 'extension' : 'userscript'} context)`
        )
        resolve()
      }

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result

        if (!db.objectStoreNames.contains(this.options.storeName)) {
          const store = db.createObjectStore(this.options.storeName, { keyPath: 'id' })
          store.createIndex('url', 'url', { unique: true })
          store.createIndex('timestamp', 'timestamp', { unique: false })
          store.createIndex('lastAccessed', 'lastAccessed', { unique: false })
          store.createIndex('size', 'size', { unique: false })
          logCache(`Created object store and indexes`)
        }
      }
    })
  }

  /**
   * Generate a consistent ID from URL
   */
  private generateId(url: string): string {
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
   * Check if an image is cached (内存或 IndexedDB)
   */
  async isImageCached(url: string): Promise<boolean> {
    // 首先检查内存缓存
    if (this.memoryCache.has(url)) {
      return true
    }

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
          resolve(!!entry)
        }

        request.onerror = () => {
          resolve(false)
        }
      })
    } catch {
      return false
    }
  }

  /**
   * Get cached image as blob URL (优先内存缓存)
   */
  async getCachedImage(url: string): Promise<string | null> {
    // 1. 首先检查内存缓存
    const memoryHit = this.memoryCache.get(url)
    if (memoryHit) {
      return memoryHit
    }

    // 2. 检查 IndexedDB
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

          // 更新访问统计
          const now = Date.now()
          entry.lastAccessed = now
          entry.accessCount++
          store.put(entry)

          // 创建 blob URL 并加入内存缓存
          try {
            const blobUrl = URL.createObjectURL(entry.blob)
            this.memoryCache.set(url, blobUrl, entry.size)
            resolve(blobUrl)
          } catch (error) {
            errorCache(`Error creating blob URL:`, error)
            resolve(null)
          }
        }

        request.onerror = () => {
          resolve(null)
        }
      })
    } catch {
      return null
    }
  }

  /**
   * Cache an image from URL (带请求去重)
   */
  async cacheImage(url: string): Promise<string> {
    // 使用请求追踪器避免重复请求
    return this.requestTracker.track(url, () => this._doCacheImage(url))
  }

  private async _doCacheImage(url: string): Promise<string> {
    try {
      await this.ensureInitialized()
      if (!this.db) {
        throw new Error('Database not initialized')
      }

      // 检查是否已缓存
      const cached = await this.getCachedImage(url)
      if (cached) {
        return cached
      }

      // 获取图片
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

      // 检查缓存限制
      await this.ensureCacheLimits()

      // 存储到 IndexedDB
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
          try {
            const blobUrl = URL.createObjectURL(blob)
            // 同时加入内存缓存
            this.memoryCache.set(url, blobUrl, blob.size)
            logCache(`Cached image: ${url} (${(blob.size / 1024).toFixed(2)} KB)`)
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
      errorCache(`Error caching image ${url}:`, error)
      throw error
    }
  }

  /**
   * 批量缓存图片（优化并发）
   */
  async cacheImages(
    urls: string[],
    options: {
      concurrency?: number
      onProgress?: (completed: number, total: number) => void
    } = {}
  ): Promise<Map<string, string | Error>> {
    const { concurrency = 4, onProgress } = options
    const results = new Map<string, string | Error>()
    let completed = 0

    // 分批处理
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency)
      const batchResults = await Promise.allSettled(
        batch.map(async url => {
          const blobUrl = await this.cacheImage(url)
          return { url, blobUrl }
        })
      )

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.set(result.value.url, result.value.blobUrl)
        } else {
          const url = batch[batchResults.indexOf(result)]
          results.set(url, result.reason)
        }
        completed++
        onProgress?.(completed, urls.length)
      }
    }

    return results
  }

  /**
   * 预加载图片到内存缓存
   */
  async preloadToMemory(urls: string[]): Promise<number> {
    let loaded = 0

    for (const url of urls) {
      // 如果已在内存缓存中，跳过
      if (this.memoryCache.has(url)) {
        loaded++
        continue
      }

      // 尝试从 IndexedDB 加载到内存
      const blobUrl = await this.getCachedImage(url)
      if (blobUrl) {
        loaded++
      }
    }

    return loaded
  }

  /**
   * Remove a cache entry (kept for potential future use)
   */
  // @ts-expect-error kept for API compatibility
  private async _removeEntry(id: string): Promise<void> {
    // 从内存缓存移除
    this.memoryCache.delete(id)

    if (!this.db) return

    const transaction = this.db.transaction([this.options.storeName], 'readwrite')
    const store = transaction.objectStore(this.options.storeName)

    return new Promise(resolve => {
      const request = store.delete(id)
      request.onsuccess = () => resolve()
      request.onerror = () => {
        warnCache(`Error removing entry:`, request.error)
        resolve()
      }
    })
  }

  /**
   * Ensure cache doesn't exceed limits
   */
  private async ensureCacheLimits(): Promise<void> {
    if (!this.db) return

    const transaction = this.db.transaction([this.options.storeName], 'readonly')
    const store = transaction.objectStore(this.options.storeName)

    return new Promise(resolve => {
      const getAllRequest = store.getAll()

      getAllRequest.onsuccess = async () => {
        const entries = getAllRequest.result as CacheEntry[]

        const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0)
        const needsCleanup =
          entries.length > this.options.maxCacheEntries || totalSize > this.options.maxCacheSize

        if (needsCleanup) {
          await this.cleanupCache(entries, totalSize)
        }
        resolve()
      }

      getAllRequest.onerror = () => resolve()
    })
  }

  /**
   * Clean up cache by removing least recently used entries
   * 仅基于 LRU 策略，不考虑过期时间（S3 URL 永久有效）
   */
  private async cleanupCache(entries: CacheEntry[], currentSize: number): Promise<void> {
    if (!this.db) return

    // 按 LRU 排序（最少访问的排前面）
    const sortedEntries = entries.sort((a, b) => a.lastAccessed - b.lastAccessed)

    const toRemove: string[] = []
    let size = currentSize
    let count = entries.length

    // 目标：减少到 80% 容量
    const targetSize = this.options.maxCacheSize * 0.8
    const targetCount = this.options.maxCacheEntries * 0.8

    for (const entry of sortedEntries) {
      if (count <= targetCount && size <= targetSize) {
        break
      }

      toRemove.push(entry.id)
      size -= entry.size
      count--
    }

    if (toRemove.length > 0) {
      const transaction = this.db.transaction([this.options.storeName], 'readwrite')
      const store = transaction.objectStore(this.options.storeName)

      for (const id of toRemove) {
        store.delete(id)
        this.memoryCache.delete(id)
      }

      logCache(`Cleaned up ${toRemove.length} cache entries (LRU)`)
    }
  }

  /**
   * Clear all cached images
   */
  async clearCache(): Promise<void> {
    // 清除内存缓存
    this.memoryCache.clear()

    try {
      await this.ensureInitialized()
      if (!this.db) return

      const transaction = this.db.transaction([this.options.storeName], 'readwrite')
      const store = transaction.objectStore(this.options.storeName)

      return new Promise((resolve, reject) => {
        const request = store.clear()

        request.onsuccess = () => {
          logCache(`Cache cleared`)
          resolve()
        }

        request.onerror = () => {
          reject(new Error(`Failed to clear cache: ${request.error?.message || 'Unknown error'}`))
        }
      })
    } catch (error) {
      errorCache(`Error clearing cache:`, error)
      throw error
    }
  }

  /**
   * 手动清理缓存（基于 LRU，用于用户主动清理）
   */
  async cleanupLRU(targetPercentage: number = 0.5): Promise<number> {
    try {
      await this.ensureInitialized()
      if (!this.db) return 0

      const transaction = this.db.transaction([this.options.storeName], 'readwrite')
      const store = transaction.objectStore(this.options.storeName)

      return new Promise(resolve => {
        const getAllRequest = store.getAll()

        getAllRequest.onsuccess = async () => {
          const entries = getAllRequest.result as CacheEntry[]
          if (entries.length === 0) {
            resolve(0)
            return
          }

          // 按 LRU 排序
          const sortedEntries = entries.sort((a, b) => a.lastAccessed - b.lastAccessed)
          const targetCount = Math.floor(entries.length * targetPercentage)

          const toRemove = sortedEntries.slice(0, targetCount)

          const deleteTransaction = this.db!.transaction([this.options.storeName], 'readwrite')
          const deleteStore = deleteTransaction.objectStore(this.options.storeName)

          for (const entry of toRemove) {
            deleteStore.delete(entry.id)
            this.memoryCache.delete(entry.url)
          }

          logCache(`Manually cleaned up ${toRemove.length} cache entries`)
          resolve(toRemove.length)
        }

        getAllRequest.onerror = () => resolve(0)
      })
    } catch {
      return 0
    }
  }

  /**
   * Get cache statistics (包括内存缓存)
   */
  async getCacheStats(): Promise<{
    totalEntries: number
    totalSize: number
    memoryEntries: number
    memorySize: number
    memoryMaxSize: number
    oldestEntry?: number
    newestEntry?: number
    context: 'extension' | 'userscript' | 'unknown'
  }> {
    const memStats = this.memoryCache.getStats()
    const context = isExtensionContext()
      ? ('extension' as const)
      : isUserscriptContext()
        ? ('userscript' as const)
        : ('unknown' as const)

    try {
      await this.ensureInitialized()
      if (!this.db) {
        return {
          totalEntries: 0,
          totalSize: 0,
          memoryEntries: memStats.entries,
          memorySize: memStats.size,
          memoryMaxSize: memStats.maxSize,
          context
        }
      }

      const transaction = this.db.transaction([this.options.storeName], 'readonly')
      const store = transaction.objectStore(this.options.storeName)

      return new Promise(resolve => {
        const getAllRequest = store.getAll()

        getAllRequest.onsuccess = () => {
          const entries = getAllRequest.result as CacheEntry[]

          resolve({
            totalEntries: entries.length,
            totalSize: entries.reduce((sum, entry) => sum + entry.size, 0),
            memoryEntries: memStats.entries,
            memorySize: memStats.size,
            memoryMaxSize: memStats.maxSize,
            oldestEntry:
              entries.length > 0 ? Math.min(...entries.map(e => e.timestamp)) : undefined,
            newestEntry:
              entries.length > 0 ? Math.max(...entries.map(e => e.timestamp)) : undefined,
            context
          })
        }

        getAllRequest.onerror = () => {
          resolve({
            totalEntries: 0,
            totalSize: 0,
            memoryEntries: memStats.entries,
            memorySize: memStats.size,
            memoryMaxSize: memStats.maxSize,
            context
          })
        }
      })
    } catch {
      return {
        totalEntries: 0,
        totalSize: 0,
        memoryEntries: memStats.entries,
        memorySize: memStats.size,
        memoryMaxSize: memStats.maxSize,
        context
      }
    }
  }

  /**
   * 获取内存缓存命中率统计
   */
  getMemoryStats() {
    return this.memoryCache.getStats()
  }
}

// Default cache instance with optimized settings
// S3 为不同文件分配不同 URL，因此无需过期策略，仅使用 LRU 基于容量清理
export const imageCache = new ImageCache({
  maxCacheSize: 200 * 1024 * 1024, // 200MB IndexedDB（增大容量）
  maxCacheEntries: 5000,
  maxAge: Infinity, // 永久缓存
  memoryBudget: 30 * 1024 * 1024 // 30MB memory cache（增大内存缓存）
})

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

// 新增便捷函数
export async function cacheImages(
  urls: string[],
  options?: { concurrency?: number; onProgress?: (completed: number, total: number) => void }
): Promise<Map<string, string | Error>> {
  return imageCache.cacheImages(urls, options)
}

export async function preloadToMemory(urls: string[]): Promise<number> {
  return imageCache.preloadToMemory(urls)
}

export async function cleanupLRU(targetPercentage?: number): Promise<number> {
  return imageCache.cleanupLRU(targetPercentage)
}

export async function getCacheStats() {
  return imageCache.getCacheStats()
}

export async function clearCache(): Promise<void> {
  return imageCache.clearCache()
}
