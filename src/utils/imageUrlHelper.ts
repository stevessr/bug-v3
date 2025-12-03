/**
 * Unified Image URL Handler
 * Provides consistent image URL handling with caching support across all components
 */

import { getCachedImage, cacheImage } from './imageCache'

import { useEmojiStore } from '@/stores/emojiStore'

export interface ImageUrlOptions {
  preferCache?: boolean
  fallbackUrl?: string
}

/**
 * Get the appropriate image URL for an emoji, respecting cache settings
 */
export async function getEmojiImageUrl(
  emoji: { displayUrl?: string; url: string; name?: string },
  options: ImageUrlOptions = {}
): Promise<string> {
  const { preferCache = true, fallbackUrl } = options
  const emojiStore = useEmojiStore()

  // Determine the primary URL to use
  const primaryUrl = emoji.displayUrl || emoji.url
  const finalFallbackUrl = fallbackUrl || emoji.url

  console.log(
    `[ImageUrlHelper] Getting image URL for ${emoji.name}, preferCache: ${preferCache}, cacheEnabled: ${emojiStore.settings.useIndexedDBForImages}`
  )

  // If caching is disabled or not preferred, return the direct URL
  if (!preferCache || !emojiStore.settings.useIndexedDBForImages) {
    console.log(
      `[ImageUrlHelper] Cache disabled for ${emoji.name}, returning direct URL:`,
      primaryUrl
    )
    return primaryUrl
  }

  try {
    // Try to get cached image first
    console.log(`[ImageUrlHelper] Checking cache for ${emoji.name}, URL:`, primaryUrl)
    const cachedUrl = await getCachedImage(primaryUrl)
    if (cachedUrl) {
      console.log(`[ImageUrlHelper] Found cached URL for ${emoji.name}:`, cachedUrl)
      return cachedUrl
    }

    console.log(`[ImageUrlHelper] No cached URL found for ${emoji.name}, attempting to cache...`)

    // If not cached, try to cache the image and return blob URL
    const blobUrl = await cacheImage(primaryUrl)
    if (blobUrl) {
      console.log(
        `[ImageUrlHelper] Successfully cached and created blob URL for ${emoji.name}:`,
        blobUrl
      )
      return blobUrl
    }

    console.log(
      `[ImageUrlHelper] Failed to create blob URL for ${emoji.name}, but caching may be in progress`
    )
  } catch (error) {
    console.warn(`[ImageUrlHelper] Failed to get cached image for ${emoji.name}:`, error)
  }

  // Instead of returning original URL, try to wait for cache to complete
  console.log(`[ImageUrlHelper] Attempting to wait for cache completion for ${emoji.name}`)

  // Try multiple times to get the cached image with delays
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await new Promise(resolve => setTimeout(resolve, 500)) // Wait 500ms
      const cachedUrl = await getCachedImage(primaryUrl)
      if (cachedUrl) {
        console.log(
          `[ImageUrlHelper] Retrieved cached URL after attempt ${attempt + 1} for ${emoji.name}:`,
          cachedUrl
        )
        return cachedUrl
      }
    } catch (error) {
      console.warn(`[ImageUrlHelper] Cache attempt ${attempt + 1} failed for ${emoji.name}:`, error)
    }
  }

  // Final fallback - only if all cache attempts fail
  console.warn(
    `[ImageUrlHelper] All cache attempts failed for ${emoji.name}, falling back to direct URL:`,
    finalFallbackUrl
  )
  return finalFallbackUrl
}

/**
 * Get image URL synchronously (for cases where async is not possible)
 * In cache mode, this will wait for cache or return a loading indicator
 */
export function getEmojiImageUrlSync(
  emoji: { displayUrl?: string; url: string; name?: string },
  options: ImageUrlOptions = {}
): string {
  const { preferCache = true, fallbackUrl } = options
  const emojiStore = useEmojiStore()

  // Determine the primary URL to use
  const primaryUrl = emoji.displayUrl || emoji.url
  const finalFallbackUrl = fallbackUrl || emoji.url

  console.log(
    `[ImageUrlHelper] Sync get image URL for ${emoji.name}, preferCache: ${preferCache}, cacheEnabled: ${emojiStore.settings.useIndexedDBForImages}`
  )

  // If caching is disabled or not preferred, return the direct URL
  if (!preferCache || !emojiStore.settings.useIndexedDBForImages) {
    console.log(
      `[ImageUrlHelper] Cache disabled for ${emoji.name}, returning direct URL:`,
      primaryUrl
    )
    return primaryUrl
  }

  // In cache mode, check if image is already cached synchronously
  try {
    // Try to get cached image synchronously (if available)
    console.log(`[ImageUrlHelper] Checking sync cache for ${emoji.name}, URL:`, primaryUrl)

    // Since we can't do async here, we'll trigger background cache and return a placeholder
    // The component should handle the async loading properly
    triggerBackgroundCache(primaryUrl).catch(error => {
      console.warn('[ImageUrlHelper] Background caching failed for', emoji.name, error)
    })

    console.log(
      `[ImageUrlHelper] Triggered background cache for ${emoji.name}, returning original URL temporarily`
    )

    // Return original URL for now, but the component should handle the async update
    // This is a limitation of sync calls - they can't wait for async operations
    return primaryUrl
  } catch (error) {
    console.warn('[ImageUrlHelper] Sync cache check failed for', emoji.name, error)
    return primaryUrl
  }
}

