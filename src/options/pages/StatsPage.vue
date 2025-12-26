<script setup lang="ts">
import { inject, ref, computed, onMounted } from 'vue'
import {
  LoadingOutlined,
  DeleteOutlined,
  LinkOutlined,
  ClearOutlined,
  DownloadOutlined
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'

import type { OptionsInject } from '../types'
import EmojiStats from '../components/EmojiStats.vue'

import type { Emoji } from '@/types/type'
import { cacheImage, imageCache } from '@/utils/imageCache'
import { getEmojiImageUrlSync, addCacheBustingParam, isImageCached } from '@/utils/imageUrlHelper'

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
const cacheProgress = ref(0)
const cacheError = ref('')
const cachedCount = ref(0)
const realCachedCount = ref(0)
const totalCount = ref(0)
const currentCacheGroup = ref('')
const currentCacheEmoji = ref('')

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
  cacheError.value = ''
  cacheProgress.value = 0
  cachedCount.value = 0
  realCachedCount.value = 0
  totalCount.value = 0
  currentCacheGroup.value = ''
  currentCacheEmoji.value = ''

  try {
    // Initialize image cache
    await imageCache.init()

    // Count total emojis first
    let total = 0
    for (const group of emojiStore.groups) {
      for (const _emoji of group.emojis || []) {
        total++
      }
    }
    totalCount.value = total

    let processed = 0

    // Process each group
    for (const group of emojiStore.groups) {
      currentCacheGroup.value = group.name

      for (const emoji of group.emojis || []) {
        const url = addCacheBustingParam(emoji.displayUrl || emoji.url, emoji)
        currentCacheEmoji.value = emoji.name

        try {
          // Check if already cached
          const isCached = await isImageCached(emoji)
          if (!isCached) {
            // Cache the image
            await cacheImage(url)
          }
          cachedCount.value++
        } catch (error) {
          console.warn(`Failed to cache image for ${emoji.name}:`, error)
        }

        processed++
        cacheProgress.value = totalCount.value > 0 ? (processed / totalCount.value) * 100 : 0

        // Add small delay to prevent overwhelming the browser
        if (processed % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
    }

    message.success(`已缓存 ${cachedCount.value} 个表情图片`)
    await refreshCacheStats()
  } catch (error: any) {
    cacheError.value = error.message || '缓存失败'
    message.error('缓存表情图片失败')
    console.error('Cache all images error:', error)
  } finally {
    isCaching.value = false
  }
}

const clearImageCache = async () => {
  try {
    await imageCache.clearCache()
    message.success('已清空图片缓存')
    await refreshCacheStats()
  } catch (error) {
    message.error('清空图片缓存失败')
    console.error('Clear image cache error:', error)
  }
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
        <div class="flex gap-3">
          <a-button
            type="primary"
            :loading="isCaching"
            :disabled="isCaching"
            @click="cacheAllImages"
          >
            <DownloadOutlined v-if="!isCaching" />
            {{ isCaching ? '缓存中...' : '一键缓存所有表情' }}
          </a-button>

          <a-button @click="clearImageCache" :disabled="isCaching">
            <ClearOutlined />
            清空缓存
          </a-button>
        </div>

        <!-- Cache Progress Indicator -->
        <div v-if="isCaching" class="space-y-3">
          <div class="flex items-center gap-4">
            <a-progress type="circle" :percent="cacheProgress" :width="80" />
            <div class="flex-1 space-y-1">
              <p class="text-sm font-medium dark:text-white">
                总进度：{{ cachedCount }} / {{ totalCount }}
              </p>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                当前分组：{{ currentCacheGroup }}
              </p>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                正在处理：{{ currentCacheEmoji }}
              </p>
            </div>
          </div>
        </div>

        <!-- Cache Error Message -->
        <div v-if="cacheError" class="bg-yellow-50 border border-yellow-200 rounded p-3">
          <p class="text-sm text-yellow-800">{{ cacheError }}</p>
        </div>

        <!-- Help Text -->
        <div class="text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <p>
            <strong>说明：</strong>
          </p>
          <ul class="list-disc list-inside space-y-1 ml-2">
            <li>缓存将图片存储到浏览器 IndexedDB，提升后续访问速度</li>
            <li>已缓存的图片在离线状态下也能正常显示</li>
            <li>缓存会占用一定的浏览器存储空间</li>
            <li>建议在网络状况良好时执行一键缓存操作</li>
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
                    <img
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
            <li>创建引用会保留第一个表情，其他重复项指向它，节省存储空间</li>
            <li>建议先使用"创建引用"方式，如需完全删除可稍后手动处理</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
