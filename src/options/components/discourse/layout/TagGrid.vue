<script setup lang="ts">
import type { DiscourseTag } from '../types'

const props = withDefaults(
  defineProps<{
    tags: DiscourseTag[]
    title?: string
  }>(),
  {
    title: '标签'
  }
)

const emit = defineEmits<{
  (e: 'click', tag: DiscourseTag): void
}>()
</script>

<template>
  <div>
    <h3 class="text-lg font-semibold mb-3 dark:text-white">{{ props.title }}</h3>
    <div v-if="props.tags.length > 0" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      <button
        v-for="tag in props.tags"
        :key="tag.id || tag.name"
        type="button"
        class="text-left px-3 py-2 rounded-lg border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        @click="emit('click', tag)"
      >
        <div class="text-sm font-medium dark:text-white truncate">#{{ tag.name }}</div>
        <div class="text-xs text-gray-500">{{ tag.count }} 话题</div>
      </button>
    </div>
    <div v-else class="text-sm text-gray-500 dark:text-gray-400">暂无标签</div>
  </div>
</template>
