<script setup lang="ts">
import { toRefs, watch } from 'vue'

import { useEmojiImages } from '@/composables/useEmojiImages'
import type { Emoji } from '@/types/type'
import CachedImage from '@/components/CachedImage.vue'

const { t } = useI18n()

const props = defineProps<{
  emojis: Emoji[]
  isLoading: boolean
  favorites: Set<string>
  gridColumns: number
  emptyMessage: string
  showAddButton: boolean
  groupId: string
  isActive: boolean
}>()

const emit = defineEmits(['select', 'openOptions'])

const { emojis, isLoading, favorites, gridColumns, emptyMessage, showAddButton, isActive } =
  toRefs(props)

// Use emoji images composable for unified image management
const { imageSources, getImageSrcSync, setActive } = useEmojiImages(() => props.emojis, {
  preload: true,
  preloadBatchSize: 3,
  preloadDelay: 50,
  preloadWhenActive: true
})

// Watch for active state changes and notify composable
watch(
  () => props.isActive,
  isActive => {
    setActive(isActive)
  },
  { immediate: true }
)

// 键盘导航功能
const handleKeyNavigation = (event: KeyboardEvent, index: number) => {
  switch (event.key) {
    case 'Enter':
    case ' ':
      event.preventDefault()
      emit('select', props.emojis[index])
      break
    case 'ArrowRight':
      event.preventDefault()
      focusAdjacentEmoji(index, 1)
      break
    case 'ArrowLeft':
      event.preventDefault()
      focusAdjacentEmoji(index, -1)
      break
    case 'ArrowDown':
      event.preventDefault()
      focusAdjacentEmoji(index, props.gridColumns)
      break
    case 'ArrowUp':
      event.preventDefault()
      focusAdjacentEmoji(index, -props.gridColumns)
      break
    case 'Home':
      event.preventDefault()
      focusFirstEmoji()
      break
    case 'End':
      event.preventDefault()
      focusLastEmoji()
      break
  }
}

const focusAdjacentEmoji = (currentIndex: number, offset: number) => {
  const newIndex = currentIndex + offset
  if (newIndex >= 0 && newIndex < props.emojis.length) {
    const nextButton = document.querySelector(
      `.emoji-item[data-emoji-index="${newIndex}"]`
    ) as HTMLElement
    if (nextButton) {
      nextButton.focus()
    }
  }
}

const focusFirstEmoji = () => {
  const firstButton = document.querySelector('.emoji-item[data-emoji-index="0"]') as HTMLElement
  if (firstButton) {
    firstButton.focus()
  }
}

const focusLastEmoji = () => {
  const lastIndex = props.emojis.length - 1
  const lastButton = document.querySelector(
    `.emoji-item[data-emoji-index="${lastIndex}"]`
  ) as HTMLElement
  if (lastButton) {
    lastButton.focus()
  }
}
</script>

<template>
  <!-- 使用 v-show 而不是 v-if，保持 DOM 不被销毁，提升切换性能 -->
  <div v-show="isActive" class="lazy-emoji-grid-wrapper">
    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
      <span class="ml-2 text-sm text-gray-600 dark:text-white">{{ t('loadingText') }}</span>
    </div>

    <div v-else-if="emojis.length > 0" class="p-0 overflow-y-auto" role="grid">
      <div
        class="emoji-grid overflow-y-auto"
        :style="`display: grid; grid-template-columns: repeat(${gridColumns}, minmax(0, 1fr)); gap: 12px; min-height: 300px;`"
        role="row"
      >
        <a-button
          v-for="(emoji, index) in emojis"
          :key="emoji.id"
          @click="$emit('select', emoji)"
          @keydown="handleKeyNavigation($event, index)"
          :data-emoji-index="index"
          style="width: 100%; height: auto"
          class="emoji-item relative p-0 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group mobile:p-2 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
          :title="emoji.name"
          role="gridcell"
          tabindex="0"
        >
          <div class="w-full aspect-square overflow-hidden rounded">
            <CachedImage
              :src="imageSources.get(emoji.id) || getImageSrcSync(emoji)"
              :alt="emoji.name"
              class="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
          <!-- Activity indicator for favorites -->
          <div
            v-if="favorites.has(emoji.id) && emoji.usageCount"
            class="absolute top-0 right-0 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center text-xs text-white font-bold"
            :title="t('usageCountTimes', [emoji.usageCount])"
          >
            {{ emoji.usageCount > 99 ? '99+' : emoji.usageCount }}
          </div>
          <!-- Star icon for favorites without usage count -->
          <div
            v-else-if="favorites.has(emoji.id)"
            class="absolute top-0 right-0 w-3 h-3 bg-yellow-400 rounded-full flex items-center justify-center"
          >
            <svg class="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path
                d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
              />
            </svg>
          </div>
        </a-button>
      </div>
    </div>

    <div v-else class="flex flex-col items-center justify-center py-8 text-center">
      <svg
        class="w-12 h-12 text-gray-400 mb-2"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m8-8v2m0 6v2"
        />
      </svg>
      <p class="text-sm text-gray-600 dark:text-white">{{ emptyMessage }}</p>
      <a-button
        v-if="showAddButton"
        @click="$emit('openOptions')"
        class="mt-2 text-xs text-blue-600 hover:text-blue-800 dark:text-white dark:hover:text-white"
      >
        {{ t('goAddEmojis') }}
      </a-button>
    </div>
  </div>
</template>

<style scoped>
.lazy-emoji-grid-wrapper {
  width: 100%;
  height: 100%;
  overflow-y: auto;
}
</style>
