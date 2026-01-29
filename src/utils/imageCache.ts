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
      const old = this.cache.get(url)
      if (old) {
        this.currentSize -= old.size
      }
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
 * Fetch image via background proxy to bypass CORP restrictions
 * Falls back to direct fetch only if proxy is not available (non-extension context)
 */
async function fetchImageViaProxy(url: string): Promise<Blob> {
  // Try to use background proxy in extension context
  if (isExtensionContext() && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    const response = await new Promise<any>((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'PROXY_IMAGE', url }, (resp: any) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          resolve(resp)
        }
      })
    })

    if (response?.success && response.data) {
      const uint8Array = new Uint8Array(response.data)
      return new Blob([uint8Array], { type: response.mimeType || 'image/png' })
    }

    // Proxy returned an error, throw it
    throw new Error(response?.error || 'Proxy fetch failed')
  }

  // Direct fetch only for non-extension contexts
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

  return response.blob()
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

        logCache(`Database initialized (${isExtensionContext() ? 'extension' : 'web'} context)`)
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
        const request = store.count(id)

        request.onsuccess = () => {
          resolve(request.result > 0)
        }

        request.onerror = () => {
          errorCache('isImageCached IndexedDB operation failed:', request.error)
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
      logCache(`Memory cache hit for: ${url.slice(0, 50)}...`)
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
            logCache(`IndexedDB cache miss for: ${url.slice(0, 50)}...`)
            resolve(null)
            return
          }

          logCache(`IndexedDB cache hit for: ${url.slice(0, 50)}...`)

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
          errorCache('getCachedImage IndexedDB operation failed:', request.error)
          resolve(null)
        }
      })
    } catch {
      return null
    }
  }

  /**
   * 批量获取缓存状态 (仅查询 IndexedDB)
   */
  private async _batchGetFromDb(urls: string[]): Promise<Map<string, CacheEntry>> {
    try {
      await this.ensureInitialized()
      if (!this.db) return new Map()

      const transaction = this.db.transaction([this.options.storeName], 'readwrite')
      const store = transaction.objectStore(this.options.storeName)
      const results = new Map<string, CacheEntry>()

      return new Promise(resolve => {
        let completed = 0
        let hasError = false

        if (urls.length === 0) {
          resolve(results)
          return
        }

        urls.forEach(url => {
          const id = this.generateId(url)
          const request = store.get(id)

          request.onsuccess = () => {
            const entry = request.result as CacheEntry | undefined
            if (entry) {
              results.set(url, entry)
              // 批量操作时不立即更新 lastAccessed，避免写入风暴
              // 只有在真正使用时才更新，或者可以在这里做一个轻量级更新（如果需要）
            }
            completed++
            if (completed === urls.length && !hasError) resolve(results)
          }

          request.onerror = () => {
            // 单个失败不影响整体，但记录错误
            errorCache('_batchGetFromDb single request failed:', request.error)
            completed++
            if (completed === urls.length && !hasError) resolve(results)
          }
        })

        transaction.onerror = () => {
          hasError = true
          resolve(results)
        }
      })
    } catch {
      return new Map()
    }
  }

  /**
   * Cache an image from URL (带请求去重)
   */
  async cacheImage(url: string, checkCache: boolean = true): Promise<string> {
    // 使用请求追踪器避免重复请求
    return this.requestTracker.track(url, () => this._doCacheImage(url, checkCache))
  }

  private async _doCacheImage(url: string, checkCache: boolean = true): Promise<string> {
    try {
      await this.ensureInitialized()
      if (!this.db) {
        throw new Error('Database not initialized')
      }

      if (checkCache) {
        // 检查是否已缓存
        const cached = await this.getCachedImage(url)
        if (cached) {
          return cached
        }
      }

      // 获取图片 (通过代理绕过 CORP 限制)
      const blob = await fetchImageViaProxy(url)

      // 注意：不再自动清理缓存，只能通过用户手动清理
      // 这样可以避免意外清空用户缓存的图片

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

    // 1. 过滤掉已经在内存缓存中的
    const uniqueUrls = [...new Set(urls)]
    const pendingUrls: string[] = []

    for (const url of uniqueUrls) {
      if (this.memoryCache.has(url)) {
        const cachedUrl = this.memoryCache.get(url)
        if (cachedUrl) {
          results.set(url, cachedUrl)
        }
        completed++
      } else {
        pendingUrls.push(url)
      }
    }

    if (onProgress && completed > 0) {
      onProgress(completed, urls.length)
    }

    if (pendingUrls.length === 0) {
      return results
    }

    // 2. 批量检查 IndexedDB
    // 分批检查以避免事务过大
    const checkBatchSize = 50 // 每次检查 50 个
    const urlsToDownload: string[] = []

    for (let i = 0; i < pendingUrls.length; i += checkBatchSize) {
      const batch = pendingUrls.slice(i, i + checkBatchSize)
      const cachedEntries = await this._batchGetFromDb(batch)

      for (const url of batch) {
        const entry = cachedEntries.get(url)
        if (entry) {
          try {
            const blobUrl = URL.createObjectURL(entry.blob)
            this.memoryCache.set(url, blobUrl, entry.size)
            results.set(url, blobUrl)
          } catch (error) {
            // 如果创建 blob URL 失败，重新下载
            urlsToDownload.push(url)
          }
        } else {
          urlsToDownload.push(url)
        }
      }
    }

    // 更新进度（因为从 DB 加载也是一种完成）
    completed = uniqueUrls.length - urlsToDownload.length
    if (onProgress && completed > 0) {
      onProgress(completed, uniqueUrls.length)
    }

    // 3. 下载未缓存的图片
    if (urlsToDownload.length === 0) {
      return results
    }

    // 分批处理下载
    for (let i = 0; i < urlsToDownload.length; i += concurrency) {
      const batch = urlsToDownload.slice(i, i + concurrency)
      const batchResults = await Promise.allSettled(
        batch.map(async url => {
          // 这里的 cacheImage 内部还是会 check 一次，但因为我们已经 check 过了且不在 cache 中
          // 为了效率，我们可以传递一个 flag 告诉它跳过 check，或者 just rely on its check (double check is safe but slower)
          // 鉴于 requestTracker 的存在，直接调用是安全的
          const blobUrl = await this.cacheImage(url, false)
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
        onProgress?.(completed, uniqueUrls.length)
      }
    }

    return results
  }

  /**
   * 预加载图片到内存缓存（优化为并行处理）
   * @param urls 要预加载的 URL 列表
   * @param concurrency 并发数，默认为 4
   */
  async preloadToMemory(urls: string[], _concurrency: number = 4): Promise<number> {
    let loaded = 0

    // 过滤出需要加载的 URL（已在内存缓存中的跳过）
    const toLoad = urls.filter(url => !this.memoryCache.has(url))

    // 已缓存的数量
    const alreadyCached = urls.length - toLoad.length
    if (alreadyCached > 0) {
      loaded += alreadyCached
    }

    // 如果都已缓存，直接返回
    if (toLoad.length === 0) {
      return loaded
    }

    // 使用 batchGetFromDb 批量检查 IDB
    const checkBatchSize = 50
    const urlsNotInDb: string[] = []

    for (let i = 0; i < toLoad.length; i += checkBatchSize) {
      const batch = toLoad.slice(i, i + checkBatchSize)
      const cachedEntries = await this._batchGetFromDb(batch)

      for (const url of batch) {
        const entry = cachedEntries.get(url)
        if (entry) {
          try {
            const blobUrl = URL.createObjectURL(entry.blob)
            this.memoryCache.set(url, blobUrl, entry.size)
            loaded++
          } catch (error) {
            urlsNotInDb.push(url)
          }
        } else {
          urlsNotInDb.push(url)
        }
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
   * 优化：使用 cursor 遍历，只读取元数据，避免加载大量 Blob 到内存
   * 注意：只在超出限制 20% 时才清理，避免频繁清理
   */
  private async ensureCacheLimits(): Promise<void> {
    if (!this.db) return

    const transaction = this.db.transaction([this.options.storeName], 'readonly')
    const store = transaction.objectStore(this.options.storeName)

    return new Promise(resolve => {
      const cursorRequest = store.openCursor()
      const metadata: Array<{ id: string; size: number; lastAccessed: number }> = []
      let totalSize = 0
      let totalCount = 0

      cursorRequest.onsuccess = async event => {
        const cursor = (event.target as IDBRequest).result

        if (cursor) {
          const entry = cursor.value as CacheEntry
          // 只收集元数据，不加载 blob
          metadata.push({
            id: entry.id,
            size: entry.size,
            lastAccessed: entry.lastAccessed
          })
          totalSize += entry.size
          totalCount++
          cursor.continue()
        } else {
          // 遍历完成，只在超出限制 20% 时才清理（避免频繁清理）
          const sizeThreshold = this.options.maxCacheSize * 1.2
          const countThreshold = this.options.maxCacheEntries * 1.2
          const needsCleanup = totalCount > countThreshold || totalSize > sizeThreshold

          if (needsCleanup) {
            logCache(
              `Cache exceeds 120% limit (size: ${(totalSize / 1024 / 1024).toFixed(1)}MB, entries: ${totalCount}), cleaning up...`
            )
            await this.cleanupCacheByMetadata(metadata, totalSize)
          }
          resolve()
        }
      }

      cursorRequest.onerror = () => {
        errorCache('ensureCacheLimits cursor failed:', cursorRequest.error)
        resolve()
      }
    })
  }

  /**
   * Clean up cache by removing least recently used entries (基于元数据)
   * 仅基于 LRU 策略，不考虑过期时间（S3 URL 永久有效）
   * 保守清理：只清理到 95% 容量，最大限度保护用户缓存
   */
  private async cleanupCacheByMetadata(
    metadata: Array<{ id: string; size: number; lastAccessed: number }>,
    currentSize: number
  ): Promise<void> {
    if (!this.db) return

    // 按 LRU 排序（最少访问的排前面）
    const sortedMetadata = metadata.sort((a, b) => a.lastAccessed - b.lastAccessed)

    const toRemove: string[] = []
    let size = currentSize
    let count = metadata.length

    // 目标：减少到 95% 容量（保守清理）
    const targetSize = this.options.maxCacheSize * 0.95
    const targetCount = this.options.maxCacheEntries * 0.95

    for (const entry of sortedMetadata) {
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

      logCache(`Cleaned up ${toRemove.length} cache entries (LRU, conservative)`)
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
   * 优化：使用 cursor 遍历元数据，避免加载所有 Blob 到内存
   */
  async cleanupLRU(targetPercentage: number = 0.5): Promise<number> {
    try {
      await this.ensureInitialized()
      if (!this.db) return 0

      const transaction = this.db.transaction([this.options.storeName], 'readonly')
      const store = transaction.objectStore(this.options.storeName)

      return new Promise(resolve => {
        const cursorRequest = store.openCursor()
        const metadata: Array<{ id: string; url: string; lastAccessed: number }> = []

        cursorRequest.onsuccess = async event => {
          const cursor = (event.target as IDBRequest).result

          if (cursor) {
            const entry = cursor.value as CacheEntry
            // 只收集元数据
            metadata.push({
              id: entry.id,
              url: entry.url,
              lastAccessed: entry.lastAccessed
            })
            cursor.continue()
          } else {
            // 遍历完成，执行清理
            if (metadata.length === 0) {
              resolve(0)
              return
            }

            // 按 LRU 排序
            const sortedMetadata = metadata.sort((a, b) => a.lastAccessed - b.lastAccessed)
            const targetCount = Math.floor(metadata.length * targetPercentage)

            const toRemove = sortedMetadata.slice(0, targetCount)

            if (toRemove.length > 0) {
              if (!this.db) {
                resolve(0)
                return
              }
              const deleteTransaction = this.db.transaction([this.options.storeName], 'readwrite')
              const deleteStore = deleteTransaction.objectStore(this.options.storeName)

              for (const entry of toRemove) {
                deleteStore.delete(entry.id)
                this.memoryCache.delete(entry.url)
              }

              logCache(`Manually cleaned up ${toRemove.length} cache entries`)
              resolve(toRemove.length)
            } else {
              resolve(0)
            }
          }
        }

        cursorRequest.onerror = () => {
          errorCache('cleanupLRU cursor failed:', cursorRequest.error)
          resolve(0)
        }
      })
    } catch {
      return 0
    }
  }

  /**
   * Get cache statistics (包括内存缓存)
   * 优化：使用 cursor 遍历，只读取元数据
   */
  async getCacheStats(): Promise<{
    totalEntries: number
    totalSize: number
    memoryEntries: number
    memorySize: number
    memoryMaxSize: number
    oldestEntry?: number
    newestEntry?: number
    context: 'extension' | 'unknown'
  }> {
    const memStats = this.memoryCache.getStats()
    const context = isExtensionContext() ? ('extension' as const) : ('unknown' as const)

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
        const cursorRequest = store.openCursor()
        let totalEntries = 0
        let totalSize = 0
        let oldestEntry: number | undefined
        let newestEntry: number | undefined

        cursorRequest.onsuccess = event => {
          const cursor = (event.target as IDBRequest).result

          if (cursor) {
            const entry = cursor.value as CacheEntry
            totalEntries++
            totalSize += entry.size

            if (oldestEntry === undefined || entry.timestamp < oldestEntry) {
              oldestEntry = entry.timestamp
            }
            if (newestEntry === undefined || entry.timestamp > newestEntry) {
              newestEntry = entry.timestamp
            }

            cursor.continue()
          } else {
            // 遍历完成
            resolve({
              totalEntries,
              totalSize,
              memoryEntries: memStats.entries,
              memorySize: memStats.size,
              memoryMaxSize: memStats.maxSize,
              oldestEntry,
              newestEntry,
              context
            })
          }
        }

        cursorRequest.onerror = () => {
          errorCache('getCacheStats cursor failed:', cursorRequest.error)
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

  /**
   * 获取所有缓存条目（用于导出）
   */
  async getAllEntries(): Promise<CacheEntry[]> {
    await this.init()

    if (!this.db) {
      throw new Error('Database not initialized')
    }

    return new Promise((resolve, reject) => {
      try {
        if (!this.db) {
          throw new Error('Database not initialized')
        }
        const transaction = this.db.transaction([this.options.storeName], 'readonly')
        const store = transaction.objectStore(this.options.storeName)

        const entries: CacheEntry[] = []
        let processedCount = 0

        const cursorRequest = store.openCursor()

        cursorRequest.onsuccess = event => {
          try {
            const cursor = (event.target as IDBRequest).result

            if (cursor) {
              const entry = cursor.value as CacheEntry

              // 验证条目的完整性
              if (entry && entry.id && entry.url && entry.blob) {
                entries.push(entry)
                processedCount++

                // 每处理 100 个条目记录一次进度
                if (processedCount % 100 === 0) {
                  console.log(`[ImageCache] 已处理 ${processedCount} 个缓存条目`)
                }
              } else {
                console.warn('[ImageCache] 跳过无效的缓存条目：', entry)
              }

              cursor.continue()
            } else {
              console.log(`[ImageCache] 获取所有缓存条目完成：${entries.length} 个有效条目`)
              resolve(entries)
            }
          } catch (cursorError) {
            console.error('[ImageCache] 处理游标时出错：', cursorError)
            reject(cursorError)
          }
        }

        cursorRequest.onerror = event => {
          const error = (event.target as IDBRequest).error
          console.error('[ImageCache] 游标请求失败：', error)
          reject(
            new Error(
              `Failed to iterate through cache entries: ${error?.message || 'Unknown error'}`
            )
          )
        }

        transaction.onerror = event => {
          const error = (event.target as IDBTransaction).error
          console.error('[ImageCache] 事务失败：', error)
          reject(new Error(`Transaction failed: ${error?.message || 'Unknown error'}`))
        }
      } catch (error) {
        console.error('[ImageCache] 创建事务时出错：', error)
        reject(error)
      }
    })
  }
}

// Default cache instance with optimized settings
// S3 为不同文件分配不同 URL，因此无需过期策略，仅使用 LRU 基于容量清理
export const imageCache = new ImageCache({
  maxCacheSize: 10 * 1024 * 1024 * 1024, // 10GB IndexedDB（增大容量）
  maxCacheEntries: 5 * 1000 * 1000, // 500 万条目限制（增大条目数）
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

/**
 * Fetch image via proxy without caching
 * Useful for previewing images in edit/add modals when direct load fails
 * Returns a blob URL that should be revoked after use
 */
export async function fetchImageForPreview(url: string): Promise<string | null> {
  if (!url || url.startsWith('blob:') || url.startsWith('data:')) {
    return null
  }

  try {
    // Check if we're in extension context
    const inExtension =
      typeof chrome !== 'undefined' &&
      (chrome.runtime || chrome.extension) &&
      typeof chrome.storage !== 'undefined'

    if (inExtension && chrome.runtime?.sendMessage) {
      // Try background proxy first
      const response = await new Promise<any>((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'PROXY_IMAGE', url }, (resp: any) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve(resp)
          }
        })
      })

      if (response?.success && response.data) {
        const uint8Array = new Uint8Array(response.data)
        const blob = new Blob([uint8Array], { type: response.mimeType || 'image/png' })
        return URL.createObjectURL(blob)
      }
    }

    // Fallback to direct fetch (non-extension or proxy failed)
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      headers: {
        Accept: 'image/*'
      }
    })

    if (!response.ok) {
      return null
    }

    const blob = await response.blob()
    return URL.createObjectURL(blob)
  } catch (error) {
    console.warn('[ImageCache] fetchImageForPreview failed:', error)
    return null
  }
}
