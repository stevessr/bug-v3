/**
 * Image Cache Service using IndexedDB
 * Optimized for perceptual hash calculation and duplicate detection
 */

export interface CachedImage {
  id: string
  url: string
  blob: Blob
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

      request.onupgradeneeded = event => {
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
    // Use the URL directly as the key - no hashing needed
    return url
  }

  private async updateStats(): Promise<void> {
    if (!this.db) return

    const transaction = this.db.transaction([this.STORE_NAME], 'readonly')
    const store = transaction.objectStore(this.STORE_NAME)

    // Use cursor iteration instead of getAll() to avoid memory bloat
    let totalImages = 0
    let totalSize = 0
    let oldestEntry: number | undefined
    let newestEntry: number | undefined

    const cursorRequest = store.openCursor()
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result
      if (cursor) {
        const img = cursor.value as CachedImage
        totalImages++
        totalSize += img.size

        if (oldestEntry === undefined || img.timestamp < oldestEntry) {
          oldestEntry = img.timestamp
        }
        if (newestEntry === undefined || img.timestamp > newestEntry) {
          newestEntry = img.timestamp
        }

        cursor.continue()
      } else {
        // Cursor finished - update stats
        this.stats.totalImages = totalImages
        this.stats.totalSize = totalSize
        this.stats.oldestEntry = oldestEntry
        this.stats.newestEntry = newestEntry
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

    const cachedImage: CachedImage = {
      id,
      url,
      blob,
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
          if (!this.db) {
            reject(new Error('Database not initialized'))
            return
          }
          const updateTransaction = this.db.transaction([this.STORE_NAME], 'readwrite')
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

    // Use count() first to check if cleanup is needed
    const transaction = this.db.transaction([this.STORE_NAME], 'readonly')
    const store = transaction.objectStore(this.STORE_NAME)

    const countRequest = store.count()
    countRequest.onsuccess = async () => {
      const count = countRequest.result

      // Quick check: if count is within limits and we haven't exceeded size recently, skip
      if (
        count <= this.MAX_CACHE_ENTRIES * 0.9 &&
        this.stats.totalSize <= this.MAX_CACHE_SIZE * 0.9
      ) {
        return
      }

      // Need to collect entries for cleanup - use cursor with minimal data
      if (!this.db) {
        throw new Error('Database not initialized')
      }
      const cleanupTransaction = this.db.transaction([this.STORE_NAME], 'readonly')
      const cleanupStore = cleanupTransaction.objectStore(this.STORE_NAME)

      const entries: Array<{
        id: string
        size: number
        lastAccessed: number
        accessCount: number
      }> = []
      let totalSize = 0

      const cursorRequest = cleanupStore.openCursor()
      cursorRequest.onsuccess = async () => {
        const cursor = cursorRequest.result
        if (cursor) {
          const img = cursor.value as CachedImage
          entries.push({
            id: img.id,
            size: img.size,
            lastAccessed: img.lastAccessed,
            accessCount: img.accessCount
          })
          totalSize += img.size
          cursor.continue()
        } else {
          // Cursor finished - check if cleanup needed
          const needsCleanup =
            entries.length > this.MAX_CACHE_ENTRIES || totalSize > this.MAX_CACHE_SIZE

          if (needsCleanup) {
            await this.cleanupCacheFromEntries(entries, totalSize, entries.length)
          }
        }
      }
    }
  }

  private async cleanupCacheFromEntries(
    entries: Array<{ id: string; size: number; lastAccessed: number; accessCount: number }>,
    totalSize: number,
    totalCount: number
  ): Promise<void> {
    if (!this.db) return

    const now = Date.now()

    // Sort by LRU (least recently used first)
    entries.sort((a, b) => {
      const aAge = now - a.lastAccessed
      const bAge = now - b.lastAccessed

      // First, prioritize very old entries
      if (aAge > this.MAX_AGE && bAge <= this.MAX_AGE) return -1
      if (bAge > this.MAX_AGE && aAge <= this.MAX_AGE) return 1

      // Then sort by last accessed time
      return a.lastAccessed - b.lastAccessed
    })

    // Determine which entries to remove
    const toRemove: string[] = []
    let currentSize = totalSize
    let currentCount = totalCount

    for (const entry of entries) {
      if (
        entry.accessCount <= 1 &&
        (currentCount > this.MAX_CACHE_ENTRIES || currentSize > this.MAX_CACHE_SIZE)
      ) {
        toRemove.push(entry.id)
        currentSize -= entry.size
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

  /**
   * 导出缓存数据为 .db 格式文件
   */
  async exportCache(): Promise<{
    data: ArrayBuffer
    filename: string
    metadata: {
      version: string
      exportDate: string
      totalImages: number
      totalSize: number
    }
  }> {
    if (!this.db) {
      await this.init()
    }
    if (!this.db) throw new Error('数据库未初始化')

    try {
      // 首先检查缓存统计
      const stats = await this.getCacheStats()
      console.log(
        `[ImageCacheService] 当前缓存统计：${stats.totalImages} 个图片，${stats.totalSize} bytes`
      )

      // 使用 IndexedDB 的原生备份功能
      const dbName = this.DB_NAME
      const db = this.db

      // 创建一个新的临时数据库用于导出
      console.log('[ImageCacheService] 开始导出数据库数据...')
      const exportData = await this.exportDatabaseData(db)

      if (exportData.images.length === 0) {
        console.warn('[ImageCacheService] 警告：没有找到任何缓存数据')
      }

      // 将数据序列化为二进制格式
      const metadata = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        totalImages: exportData.images.length,
        totalSize: exportData.images.reduce((sum: number, img: any) => sum + img.size, 0),
        dbName: this.DB_NAME,
        storeName: this.STORE_NAME,
        dbVersion: this.VERSION
      }

      console.log(
        `[ImageCacheService] 准备创建数据库文件：${metadata.totalImages} 个图片，总大小 ${(metadata.totalSize / 1024 / 1024).toFixed(2)}MB`
      )

      // 创建二进制格式的数据库文件
      const dbFile = await this.createDatabaseFile(exportData, metadata)
      const filename = `emoji-cache-${new Date().toISOString().split('T')[0]}.db`

      console.log(
        `[ImageCacheService] 导出缓存完成：${metadata.totalImages} 个图片，总大小 ${(metadata.totalSize / 1024 / 1024).toFixed(2)}MB, 文件大小 ${(dbFile.byteLength / 1024 / 1024).toFixed(2)}MB`
      )

      return { data: dbFile, filename, metadata }
    } catch (error) {
      console.error('[ImageCacheService] 导出缓存失败：', error)
      throw error
    }
  }

  /**
   * 获取缓存统计信息
   */
  private async getCacheStats(): Promise<{ totalImages: number; totalSize: number }> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve({ totalImages: 0, totalSize: 0 })
        return
      }

      const transaction = this.db.transaction([this.STORE_NAME], 'readonly')
      const store = transaction.objectStore(this.STORE_NAME)

      let totalImages = 0
      let totalSize = 0

      const cursorRequest = store.openCursor()
      cursorRequest.onsuccess = event => {
        const cursor = (event.target as IDBRequest).result

        if (cursor) {
          const img = cursor.value as CachedImage
          totalImages++
          totalSize += img.size
          cursor.continue()
        } else {
          resolve({ totalImages, totalSize })
        }
      }

      cursorRequest.onerror = () => reject(cursorRequest.error)
    })
  }

