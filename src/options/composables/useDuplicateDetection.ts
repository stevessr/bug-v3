import { ref, computed } from 'vue'
import { message } from 'ant-design-vue'

import type { Emoji } from '@/types/type'

export function useDuplicateDetection(emojiStore: any) {
  // State
  const isScanning = ref(false)
  const duplicateGroups = ref<Array<Array<{ emoji: Emoji; groupId: string; groupName: string }>>>(
    []
  )
  const selectedAction = ref<'delete' | 'reference'>('reference')
  const similarityThreshold = ref(10)
  const scanError = ref('')
  const filterQuery = ref('')

  // Progress State
  const progress = ref(0)
  const currentGroup = ref('')
  const currentEmojiName = ref('')
  const totalEmojisCount = ref(0)
  const processedEmojis = ref(0)
  const groupTotal = ref(0)
  const groupProcessed = ref(0)

  // Computed
  const filteredDuplicateGroups = computed(() => {
    if (!filterQuery.value) {
      return duplicateGroups.value
    }
    const query = filterQuery.value.toLowerCase()
    return duplicateGroups.value.filter(group => {
      return group.some(
        item =>
          item.emoji.name.toLowerCase().includes(query) ||
          item.groupName.toLowerCase().includes(query)
      )
    })
  })

  // Methods
  const setAsOriginal = (groupIndex: number, itemIndex: number) => {
    if (itemIndex === 0) return // Already the original

    const group = duplicateGroups.value[groupIndex]
    const [item] = group.splice(itemIndex, 1)
    group.unshift(item)
  }

  const removeDuplicateGroup = (groupIndex: number) => {
    duplicateGroups.value.splice(groupIndex, 1)
  }

  const getTotalDuplicates = () => {
    return duplicateGroups.value.reduce((sum, group) => sum + (group.length - 1), 0)
  }

  const clearHashes = async () => {
    try {
      await emojiStore.clearAllPerceptualHashes()
      message.success('已清空所有表情的哈希值')
    } catch (error) {
      message.error('清空哈希值失败')
      console.error('Clear hashes error:', error)
    }
  }

  const scanForDuplicates = async () => {
    isScanning.value = true
    scanError.value = ''
    duplicateGroups.value = []
    progress.value = 0
    currentGroup.value = ''
    currentEmojiName.value = ''
    totalEmojisCount.value = 0
    processedEmojis.value = 0
    groupTotal.value = 0
    groupProcessed.value = 0

    const handleProgress = (p: {
      total: number
      processed: number
      group: string
      emojiName: string
      groupTotal: number
      groupProcessed: number
    }) => {
      totalEmojisCount.value = p.total
      processedEmojis.value = p.processed
      progress.value = p.total > 0 ? (p.processed / p.total) * 100 : 0
      currentGroup.value = p.group
      currentEmojiName.value = p.emojiName
      groupTotal.value = p.groupTotal
      groupProcessed.value = p.groupProcessed
    }

    try {
      // 首先检查缓存状态
      console.log('[StatsPage] 检查缓存状态...')
      const { optimizedHashService } = await import('@/utils/optimizedHashService')
      await optimizedHashService.initializeWorkers()

      // 收集所有需要处理的图片 URL
      const emojiUrls: string[] = []
      for (const group of emojiStore.groups) {
        if (group.id === 'favorites') continue // 忽略收藏分组
        const emojis = group.emojis || []
        for (const emoji of emojis) {
          if (!emoji) continue
          if (emoji.url && !emoji.perceptualHash) {
            emojiUrls.push(emoji.url)
          }
        }
      }

      if (emojiUrls.length > 0) {
        const cacheStatus = await optimizedHashService.checkCacheStatus(emojiUrls)
        console.log(
          `[StatsPage] 缓存状态：${cacheStatus.cachedImages}/${cacheStatus.total} 图片已缓存，${cacheStatus.cachedHashes}/${cacheStatus.total} 哈希已缓存`
        )

        // 如果缓存率较低，提示用户
        const cacheRate = (cacheStatus.cachedImages / cacheStatus.total) * 100
        if (cacheRate < 50) {
          console.log(
            `[StatsPage] 缓存率较低 (${cacheRate.toFixed(1)}%)，建议先执行"一键缓存所有表情"操作`
          )
        }
      }

      const results = await emojiStore.findDuplicatesAcrossGroups(
        similarityThreshold.value,
        handleProgress
      )
      duplicateGroups.value = results

      if (results.length === 0) {
        scanError.value = '未找到重复的表情'
      }
    } catch (error: any) {
      scanError.value = error.message || '扫描失败'
      console.error('Scan error:', error)
    } finally {
      isScanning.value = false
    }
  }

  const removeDuplicates = async () => {
    if (duplicateGroups.value.length === 0) return

    const createReferences = selectedAction.value === 'reference'

    try {
      const removed = await emojiStore.removeDuplicatesAcrossGroups(
        duplicateGroups.value,
        createReferences
      )

      // Clear the duplicate groups after processing
      duplicateGroups.value = []

      const msg = createReferences
        ? `已将 ${removed} 个重复表情转换为引用`
        : `已删除 ${removed} 个重复表情`

      message.success(msg)
      console.log(msg)
    } catch (error) {
      message.error('处理重复项失败')
      console.error('Remove duplicates error:', error)
    }
  }

  return {
    isScanning,
    duplicateGroups,
    selectedAction,
    similarityThreshold,
    scanError,
    filterQuery,
    progress,
    currentGroup,
    currentEmojiName,
    totalEmojisCount,
    processedEmojis,
    groupTotal,
    groupProcessed,
    filteredDuplicateGroups,
    setAsOriginal,
    removeDuplicateGroup,
    getTotalDuplicates,
    clearHashes,
    scanForDuplicates,
    removeDuplicates
  }
}
