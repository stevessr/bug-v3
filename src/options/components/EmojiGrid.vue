<script setup lang="ts">
import { QuestionCircleOutlined } from '@ant-design/icons-vue'

import type { Emoji } from '../../types/emoji'

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
            :src="emoji.url"
            :alt="emoji.name"
            class="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
        <div class="text-xs text-center text-gray-600 mt-1 truncate dark:text-white">
          {{ emoji.name }}
        </div>
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
