/**
 * Content Script Image Cache Service
 * 为 content script 提供图片缓存功能，使用本地缓存的图片而不是直接请求 URL
 */

import { imageCache, getCachedImage, cacheImage, isImageCached } from '@/utils/imageCache'

export interface ContentImageCacheOptions {
  enableCache?: boolean
  fallbackToOriginal?: boolean
  preloadOnHover?: boolean
  maxCacheSize?: number
}

class ContentImageCacheService {
  private options: Required<ContentImageCacheOptions>
  private isInitialized = false
  private preloadQueue = new Set<string>()
  private preloadTimeout: number | null = null
  private listeners: Array<{ event: string; handler: EventListener }> = []

  constructor(options: ContentImageCacheOptions = {}) {
    this.options = {
      enableCache: options.enableCache ?? true,
      fallbackToOriginal: options.fallbackToOriginal ?? true,
      preloadOnHover: options.preloadOnHover ?? true,
      maxCacheSize: options.maxCacheSize ?? 50 * 1024 * 1024 // 50MB
    }
  }

  /**
   * 初始化缓存服务
   */
  async init(): Promise<void> {
    if (this.isInitialized) return

    try {
      // 检查是否启用了图片缓存功能
      const enableCache = await this.getSetting('enableContentImageCache')
      if (enableCache === false) {
        console.log('[ContentImageCache] Image cache disabled by settings')
        this.options.enableCache = false
        return
      }

      await imageCache.init()
      this.isInitialized = true
      console.log('[ContentImageCache] Initialized successfully')

      // 设置预加载监听器
      if (this.options.preloadOnHover) {
        this.setupPreloadListeners()
      }
    } catch (error) {
      console.error('[ContentImageCache] Failed to initialize:', error)
      this.options.enableCache = false
    }
  }

  /**
   * 获取缓存的图片 URL 或原始 URL
   */
  async getImageUrl(originalUrl: string): Promise<string> {
    if (!this.options.enableCache) {
      return originalUrl
    }

    if (!this.isInitialized) {
      await this.init()
    }

    if (!this.options.enableCache) {
      return originalUrl
    }

    try {
      // 检查是否已缓存
      const isCached = await isImageCached(originalUrl)
      if (isCached) {
        const cachedUrl = await getCachedImage(originalUrl)
        if (cachedUrl) {
          return cachedUrl
        }
      }

      // 如果未缓存且启用了预加载，异步缓存但不等待
      if (this.options.preloadOnHover) {
        this.preloadImage(originalUrl)
      }

      // 返回原始 URL 作为后备
      return this.options.fallbackToOriginal ? originalUrl : originalUrl
    } catch (error) {
      console.warn('[ContentImageCache] Error getting cached image:', error)
      return originalUrl
    }
  }

  /**
   * 预加载图片到缓存
   */
  async preloadImage(url: string): Promise<string | null> {
    if (!this.options.enableCache || !this.isInitialized) {
      return null
    }

    // 避免重复预加载
    if (this.preloadQueue.has(url)) {
      return null
    }

    this.preloadQueue.add(url)

    try {
      const cachedUrl = await cacheImage(url)
      console.log('[ContentImageCache] Preloaded image:', url)
      return cachedUrl
    } catch (error) {
      console.warn('[ContentImageCache] Failed to preload image:', url, error)
      return null
    } finally {
      this.preloadQueue.delete(url)
    }
  }

  /**
   * 批量预加载图片
   */
  async preloadImages(urls: string[]): Promise<number> {
    if (!this.options.enableCache || !this.isInitialized) {
      return 0
    }

    const uniqueUrls = [...new Set(urls)]
    let successCount = 0

    // 分批处理，避免一次性请求太多
    const batchSize = 3
    for (let i = 0; i < uniqueUrls.length; i += batchSize) {
      const batch = uniqueUrls.slice(i, i + batchSize)

      const results = await Promise.allSettled(batch.map(url => this.preloadImage(url)))

      successCount += results.filter(r => r.status === 'fulfilled' && r.value !== null).length
    }

    console.log(`[ContentImageCache] Preloaded ${successCount}/${uniqueUrls.length} images`)
    return successCount
  }

  /**
   * 设置鼠标悬停预加载监听器
   */
  private setupPreloadListeners(): void {
    // 监听鼠标悬停在表情图片上
    const mouseoverHandler = (event: Event) => {
      const target = event.target as HTMLElement
      const imgElement = target.closest('img, [data-emoji-url]')

      if (imgElement) {
        const url = imgElement.getAttribute('src') || imgElement.getAttribute('data-emoji-url')
        if (url && url.startsWith('http')) {
          // 延迟预加载，避免鼠标快速划过时触发过多请求
          if (this.preloadTimeout) {
            clearTimeout(this.preloadTimeout)
          }

          this.preloadTimeout = window.setTimeout(() => {
            this.preloadImage(url)
          }, 200)
        }
      }
    }

    // 鼠标移出时取消预加载
    const mouseoutHandler = (event: Event) => {
      const target = event.target as HTMLElement
      const imgElement = target.closest('img, [data-emoji-url]')

      if (imgElement && this.preloadTimeout) {
        clearTimeout(this.preloadTimeout)
        this.preloadTimeout = null
      }
    }

    document.addEventListener('mouseover', mouseoverHandler)
    document.addEventListener('mouseout', mouseoutHandler)

    this.listeners.push(
      { event: 'mouseover', handler: mouseoverHandler },
      { event: 'mouseout', handler: mouseoutHandler }
    )
  }

