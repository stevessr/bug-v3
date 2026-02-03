<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick } from 'vue'

import QuickTagEditor from './QuickTagEditor.vue'
import VirtualList from './VirtualList.vue'
import EmojiCard from './EmojiCard'

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

let resizeObserver: ResizeObserver | null = null

// 组件挂载后进行测量
onMounted(() => {
  measureItemHeight()
  if (measurementRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      measureItemHeight()
    })
    resizeObserver.observe(measurementRef.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
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
// 注意：需要依赖整个 emojis 数组，以便在 emoji 内容变化时触发更新
const emojiRows = computed(() => {
  const emojis = props.emojis
  const { gridColumns } = props

  const rows: Emoji[][] = []
  for (let i = 0; i < emojis.length; i += gridColumns) {
    rows.push(emojis.slice(i, i + gridColumns))
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
      class="measurement-row emoji-row"
      :style="{
        gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`
      }"
    >
      <div class="emoji-item">
        <EmojiCard
          :emoji="emojis[0]"
          :group-id="groupId"
          :index="0"
          :image-src="getImageSrcSync(emojis[0])"
          @quickTag="() => undefined"
          @edit="() => undefined"
          @remove="() => undefined"
        />
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
          class="emoji-row grid gap-4"
          :style="{
            gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
            padding: '0 8px'
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
            <EmojiCard
              :emoji="emoji"
              :group-id="groupId"
              :index="rowIndex * gridColumns + colIndex"
              :image-src="imageSources.get(emoji.id) || getImageSrcSync(emoji)"
              @quickTag="openQuickTagEditor"
              @edit="(e, g, i) => $emit('editEmoji', e, g, i)"
              @remove="(g, i) => $emit('removeEmoji', g, i)"
            />
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

<style scoped src="./EmojiGrid.css" />
