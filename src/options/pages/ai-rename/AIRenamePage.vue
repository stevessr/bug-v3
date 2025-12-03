<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'

import type { Emoji } from '@/types/type'
import { useEmojiStore } from '@/stores/emojiStore'
import { getEmojiImageUrlWithLoading } from '@/utils/imageUrlHelper'
import VirtualList from '@/options/components/VirtualList.vue'
import BatchActionsBar from '@/options/components/BatchActionsBar.vue'
import BatchRenameModalOptimized from '@/options/modals/BatchRenameModalOptimized.vue'

const emojiStore = useEmojiStore()

// 只显示分组中的表情，排除常用和未分组的表情
const allEmojis = computed(() => {
  return emojiStore.sortedGroups.flatMap(group => {
    // 排除常用分组和未分组的表情
    if (group.id === 'favorites' || group.id === 'ungrouped') {
      return []
    }
    return group.emojis.map(emoji => ({ ...emoji, groupId: group.id }))
  })
})

const selectedEmojis = ref(new Set<string>())

// 图片缓存状态管理
const imageSources = ref<Map<string, string>>(new Map())
const loadingStates = ref<Map<string, boolean>>(new Map())

// 初始化图片缓存
const initializeImageSources = async () => {
  if (!allEmojis.value.length) return

  console.log('[AIRenamePage] Initializing image sources for', allEmojis.value.length, 'emojis')
  console.log('[AIRenamePage] Cache enabled:', emojiStore.settings.useIndexedDBForImages)

  const newSources = new Map<string, string>()
  const newLoadingStates = new Map<string, boolean>()

  for (const emoji of allEmojis.value) {
    try {
      if (emojiStore.settings.useIndexedDBForImages) {
        // 使用缓存优先的加载函数
        const result = await getEmojiImageUrlWithLoading(emoji, { preferCache: true })
        newSources.set(emoji.id, result.url)
        newLoadingStates.set(emoji.id, result.isLoading)
        console.log(`[AIRenamePage] Image source for ${emoji.name}:`, result.url, 'from cache:', result.isFromCache)
      } else {
        // 直接 URL 模式
        const fallbackSrc = emoji.displayUrl || emoji.url
        newSources.set(emoji.id, fallbackSrc)
        console.log(`[AIRenamePage] Direct URL for ${emoji.name}:`, fallbackSrc)
      }
    } catch (error) {
      console.warn(`[AIRenamePage] Failed to get image source for ${emoji.name}:`, error)
      // 回退到直接 URL
      const fallbackSrc = emoji.displayUrl || emoji.url
      newSources.set(emoji.id, fallbackSrc)
    }
  }

  imageSources.value = newSources
  loadingStates.value = newLoadingStates
  console.log('[AIRenamePage] Image sources initialized:', imageSources.value.size)
}

// 监听表情数据变化
watch(() => allEmojis.value, () => {
  console.log('[AIRenamePage] Emojis changed, reinitializing image sources')
  initializeImageSources()
}, { deep: true })

// 组件挂载时初始化
onMounted(() => {
  console.log('[AIRenamePage] Component mounted')
  initializeImageSources()
})


const toggleSelection = (emojiId: string) => {
  if (selectedEmojis.value.has(emojiId)) {
    selectedEmojis.value.delete(emojiId)
  } else {
    selectedEmojis.value.add(emojiId)
  }
}

const selectedCount = computed(() => selectedEmojis.value.size)

const handleSelectAll = () => {
  selectedEmojis.value = new Set(allEmojis.value.map(e => e.id))
}

const handleDeselectAll = () => {
  selectedEmojis.value.clear()
}

const handleCancelSelection = () => {
  selectedEmojis.value.clear()
}

const isBatchRenameModalVisible = ref(false)

const handleBatchRename = () => {
  isBatchRenameModalVisible.value = true
}

