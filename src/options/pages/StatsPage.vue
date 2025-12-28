<script setup lang="ts">
import { inject, ref, computed, onMounted } from 'vue'
import {
  LoadingOutlined,
  DeleteOutlined,
  LinkOutlined,
  ClearOutlined,
  DownloadOutlined,
  StopOutlined,
  UploadOutlined,
  ExportOutlined
} from '@ant-design/icons-vue'

import type { OptionsInject } from '../types'
import EmojiStats from '../components/EmojiStats.vue'

import type { Emoji } from '@/types/type'
import { getEmojiImageUrlSync, addCacheBustingParam } from '@/utils/imageUrlHelper'
import { isImageCached } from '@/utils/imageCache'
import CachedImage from '@/components/CachedImage.vue'

const options = inject<OptionsInject>('options')!
const { emojiStore, totalEmojis } = options

// Duplicate detection state
const isScanning = ref(false)
const duplicateGroups = ref<Array<Array<{ emoji: Emoji; groupId: string; groupName: string }>>>([])
const selectedAction = ref<'delete' | 'reference'>('reference')
const similarityThreshold = ref(10)
const scanError = ref('')
const filterQuery = ref('')

// Cache all images state
const isCaching = ref(false)
const cacheError = ref('')
const cachedCount = ref(0)
const realCachedCount = ref(0)
const totalCount = ref(0)
const currentCacheGroup = ref('')
const currentCacheEmoji = ref('')
const shouldStopCaching = ref(false)
const enableAutoCleanup = ref(false) // 默认关闭自动清理

// Cache export/import state
const isExporting = ref(false)
const isImporting = ref(false)
const exportImportError = ref('')

// 三个进度状态
// 1. 总进度：基于总图片数量
const totalProgress = ref(0)
const totalProcessedCount = ref(0)
const totalImageCount = ref(0)

// 2. 分组进度：基于分组数量
const groupProgress = ref(0)
const processedGroupCount = ref(0)
const totalGroupCount = ref(0)

// 3. 当前分组进度：基于当前分组的图片数量
const currentGroupProgress = ref(0)
const currentGroupProcessedCount = ref(0)
const currentGroupImageCount = ref(0)

// Progress indicators
const progress = ref(0)
const currentGroup = ref('')
const currentEmojiName = ref('')
const totalEmojisCount = ref(0)
const processedEmojis = ref(0)
const groupTotal = ref(0)
const groupProcessed = ref(0)

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

// Calculate cache statistics
// 优化：直接使用 options 中已有的 totalEmojis，避免重复遍历
const cacheStats = computed(() => {
  return { total: totalEmojis.value, cached: realCachedCount.value }
})

const refreshCacheStats = async () => {
  try {
    const { imageCache } = await import('@/utils/imageCache')
    const stats = await imageCache.getCacheStats()
    realCachedCount.value = stats.totalEntries
  } catch (error) {
    console.error('Failed to get cache stats:', error)
  }
}

onMounted(() => {
  refreshCacheStats()
})

const setAsOriginal = (groupIndex: number, itemIndex: number) => {
  if (itemIndex === 0) return // Already the original

  const group = duplicateGroups.value[groupIndex]
  const [item] = group.splice(itemIndex, 1)
  group.unshift(item)
}

