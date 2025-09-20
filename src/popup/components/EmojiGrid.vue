<script setup lang="ts">
import { defineProps, toRefs } from 'vue'

import type { Emoji } from '../../types/emoji'

// Keep props reactive in the template by using toRefs instead of plain
// destructuring which would lose reactivity for primitive props like
// `isLoading` and cause the loading UI to never update.
const props = defineProps<{
  emojis: Emoji[]
  isLoading: boolean
  favorites: Set<string>
  gridColumns: number
  emptyMessage: string
  showAddButton: boolean
}>()

// Declare emitted events to satisfy TypeScript/vue compiler
defineEmits(['select', 'openOptions'])

const { emojis, isLoading, favorites, gridColumns, emptyMessage, showAddButton } = toRefs(props)
</script>

<template>
  <div v-if="isLoading" class="flex items-center justify-center py-8">
    <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
    <span class="ml-2 text-sm text-gray-600 dark:text-white">加载中...</span>
  </div>

  <div v-else-if="emojis.length > 0" class="p-0 overflow-hidden">
    <div
      class="grid emoji-grid overflow-y-auto"
      :style="`grid-template-columns: repeat(${gridColumns}, minmax(0, 1fr)); max-height: 300px;`"
    >
      <a-button
        v-for="emoji in emojis"
        :key="emoji.id"
        @click="$emit('select', emoji)"
        style="height: max-content"
        class="relative p-0 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group mobile:p-2"
        :title="emoji.name"
      >
        <img
          :src="emoji.displayUrl || emoji.url"
          :alt="emoji.name"
          class="w-full h-full object-cover"
          loading="lazy"
        />
        <!-- Activity indicator for favorites -->
        <div
          v-if="favorites.has(emoji.id) && emoji.usageCount"
          class="absolute top-0 right-0 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center text-xs text-white font-bold"
          :title="`使用 ${emoji.usageCount} 次`"
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
    <svg class="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      去添加表情
    </a-button>
  </div>
</template>
