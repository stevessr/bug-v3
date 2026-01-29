import { ref, computed } from 'vue'

import { useCacheExportImport } from './useCacheExportImport'

import { addCacheBustingParam } from '@/utils/imageUrlHelper'
import { isImageCached } from '@/utils/imageCache'
import type { EmojiGroup } from '@/types/type'

export function useImageCache(emojiStore: any, totalEmojis: any) {
  // State
  const isCaching = ref(false)
  const cacheError = ref('')
  const cachedCount = ref(0)
  const realCachedCount = ref(0)
  const totalCount = ref(0)
  const currentCacheGroup = ref('')
  const currentCacheEmoji = ref('')
  const shouldStopCaching = ref(false)
  const isRefreshingStats = ref(false)

  // Progress State
  const totalProgress = ref(0)
  const totalProcessedCount = ref(0)
  const totalImageCount = ref(0)

  const groupProgress = ref(0)
  const processedGroupCount = ref(0)
  const totalGroupCount = ref(0)

  const currentGroupProgress = ref(0)
  const currentGroupProcessedCount = ref(0)
  const currentGroupImageCount = ref(0)

  // Computed
  const cacheStats = computed(() => {
    return { total: totalEmojis.value, cached: realCachedCount.value }
  })

  // Methods
  const refreshCacheStats = async () => {
    isRefreshingStats.value = true
    try {
      const { imageCache } = await import('@/utils/imageCache')
      await imageCache.init()
      const stats = await imageCache.getCacheStats()
      realCachedCount.value = stats.totalEntries
    } catch (error) {
      console.error('Failed to get cache stats:', error)
    } finally {
      isRefreshingStats.value = false
    }
  }

  const { isExporting, isImporting, exportImportError, exportCache, importCache } =
    useCacheExportImport(refreshCacheStats)

  const stopCaching = () => {
    shouldStopCaching.value = true
    message.info('正在停止缓存进程...')
  }

  const clearImageCache = async () => {
    try {
      const { imageCache } = await import('@/utils/imageCache')
      await imageCache.clearCache()
      message.success('已清空图片缓存')
      await refreshCacheStats()
    } catch (error) {
      message.error('清空图片缓存失败')
      console.error('Clear image cache error:', error)
    }
  }

  const cacheAllImages = async () => {
    isCaching.value = true
    shouldStopCaching.value = false
    cacheError.value = ''
    cachedCount.value = 0
    realCachedCount.value = 0
    totalCount.value = 0
    currentCacheGroup.value = ''
    currentCacheEmoji.value = ''

    // Reset progress
    totalProgress.value = 0
    totalProcessedCount.value = 0
    totalImageCount.value = 0
    groupProgress.value = 0
    processedGroupCount.value = 0
    totalGroupCount.value = 0
    currentGroupProgress.value = 0
    currentGroupProcessedCount.value = 0
    currentGroupImageCount.value = 0

    try {
      const { imageCache } = await import('@/utils/imageCache')
      await imageCache.init()

      let totalImages = 0
      const validGroups = emojiStore.groups.filter(
        (group: EmojiGroup) => group.emojis && group.emojis.length > 0
      )
      totalGroupCount.value = validGroups.length

      for (const group of validGroups) {
        totalImages += group.emojis.length
      }
      totalImageCount.value = totalImages
      totalCount.value = totalImages

      let processedImages = 0
      let processedGroups = 0

      for (const group of validGroups) {
        if (shouldStopCaching.value) break

        currentCacheGroup.value = group.name
        currentGroupImageCount.value = group.emojis.length
        currentGroupProcessedCount.value = 0
        currentGroupProgress.value = 0

        for (const emoji of group.emojis) {
          if (shouldStopCaching.value) break

          const url = addCacheBustingParam(emoji.displayUrl || emoji.url, emoji)
          currentCacheEmoji.value = emoji.name

          try {
            const isCached = await isImageCached(url)
            if (!isCached) {
              const { imageCache } = await import('@/utils/imageCache')
              await imageCache.cacheImage(url, false)
            }
            cachedCount.value++
          } catch (error) {
            console.warn(`Failed to cache image for ${emoji.name}:`, error)
          }

          processedImages++
          totalProcessedCount.value = processedImages
          currentGroupProcessedCount.value++

          totalProgress.value =
            totalImageCount.value > 0 ? (processedImages / totalImageCount.value) * 100 : 0
          currentGroupProgress.value =
            currentGroupImageCount.value > 0
              ? (currentGroupProcessedCount.value / currentGroupImageCount.value) * 100
              : 0

          if (processedImages % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        }

        if (!shouldStopCaching.value) {
          processedGroups++
          processedGroupCount.value = processedGroups
          groupProgress.value =
            totalGroupCount.value > 0 ? (processedGroups / totalGroupCount.value) * 100 : 0
        }
      }

      if (shouldStopCaching.value) {
        message.info(`缓存已中断，已缓存 ${cachedCount.value} 个表情图片`)
      } else {
        message.success(`已缓存 ${cachedCount.value} 个表情图片`)
      }
      await refreshCacheStats()
    } catch (error: any) {
      cacheError.value = error.message || '缓存失败'
      message.error('缓存表情图片失败')
      console.error('Cache all images error:', error)
    } finally {
      isCaching.value = false
      shouldStopCaching.value = false
    }
  }

  return {
    isCaching,
    cacheError,
    cachedCount,
    realCachedCount,
    totalCount,
    currentCacheGroup,
    currentCacheEmoji,
    shouldStopCaching,
    isExporting,
    isImporting,
    isRefreshingStats,
    exportImportError,
    totalProgress,
    totalProcessedCount,
    totalImageCount,
    groupProgress,
    processedGroupCount,
    totalGroupCount,
    currentGroupProgress,
    currentGroupProcessedCount,
    currentGroupImageCount,
    cacheStats,
    refreshCacheStats,
    cacheAllImages,
    stopCaching,
    clearImageCache,
    exportCache,
    importCache
  }
}
