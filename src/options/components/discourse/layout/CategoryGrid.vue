<script setup lang="ts">
import { computed } from 'vue'

import type { DiscourseCategory } from '../types'
import ImageProxy from '../ImageProxy.vue'

const props = withDefaults(
  defineProps<{
    categories: DiscourseCategory[]
    title?: string
    baseUrl?: string
  }>(),
  {
    title: '分类',
    baseUrl: ''
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

const getImageUrl = (url?: string | null) => {
  if (!url) return ''
  return url.startsWith('http') ? url : `${props.baseUrl}${url}`
}

const getIconHref = (icon?: string | null) => {
  if (!icon) return ''
  return `#${icon}`
}
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
        <div class="flex items-center gap-2">
          <div class="category-icon-wrap" :style="{ color: `#${cat.color}` }">
            <ImageProxy
              v-if="cat.uploaded_logo?.url"
              :original-src="getImageUrl(cat.uploaded_logo.url)"
              :alt="cat.name"
              class="category-icon-img"
              :fallback-src="getImageUrl(cat.uploaded_logo.url)"
              :force-proxy="true"
            />
            <ImageProxy
              v-else-if="cat.uploaded_logo_dark?.url"
              :original-src="getImageUrl(cat.uploaded_logo_dark.url)"
              :alt="cat.name"
              class="category-icon-img"
              :fallback-src="getImageUrl(cat.uploaded_logo_dark.url)"
              :force-proxy="true"
            />
            <span v-else-if="cat.emoji" class="category-emoji">{{ cat.emoji }}</span>
            <svg v-else-if="cat.icon" class="category-icon-svg" viewBox="0 0 24 24">
              <use :href="getIconHref(cat.icon)" />
            </svg>
            <span v-else class="category-icon-dot" :style="{ backgroundColor: `#${cat.color}` }" />
          </div>
          <div class="font-medium dark:text-white">{{ cat.name }}</div>
        </div>
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
            <span class="inline-flex items-center gap-1">
              <span class="subcategory-icon" :style="{ color: `#${child.color}` }">
                <ImageProxy
                  v-if="child.uploaded_logo?.url"
                  :original-src="getImageUrl(child.uploaded_logo.url)"
                  :alt="child.name"
                  class="subcategory-icon-img"
                  :fallback-src="getImageUrl(child.uploaded_logo.url)"
                  :force-proxy="true"
                />
                <ImageProxy
                  v-else-if="child.uploaded_logo_dark?.url"
                  :original-src="getImageUrl(child.uploaded_logo_dark.url)"
                  :alt="child.name"
                  class="subcategory-icon-img"
                  :fallback-src="getImageUrl(child.uploaded_logo_dark.url)"
                  :force-proxy="true"
                />
                <span v-else-if="child.emoji" class="subcategory-emoji">{{ child.emoji }}</span>
                <svg v-else-if="child.icon" class="subcategory-icon-svg" viewBox="0 0 24 24">
                  <use :href="getIconHref(child.icon)" />
                </svg>
                <span
                  v-else
                  class="subcategory-dot"
                  :style="{ backgroundColor: `#${child.color}` }"
                />
              </span>
              {{ child.name }}
            </span>
          </div>
          <div v-if="(childrenByParent.get(cat.id)?.length || 0) > 4" class="text-xs text-gray-400">
            还有 {{ (childrenByParent.get(cat.id)?.length || 0) - 4 }} 个子分类...
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="../css/CategoryGrid.css"></style>
