<script setup lang="ts">
import { computed } from 'vue'
import type { DiscourseCategory } from './types'

const props = withDefaults(
  defineProps<{
    categories: DiscourseCategory[]
    title?: string
  }>(),
  {
    title: '分类'
  }
)

const hasHierarchy = computed(() => {
  const hasChildren = props.categories.some(cat => cat.parent_category_id)
  const hasParents = props.categories.some(cat => !cat.parent_category_id)
  return hasChildren && hasParents
})

const topCategories = computed(() =>
  hasHierarchy.value ? props.categories.filter(cat => !cat.parent_category_id) : props.categories
)

const childrenByParent = computed(() => {
  const map = new Map<number, DiscourseCategory[]>()
  props.categories.forEach(cat => {
    if (!cat.parent_category_id) return
    const list = map.get(cat.parent_category_id) || []
    list.push(cat)
    map.set(cat.parent_category_id, list)
  })
  return map
})

const emit = defineEmits<{
  (e: 'click', category: DiscourseCategory): void
}>()
</script>

<template>
  <div v-if="props.categories.length > 0">
    <h3 class="text-lg font-semibold mb-3 dark:text-white">{{ props.title }}</h3>
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      <div
        v-for="cat in topCategories.slice(0, 8)"
        :key="cat.id"
        class="p-3 rounded-lg border dark:border-gray-700 cursor-pointer hover:shadow-md transition-shadow"
        :style="{ borderLeftColor: `#${cat.color}`, borderLeftWidth: '4px' }"
        @click="emit('click', cat)"
      >
        <div class="font-medium dark:text-white">{{ cat.name }}</div>
        <div class="text-xs text-gray-500">{{ cat.topic_count }} 话题</div>
        <div
          v-if="hasHierarchy && (childrenByParent.get(cat.id)?.length || 0) > 0"
          class="mt-2 space-y-1"
        >
          <div
            v-for="child in childrenByParent.get(cat.id)?.slice(0, 4)"
            :key="child.id"
            class="text-xs text-gray-600 dark:text-gray-300 truncate cursor-pointer hover:text-blue-600"
            @click.stop="emit('click', child)"
          >
            {{ child.name }}
          </div>
          <div
            v-if="(childrenByParent.get(cat.id)?.length || 0) > 4"
            class="text-xs text-gray-400"
          >
            还有 {{ (childrenByParent.get(cat.id)?.length || 0) - 4 }} 个子分类...
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
