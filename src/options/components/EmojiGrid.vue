<script setup lang="ts">
import { computed, ref } from 'vue'
import { QuestionCircleOutlined, TagOutlined } from '@ant-design/icons-vue'

import EmojiTags from './EmojiTags.vue'
import QuickTagEditor from './QuickTagEditor.vue'
import VirtualList from './VirtualList.vue'

import { useEmojiImages } from '@/composables/useEmojiImages'
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

// Use emoji images composable for unified image management
const { imageSources, getImageSrcSync } = useEmojiImages(() => props.emojis, {
  preload: true,
  preloadBatchSize: 3,
  preloadDelay: 50
})

// Calculate item height for virtual list (based on grid layout)
// Each row has: image (aspect-square) + name (text-xs) + tags + spacing
// Approximate: 150px for image + 20px for name + 24px for tags + 12px spacing = ~206px
const ITEM_HEIGHT = 206

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

// Group emojis into rows for virtual list
const emojiRows = computed(() => {
  const rows: Emoji[][] = []
  for (let i = 0; i < props.emojis.length; i += props.gridColumns) {
    rows.push(props.emojis.slice(i, i + props.gridColumns))
  }
  return rows
})
</script>

<template>
  <div class="emoji-grid-container">
    <VirtualList
      :items="emojiRows"
      :item-height="ITEM_HEIGHT"
      :container-height="600"
      :buffer="2"
      :items-per-row="1"
    >
      <template #default="{ item: row, index: rowIndex }">
        <div
          class="grid gap-3"
          :style="{
            gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
            padding: '0 4px'
          }"
        >
          <div
            v-for="(emoji, colIndex) in row"
            :key="`${groupId}-${rowIndex * gridColumns + colIndex}`"
            class="emoji-item relative group cursor-move"
            :draggable="true"
            @dragstart="e => handleEmojiDragStart(emoji, rowIndex * gridColumns + colIndex, e)"
            @dragover.prevent
            @drop="e => handleEmojiDrop(rowIndex * gridColumns + colIndex, e)"
            :ref="
              el =>
                el &&
                addEmojiTouchEvents(el as HTMLElement, emoji, rowIndex * gridColumns + colIndex)
            "
          >
            <div
              class="aspect-square bg-gray-50 rounded-lg overflow-hidden hover:bg-gray-100 transition-colors dark:bg-gray-700 dark:hover:bg-gray-600"
            >
              <img
                :src="imageSources.get(emoji.id) || getImageSrcSync(emoji)"
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
              @click="$emit('editEmoji', emoji, groupId, rowIndex * gridColumns + colIndex)"
              class="absolute bottom-1 right-1 w-4 h-4 bg-blue-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              title="编辑表情"
            >
              ✎
            </a-button>
            <!-- Remove button -->
            <a-popconfirm
              title="确认移除此表情？"
              @confirm="$emit('removeEmoji', groupId, rowIndex * gridColumns + colIndex)"
            >
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
      </template>
    </VirtualList>

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
.emoji-grid-container {
  width: 100%;
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
