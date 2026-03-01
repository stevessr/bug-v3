<script setup lang="ts">
import { ref } from 'vue'

import QuickTagEditor from './QuickTagEditor.vue'
import EmojiCard from './EmojiCard.vue'

import { useEmojiImages } from '@/composables/useEmojiImages'
import type { Emoji } from '@/types/type'

const props = defineProps<{
  emojis: Emoji[]
  groupId: string
  gridColumns: number
}>()

const emit = defineEmits<{
  (e: 'editEmoji', emoji: Emoji, groupId: string, index: number): void
  (e: 'removeEmoji', groupId: string, index: number): void
  (e: 'emojiDragStart', emoji: Emoji, groupId: string, index: number, event: DragEvent): void
  (e: 'emojiDrop', groupId: string, index: number, event: DragEvent): void
}>()

const showQuickTagEditor = ref(false)
const editingEmoji = ref<Emoji | null>(null)

const openQuickTagEditor = (emoji: Emoji) => {
  editingEmoji.value = emoji
  showQuickTagEditor.value = true
}

const closeQuickTagEditor = () => {
  showQuickTagEditor.value = false
  editingEmoji.value = null
}

const { imageSources, getImageSrcSync } = useEmojiImages(() => props.emojis, {
  preload: true,
  preloadBatchSize: 3,
  preloadDelay: 50
})

const handleEmojiDragStart = (emoji: Emoji, index: number, event: DragEvent) => {
  emit('emojiDragStart', emoji, props.groupId, index, event)
}

const handleEmojiDrop = (index: number, event: DragEvent) => {
  emit('emojiDrop', props.groupId, index, event)
}

const addEmojiTouchEvents = (_element: HTMLElement, _emoji: Emoji, _index: number) => {
  // 由父组件通过 TouchDragHandler 处理
}

const handleEmojiRef = (el: Element | null, emoji: Emoji, index: number) => {
  if (el instanceof HTMLElement) addEmojiTouchEvents(el, emoji, index)
}

const getEmojiImageSrc = (emoji: Emoji) => {
  return imageSources.value.get(emoji.id) || getImageSrcSync(emoji)
}
</script>

<template>
  <div class="options-emoji-grid-container">
    <div
      class="options-emoji-grid"
      :style="{ gridTemplateColumns: `repeat(${props.gridColumns}, minmax(0, 1fr))` }"
    >
      <div
        v-for="(emoji, index) in props.emojis"
        :key="emoji.id"
        class="options-emoji-item relative group cursor-move"
        draggable
        @dragstart="handleEmojiDragStart(emoji, index, $event)"
        @dragover.prevent
        @drop="handleEmojiDrop(index, $event)"
        :ref="el => handleEmojiRef(el, emoji, index)"
      >
        <EmojiCard
          :emoji="emoji"
          :group-id="props.groupId"
          :index="index"
          :image-src="getEmojiImageSrc(emoji)"
          @quick-tag="openQuickTagEditor"
          @edit="(e, g, i) => emit('editEmoji', e, g, i)"
          @remove="(g, i) => emit('removeEmoji', g, i)"
        />
      </div>
    </div>

    <QuickTagEditor
      v-if="editingEmoji"
      v-model:show="showQuickTagEditor"
      :emoji="editingEmoji"
      @close="closeQuickTagEditor"
    />
  </div>
</template>

<style scoped src="./EmojiGrid.css" />