  /**
   * 销毁缓存服务，移除所有事件监听器
   */
  destroy(): void {
    for (const { event, handler } of this.listeners) {
      document.removeEventListener(event, handler)
    }
    this.listeners = []
    if (this.preloadTimeout) {
      clearTimeout(this.preloadTimeout)
      this.preloadTimeout = null
    }
    this.isInitialized = false
  }

  /**
   * 处理表情图片元素，替换为缓存版本
   */
  async processImageElement(imgElement: HTMLImageElement): Promise<void> {
    if (!this.options.enableCache || !imgElement.src) {
      return
    }

    const originalUrl = imgElement.src
    if (!originalUrl.startsWith('http')) {
      return
    }

    try {
      const cachedUrl = await this.getImageUrl(originalUrl)
      if (cachedUrl !== originalUrl) {
        // 替换为缓存版本
        imgElement.src = cachedUrl
        imgElement.setAttribute('data-original-url', originalUrl)

        // 添加缓存标识
        imgElement.setAttribute('data-cached', 'true')

        console.log('[ContentImageCache] Replaced with cached version:', originalUrl)
      }
    } catch (error) {
      console.warn('[ContentImageCache] Failed to process image element:', error)
    }
  }

  /**
   * 批量处理页面中的表情图片
   */
  async processPageImages(): Promise<number> {
    if (!this.options.enableCache) {
      return 0
    }

    // 查找可能的表情图片元素
    const imageSelectors = [
      'img[src*="emoji"]',
      'img[src*="emote"]',
      'img[data-emoji-url]',
      '.emoji img',
      '.emote img',
      '[class*="emoji"] img',
      '[class*="emote"] img'
    ]

    const allImages: HTMLImageElement[] = []

    for (const selector of imageSelectors) {
      const images = document.querySelectorAll(selector)
      allImages.push(...Array.from(images).filter(img => img instanceof HTMLImageElement))
    }

    // 去重
    const uniqueImages = Array.from(new Set(allImages))

    let processedCount = 0

    // 分批处理，避免阻塞 UI
    const batchSize = 5
    for (let i = 0; i < uniqueImages.length; i += batchSize) {
      const batch = uniqueImages.slice(i, i + batchSize)

      await Promise.all(batch.map(img => this.processImageElement(img)))

      processedCount += batch.length

      // 让出控制权，避免阻塞
      if (i + batchSize < uniqueImages.length) {
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    }

    console.log(`[ContentImageCache] Processed ${processedCount} images`)
    return processedCount
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStats(): Promise<any> {
    if (!this.isInitialized) {
      return null
    }

    try {
      return await imageCache.getCacheStats()
    } catch (error) {
      console.error('[ContentImageCache] Failed to get cache stats:', error)
      return null
    }
  }

  /**
   * 清理缓存
   */
  async clearCache(): Promise<void> {
    if (!this.isInitialized) {
      return
    }

    try {
      await imageCache.clearCache()
      console.log('[ContentImageCache] Cache cleared')
    } catch (error) {
      console.error('[ContentImageCache] Failed to clear cache:', error)
    }
  }

  /**
   * 从 background 获取设置
   */
  private async getSetting(key: string): Promise<any> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_EMOJI_SETTING',
        key
      })

      return response?.success ? response.value : null
    } catch (error) {
      console.warn('[ContentImageCache] Failed to get setting:', key, error)
      return null
    }
  }

  /**
   * 动态更新设置
   */
  async updateSettings(newOptions: Partial<ContentImageCacheOptions>): Promise<void> {
    this.options = { ...this.options, ...newOptions }

    if (newOptions.enableCache === false && this.isInitialized) {
      console.log('[ContentImageCache] Cache disabled')
    } else if (newOptions.enableCache === true && !this.isInitialized) {
      await this.init()
    }
  }
}

// 创建全局实例
export const contentImageCache = new ContentImageCacheService()

// 便捷函数
export async function getCachedImageUrl(originalUrl: string): Promise<string> {
  return contentImageCache.getImageUrl(originalUrl)
}

export async function preloadImageUrl(url: string): Promise<string | null> {
  return contentImageCache.preloadImage(url)
}

export async function processEmojiImages(): Promise<number> {
  return contentImageCache.processPageImages()
}

// 自动初始化
contentImageCache.init().catch(error => {
  console.error('[ContentImageCache] Auto-initialization failed:', error)
})
