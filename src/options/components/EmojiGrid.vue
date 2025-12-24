<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { QuestionCircleOutlined, TagOutlined } from '@ant-design/icons-vue'

import EmojiTags from './EmojiTags.vue'
import QuickTagEditor from './QuickTagEditor.vue'

import { useEmojiStore } from '@/stores/emojiStore'
import { getEmojiImageUrl, getEmojiImageUrlSync, preloadImages } from '@/utils/imageUrlHelper'
import type { Emoji } from '@/types/type'

interface Props {
  emojis: Emoji[]
  groupId: string
  gridColumns: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  editEmoji: [emoji: Emoji, groupId: string, index: number]
  removeEmoji: [groupId: string, index: number]
  emojiDragStart: [emoji: Emoji, groupId: string, index: number, event: DragEvent]
  emojiDrop: [groupId: string, index: number, event: DragEvent]
}>()

// 快速標籤編輯器狀態
const showQuickTagEditor = ref(false)
const editingEmoji = ref<Emoji | null>(null)

// 打開快速標籤編輯器
const openQuickTagEditor = (emoji: Emoji) => {
  editingEmoji.value = emoji
  showQuickTagEditor.value = true
}

// 關閉快速標籤編輯器
const closeQuickTagEditor = () => {
  showQuickTagEditor.value = false
  editingEmoji.value = null
}

const emojiStore = useEmojiStore()
const blobUrls = ref<Set<string>>(new Set())

// Computed property to check if image caching is enabled
const useCachedImages = computed(() => emojiStore.settings.useIndexedDBForImages)

// Method to get image source with caching support
const getImageSrc = async (emoji: Emoji): Promise<string> => {
  return getEmojiImageUrl(emoji, { preferCache: useCachedImages.value })
}

// Synchronous version for immediate rendering
const getImageSrcSync = (emoji: Emoji): string => {
  return getEmojiImageUrlSync(emoji, { preferCache: useCachedImages.value })
}

// Reactive image sources for emojis
const imageSources = ref<Map<string, string>>(new Map())

// Initialize image sources
const initializeImageSources = async () => {
  // 使用 Promise.all 批量获取，而不是逐个 await
  const entries = await Promise.all(
    props.emojis.map(async emoji => {
      const src = await getImageSrc(emoji)
      return [emoji.id, src] as const
    })
  )
  imageSources.value = new Map(entries)
}

// Watch for emoji changes and update image sources
// 优化：防抖并使用批量更新，避免频繁更新
let updateDebounceTimer: ReturnType<typeof setTimeout> | null = null
const updateImageSources = async () => {
  // 防抖：避免短时间内多次更新
  if (updateDebounceTimer) {
    clearTimeout(updateDebounceTimer)
  }
  updateDebounceTimer = setTimeout(async () => {
    const currentEmojiIds = new Set(props.emojis.map(e => e.id))

    // Clean up old blob URLs that are no longer needed
    for (const [emojiId, blobUrl] of imageSources.value) {
      if (!currentEmojiIds.has(emojiId) && blobUrl.startsWith('blob:')) {
        blobUrls.value.delete(blobUrl)
        URL.revokeObjectURL(blobUrl)
      }
    }

    // 批量获取新的图片源
    const entries = await Promise.all(
      props.emojis.map(async emoji => {
        // 如果已存在且不是 blob URL，复用
        const existing = imageSources.value.get(emoji.id)
        if (existing && !existing.startsWith('blob:')) {
          return [emoji.id, existing] as const
        }
        const src = await getImageSrc(emoji)
        return [emoji.id, src] as const
      })
    )

    imageSources.value = new Map(entries)
  }, 100)
}

// Preload images for better performance
const preloadEmojis = async () => {
  if (useCachedImages.value) {
    try {
      await preloadImages(props.emojis, { batchSize: 3, delay: 50 })
    } catch (error) {
      console.warn('Failed to preload images:', error)
    }
  }
}

// Clean up blob URLs when component is unmounted
onUnmounted(() => {
  // 清理防抖定时器
  if (updateDebounceTimer) {
    clearTimeout(updateDebounceTimer)
  }
  for (const blobUrl of blobUrls.value) {
    try {
      URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.warn('Failed to revoke blob URL:', blobUrl, error)
    }
  }
  blobUrls.value.clear()
})