/**
 * Get image URL with loading state - returns cached URL if available, otherwise loads and caches
 */
export async function getEmojiImageUrlWithLoading(
  emoji: { displayUrl?: string; url: string; name?: string },
  options: ImageUrlOptions = {}
): Promise<{ url: string; isLoading: boolean; isFromCache: boolean }> {
  const { preferCache = true, fallbackUrl } = options
  const emojiStore = useEmojiStore()

  // Determine the primary URL to use
  const primaryUrl = emoji.displayUrl || emoji.url
  const finalFallbackUrl = fallbackUrl || emoji.url

  console.log(`[ImageUrlHelper] Getting image URL with loading for ${emoji.name}`)

  // If caching is disabled or not preferred, return direct URL
  if (!preferCache || !emojiStore.settings.useIndexedDBForImages) {
    return { url: primaryUrl, isLoading: false, isFromCache: false }
  }

  try {
    // Try to get cached image first
    const cachedUrl = await getCachedImage(primaryUrl)
    if (cachedUrl) {
      console.log(`[ImageUrlHelper] Found cached URL for ${emoji.name}:`, cachedUrl)
      return { url: cachedUrl, isLoading: false, isFromCache: true }
    }

    // If not cached, we need to load and cache it
    console.log(`[ImageUrlHelper] No cached URL found for ${emoji.name}, loading and caching...`)

    // Start caching process
    const cachePromise = cacheImage(primaryUrl)

    // Wait for caching to complete
    const blobUrl = await cachePromise
    if (blobUrl) {
      console.log(
        `[ImageUrlHelper] Successfully cached and created blob URL for ${emoji.name}:`,
        blobUrl
      )
      return { url: blobUrl, isLoading: false, isFromCache: true }
    }

    // If caching failed, try a few more times with delays
    for (let attempt = 0; attempt < 3; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 300))
      const cachedUrl = await getCachedImage(primaryUrl)
      if (cachedUrl) {
        console.log(
          `[ImageUrlHelper] Retrieved cached URL after attempt ${attempt + 1} for ${emoji.name}:`,
          cachedUrl
        )
        return { url: cachedUrl, isLoading: false, isFromCache: true }
      }
    }

    console.warn(`[ImageUrlHelper] All cache attempts failed for ${emoji.name}`)
    return { url: finalFallbackUrl, isLoading: false, isFromCache: false }
  } catch (error) {
    console.error(`[ImageUrlHelper] Error loading image for ${emoji.name}:`, error)
    return { url: finalFallbackUrl, isLoading: false, isFromCache: false }
  }
}
/**
 * Trigger background caching for an image URL
 */
async function triggerBackgroundCache(url: string): Promise<void> {
  try {
    const isCached = await getCachedImage(url)
    if (!isCached) {
      await cacheImage(url)
      console.log(`[ImageUrlHelper] Background cache completed for URL:`, url)
    } else {
      console.log(`[ImageUrlHelper] URL already cached:`, url)
    }
  } catch (error) {
    console.warn('[ImageUrlHelper] Background cache failed for URL:', url, error)
  }
}

/**
 * Check if an image is cached
 */
export async function isImageCached(emoji: { displayUrl?: string; url: string }): Promise<boolean> {
  const primaryUrl = emoji.displayUrl || emoji.url
  const { isImageCached } = await import('./imageCache')
  return isImageCached(primaryUrl)
}

/**
 * Preload multiple images into cache
 */
export async function preloadImages(
  emojis: Array<{ displayUrl?: string; url: string; name?: string }>,
  options: { batchSize?: number; delay?: number } = {}
): Promise<void> {
  const { batchSize = 5, delay = 100 } = options
  const emojiStore = useEmojiStore()

  if (!emojiStore.settings.useIndexedDBForImages) {
    return // Skip if caching is disabled
  }

  for (let i = 0; i < emojis.length; i += batchSize) {
    const batch = emojis.slice(i, i + batchSize)

    await Promise.allSettled(
      batch.map(async emoji => {
        const url = emoji.displayUrl || emoji.url
        try {
          const isCached = await getCachedImage(url)
          if (!isCached) {
            await cacheImage(url)
          }
        } catch (error) {
          console.warn(`Failed to preload image for ${emoji.name || 'unknown'}:`, error)
        }
      })
    )

    // Add delay between batches to prevent overwhelming the browser
    if (i + batchSize < emojis.length) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}
