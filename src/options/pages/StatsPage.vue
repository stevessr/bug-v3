<script setup lang="ts">
import { inject, onMounted } from 'vue'
import {
  LoadingOutlined,
  DeleteOutlined,
  LinkOutlined,
  ClearOutlined,
  DownloadOutlined,
  StopOutlined,
  UploadOutlined,
  ExportOutlined,
  ReloadOutlined
} from '@ant-design/icons-vue'

import type { OptionsInject } from '../types'
import EmojiStats from '../components/EmojiStats.vue'
import { useImageCache } from '../composables/useImageCache'
import { useDuplicateDetection } from '../composables/useDuplicateDetection'

import CachedImage from '@/components/CachedImage.vue'
import { getEmojiImageUrlSync } from '@/utils/imageUrlHelper'

// Composables

const options = inject<OptionsInject>('options')!
const { emojiStore, totalEmojis } = options

// Initialize composables
const {
  isCaching,
  cacheError,
  // cachedCount, // Not used in template directly except in messages
  // totalCount, // Not used in template
  currentCacheGroup,
  currentCacheEmoji,
  // shouldStopCaching, // Not used in template
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
} = useImageCache(emojiStore, totalEmojis)

const {
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
} = useDuplicateDetection(emojiStore)

onMounted(() => {
  refreshCacheStats()
})
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
      <div
        class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center"
      >
        <div>
          <h2 class="text-lg font-semibold dark:text-white">图片缓存</h2>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
            缓存所有表情图片到本地 IndexedDB，提升加载速度和离线访问能力
          </p>
        </div>
        <a-button
          @click="refreshCacheStats"
          :loading="isRefreshingStats"
          :disabled="isCaching || isRefreshingStats"
          size="small"
        >
          <ReloadOutlined v-if="!isRefreshingStats" />
          {{ isRefreshingStats ? '刷新中...' : '刷新统计' }}
        </a-button>
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
