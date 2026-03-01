/**
 * Unified Image URL Handler
 * Provides consistent image URL handling with caching support across all components
 * 优化版本：利用增强的图片缓存系统
 */

import { useEmojiStore } from '@/stores'
import { resolveImageCacheStrategy, shouldPreferCache } from '@/utils/imageCachePolicy'

declare const __ENABLE_LOGGING__: boolean

export interface ImageUrlOptions {
  preferCache?: boolean
  fallbackUrl?: string
}

// 内存缓存：避免重复计算 cache-busting 参数
const urlCache = new Map<string, string>()
const URL_CACHE_MAX_SIZE = 2000

/**
 * Add cache-busting parameter to URL to force refresh when emoji is updated
 * 优化：使用内存缓存避免重复计算
 */
function hashString(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

export function addCacheBustingParam(url: string, emoji: { id?: string; packet?: number }): string {
  if (!url) return url

  // 检查缓存
  const safeId = emoji.id || ''
  const cacheKey = `${url}|${safeId || 'no-id'}|${emoji.packet || ''}`
  const cached = urlCache.get(cacheKey)
  if (cached) return cached

  // Use packet number as version indicator, fallback to id hash if not available
  const version = emoji.packet || (safeId ? safeId.substring(0, 8) : hashString(url))
  const separator = url.includes('?') ? '&' : '?'
  const result = `${url}${separator}v=${version}`

  // 存入缓存，限制大小
  if (urlCache.size >= URL_CACHE_MAX_SIZE) {
    // 清除最早的一半条目
    const keysToDelete = Array.from(urlCache.keys()).slice(0, URL_CACHE_MAX_SIZE / 2)
    keysToDelete.forEach(k => urlCache.delete(k))
  }
  urlCache.set(cacheKey, result)

  return result
}

// 日志工具
function log(message: string, ...args: any[]) {
  if (typeof __ENABLE_LOGGING__ !== 'undefined' && __ENABLE_LOGGING__) {
    console.log(`[ImageUrlHelper] ${message}`, ...args)
  }
}

/**
 * Get the appropriate image URL for an emoji, respecting cache settings
 * 优化：减少日志输出，使用更智能的重试策略
 */
export async function getEmojiImageUrl(
  emoji: { id?: string; displayUrl?: string; url: string; name?: string; packet?: number },
  options: ImageUrlOptions = {}
): Promise<string> {
  const { preferCache = true, fallbackUrl } = options
  const emojiStore = useEmojiStore()
  const strategy = resolveImageCacheStrategy(emojiStore.settings)

  // Determine the primary URL to use with cache-busting
  const primaryUrl = addCacheBustingParam(emoji.displayUrl || emoji.url || '', emoji)
  const finalFallbackUrl = addCacheBustingParam(fallbackUrl || emoji.url || '', emoji)

  const preferCacheNow = preferCache && shouldPreferCache(emojiStore.settings, primaryUrl)

  // If caching is disabled or not preferred, return the direct URL
  if (!preferCacheNow || strategy === 'force-source') {
    return primaryUrl
  }

  try {
    // Try to get cached image first (now includes memory cache layer)
    const { getCachedImage, cacheImage } = await import('./imageCache')
    const cachedUrl = await getCachedImage(primaryUrl)
    if (cachedUrl) {
      return cachedUrl
    }

    // If not cached, try to cache the image and return blob URL
    const blobUrl = await cacheImage(primaryUrl)
    if (blobUrl) {
      return blobUrl
    }
  } catch (error) {
    // 静默失败，仅在开发模式下记录
    log(`Failed to get cached image for ${emoji.name}:`, error)
  }

  return finalFallbackUrl
}

/**
 * Get image URL synchronously (for cases where async is not possible)
 * In cache mode, this will wait for cache or return a loading indicator
 * 优化：减少日志输出
 */
export function getEmojiImageUrlSync(
  emoji: { id?: string; displayUrl?: string; url: string; name?: string; packet?: number },
  options: ImageUrlOptions = {}
): string {
  const { preferCache = true } = options
  const emojiStore = useEmojiStore()
  const strategy = resolveImageCacheStrategy(emojiStore.settings)

  // Determine the primary URL to use with cache-busting
  const primaryUrl = addCacheBustingParam(emoji.displayUrl || emoji.url || '', emoji)

  const preferCacheNow = preferCache && shouldPreferCache(emojiStore.settings, primaryUrl)

  // If caching is disabled or not preferred, return the direct URL with cache-busting
  if (!preferCacheNow || strategy === 'force-source') {
    return primaryUrl
  }

  // In cache mode, trigger background cache and return original URL
  try {
    triggerBackgroundCache(primaryUrl).catch(() => {
      // 静默失败
    })
    return primaryUrl
  } catch {
    return primaryUrl
  }
}

/**
 * Get image URL with loading state - returns cached URL if available, otherwise loads and caches
 * 优化：减少日志和重试次数
 */
export async function getEmojiImageUrlWithLoading(
  emoji: { id?: string; displayUrl?: string; url: string; name?: string; packet?: number },
  options: ImageUrlOptions = {}
): Promise<{ url: string; isLoading: boolean; isFromCache: boolean }> {
  const { preferCache = true, fallbackUrl } = options
  const emojiStore = useEmojiStore()
  const strategy = resolveImageCacheStrategy(emojiStore.settings)

  // Determine the primary URL to use with cache-busting
  const primaryUrl = addCacheBustingParam(emoji.displayUrl || emoji.url || '', emoji)
  const finalFallbackUrl = addCacheBustingParam(fallbackUrl || emoji.url || '', emoji)

  const preferCacheNow = preferCache && shouldPreferCache(emojiStore.settings, primaryUrl)

  // If caching is disabled or not preferred, return direct URL with cache-busting
  if (!preferCacheNow || strategy === 'force-source') {
    return { url: primaryUrl, isLoading: false, isFromCache: false }
  }

  try {
    // Try to get cached image first (now includes memory cache)
    const { getCachedImage, cacheImage } = await import('./imageCache')
    const cachedUrl = await getCachedImage(primaryUrl)
    if (cachedUrl) {
      return { url: cachedUrl, isLoading: false, isFromCache: true }
    }

    // If not cached, we need to load and cache it
    const blobUrl = await cacheImage(primaryUrl)
    if (blobUrl) {
      return { url: blobUrl, isLoading: false, isFromCache: true }
    }

    return { url: finalFallbackUrl, isLoading: false, isFromCache: false }
  } catch {
    return { url: finalFallbackUrl, isLoading: false, isFromCache: false }
  }
}

/**
 * Trigger background caching for an image URL
 * 优化：使用内存缓存避免重复触发
 */
const backgroundCacheInProgress = new Set<string>()

async function triggerBackgroundCache(url: string): Promise<void> {
  // 避免重复触发同一 URL 的缓存
  if (backgroundCacheInProgress.has(url)) {
    return
  }

  backgroundCacheInProgress.add(url)

  try {
    const { getCachedImage, cacheImage } = await import('./imageCache')
    const isCached = await getCachedImage(url)
    if (!isCached) {
      await cacheImage(url)
    }
  } finally {
    // 延迟移除，避免短时间内重复触发
    setTimeout(() => {
      backgroundCacheInProgress.delete(url)
    }, 5000)
  }
}

/**
 * Preload multiple images into cache
 * 优化：使用新的批量预加载 API
 */
export async function preloadImages(
  emojis: Array<{ id?: string; displayUrl?: string; url: string; name?: string; packet?: number }>,
  options: { batchSize?: number; delay?: number; toMemory?: boolean } = {}
): Promise<void> {
  const { batchSize = 6, delay = 50, toMemory = true } = options
  const emojiStore = useEmojiStore()
  const strategy = resolveImageCacheStrategy(emojiStore.settings)

  if (strategy === 'force-source') {
    return // Skip if caching is disabled
  }

  // 构建 URL 列表
  const urls = emojis.map(emoji => addCacheBustingParam(emoji.displayUrl || emoji.url || '', emoji))

  // 如果只需要加载到内存，使用更快的方法
  if (toMemory) {
    const { preloadToMemory } = await import('./imageCache')
    await preloadToMemory(urls)
    return
  }

  // 批量缓存
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize)

    await Promise.allSettled(
      batch.map(async url => {
        try {
          const { getCachedImage, cacheImage } = await import('./imageCache')
          const isCached = await getCachedImage(url)
          if (!isCached) {
            await cacheImage(url)
          }
        } catch {
          // 静默失败
        }
      })
    )

    // Add delay between batches to prevent overwhelming the browser
    if (i + batchSize < urls.length && delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

/**
 * 批量获取图片 URL（优化版）
 */
export async function getEmojiImageUrls(
  emojis: Array<{ id?: string; displayUrl?: string; url: string; name?: string; packet?: number }>,
  options: ImageUrlOptions = {}
): Promise<Map<string, string>> {
  const { preferCache = true } = options
  const emojiStore = useEmojiStore()
  const strategy = resolveImageCacheStrategy(emojiStore.settings)
  const results = new Map<string, string>()

  // If caching is disabled or strategy prefers source, just return direct URLs
  if (!preferCache || strategy === 'force-source' || strategy === 'auto') {
    for (const emoji of emojis) {
      const url = addCacheBustingParam(emoji.displayUrl || emoji.url || '', emoji)
      if (emoji.id) {
        results.set(emoji.id, url)
      }
    }
    return results
  }

  // 批量处理
  const { cacheImages } = await import('./imageCache')
  const urls = emojis.map(emoji => addCacheBustingParam(emoji.displayUrl || emoji.url || '', emoji))

  if (strategy === 'adaptive') {
    const adaptiveUrls = urls.filter(url => shouldPreferCache(emojiStore.settings, url))
    if (adaptiveUrls.length === 0) {
      for (let i = 0; i < emojis.length; i++) {
        const id = emojis[i]?.id
        if (!id) continue
        results.set(id, urls[i] || '')
      }
      return results
    }

    const cacheResults = await cacheImages(adaptiveUrls, { concurrency: 4 })
    for (let i = 0; i < emojis.length; i++) {
      const id = emojis[i]?.id
      if (!id) continue
      const url = urls[i]
      const cachedUrl = cacheResults.get(url)
      const resolved = typeof cachedUrl === 'string' ? cachedUrl : undefined
      results.set(id, resolved || url || '')
    }
    return results
  }

  const cacheResults = await cacheImages(urls, { concurrency: 4 })

  for (let i = 0; i < emojis.length; i++) {
    const emoji = emojis[i]
    const url = urls[i]
    const cachedUrl = cacheResults.get(url)

    if (cachedUrl && typeof cachedUrl === 'string') {
      if (emoji.id) {
        results.set(emoji.id, cachedUrl)
      }
    } else {
      if (emoji.id) {
        results.set(emoji.id, addCacheBustingParam(emoji.displayUrl || emoji.url || '', emoji))
      }
    }
  }

  return results
}