  /**
   * 导出数据库数据
   */
  private async exportDatabaseData(db: IDBDatabase): Promise<{ images: any[] }> {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readonly')
      const store = transaction.objectStore(this.STORE_NAME)

      const cachedImages: CachedImage[] = []
      const cursorRequest = store.openCursor()

      cursorRequest.onsuccess = event => {
        const cursor = (event.target as IDBRequest).result

        if (cursor) {
          const img = cursor.value as CachedImage
          cachedImages.push(img)
          cursor.continue()
        } else {
          // 游标完成，处理所有图片
          console.log(`[ImageCacheService] 从数据库获取到 ${cachedImages.length} 个缓存项`)

          // 将 Blob 转换为 ArrayBuffer 以便二进制存储
          Promise.all(
            cachedImages.map(async (img, index) => {
              try {
                const arrayBuffer = await this.blobToArrayBuffer(img.blob)
                if (index % 100 === 0) {
                  console.log(
                    `[ImageCacheService] 已处理 ${index + 1}/${cachedImages.length} 个图片`
                  )
                }
                return {
                  id: img.id,
                  url: img.url,
                  hash: img.hash,
                  timestamp: img.timestamp,
                  size: img.size,
                  lastAccessed: img.lastAccessed,
                  accessCount: img.accessCount,
                  data: arrayBuffer,
                  mimeType: img.blob.type
                }
              } catch (error) {
                console.error(`[ImageCacheService] 处理图片失败 ${img.url}:`, error)
                return null
              }
            })
          )
            .then(images => {
              const validImages = images.filter(img => img !== null)
              console.log(
                `[ImageCacheService] 成功处理 ${validImages.length} 个图片，${cachedImages.length - validImages.length} 个失败`
              )
              resolve({ images: validImages })
            })
            .catch(reject)
        }
      }

      cursorRequest.onerror = () => reject(cursorRequest.error)
    })
  }

  /**
   * 创建数据库文件格式
   */
  private async createDatabaseFile(
    exportData: { images: any[] },
    metadata: any
  ): Promise<ArrayBuffer> {
    // 创建文件头
    const header = new TextEncoder().encode('EMOJI_CACHE_DB_V1.0')

    // 序列化元数据
    const metadataBytes = new TextEncoder().encode(JSON.stringify(metadata))
    const metadataLength = new Uint32Array([metadataBytes.length])

    // 序列化图片数据
    const imageDataPromises = exportData.images.map(async img => {
      const urlBytes = new TextEncoder().encode(img.url)
      const hashBytes = img.hash ? new TextEncoder().encode(img.hash) : new Uint8Array(0)
      const mimeTypeBytes = new TextEncoder().encode(img.mimeType)
      const idBytes = new TextEncoder().encode(img.id)

      // 创建数据结构
      const entry = {
        id: img.id,
        idLength: idBytes.length,
        urlLength: urlBytes.length,
        hashLength: hashBytes.length,
        mimeTypeLength: mimeTypeBytes.length,
        timestamp: img.timestamp,
        size: img.size,
        lastAccessed: img.lastAccessed,
        accessCount: img.accessCount,
        dataLength: img.data.byteLength
      }

      return {
        header: entry,
        idBytes,
        urlBytes,
        hashBytes,
        mimeTypeBytes,
        dataArray: new Uint8Array(img.data)
      }
    })

    const imageData = await Promise.all(imageDataPromises)

    // 计算总大小 - 修复计算错误
    let totalSize = header.length + 4 + metadataBytes.length // header + metadata length + metadata
    for (const img of imageData) {
      totalSize += 64 // fixed header size
      totalSize += img.idBytes.length
      totalSize += img.urlBytes.length
      totalSize += img.hashBytes.length
      totalSize += img.mimeTypeBytes.length
      totalSize += img.dataArray.length
    }

    console.log(`[ImageCacheService] 计算的文件大小：${totalSize} bytes`)

    // 创建 ArrayBuffer
    const buffer = new ArrayBuffer(totalSize)
    const view = new Uint8Array(buffer)
    let offset = 0

    // 写入文件头
    if (offset + header.length > totalSize) throw new Error('文件头写入越界')
    view.set(header, offset)
    offset += header.length

    // 写入元数据长度和元数据
    if (offset + 4 > totalSize) throw new Error('元数据长度写入越界')
    view.set(new Uint8Array(metadataLength.buffer), offset)
    offset += 4

    if (offset + metadataBytes.length > totalSize) throw new Error('元数据写入越界')
    view.set(metadataBytes, offset)
    offset += metadataBytes.length

    // 写入图片数据
    for (const img of imageData) {
      // 检查是否有足够空间写入固定头部
      if (offset + 64 > totalSize) throw new Error('图片头部写入越界')

      // 写入头部信息 (64 bytes fixed)
      const headerView = new DataView(buffer, offset, 64)
      headerView.setUint32(0, img.header.idLength, true)
      headerView.setUint32(4, img.header.urlLength, true)
      headerView.setUint32(8, img.header.hashLength, true)
      headerView.setUint32(12, img.header.mimeTypeLength, true)
      headerView.setBigUint64(16, BigInt(img.header.timestamp), true)
      headerView.setUint32(24, img.header.size, true)
      headerView.setBigUint64(28, BigInt(img.header.lastAccessed), true)
      headerView.setUint32(36, img.header.accessCount, true)
      headerView.setUint32(40, img.header.dataLength, true)
      offset += 64

      // 写入 ID
      if (offset + img.idBytes.length > totalSize) throw new Error('ID 写入越界')
      view.set(img.idBytes, offset)
      offset += img.idBytes.length

      // 写入 URL
      if (offset + img.urlBytes.length > totalSize) throw new Error('URL 写入越界')
      view.set(img.urlBytes, offset)
      offset += img.urlBytes.length

      // 写入哈希
      if (offset + img.hashBytes.length > totalSize) throw new Error('哈希写入越界')
      view.set(img.hashBytes, offset)
      offset += img.hashBytes.length

      // 写入 MIME 类型
      if (offset + img.mimeTypeBytes.length > totalSize) throw new Error('MIME 类型写入越界')
      view.set(img.mimeTypeBytes, offset)
      offset += img.mimeTypeBytes.length

      // 写入图片数据
      if (offset + img.dataArray.length > totalSize) throw new Error('图片数据写入越界')
      view.set(img.dataArray, offset)
      offset += img.dataArray.length
    }

    console.log(`[ImageCacheService] 实际写入大小：${offset} bytes, 预期大小：${totalSize} bytes`)

    if (offset !== totalSize) {
      console.warn(
        `[ImageCacheService] 警告：实际写入大小 (${offset}) 与预期大小 (${totalSize}) 不匹配`
      )
    }

    return buffer
  }

  /**
   * 将 Blob 转换为 ArrayBuffer
   */
  private async blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(blob)
    })
  }

  /**
   * 从 .db 文件导入缓存数据
   */
  async importCache(arrayBuffer: ArrayBuffer): Promise<{
    imported: number
    skipped: number
    errors: string[]
  }> {
    if (!this.db) {
      await this.init()
    }
    if (!this.db) throw new Error('数据库未初始化')

    try {
      // 解析 .db 文件格式
      const { metadata, images } = await this.parseDatabaseFile(arrayBuffer)

      console.log(`[ImageCacheService] 开始导入缓存：${images.length} 个图片`)

      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite')
      const store = transaction.objectStore(this.STORE_NAME)

      let imported = 0
      let skipped = 0
      const errors: string[] = []

      for (const imgData of images) {
        try {
          // 检查是否已存在
          const existingRequest = store.get(imgData.id)

          await new Promise<void>((resolve, reject) => {
            existingRequest.onsuccess = async () => {
              try {
                const existing = existingRequest.result as CachedImage | undefined

                if (existing) {
                  // 如果已存在，检查是否需要更新
                  if (existing.timestamp >= imgData.timestamp) {
                    skipped++
                    resolve()
                    return
                  }
                }

                // 将 ArrayBuffer 转换为 Blob
                const blob = new Blob([imgData.data], { type: imgData.mimeType })

                const cachedImage: CachedImage = {
                  id: imgData.id,
                  url: imgData.url,
                  blob,
                  hash: imgData.hash,
                  timestamp: imgData.timestamp,
                  size: imgData.size,
                  lastAccessed: imgData.lastAccessed,
                  accessCount: imgData.accessCount
                }

                const putRequest = store.put(cachedImage)

                putRequest.onsuccess = () => {
                  imported++
                  resolve()
                }

                putRequest.onerror = () => {
                  errors.push(`导入失败 ${imgData.url}: ${putRequest.error}`)
                  resolve()
                }
              } catch (error) {
                errors.push(`处理失败 ${imgData.url}: ${error}`)
                resolve()
              }
            }

            existingRequest.onerror = () => {
              errors.push(`检查失败 ${imgData.url}: ${existingRequest.error}`)
              resolve()
            }
          })
        } catch (error) {
          errors.push(`处理图片失败 ${imgData.url}: ${error}`)
        }
      }

      // 更新统计信息
      await this.updateStats()

      console.log(
        `[ImageCacheService] 导入完成：${imported} 个新图片，${skipped} 个已跳过，${errors.length} 个错误`
      )

      return { imported, skipped, errors }
    } catch (error) {
      throw new Error(`导入缓存失败：${error}`)
    }
  }

  /**

     * 解析数据库文件格式

     */

  private async parseDatabaseFile(
    arrayBuffer: ArrayBuffer
  ): Promise<{ metadata: any; images: any[] }> {
    const view = new Uint8Array(arrayBuffer)

    let offset = 0

    // 检查文件头

    if (offset + 18 > arrayBuffer.byteLength) {
      throw new Error('文件不完整：无法读取文件头')
    }

    const header = new TextDecoder().decode(view.slice(offset, offset + 18))

    if (header !== 'EMOJI_CACHE_DB_V1.0') {
      throw new Error('无效的缓存文件格式')
    }

    offset += 18

    // 读取元数据长度和元数据

    if (offset + 4 > arrayBuffer.byteLength) {
      throw new Error('文件不完整：无法读取元数据长度')
    }

    const metadataLength = new DataView(arrayBuffer, offset, 4).getUint32(0, true)

    offset += 4

    if (offset + metadataLength > arrayBuffer.byteLength) {
      throw new Error('文件不完整：无法读取元数据')
    }

    const metadataBytes = view.slice(offset, offset + metadataLength)

    const metadata = JSON.parse(new TextDecoder().decode(metadataBytes))

    offset += metadataLength

    // 读取图片数据

    const images: any[] = []

    const endOffset = arrayBuffer.byteLength

    while (offset < endOffset) {
      // 检查是否有足够空间读取头部

      if (offset + 64 > endOffset) {
        throw new Error('文件不完整：无法读取图片头部')
      }

      // 读取头部信息 (64 bytes fixed)

      const headerView = new DataView(arrayBuffer, offset, 64)

      const idLength = headerView.getUint32(0, true)

      const urlLength = headerView.getUint32(4, true)

      const hashLength = headerView.getUint32(8, true)

      const mimeTypeLength = headerView.getUint32(12, true)

      const timestamp = Number(headerView.getBigUint64(16, true))

      const size = headerView.getUint32(24, true)

      const lastAccessed = Number(headerView.getBigUint64(28, true))

      const accessCount = headerView.getUint32(36, true)

      const dataLength = headerView.getUint32(40, true)

      offset += 64

      // 检查数据长度是否合理

      const totalEntrySize = idLength + urlLength + hashLength + mimeTypeLength + dataLength

      if (totalEntrySize > 100 * 1024 * 1024) {
        // 100MB 限制

        throw new Error('图片数据过大，可能文件已损坏')
      }

      // 读取 ID

      if (offset + idLength > endOffset) {
        throw new Error('文件不完整：无法读取 ID')
      }

      const id = new TextDecoder().decode(view.slice(offset, offset + idLength))

      offset += idLength

      // 读取 URL

      if (offset + urlLength > endOffset) {
        throw new Error('文件不完整：无法读取 URL')
      }

      const url = new TextDecoder().decode(view.slice(offset, offset + urlLength))

      offset += urlLength

      // 读取哈希

      if (hashLength > 0) {
        if (offset + hashLength > endOffset) {
          throw new Error('文件不完整：无法读取哈希')
        }

        const hash = new TextDecoder().decode(view.slice(offset, offset + hashLength))

        offset += hashLength
      }

      // 读取 MIME 类型

      if (offset + mimeTypeLength > endOffset) {
        throw new Error('文件不完整：无法读取 MIME 类型')
      }

      const mimeType = new TextDecoder().decode(view.slice(offset, offset + mimeTypeLength))

      offset += mimeTypeLength

      // 读取图片数据

      if (offset + dataLength > endOffset) {
        throw new Error('文件不完整：无法读取图片数据')
      }

      const data = view.slice(offset, offset + dataLength).buffer

      offset += dataLength

      images.push({
        id,

        url,

        hash: hashLength > 0 ? hash : undefined,

        mimeType,

        timestamp,

        size,

        lastAccessed,

        accessCount,

        data
      })
    }

    console.log(`[ImageCacheService] 成功解析 ${images.length} 个图片条目`)

    return { metadata, images }
  }
  /**
   * 将 Blob 转换为 Base64
   */
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  }

  /**
   * 将 Base64 转换为 Blob
   */
  private async base64ToBlob(base64: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
      try {
        // 移除 data URL 前缀
        const matches = base64.match(/^data:(.+?);base64,(.+)$/)
        if (!matches) {
          throw new Error('无效的 Base64 格式')
        }

        const mimeType = matches[1]
        const data = atob(matches[2])
        const bytes = new Uint8Array(data.length)

        for (let i = 0; i < data.length; i++) {
          bytes[i] = data.charCodeAt(i)
        }

        const blob = new Blob([bytes], { type: mimeType })
        resolve(blob)
      } catch (error) {
        reject(error)
      }
    })
  }
}

export const imageCacheService = new ImageCacheService()
