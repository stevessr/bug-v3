/**
 * Image Cache Service using IndexedDB
 * Optimized for perceptual hash calculation and duplicate detection
 */

export interface CachedImage {
  id: string
  url: string
  blob: Blob
  dataUrl?: string
  hash?: string
  timestamp: number
  size: number
  lastAccessed: number
  accessCount: number
}

export interface CacheStats {
  totalImages: number
  totalSize: number
  cacheHits: number
  cacheMisses: number
  oldestEntry?: number
  newestEntry?: number
}

export class ImageCacheService {
  private db: IDBDatabase | null = null
  private readonly DB_NAME = 'EmojiImageCache'
  private readonly STORE_NAME = 'images'
  private readonly VERSION = 1
  private readonly MAX_CACHE_SIZE = 100 * 1024 * 1024 // 100MB
  private readonly MAX_CACHE_ENTRIES = 10000
  private readonly MAX_AGE = 30 * 24 * 60 * 60 * 1000 // 30 days

  private stats: CacheStats = {
    totalImages: 0,
    totalSize: 0,
    cacheHits: 0,
    cacheMisses: 0
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        this.updateStats()
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' })
          store.createIndex('url', 'url', { unique: true })
          store.createIndex('hash', 'hash', { unique: false })
          store.createIndex('timestamp', 'timestamp', { unique: false })
          store.createIndex('lastAccessed', 'lastAccessed', { unique: false })
        }
      }
    })
  }

  private generateId(url: string): string {
    // Create a consistent ID from URL
    return btoa(url).slice(0, 16)
  }

  private async updateStats(): Promise<void> {
    if (!this.db) return

    const transaction = this.db.transaction([this.STORE_NAME], 'readonly')
    const store = transaction.objectStore(this.STORE_NAME)

    const getAllRequest = store.getAll()
    getAllRequest.onsuccess = () => {
      const images = getAllRequest.result as CachedImage[]
      this.stats.totalImages = images.length
      this.stats.totalSize = images.reduce((sum, img) => sum + img.size, 0)

      if (images.length > 0) {
        this.stats.oldestEntry = Math.min(...images.map(img => img.timestamp))
        this.stats.newestEntry = Math.max(...images.map(img => img.timestamp))
      }
    }
  }

  async getImage(url: string): Promise<Blob | null> {
    if (!this.db) {
      await this.init()
    }
    if (!this.db) return null

    const id = this.generateId(url)
    const transaction = this.db.transaction([this.STORE_NAME], 'readwrite')
    const store = transaction.objectStore(this.STORE_NAME)

    return new Promise((resolve, reject) => {
      const request = store.get(id)

      request.onsuccess = () => {
        const cachedImage = request.result as CachedImage | undefined

        if (cachedImage) {
          // Update access statistics
          cachedImage.lastAccessed = Date.now()
          cachedImage.accessCount++
          store.put(cachedImage)

          this.stats.cacheHits++
          resolve(cachedImage.blob)
        } else {
          this.stats.cacheMisses++
          resolve(null)
        }
      }

      request.onerror = () => reject(request.error)
    })
  }

  async cacheImage(url: string, blob: Blob, hash?: string): Promise<void> {
    if (!this.db) {
      await this.init()
    }
    if (!this.db) return

    // Check cache size limits
    await this.ensureCacheLimit()

    const id = this.generateId(url)
    const now = Date.now()

    // Convert blob to data URL for potential canvas usage
    const dataUrl = await this.blobToDataUrl(blob)

    const cachedImage: CachedImage = {
      id,
      url,
      blob,
      dataUrl,
      hash,
      timestamp: now,
      size: blob.size,
      lastAccessed: now,
      accessCount: 1
    }

    const transaction = this.db.transaction([this.STORE_NAME], 'readwrite')
    const store = transaction.objectStore(this.STORE_NAME)

    return new Promise((resolve, reject) => {
      const request = store.put(cachedImage)

      request.onsuccess = () => {
        this.updateStats()
        resolve()
      }

      request.onerror = () => reject(request.error)
    })
  }

  async getHash(url: string): Promise<string | null> {
    if (!this.db) {
      await this.init()
    }
    if (!this.db) return null

    const id = this.generateId(url)
    const transaction = this.db.transaction([this.STORE_NAME], 'readonly')
    const store = transaction.objectStore(this.STORE_NAME)

    return new Promise((resolve, reject) => {
      const request = store.get(id)

      request.onsuccess = () => {
        const cachedImage = request.result as CachedImage | undefined
        if (cachedImage && cachedImage.hash) {
          // Update access statistics
          const updateTransaction = this.db!.transaction([this.STORE_NAME], 'readwrite')
          const updateStore = updateTransaction.objectStore(this.STORE_NAME)
          cachedImage.lastAccessed = Date.now()
          cachedImage.accessCount++
          updateStore.put(cachedImage)

          resolve(cachedImage.hash)
        } else {
          resolve(null)
        }
      }

      request.onerror = () => reject(request.error)
    })
  }

  async updateHash(url: string, hash: string): Promise<void> {
    if (!this.db) {
      await this.init()
    }
    if (!this.db) return

    const id = this.generateId(url)
    const transaction = this.db.transaction([this.STORE_NAME], 'readwrite')
    const store = transaction.objectStore(this.STORE_NAME)

    return new Promise((resolve, reject) => {
      const getRequest = store.get(id)

      getRequest.onsuccess = () => {
        const cachedImage = getRequest.result as CachedImage | undefined
        if (cachedImage) {
          cachedImage.hash = hash
          cachedImage.lastAccessed = Date.now()

          const putRequest = store.put(cachedImage)
          putRequest.onsuccess = () => resolve()
          putRequest.onerror = () => reject(putRequest.error)
        } else {
          resolve() // Image not found, nothing to update
        }
      }

      getRequest.onerror = () => reject(getRequest.error)
    })
  }

  private async ensureCacheLimit(): Promise<void> {
    if (!this.db) return

    // Check current cache size
    const transaction = this.db.transaction([this.STORE_NAME], 'readonly')
    const store = transaction.objectStore(this.STORE_NAME)

    const getAllRequest = store.getAll()
    getAllRequest.onsuccess = async () => {
      const images = getAllRequest.result as CachedImage[]

      // Check if we need to clean up
      const needsCleanup =
        images.length > this.MAX_CACHE_ENTRIES ||
        images.reduce((sum, img) => sum + img.size, 0) > this.MAX_CACHE_SIZE

      if (needsCleanup) {
        await this.cleanupCache(images)
      }
    }
  }

  private async cleanupCache(images: CachedImage[]): Promise<void> {
    if (!this.db) return

    // Sort by least recently used (LRU) and oldest
    const sortedImages = images.sort((a, b) => {
      // First, remove very old entries
      const now = Date.now()
      const aAge = now - a.lastAccessed
      const bAge = now - b.lastAccessed

      if (aAge > this.MAX_AGE && bAge <= this.MAX_AGE) return -1
      if (bAge > this.MAX_AGE && aAge <= this.MAX_AGE) return 1

      // Then sort by last accessed time (LRU)
      return a.lastAccessed - b.lastAccessed
    })

    // Remove images that are too old or least recently used
    const toRemove: string[] = []
    let currentSize = images.reduce((sum, img) => sum + img.size, 0)
    let currentCount = images.length

    for (const image of sortedImages) {
      if (
        image.accessCount <= 1 && // Rarely accessed
        (currentCount > this.MAX_CACHE_ENTRIES || currentSize > this.MAX_CACHE_SIZE)
      ) {
        toRemove.push(image.id)
        currentSize -= image.size
        currentCount--
      }
    }

    // Remove from database
    if (toRemove.length > 0) {
      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite')
      const store = transaction.objectStore(this.STORE_NAME)

      for (const id of toRemove) {
        store.delete(id)
      }
    }
  }

  private async blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  async clearCache(): Promise<void> {
    if (!this.db) {
      await this.init()
    }
    if (!this.db) return

    const transaction = this.db.transaction([this.STORE_NAME], 'readwrite')
    const store = transaction.objectStore(this.STORE_NAME)

    return new Promise((resolve, reject) => {
      const request = store.clear()

      request.onsuccess = () => {
        this.stats = {
          totalImages: 0,
          totalSize: 0,
          cacheHits: 0,
          cacheMisses: 0
        }
        resolve()
      }

      request.onerror = () => reject(request.error)
    })
  }

  getStats(): CacheStats {
    return { ...this.stats }
  }

  async findSimilarImages(targetHash: string, threshold: number = 10): Promise<string[]> {
    if (!this.db) {
      await this.init()
    }
    if (!this.db) return []

    const transaction = this.db.transaction([this.STORE_NAME], 'readonly')
    const store = transaction.objectStore(this.STORE_NAME)
    const index = store.index('hash')

    return new Promise((resolve, reject) => {
      const request = index.getAll()

      request.onsuccess = () => {
        const cachedImages = request.result as CachedImage[]
        const similarUrls: string[] = []

        for (const cachedImage of cachedImages) {
          if (cachedImage.hash) {
            const distance = this.hammingDistance(targetHash, cachedImage.hash)
            if (distance <= threshold) {
              similarUrls.push(cachedImage.url)
            }
          }
        }

        resolve(similarUrls)
      }

      request.onerror = () => reject(request.error)
    })
  }

  private hammingDistance(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length) return Infinity

    let distance = 0
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) distance++
    }
    return distance
  }
}

export const imageCacheService = new ImageCacheService()