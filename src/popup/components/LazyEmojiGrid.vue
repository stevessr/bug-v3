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
    <div v-if="isLoading" class="emoji-grid-loading">
      <div class="emoji-grid-spinner"></div>
      <span class="emoji-grid-loading-text">{{ t('loadingText') }}</span>
    </div>

    <div v-else-if="emojis.length > 0" class="emoji-grid-container" role="grid">
      <div
        class="emoji-grid"
        :style="`display: grid; grid-template-columns: repeat(${gridColumns}, minmax(0, 1fr)); gap: 12px; min-height: 300px;`"
        role="row"
      >
        <a-button
          v-for="(emoji, index) in emojis"
          :key="emoji.id"
          @click="$emit('select', emoji)"
          @keydown="handleKeyNavigation($event, index)"
          :data-emoji-index="index"
          class="emoji-item"
          :title="emoji.name"
          role="gridcell"
          tabindex="0"
        >
          <div class="emoji-item-image">
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
            class="emoji-item-badge"
            :title="t('usageCountTimes', [emoji.usageCount])"
          >
            {{ emoji.usageCount > 99 ? '99+' : emoji.usageCount }}
          </div>
          <!-- Star icon for favorites without usage count -->
          <div
            v-else-if="favorites.has(emoji.id)"
            class="emoji-item-star"
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

    <div v-else class="emoji-grid-empty">
      <svg
        class="emoji-grid-empty-icon"
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
      <p class="emoji-grid-empty-text">{{ emptyMessage }}</p>
      <a-button
        v-if="showAddButton"
        @click="$emit('openOptions')"
        class="emoji-grid-empty-btn"
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
  background-color: var(--md3-surface);
}

/* Loading state */
.emoji-grid-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 0;
}

.emoji-grid-spinner {
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid var(--md3-surface-container-highest);
  border-bottom-color: var(--md3-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.emoji-grid-loading-text {
  margin-left: 0.5rem;
  font-size: 0.875rem;
  color: var(--md3-on-surface-variant);
}

/* Grid container */
.emoji-grid-container {
  padding: 0;
  overflow-y: auto;
}

.emoji-grid {
  overflow-y: auto;
}

/* Emoji item */
.emoji-item {
  position: relative;
  width: 100%;
  height: auto;
  padding: 0;
  border-radius: 0.5rem;
  background-color: transparent;
  transition: background-color 0.2s;
}

.emoji-item:hover {
  background-color: var(--md3-surface-container-high);
}

.emoji-item:focus {
  outline: 2px solid var(--md3-primary);
  outline-offset: 2px;
}

.emoji-item-image {
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 0.25rem;
}

/* Badge for usage count */
.emoji-item-badge {
  position: absolute;
  top: 0;
  right: 0;
  width: 1rem;
  height: 1rem;
  background-color: var(--md3-tertiary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.625rem;
  color: var(--md3-on-tertiary);
  font-weight: bold;
}

/* Star badge */
.emoji-item-star {
  position: absolute;
  top: 0;
  right: 0;
  width: 0.75rem;
  height: 0.75rem;
  background-color: var(--md3-tertiary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Empty state */
.emoji-grid-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 0;
  text-align: center;
}

.emoji-grid-empty-icon {
  width: 3rem;
  height: 3rem;
  color: var(--md3-on-surface-variant);
  margin-bottom: 0.5rem;
}

.emoji-grid-empty-text {
  font-size: 0.875rem;
  color: var(--md3-on-surface-variant);
}

.emoji-grid-empty-btn {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--md3-primary);
  background-color: transparent;
}

.emoji-grid-empty-btn:hover {
  color: var(--md3-primary);
  background-color: var(--md3-primary-container);
}

/* Mobile responsive */
@media (min-width: 640px) {
  .emoji-item {
    padding: 0.5rem;
  }
}
</style>