const removeDuplicateGroup = (groupIndex: number) => {
  duplicateGroups.value.splice(groupIndex, 1)
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

const clearHashes = async () => {
  try {
    await emojiStore.clearAllPerceptualHashes()
    message.success('已清空所有表情的哈希值')
  } catch (error) {
    message.error('清空哈希值失败')
    console.error('Clear hashes error:', error)
  }
}

const getTotalDuplicates = () => {
  return duplicateGroups.value.reduce((sum, group) => sum + (group.length - 1), 0)
}

// Cache all images functionality
const cacheAllImages = async () => {
  isCaching.value = true
  shouldStopCaching.value = false
  cacheError.value = ''
  cachedCount.value = 0
  realCachedCount.value = 0
  totalCount.value = 0
  currentCacheGroup.value = ''
  currentCacheEmoji.value = ''

  // 初始化三个进度
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
    const { imageCache, cacheImage } = await import('@/utils/imageCache')
    // Initialize image cache
    await imageCache.init()

    // 计算总图片数和分组数
    let totalImages = 0
    const validGroups = emojiStore.groups.filter(group => group.emojis && group.emojis.length > 0)
    totalGroupCount.value = validGroups.length

    for (const group of validGroups) {
      totalImages += group.emojis.length
    }
    totalImageCount.value = totalImages
    totalCount.value = totalImages

    let processedImages = 0
    let processedGroups = 0

    // Process each group
    for (const group of validGroups) {
      // 检查是否需要中断
      if (shouldStopCaching.value) {
        break
      }
      currentCacheGroup.value = group.name
      currentGroupImageCount.value = group.emojis.length
      currentGroupProcessedCount.value = 0
      currentGroupProgress.value = 0

      for (const emoji of group.emojis) {
        // 检查是否需要中断
        if (shouldStopCaching.value) {
          break
        }
        const url = addCacheBustingParam(emoji.displayUrl || emoji.url, emoji)
        currentCacheEmoji.value = emoji.name

        try {
          // Check if already cached
          const isCached = await isImageCached(url)
          if (!isCached) {
            // Cache the image without triggering cache cleanup
            const { imageCache } = await import('@/utils/imageCache')
            await imageCache.cacheImage(url, false) // false = 不检查缓存限制
          }
          cachedCount.value++
        } catch (error) {
          console.warn(`Failed to cache image for ${emoji.name}:`, error)
        }

        // 更新进度
        processedImages++
        totalProcessedCount.value = processedImages
        currentGroupProcessedCount.value++

        // 计算三个进度
        totalProgress.value =
          totalImageCount.value > 0 ? (processedImages / totalImageCount.value) * 100 : 0
        currentGroupProgress.value =
          currentGroupImageCount.value > 0
            ? (currentGroupProcessedCount.value / currentGroupImageCount.value) * 100
            : 0

        // Add small delay to prevent overwhelming the browser
        if (processedImages % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      // 分组处理完成

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

      // 缓存完成后，根据用户设置决定是否进行清理
      if (enableAutoCleanup.value) {
        console.log('[StatsPage] 用户启用自动清理，检查缓存状态...')
        try {
          const { imageCache } = await import('@/utils/imageCache')
          const stats = await imageCache.getCacheStats()
          const maxSize = 2 * 1024 * 1024 * 1024 // 2GB
          const maxEntries = 5000

          // 只有在严重超出限制时才进行清理（超出 120%）
          if (stats.totalSize > maxSize * 1.2 || stats.totalEntries > maxEntries * 1.2) {
            console.log(
              `[StatsPage] 缓存严重超出限制（大小：${(stats.totalSize / 1024 / 1024).toFixed(1)}MB, 条目：${stats.totalEntries}），进行保守清理`
            )

            // 只清理到 95% 容量，保留更多缓存
            const cleanedCount = await imageCache.cleanupLRU(0.95)
            if (cleanedCount > 0) {
              console.warn(`[StatsPage] 保守清理了 ${cleanedCount} 个最旧的缓存项`)
              message.warning(`缓存空间不足，已清理 ${cleanedCount} 个最旧的缓存项以释放空间`)
            }
          } else {
            console.log(
              `[StatsPage] 缓存空间充足（大小：${(stats.totalSize / 1024 / 1024).toFixed(1)}MB, 条目：${stats.totalEntries}），无需清理`
            )
          }
        } catch (cleanupError) {
          console.warn('[StatsPage] 缓存检查失败：', cleanupError)
        }
      } else {
        console.log('[StatsPage] 用户未启用自动清理，保留所有缓存')
        message.info('缓存完成，已保留所有现有缓存（未启用自动清理）')
      }
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

const exportCache = async () => {
  isExporting.value = true
  exportImportError.value = ''

  try {
    // 使用与 UI 统计相同的缓存服务
    const { imageCache } = await import('@/utils/imageCache')
    await imageCache.init()

    // 获取所有缓存数据
    const stats = await imageCache.getCacheStats()
    console.log(`[StatsPage] 准备导出缓存：${stats.totalEntries} 个图片`)

    if (stats.totalEntries === 0) {
      message.warning('没有找到任何缓存数据')
      return
    }

    // 获取所有缓存条目
    const allEntries = await imageCache.getAllEntries()
    console.log(`[StatsPage] 获取到 ${allEntries.length} 个缓存条目`)

    // 分批处理以避免内存问题
    const batchSize = 50
    const processedImages: any[] = []

    for (let i = 0; i < allEntries.length; i += batchSize) {
      const batch = allEntries.slice(i, i + batchSize)
      console.log(
        `[StatsPage] 处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(allEntries.length / batchSize)} (${batch.length} 个图片)`
      )

      const batchResults = await Promise.allSettled(
        batch.map(async entry => {
          try {
            // 使用 FileReader 安全地转换 Blob
            const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => resolve(reader.result as ArrayBuffer)
              reader.onerror = () => reject(new Error('Failed to read blob'))
              reader.readAsArrayBuffer(entry.blob)
            })

            return {
              id: entry.id,
              url: entry.url,
              timestamp: entry.timestamp,
              size: entry.size,
              lastAccessed: entry.lastAccessed,
              accessCount: entry.accessCount,
              data: arrayBuffer,
              mimeType: entry.blob.type
            }
          } catch (error) {
            console.error(`[StatsPage] 处理图片失败 ${entry.url}:`, error)
            return null
          }
        })
      )

      // 过滤成功的结果
      const successfulResults = batchResults
        .filter(
          (result): result is PromiseFulfilledResult<any> =>
            result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value)

      processedImages.push(...successfulResults)

      // 添加延迟以避免浏览器压力过大
      if (i + batchSize < allEntries.length) {
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    }

    console.log(
      `[StatsPage] 成功处理 ${processedImages.length} 个图片，失败 ${allEntries.length - processedImages.length} 个`
    )

    // 创建导出数据
    const exportData = {
      metadata: {
        version: '1.0',
        exportDate: new Date().toISOString(),
        totalImages: processedImages.length,
        totalSize: processedImages.reduce((sum, img) => sum + img.size, 0),
        dbName: 'ImageCacheDB',
        storeName: 'images'
      },
      images: processedImages
    }

    // 创建二进制文件
    const dbFile = await createDatabaseFile(exportData)
    const filename = `emoji-cache-${new Date().toISOString().split('T')[0]}.db`

    // 创建下载链接
    const blob = new Blob([dbFile], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    message.success(
      `已导出缓存：${exportData.metadata.totalImages} 个图片，${(exportData.metadata.totalSize / 1024 / 1024).toFixed(2)}MB`
    )
    console.log('Cache export completed:', exportData.metadata)
  } catch (error: any) {
    exportImportError.value = error.message || '导出失败'
    message.error('导出缓存失败')
    console.error('Export cache error:', error)
  } finally {
    isExporting.value = false
  }
}

const importCache = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.db'

  input.onchange = async event => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return

    isImporting.value = true
    exportImportError.value = ''

    try {
      const arrayBuffer = await file.arrayBuffer()
      const importData = await parseDatabaseFile(arrayBuffer)

      // 使用与 UI 统计相同的缓存服务
      const { imageCache } = await import('@/utils/imageCache')
      await imageCache.init()

      let imported = 0
      let skipped = 0
      const errors: string[] = []

      for (const imgData of importData.images) {
        try {
          // 检查是否已存在
          const existing = await imageCache.get(imgData.url)

          if (existing) {
            // 如果已存在，检查是否需要更新
            if (existing.timestamp >= imgData.timestamp) {
              skipped++
              continue
            }
          }

          // 将 ArrayBuffer 转换为 Blob
          try {
            const blob = new Blob([imgData.data], { type: imgData.mimeType })

            // 验证 Blob 是否有效
            if (blob.size === 0) {
              throw new Error('Empty blob created')
            }

            // 缓存图片
            await imageCache.set(imgData.url, blob)
            imported++
            console.log(`[StatsPage] 成功导入：${imgData.url}`)
          } catch (blobError) {
            console.error(`[StatsPage] 创建 Blob 失败 ${imgData.url}:`, blobError)
            errors.push(`创建 Blob 失败 ${imgData.url}: ${blobError}`)
          }
        } catch (error) {
          errors.push(`处理图片失败 ${imgData.url}: ${error}`)
        }
      }

      if (errors.length > 0) {
        message.warning(
          `导入完成：${imported} 个新图片，${skipped} 个已跳过，${errors.length} 个错误`
        )
        console.warn('Import errors:', errors)
      } else {
        message.success(`导入完成：${imported} 个新图片，${skipped} 个已跳过`)
      }

      // 刷新缓存统计
      await refreshCacheStats()
    } catch (error: any) {
      exportImportError.value = error.message || '导入失败'
      message.error('导入缓存失败')
      console.error('Import cache error:', error)
    } finally {
      isImporting.value = false
    }
  }

  input.click()
}

// 辅助函数：创建数据库文件
const createDatabaseFile = async (exportData: any): Promise<ArrayBuffer> => {
  // 创建文件头
  const header = new TextEncoder().encode('EMOJI_CACHE_DB_V1.0')

  // 序列化元数据
  const metadataBytes = new TextEncoder().encode(JSON.stringify(exportData.metadata))
  const metadataLength = new Uint32Array([metadataBytes.length])

  // 序列化图片数据
  const imageData = await Promise.all(
    exportData.images.map(async (img: any) => {
      const urlBytes = new TextEncoder().encode(img.url)
      const idBytes = new TextEncoder().encode(img.id)

      return {
        header: {
          id: img.id,
          idLength: idBytes.length,
          urlLength: urlBytes.length,
          hashLength: 0,
          mimeTypeLength: new TextEncoder().encode(img.mimeType).length,
          timestamp: img.timestamp,
          size: img.size,
          lastAccessed: img.lastAccessed,
          accessCount: img.accessCount,
          dataLength: img.data.byteLength
        },
        idBytes,
        urlBytes,
        hashBytes: new Uint8Array(0),
        mimeTypeBytes: new TextEncoder().encode(img.mimeType),
        dataArray: new Uint8Array(img.data)
      }
    })
  )

  // 计算总大小
  let totalSize = header.length + 4 + metadataBytes.length
  for (const img of imageData) {
    totalSize += 64 // fixed header size
    totalSize += img.idBytes.length
    totalSize += img.urlBytes.length
    totalSize += img.hashBytes.length
    totalSize += img.mimeTypeBytes.length
    totalSize += img.dataArray.length
  }

  // 创建 ArrayBuffer
  const buffer = new ArrayBuffer(totalSize)
  const view = new Uint8Array(buffer)
  let offset = 0

  // 写入文件头
  view.set(header, offset)
  offset += header.length

  // 写入元数据长度和元数据
  view.set(new Uint8Array(metadataLength.buffer), offset)
  offset += 4
  view.set(metadataBytes, offset)
  offset += metadataBytes.length

  // 写入图片数据
  for (const img of imageData) {
    // 写入头部信息
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

    // 写入各个字段
    view.set(img.idBytes, offset)
    offset += img.idBytes.length

    view.set(img.urlBytes, offset)
    offset += img.urlBytes.length

    view.set(img.hashBytes, offset)
    offset += img.hashBytes.length

    view.set(img.mimeTypeBytes, offset)
    offset += img.mimeTypeBytes.length

    view.set(img.dataArray, offset)
    offset += img.dataArray.length
  }

  return buffer
}

// 辅助函数：解析数据库文件
const parseDatabaseFile = async (
  arrayBuffer: ArrayBuffer
): Promise<{ metadata: any; images: any[] }> => {
  const view = new Uint8Array(arrayBuffer)
  let offset = 0

  // 检查文件头
  const header = new TextDecoder().decode(view.slice(offset, offset + 18))
  if (header !== 'EMOJI_CACHE_DB_V1.0') {
    throw new Error('无效的缓存文件格式')
  }
  offset += 18

  // 读取元数据
  const metadataLength = new DataView(arrayBuffer, offset, 4).getUint32(0, true)
  offset += 4
  const metadataBytes = view.slice(offset, offset + metadataLength)
  const metadata = JSON.parse(new TextDecoder().decode(metadataBytes))
  offset += metadataLength

  // 读取图片数据
  const images: any[] = []
  const endOffset = arrayBuffer.byteLength

  while (offset < endOffset) {
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

    const id = new TextDecoder().decode(view.slice(offset, offset + idLength))
    offset += idLength

    const url = new TextDecoder().decode(view.slice(offset, offset + urlLength))
    offset += urlLength

    offset += hashLength // 跳过哈希

    const mimeType = new TextDecoder().decode(view.slice(offset, offset + mimeTypeLength))
    offset += mimeTypeLength

    const data = view.slice(offset, offset + dataLength).buffer
    offset += dataLength

    images.push({
      id,
      url,
      mimeType,
      timestamp,
      size,
      lastAccessed,
      accessCount,
      data
    })
  }

  return { metadata, images }
}
</script>

<template>
  <div class="space-y-8">
    <!-- Statistics Section -->
    <EmojiStats
      :groupCount="emojiStore.groups.length"
      :totalEmojis="totalEmojis"
      :favoritesCount="emojiStore.favorites.size"
    />

    <!-- Image Cache Section -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 class="text-lg font-semibold dark:text-white">图片缓存</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
          缓存所有表情图片到本地 IndexedDB，提升加载速度和离线访问能力
        </p>
      </div>

      <div class="p-6 space-y-6">
        <!-- Cache Statistics -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-gray-50 dark:bg-gray-700 rounded p-4">
            <h3 class="text-sm font-medium text-gray-700 dark:text-white mb-1">总表情数</h3>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ cacheStats.total }}</p>
          </div>
          <div class="bg-blue-50 dark:bg-blue-900 rounded p-4">
            <h3 class="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">已缓存</h3>
            <p class="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {{ cacheStats.cached }}
            </p>
          </div>
          <div class="bg-green-50 dark:bg-green-900 rounded p-4">
            <h3 class="text-sm font-medium text-green-700 dark:text-green-300 mb-1">缓存率</h3>
            <p class="text-2xl font-bold text-green-900 dark:text-green-100">
              {{
                cacheStats.total > 0 ? Math.round((cacheStats.cached / cacheStats.total) * 100) : 0
              }}%
            </p>
          </div>
        </div>

        <!-- Cache Controls -->
        <div class="flex flex-wrap gap-3">
          <a-button
            type="primary"
            :loading="isCaching"
            :disabled="isCaching"
            @click="cacheAllImages"
          >
            <DownloadOutlined v-if="!isCaching" />
            {{ isCaching ? '缓存中...' : '一键缓存所有表情' }}
          </a-button>

          <a-button v-if="isCaching" type="default" danger @click="stopCaching">
            <StopOutlined />
            停止缓存
          </a-button>

          <a-button
            @click="exportCache"
            :loading="isExporting"
            :disabled="isCaching || isExporting || cacheStats.total === 0"
          >
            <ExportOutlined v-if="!isExporting" />
            {{ isExporting ? '导出中...' : '导出缓存' }}
          </a-button>

          <a-button
            @click="importCache"
            :loading="isImporting"
            :disabled="isCaching || isImporting"
          >
            <UploadOutlined v-if="!isImporting" />
            {{ isImporting ? '导入中...' : '导入缓存' }}
          </a-button>

          <a-button @click="clearImageCache" :disabled="isCaching || isImporting || isExporting">
            <ClearOutlined />
            清空缓存
          </a-button>
        </div>

        <!-- Auto Cleanup Option -->
        <div class="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <a-checkbox v-model:checked="enableAutoCleanup">
            启用自动清理（仅在缓存空间严重不足时清理最旧的缓存项）
          </a-checkbox>
          <span class="text-xs text-blue-600 dark:text-blue-400">
            ⚠️ 建议关闭以保护手动缓存的图片
          </span>
        </div>
        <!-- Cache Progress Indicator -->
        <div v-if="isCaching" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <!-- 总进度（基于总图片数量） -->
            <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <div class="flex flex-col items-center">
                <a-progress
                  type="circle"
                  :percent="totalProgress"
                  :stroke-color="'#1890ff'"
                  :width="100"
                  show-info
                />
                <h3 class="text-sm font-medium text-blue-700 dark:text-blue-300 mt-3">总进度</h3>
                <p class="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  {{ totalProcessedCount }} / {{ totalImageCount }} 张图片
                </p>
              </div>
            </div>

            <!-- 分组进度（基于分组数量） -->
            <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <div class="flex flex-col items-center">
                <a-progress
                  type="circle"
                  :percent="groupProgress"
                  :stroke-color="'#52c41a'"
                  :width="100"
                  show-info
                />
                <h3 class="text-sm font-medium text-green-700 dark:text-green-300 mt-3">
                  分组进度
                </h3>
                <p class="text-xs text-green-600 dark:text-green-400 mt-1">
                  {{ processedGroupCount }} / {{ totalGroupCount }} 个分组
                </p>
              </div>
            </div>

            <!-- 当前分组进度（基于当前分组的图片数量） -->
            <div class="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
              <div class="flex flex-col items-center">
                <a-progress
                  type="circle"
                  :percent="currentGroupProgress"
                  :stroke-color="'#fa8c16'"
                  :width="100"
                  show-info
                />
                <h3 class="text-sm font-medium text-orange-700 dark:text-orange-300 mt-3">
                  当前分组
                </h3>
                <p class="text-xs text-orange-600 dark:text-orange-400 mt-1">
                  {{ currentGroupProcessedCount }} / {{ currentGroupImageCount }} 张
                </p>
              </div>
            </div>
          </div>

          <!-- 当前处理信息 -->
          <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <p class="text-sm text-gray-700 dark:text-gray-300 text-center">
              <span class="font-medium">正在处理：</span>
              {{ currentCacheGroup }} - {{ currentCacheEmoji }}
            </p>
          </div>
        </div>

        <!-- Cache Error Message -->
        <div v-if="cacheError" class="bg-yellow-50 border border-yellow-200 rounded p-3">
          <p class="text-sm text-yellow-800">{{ cacheError }}</p>
        </div>

        <!-- Export/Import Error Message -->
        <div v-if="exportImportError" class="bg-red-50 border border-red-200 rounded p-3">
          <p class="text-sm text-red-800">{{ exportImportError }}</p>
        </div>

        <!-- Help Text -->

        <div class="text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <p>
            <strong>说明：</strong>
          </p>

          <ul class="list-disc list-inside space-y-1 ml-2">
            <li>缓存将图片存储到浏览器 IndexedDB，提升后续访问速度</li>

            <li>已缓存的图片在离线状态下也能正常显示</li>

            <li>缓存会占用一定的浏览器存储空间（限制：100MB 或 5000 张图片）</li>

            <li>建议在网络状况良好时执行一键缓存操作</li>

            <li>
              <strong>保护旧缓存：</strong>
              默认情况下缓存过程不会清除已存在的缓存，保护用户手动缓存的图片
            </li>

            <li>
              <strong>自动清理选项：</strong>
              可选择启用自动清理，仅在缓存空间严重超出 120% 限制时清理最旧的缓存项
            </li>

            <li>
              <strong>保守清理：</strong>
              即使启用自动清理，也只会清理到 95% 容量，最大限度保护用户缓存
            </li>

            <li>
              <strong>导出功能：</strong>
              将缓存数据导出为 .db 二进制文件，保持原始数据格式
            </li>

            <li>
              <strong>导入功能：</strong>
              从 .db 文件恢复缓存数据，完整保留所有图片和元数据
            </li>

            <li>.db 格式比 JSON 格式更紧凑，导入速度更快，适合大型缓存文件</li>

            <li>导出的文件包含完整的 IndexedDB 数据，文件较大请耐心等待</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Duplicate Detection Section -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 class="text-lg font-semibold dark:text-white">重复检测</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
          使用图片相似度检测跨分组的重复表情
        </p>
      </div>

      <div class="p-6 space-y-6">
        <!-- Similarity Threshold -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-white mb-2">
            相似度阈值：{{ similarityThreshold }}
          </label>
          <div class="flex items-center gap-3">
            <a-slider
              v-model:value="similarityThreshold"
              :min="0"
              :max="20"
              :step="1"
              class="flex-1"
              :disabled="isScanning"
            />
            <span class="text-sm text-gray-600 dark:text-gray-400 w-24">
              {{ similarityThreshold <= 5 ? '严格' : similarityThreshold <= 15 ? '中等' : '宽松' }}
            </span>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            数值越小，检测越严格；数值越大，检测越宽松
          </p>
        </div>

        <!-- Action Selection -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-white mb-2">
            处理方式
          </label>
          <a-radio-group v-model:value="selectedAction">
            <a-radio value="reference">
              <LinkOutlined />
              创建引用（推荐）
              <span class="text-xs text-gray-500 ml-2">
                保留第一个表情，其他转为引用，节省存储空间
              </span>
            </a-radio>
            <a-radio value="delete">
              <DeleteOutlined />
              直接删除
              <span class="text-xs text-gray-500 ml-2">保留第一个表情，删除其他重复项</span>
            </a-radio>
          </a-radio-group>
        </div>

        <!-- Scan Button -->
        <div class="flex gap-3">
          <a-button
            type="primary"
            :loading="isScanning"
            :disabled="isScanning || isCaching"
            @click="scanForDuplicates"
          >
            <LoadingOutlined v-if="isScanning" />
            {{ isScanning ? '扫描中...' : '开始扫描' }}
          </a-button>

          <a-button
            v-if="duplicateGroups.length > 0"
            type="default"
            danger
            @click="removeDuplicates"
          >
            处理重复项 ({{ getTotalDuplicates() }})
          </a-button>

          <a-button @click="clearHashes" :disabled="isCaching">
            <ClearOutlined />
            清空哈希值
          </a-button>
        </div>

        <!-- Progress Indicator -->
        <div v-if="isScanning" class="space-y-2">
          <div class="flex items-center gap-4">
            <a-progress type="circle" :percent="progress" :width="80" />
            <div class="flex-1 space-y-1">
              <p class="text-sm font-medium dark:text-white">
                总进度：{{ processedEmojis }} / {{ totalEmojisCount }}
              </p>
              <p class="text-sm text-gray-600 dark:text-gray-400">当前分组：{{ currentGroup }}</p>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                正在处理：{{ currentEmojiName }}
              </p>
              <a-progress
                :percent="groupTotal > 0 ? (groupProcessed / groupTotal) * 100 : 0"
                :stroke-width="6"
                :show-info="false"
              />
              <p class="text-xs text-gray-500 dark:text-gray-500">
                {{ groupProcessed }} / {{ groupTotal }}
              </p>
            </div>
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="scanError" class="bg-yellow-50 border border-yellow-200 rounded p-3">
          <p class="text-sm text-yellow-800">{{ scanError }}</p>
        </div>

        <!-- Results -->
        <div v-if="duplicateGroups.length > 0" class="space-y-4">
          <div
            class="flex justify-between items-center bg-blue-50 border border-blue-200 rounded p-3"
          >
            <p class="text-sm text-blue-800">
              找到 {{ duplicateGroups.length }} 组重复表情，共 {{ getTotalDuplicates() }} 个重复项
            </p>
            <a-input
              v-model:value="filterQuery"
              placeholder="过滤结果..."
              class="w-48"
              allow-clear
            />
          </div>

          <!-- Duplicate Groups -->
          <div class="space-y-4 max-h-96 overflow-y-auto">
            <div
              v-for="(group, groupIndex) in filteredDuplicateGroups"
              :key="groupIndex"
              class="border border-gray-200 dark:border-gray-700 rounded p-4"
            >
              <div class="flex items-center justify-between gap-2 mb-3">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-gray-700 dark:text-white">
                    重复组 #{{ groupIndex + 1 }}
                  </span>
                  <span class="text-xs text-gray-500">{{ group.length }} 个相似表情</span>
                </div>
                <a-button size="small" danger @click="removeDuplicateGroup(groupIndex)">
                  移除该组
                </a-button>
              </div>

              <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                <div
                  v-for="(item, itemIndex) in group"
                  :key="item.emoji.id"
                  class="border rounded p-2 cursor-pointer transition-all"
                  :class="[
                    itemIndex === 0
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-500'
                  ]"
                  @click="setAsOriginal(groupIndex, itemIndex)"
                >
                  <div class="relative">
                    <CachedImage
                      :src="getEmojiImageUrlSync(item.emoji)"
                      :alt="item.emoji.name"
                      class="w-full h-24 object-contain rounded"
                      loading="lazy"
                    />
                    <div
                      v-if="itemIndex === 0"
                      class="absolute top-1 right-1 bg-green-500 text-white text-xs px-1 rounded"
                    >
                      保留
                    </div>
                    <div
                      v-else
                      class="absolute top-1 right-1 bg-gray-500 text-white text-xs px-1 rounded opacity-0 group-hover:opacity-100"
                    >
                      设为保留
                    </div>
                  </div>
                  <div class="mt-2">
                    <p class="text-xs font-medium text-gray-900 dark:text-white truncate">
                      {{ item.emoji.name }}
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {{ item.groupName }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Help Text -->
        <div class="text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <p>
            <strong>说明：</strong>
          </p>
          <ul class="list-disc list-inside space-y-1 ml-2">
            <li>扫描会计算所有表情的感知哈希值（首次可能需要较长时间）</li>
            <li>如果表情已经有哈希值，将会跳过计算</li>
            <li>基于图片内容相似度检测重复，而非文件名或 URL</li>
            <li>
              <strong>优化特性：</strong>
              优先从本地缓存加载图片，减少网络请求
            </li>
            <li>建议先执行"一键缓存所有表情"操作，提升重复检测速度</li>
            <li>创建引用会保留第一个表情，其他重复项指向它，节省存储空间</li>
            <li>建议先使用"创建引用"方式，如需完全删除可稍后手动处理</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
