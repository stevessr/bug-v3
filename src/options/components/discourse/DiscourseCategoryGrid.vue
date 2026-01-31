<script setup lang="ts">
import type { DiscourseCategory } from './types'

defineProps<{
  categories: DiscourseCategory[]
}>()

const emit = defineEmits<{
  (e: 'click', category: DiscourseCategory): void
}>()
</script>

<template>
  <div v-if="categories.length > 0">
    <h3 class="text-lg font-semibold mb-3 dark:text-white">分类</h3>
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      <div
        v-for="cat in categories.slice(0, 8)"
        :key="cat.id"
        class="p-3 rounded-lg border dark:border-gray-700 cursor-pointer hover:shadow-md transition-shadow"
        :style="{ borderLeftColor: `#${cat.color}`, borderLeftWidth: '4px' }"
        @click="emit('click', cat)"
      >
        <div class="font-medium dark:text-white">{{ cat.name }}</div>
        <div class="text-xs text-gray-500">{{ cat.topic_count }} 话题</div>
      </div>
    </div>
  </div>
</template>