// Initialize image sources when component is created
initializeImageSources()

// Preload images after initialization
preloadEmojis()

// Watch for emoji changes and update image sources
// 使用防抖的深度监听，平衡性能和数据一致性
watch(() => props.emojis, updateImageSources, { deep: true })

// 拖拽处理
const handleEmojiDragStart = (emoji: Emoji, index: number, event: DragEvent) => {
  emit('emojiDragStart', emoji, props.groupId, index, event)
}

const handleEmojiDrop = (index: number, event: DragEvent) => {
  emit('emojiDrop', props.groupId, index, event)
}

// 触摸事件处理占位
const addEmojiTouchEvents = (_element: HTMLElement, _emoji: Emoji, _index: number) => {
  // 由父组件通过 TouchDragHandler 处理
}
</script>

<template>
  <div class="emoji-grid">
    <div
      class="grid gap-3"
      :style="{
        gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`
      }"
    >
      <div
        v-for="(emoji, index) in emojis"
        :key="`${groupId}-${index}`"
        class="emoji-item relative group cursor-move"
        :draggable="true"
        @dragstart="e => handleEmojiDragStart(emoji, index, e)"
        @dragover.prevent
        @drop="e => handleEmojiDrop(index, e)"
        :ref="el => el && addEmojiTouchEvents(el as HTMLElement, emoji, index)"
      >
        <div
          class="aspect-square bg-gray-50 rounded-lg overflow-hidden hover:bg-gray-100 transition-colors dark:bg-gray-700 dark:hover:bg-gray-600"
        >
          <img
            :src="imageSources.get(emoji.id) || getEmojiImageUrlSync(emoji)"
            :alt="emoji.name"
            class="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
        <div class="text-xs text-center text-gray-600 mt-1 truncate dark:text-white">
          {{ emoji.name }}
        </div>
        <!-- 標籤顯示 -->
        <EmojiTags :tags="emoji.tags || []" :max-display="2" />

        <!-- 快速標籤編輯按鈕 -->
        <button
          @click="openQuickTagEditor(emoji)"
          class="absolute bottom-1 left-1 w-6 h-6 bg-green-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-green-600"
          title="快速編輯標籤"
        >
          <TagOutlined class="text-xs" />
        </button>

        <!-- Edit button -->
        <a-button
          @click="$emit('editEmoji', emoji, groupId, index)"
          class="absolute bottom-1 right-1 w-4 h-4 bg-blue-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          title="编辑表情"
        >
          ✎
        </a-button>
        <!-- Remove button -->
        <a-popconfirm title="确认移除此表情？" @confirm="$emit('removeEmoji', groupId, index)">
          <template #icon>
            <QuestionCircleOutlined style="color: red" />
          </template>
          <a-button
            class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
          >
            ×
          </a-button>
        </a-popconfirm>
      </div>
    </div>

    <!-- 快速標籤編輯器模態框 -->
    <QuickTagEditor
      v-if="editingEmoji"
      :show="showQuickTagEditor"
      :emoji="editingEmoji"
      @update:show="showQuickTagEditor = $event"
      @close="closeQuickTagEditor"
    />
  </div>
</template>

<style scoped>
.emoji-grid {
  width: 100%;
  max-height: 600px;
  overflow-y: auto;
  padding: 4px;
}

.emoji-grid {
  scrollbar-width: thin;
  scrollbar-color: #cbd5e0 #f7fafc;
}

.emoji-grid::-webkit-scrollbar {
  width: 8px;
}

.emoji-grid::-webkit-scrollbar-track {
  background: #f7fafc;
  border-radius: 4px;
}

.emoji-grid::-webkit-scrollbar-thumb {
  background: #cbd5e0;
  border-radius: 4px;
}

.emoji-grid::-webkit-scrollbar-thumb:hover {
  background: #a0aec0;
}

.emoji-item {
  transition:
    transform 0.2s,
    opacity 0.2s;
}

.emoji-item:hover {
  transform: translateY(-2px);
}

.emoji-item.touch-dragging {
  opacity: 0.6;
  transform: scale(0.9);
}

.emoji-item img {
  transition: opacity 0.3s;
}

@media (max-width: 768px) {
  .emoji-item {
    margin: 2px;
  }

  .emoji-item button {
    opacity: 1;
  }
}
</style>