const selectedEmojiObjects = computed(() => {
  const emojis: Emoji[] = []
  const selected = selectedEmojis.value
  if (selected.size === 0) return emojis

  for (const emoji of allEmojis.value) {
    if (selected.has(emoji.id)) {
      emojis.push(emoji)
    }
  }
  return emojis
})

const handleApplyBatchRename = (newNames: Record<string, string>) => {
  emojiStore.updateEmojiNames(newNames)
  isBatchRenameModalVisible.value = false
  selectedEmojis.value.clear()
}

// 虚拟列表引用
const virtualListRef = ref<InstanceType<typeof VirtualList> | null>(null)

// 使用设置中的网格列数
const gridColumns = computed(() => emojiStore.settings.gridColumns || 4)

// 根据网格列数计算项目高度
const itemHeight = computed(() => {
  // 每行显示 gridColumns 个卡片，每个卡片高度约为 180px（包括名称）
  return 180
})
const containerHeight = 600
</script>

<template>
  <div class="p-4">
    <div class="mb-4">
      <h1 class="text-2xl font-bold">AI 批量重命名</h1>
      <p class="text-gray-600 dark:text-gray-400">
        选择多个表情，使用 AI 智能批量重命名。支持流式加载和虚拟滚动优化。
      </p>
    </div>

    <!-- 使用虚拟滚动优化的列表 -->
    <div class="border rounded-lg overflow-hidden">
      <VirtualList
        ref="virtualListRef"
        :items="allEmojis"
        :item-height="itemHeight"
        :container-height="containerHeight"
        :buffer="5"
        :items-per-row="gridColumns"
      >
        <template #default="{ item: emoji }">
          <a-card
            class="m-1 cursor-pointer transition-all duration-200 h-full flex flex-col"
            :class="{
              'hover:shadow-lg hover:border-green-300': !selectedEmojis.has(emoji.id),
              'border-blue-500 border-2': selectedEmojis.has(emoji.id),
              'shadow-md': !selectedEmojis.has(emoji.id)
            }"
            @click="toggleSelection(emoji.id)"
            hoverable
          >
            <!-- 
              修复 #1: 
              - 移除了错误的 h-128。
              - 使用 justify-between 来在垂直方向上分隔图片和文字内容。
              - 确保此容器占满整个卡片高度 (h-full)。
            -->
            <div class="flex flex-col items-center justify-between p-2 h-full">
              <!-- 
                修复 #2: 
                - 创建一个新的 div 作为图片的 "视窗"。
                - 给它一个固定的高度 (例如 h-24)，这个高度决定了图片显示区域的大小。
                - 在这个视窗上应用 overflow-hidden 来裁剪放大后的图片。
              -->
              <div class="h-24 w-full flex items-center justify-center overflow-hidden">
                <a-image
                  :src="imageSources.get(emoji.id) || (emoji.displayUrl || emoji.url)"
                  :alt="emoji.name"
                  loading="lazy"
                />
                <div
                  v-if="loadingStates.get(emoji.id)"
                  class="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75"
                >
                  <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                </div>
              </div>

              <!-- 将文字和复选框组合在一起，位于卡片底部 -->
              <div class="text-center w-full mt-2">
                <div class="text-center truncate w-full text-sm dark:text-white mb-1">
                  {{ emoji.name }}
                </div>
                <div class="flex items-center justify-center">
                  <a-checkbox
                    :checked="selectedEmojis.has(emoji.id)"
                    @click.stop="toggleSelection(emoji.id)"
                  />
                </div>
              </div>
            </div>
          </a-card>
        </template>
      </VirtualList>
    </div>

    <BatchActionsBar
      v-if="selectedCount > 0"
      :selected-count="selectedCount"
      @select-all="handleSelectAll"
      @deselect-all="handleDeselectAll"
      @batch-rename="handleBatchRename"
      @cancel="handleCancelSelection"
    />

    <BatchRenameModalOptimized
      :visible="isBatchRenameModalVisible"
      :selected-emojis="selectedEmojiObjects"
      @close="isBatchRenameModalVisible = false"
      @apply="handleApplyBatchRename"
    />
  </div>
</template>
