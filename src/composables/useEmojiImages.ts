import { ref, computed, onUnmounted, watch } from 'vue'

import { useEmojiStore } from '@/stores/emojiStore'
import { getEmojiImageUrl, getEmojiImageUrlSync, preloadImages } from '@/utils/imageUrlHelper'
import type { Emoji } from '@/types/type'

export interface UseEmojiImagesOptions {
  /** Whether to preload images (default: true) */
  preload?: boolean
  /** Batch size for preloading (default: 3) */
  preloadBatchSize?: number
  /** Delay between batches in ms (default: 50) */
  preloadDelay?: number
  /** Debounce delay for updates in ms (default: 100) */
  updateDebounce?: number
  /** Only preload when active (for tabs) */
  preloadWhenActive?: boolean
}

/**
 * Composable for managing emoji image sources with caching and cleanup
 *
 * Features:
 * - Automatic blob URL cleanup
 * - Debounced updates
 * - Optional preloading
 * - Cache reuse
 *
 * @param emojis - Ref or computed array of emojis
 * @param options - Configuration options
 *
 * @example
 * ```ts
 * const { imageSources, getImageSrc } = useEmojiImages(() => props.emojis, {
 *   preload: true,
 *   preloadBatchSize: 3
 * })
 * ```
 */
export function useEmojiImages(emojis: () => Emoji[], options: UseEmojiImagesOptions = {}) {
  const {
    preload = true,
    preloadBatchSize = 3,
    preloadDelay = 50,
    updateDebounce = 100,
    preloadWhenActive = false
  } = options

  const emojiStore = useEmojiStore()
  const blobUrls = ref<Set<string>>(new Set())
  const imageSources = ref<Map<string, string>>(new Map())

  // Track if component is active (for conditional preloading)
  const isActive = ref(!preloadWhenActive)

  // Computed property to check if image caching is enabled
  const useCachedImages = computed(() => emojiStore.settings.useIndexedDBForImages)

  /**
   * Get image source for an emoji with caching support
   */
  const getImageSrc = async (emoji: Emoji): Promise<string> => {
    return getEmojiImageUrl(emoji, { preferCache: useCachedImages.value })
  }

  /**
   * Get image source synchronously (for immediate rendering)
   */
  const getImageSrcSync = (emoji: Emoji): string => {
    return getEmojiImageUrlSync(emoji, { preferCache: useCachedImages.value })
  }

  /**
   * Initialize image sources for all emojis
   */
  const initializeImageSources = async () => {
    const emojiList = emojis()
    if (emojiList.length === 0) {
      imageSources.value.clear()
      return
    }

    // Batch fetch all image sources
    const entries = await Promise.all(
      emojiList.map(async emoji => {
        const src = await getImageSrc(emoji)
        if (src.startsWith('blob:')) {
          blobUrls.value.add(src)
        }
        return [emoji.id, src] as const
      })
    )
    imageSources.value = new Map(entries)
  }

  /**
   * Update image sources when emojis change
   */
  let updateDebounceTimer: ReturnType<typeof setTimeout> | null = null
  const updateImageSources = async () => {
    // Debounce to avoid frequent updates
    if (updateDebounceTimer) {
      clearTimeout(updateDebounceTimer)
    }

    updateDebounceTimer = setTimeout(async () => {
      const emojiList = emojis()
      const currentEmojiIds = new Set(emojiList.map(e => e.id))

      // Clean up old blob URLs that are no longer needed
      for (const [emojiId, blobUrl] of imageSources.value) {
        if (!currentEmojiIds.has(emojiId) && blobUrl.startsWith('blob:')) {
          blobUrls.value.delete(blobUrl)
          URL.revokeObjectURL(blobUrl)
        }
      }

      // Batch fetch new image sources, reusing existing non-blob URLs
      const entries = await Promise.all(
        emojiList.map(async emoji => {
          const existing = imageSources.value.get(emoji.id)
          // Reuse existing URL if it's not a blob URL
          if (existing && !existing.startsWith('blob:')) {
            return [emoji.id, existing] as const
          }
          const src = await getImageSrc(emoji)
          if (src.startsWith('blob:')) {
            blobUrls.value.add(src)
          }
          return [emoji.id, src] as const
        })
      )

      imageSources.value = new Map(entries)
    }, updateDebounce)
  }

  /**
   * Preload images for better performance
   */
  const preloadEmojis = async () => {
    if (!preload || !useCachedImages.value || !isActive.value) {
      return
    }

    try {
      await preloadImages(emojis(), { batchSize: preloadBatchSize, delay: preloadDelay })
    } catch (error) {
      console.warn('Failed to preload images:', error)
    }
  }

  /**
   * Set active state (for conditional preloading)
   */
  const setActive = (active: boolean) => {
    isActive.value = active
    if (active && preloadWhenActive) {
      preloadEmojis()
    }
  }

  /**
   * Clean up all blob URLs and timers
   */
  const cleanup = () => {
    // Clear debounce timer
    if (updateDebounceTimer) {
      clearTimeout(updateDebounceTimer)
      updateDebounceTimer = null
    }

    // Revoke all blob URLs
    for (const blobUrl of blobUrls.value) {
      try {
        URL.revokeObjectURL(blobUrl)
      } catch (error) {
        console.warn('Failed to revoke blob URL:', blobUrl, error)
      }
    }
    blobUrls.value.clear()
    imageSources.value.clear()
  }

  // Initialize on creation
  initializeImageSources()

  // Preload if enabled
  if (preload && !preloadWhenActive) {
    preloadEmojis()
  }

  // Watch for emoji changes (shallow watch on array reference and length)
  watch(
    () => {
      const emojiList = emojis()
      return [emojiList, emojiList.length]
    },
    updateImageSources,
    { flush: 'post' }
  )

  // Clean up on unmount
  onUnmounted(cleanup)

  return {
    /** Map of emoji ID to image source URL */
    imageSources,
    /** Get image source asynchronously */
    getImageSrc,
    /** Get image source synchronously */
    getImageSrcSync,
    /** Set active state for conditional preloading */
    setActive,
    /** Whether image caching is enabled */
    useCachedImages,
    /** Manual cleanup function */
    cleanup
  }
}
