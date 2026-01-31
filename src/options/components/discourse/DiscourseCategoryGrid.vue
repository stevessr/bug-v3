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
  const hasChildren = props.categories.some(
    cat => cat.parent_category_id || (cat.subcategory_ids?.length || 0) > 0
  )
  const hasParents = props.categories.some(cat => !cat.parent_category_id)
  return hasChildren && hasParents
})

const topCategories = computed(() =>
  hasHierarchy.value ? props.categories.filter(cat => !cat.parent_category_id) : props.categories
)

const childrenByParent = computed(() => {
  const map = new Map<number, DiscourseCategory[]>()
  const byId = new Map<number, DiscourseCategory>()
  props.categories.forEach(cat => {
    byId.set(cat.id, cat)
  })

  const pushChild = (parentId: number, child: DiscourseCategory) => {
    const list = map.get(parentId) || []
    if (!list.some(item => item.id === child.id)) {
      list.push(child)
      map.set(parentId, list)
    }
  }

  props.categories.forEach(cat => {
    if (cat.parent_category_id) {
      pushChild(cat.parent_category_id, cat)
    }
  })

  props.categories.forEach(cat => {
    if (!cat.subcategory_ids?.length) return
    cat.subcategory_ids.forEach(id => {
      const child = byId.get(id)
      if (child) {
        pushChild(cat.id, child)
      }
    })
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
        v-for="cat in topCategories"
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
          <div v-if="(childrenByParent.get(cat.id)?.length || 0) > 4" class="text-xs text-gray-400">
            还有 {{ (childrenByParent.get(cat.id)?.length || 0) - 4 }} 个子分类...
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
