import { ref, computed, onUnmounted, watch } from 'vue'

import { useEmojiStore } from '@/stores/emojiStore'
import { getEmojiImageUrl, getEmojiImageUrlSync, preloadImages } from '@/utils/imageUrlHelper'
import {
  resolveImageCacheStrategy,
  shouldPreferCache,
  shouldUseImageCache
} from '@/utils/imageCachePolicy'
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
  /** Batch size for resolving image sources (default: 40) */
  sourceBatchSize?: number
  /** Delay between source batches in ms (default: 0) */
  sourceBatchDelay?: number
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
    preloadWhenActive = false,
    sourceBatchSize = 40,
    sourceBatchDelay = 0
  } = options

  const emojiStore = useEmojiStore()
  const blobUrls = ref<Set<string>>(new Set())
  const imageSources = ref<Map<string, string>>(new Map())

  // Track if component is active (for conditional preloading)
  const isActive = ref(!preloadWhenActive)

  // Computed property to check if image caching is enabled
  const useCachedImages = computed(() => shouldUseImageCache(emojiStore.settings))

  /**
   * Get image source for an emoji with caching support
   */
  const getImageSrc = async (emoji: Emoji): Promise<string> => {
    const preferCache = shouldPreferCache(emojiStore.settings, emoji.displayUrl || emoji.url || '')
    return getEmojiImageUrl(emoji, { preferCache })
  }

  /**
   * Get image source synchronously (for immediate rendering)
   */
  const getImageSrcSync = (emoji: Emoji): string => {
    const preferCache = shouldPreferCache(emojiStore.settings, emoji.displayUrl || emoji.url || '')
    return getEmojiImageUrlSync(emoji, { preferCache })
  }

  const resolveSourceBatch = async (emojiList: Emoji[]): Promise<Map<string, string>> => {
    const results = await Promise.all(
      emojiList.map(async emoji => {
        const src = await getImageSrc(emoji)
        if (src.startsWith('blob:')) {
          blobUrls.value.add(src)
        }
        return [emoji.id, src] as const
      })
    )
    const entries = new Map<string, string>()
    for (const [id, src] of results) {
      entries.set(id, src)
    }
    return entries
  }

  const waitForIdle = (skipIdle = false) =>
    new Promise<void>(resolve => {
      if (skipIdle) {
        resolve()
        return
      }
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(() => resolve(), { timeout: 100 })
      } else {
        setTimeout(resolve, 0)
      }
    })

  /**
   * Initialize image sources for all emojis
   */
  const initializeImageSources = async () => {
    const emojiList = emojis()
    if (emojiList.length === 0) {
      imageSources.value.clear()
      return
    }

    const nextMap = new Map<string, string>()
    for (let i = 0; i < emojiList.length; i += sourceBatchSize) {
      const batch = emojiList.slice(i, i + sourceBatchSize)
      await waitForIdle(i === 0)
      const batchEntries = await resolveSourceBatch(batch)
      for (const [id, src] of batchEntries) {
        nextMap.set(id, src)
      }
      if (sourceBatchDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, sourceBatchDelay))
      }
      imageSources.value = new Map(nextMap)
    }
  }

  /**
   * Update image sources when emojis change
   * 优化：添加 grace period 防止过早释放正在使用的 Blob URL
   */
  let updateDebounceTimer: ReturnType<typeof setTimeout> | null = null
  const pendingRevocations = new Map<string, ReturnType<typeof setTimeout>>()

  const updateImageSources = async () => {
    // Debounce to avoid frequent updates
    if (updateDebounceTimer) {
      clearTimeout(updateDebounceTimer)
    }

    updateDebounceTimer = setTimeout(async () => {
      const emojiList = emojis()
      const currentEmojiIds = new Set(emojiList.map(e => e.id))

      // Schedule blob URL revocation with grace period (500ms)
      // This prevents "broken image" icons during rapid filtering
      for (const [emojiId, blobUrl] of imageSources.value) {
        if (!currentEmojiIds.has(emojiId) && blobUrl.startsWith('blob:')) {
          // Cancel any existing pending revocation for this URL
          const existing = pendingRevocations.get(blobUrl)
          if (existing) {
            clearTimeout(existing)
          }

          // Schedule revocation after grace period
          const timer = setTimeout(() => {
            try {
              URL.revokeObjectURL(blobUrl)
              blobUrls.value.delete(blobUrl)
              pendingRevocations.delete(blobUrl)
            } catch (error) {
              console.warn('Failed to revoke blob URL:', blobUrl, error)
            }
          }, 500) // 500ms grace period

          pendingRevocations.set(blobUrl, timer)
        }
      }

      const nextMap = new Map<string, string>()
      for (let i = 0; i < emojiList.length; i += sourceBatchSize) {
        const batch = emojiList.slice(i, i + sourceBatchSize)
        await waitForIdle(i === 0)

        const resolved = await Promise.all(
          batch.map(async emoji => {
            const existing = imageSources.value.get(emoji.id)
            if (existing && !existing.startsWith('blob:')) {
              const pending = pendingRevocations.get(existing)
              if (pending) {
                clearTimeout(pending)
                pendingRevocations.delete(existing)
              }
              return [emoji.id, existing] as const
            }

            const src = await getImageSrc(emoji)
            if (src.startsWith('blob:')) {
              blobUrls.value.add(src)
              const pending = pendingRevocations.get(src)
              if (pending) {
                clearTimeout(pending)
                pendingRevocations.delete(src)
              }
            }
            return [emoji.id, src] as const
          })
        )

        for (const [id, src] of resolved) {
          nextMap.set(id, src)
        }

        if (sourceBatchDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, sourceBatchDelay))
        }
        imageSources.value = new Map(nextMap)
      }
    }, updateDebounce)
  }

  /**
   * Preload images for better performance
   */
  const preloadEmojis = async () => {
    if (!preload || !useCachedImages.value || !isActive.value) {
      return
    }

    const strategy = resolveImageCacheStrategy(emojiStore.settings)
    const emojiList = emojis().filter(e =>
      shouldPreferCache(emojiStore.settings, e.displayUrl || e.url || '')
    )
    if (strategy === 'auto' && emojiList.length === 0) {
      return
    }

    try {
      await preloadImages(emojiList.length ? emojiList : emojis(), {
        batchSize: preloadBatchSize,
        delay: preloadDelay
      })
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

    // Clear all pending revocations
    for (const timer of pendingRevocations.values()) {
      clearTimeout(timer)
    }
    pendingRevocations.clear()

    // Revoke all blob URLs immediately
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
