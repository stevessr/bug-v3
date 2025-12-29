<script setup lang="ts">
import { computed, ref, onMounted, nextTick } from 'vue'
import { QuestionCircleOutlined, TagOutlined } from '@ant-design/icons-vue'

import EmojiTags from './EmojiTags.vue'
import QuickTagEditor from './QuickTagEditor.vue'
import VirtualList from './VirtualList.vue'

import { useEmojiImages } from '@/composables/useEmojiImages'
import type { Emoji } from '@/types/type'
import CachedImage from '@/components/CachedImage.vue'

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

// 动态测量行高
const measuredItemHeight = ref<number>(206) // 默认值作为 fallback
const measurementRef = ref<HTMLElement | null>(null)

// 测量实际渲染的行高
const measureItemHeight = async () => {
  await nextTick()
  if (measurementRef.value) {
    const height = measurementRef.value.offsetHeight
    if (height > 0) {
      measuredItemHeight.value = height
      console.log('[EmojiGrid] Measured item height:', height)
    }
  }
}

// 组件挂载后进行测量
onMounted(() => {
  measureItemHeight()
})

// 当 gridColumns 变化时重新测量
// 注意：使用 computed + watch 会更好，但为了性能我们只在必要时重新测量
const ITEM_HEIGHT = computed(() => measuredItemHeight.value)

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
// 优化：使用 computed 的依赖收集，配合 length 和 gridColumns 作为显式依赖
const emojiRows = computed(() => {
  // 显式依赖这些值，Vue 会自动缓存
  const { length } = props.emojis
  const { gridColumns } = props

  const rows: Emoji[][] = []
  for (let i = 0; i < length; i += gridColumns) {
    rows.push(props.emojis.slice(i, i + gridColumns))
  }

  return rows
})
</script>

<template>
  <div class="emoji-grid-container">
    <!-- 隐藏的测量元素 - 用于动态获取实际行高 -->
    <div
      v-if="emojis.length > 0"
      ref="measurementRef"
      class="measurement-row"
      :style="{
        visibility: 'hidden',
        position: 'absolute',
        pointerEvents: 'none',
        gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
        padding: '0 4px',
        width: '100%'
      }"
    >
      <div class="emoji-item">
        <div class="aspect-square bg-gray-50 rounded-lg overflow-hidden">
          <img
            :src="getImageSrcSync(emojis[0])"
            :alt="emojis[0].name"
            class="w-full h-full object-cover"
          />
        </div>
        <div class="text-xs text-center text-gray-600 mt-1 truncate">{{ emojis[0].name }}</div>
        <EmojiTags :tags="emojis[0].tags || []" :max-display="2" />
      </div>
    </div>

    <VirtualList
      :items="emojiRows"
      :item-height="ITEM_HEIGHT"
      :container-height="600"
      :buffer="2"
      :items-per-row="1"
      :item-key="(row, index) => row.map(e => e.id).join('-') || `row-${index}`"
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
              <CachedImage
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
  position: relative;
}

.measurement-row {
  display: grid;
  gap: 0.75rem; /* gap-3 */
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
