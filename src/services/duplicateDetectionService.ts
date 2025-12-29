/**
 * Duplicate Detection Service
 * 负责跨分组的表情重复检测，使用感知哈希算法
 */

import type { Emoji, EmojiGroup } from '@/types/type'

export interface DuplicateItem {
  emoji: Emoji
  groupId: string
  groupName: string
}

export interface DuplicateDetectionProgress {
  total: number
  processed: number
  group: string
  emojiName: string
  groupTotal: number
  groupProcessed: number
}

export interface DuplicateDetectionOptions {
  similarityThreshold?: number
  onProgress?: (progress: DuplicateDetectionProgress) => void
}

/**
 * Find duplicate emojis across all groups based on perceptual hash
 */
export async function findDuplicatesAcrossGroups(
  groups: EmojiGroup[],
  options: DuplicateDetectionOptions = {}
): Promise<Array<Array<DuplicateItem>>> {
  const { similarityThreshold = 10, onProgress } = options

  try {
    // Initialize the optimized hash service for better performance
    const { optimizedHashService } = await import('@/utils/optimizedHashService')
    await optimizedHashService.initializeWorkers()

    // Collect all emojis with their URLs
    const allEmojis: DuplicateItem[] = []
    const emojiUrls: string[] = []

    for (const group of groups) {
      if (group.id === 'favorites') continue // Ignore favorites group
      const emojis = group.emojis || []
      for (const emoji of emojis) {
        if (!emoji) continue
        allEmojis.push({
          emoji,
          groupId: group.id,
          groupName: group.name
        })
        if (emoji.url && !emoji.perceptualHash) {
          emojiUrls.push(emoji.url)
        }
      }
    }

    const totalEmojis = allEmojis.length
    console.log(`[DuplicateDetection] Processing ${totalEmojis} emojis for duplicate detection...`)

    // 检查缓存状态，优先使用本地缓存
    if (emojiUrls.length > 0) {
      console.log(`[DuplicateDetection] 检查 ${emojiUrls.length} 个需要计算哈希的表情的缓存状态...`)
      const cacheStatus = await optimizedHashService.checkCacheStatus(emojiUrls)
      const cacheRate = (cacheStatus.cachedImages / cacheStatus.total) * 100
      console.log(
        `[DuplicateDetection] 缓存状态：${cacheStatus.cachedImages}/${cacheStatus.total} 图片已缓存 (${cacheRate.toFixed(1)}%), ${cacheStatus.cachedHashes}/${cacheStatus.total} 哈希已缓存`
      )

      if (cacheRate >= 80) {
        console.log('[DuplicateDetection] 缓存率良好，重复检测将优先使用本地缓存')
      } else if (cacheRate >= 50) {
        console.log('[DuplicateDetection] 缓存率中等，部分图片需要从网络获取')
      } else {
        console.log('[DuplicateDetection] 缓存率较低，建议先执行图片缓存操作以提升检测速度')
      }
    }

    // Batch calculate missing hashes using the optimized service
    if (emojiUrls.length > 0) {
      console.log(`[DuplicateDetection] Calculating hashes for ${emojiUrls.length} emojis...`)

      const hashResults = await optimizedHashService.calculateBatchHashes(emojiUrls, {
        useCache: true,
        batchSize: 20,
        quality: 'medium',
        onProgress: (processed, _total) => {
          // Map progress back to the original progress callback format
          const processedEmoji = allEmojis.find(e => e.emoji.url === emojiUrls[processed - 1])
          if (processedEmoji && onProgress) {
            const group = groups.find(g => g.id === processedEmoji.groupId)
            const groupEmojis = group?.emojis || []
            const groupTotal = groupEmojis.length
            onProgress({
              total: totalEmojis,
              processed: processed, // This is hash calculation progress
              group: processedEmoji.groupName,
              emojiName: processedEmoji.emoji.name,
              groupTotal,
              groupProcessed: groupEmojis.findIndex(e => e && e.id === processedEmoji.emoji.id) + 1
            })
          }
        }
      })

      // Update emojis with calculated hashes
      for (const result of hashResults) {
        const emoji = allEmojis.find(e => e.emoji.url === result.url)
        if (emoji && result.hash && !result.error) {
          emoji.emoji.perceptualHash = result.hash
        }
      }
    }

    // Find duplicates using optimized batch processing with hash bucketing
    console.log('[DuplicateDetection] Finding duplicates using optimized algorithm...')

    // Prepare items for optimized comparison
    const hashItems = allEmojis
      .filter(
        (item): item is typeof item & { emoji: { perceptualHash: string } } =>
          !!item.emoji.perceptualHash
      )
      .map(item => ({
        id: item.emoji.id,
        hash: item.emoji.perceptualHash,
        item
      }))

    // Use optimized duplicate finding with hash bucketing and Union-Find
    const duplicateMap = await optimizedHashService.findDuplicatesOptimized(
      hashItems,
      similarityThreshold
    )

    // Convert Map result to array format expected by the rest of the code
    const duplicateGroups: Array<Array<DuplicateItem>> = []
    for (const [_root, groupItems] of duplicateMap) {
      duplicateGroups.push(groupItems.map(gi => gi.item))
    }

    // Clear the binary hash cache after processing
    optimizedHashService.clearBinaryHashCache()

    console.log(`[DuplicateDetection] Found ${duplicateGroups.length} groups of duplicates`)

    // Log cache statistics
    const cacheStats = optimizedHashService.getCacheStats()
    console.log('[DuplicateDetection] Cache stats:', cacheStats)

    return duplicateGroups
  } catch (err) {
    console.error('[DuplicateDetection] findDuplicatesAcrossGroups error', err)
    return []
  }
}
