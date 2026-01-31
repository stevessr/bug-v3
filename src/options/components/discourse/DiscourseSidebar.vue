<script setup lang="ts">
import { computed } from 'vue'

import type { DiscourseCategory, DiscourseUser } from './types'
import { getAvatarUrl } from './utils'

const props = defineProps<{
  categories: DiscourseCategory[]
  users: DiscourseUser[]
  baseUrl: string
}>()

const emit = defineEmits<{
  (e: 'clickCategory', category: DiscourseCategory): void
  (e: 'clickUser', username: string): void
}>()

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
  <div class="sidebar space-y-4">
    <!-- Categories section -->
    <div
      v-if="categories.length > 0"
      class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700"
    >
      <h3 class="text-sm font-semibold mb-3 dark:text-white">分类</h3>
      <div class="space-y-1">
        <template v-for="cat in topCategories" :key="cat.id">
          <div
            class="flex items-center gap-2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
            @click="emit('clickCategory', cat)"
          >
            <div class="sidebar-icon">
              <img
                v-if="cat.uploaded_logo?.url"
                :src="getImageUrl(cat.uploaded_logo.url)"
                :alt="cat.name"
                class="sidebar-icon-img"
              />
              <img
                v-else-if="cat.uploaded_logo_dark?.url"
                :src="getImageUrl(cat.uploaded_logo_dark.url)"
                :alt="cat.name"
                class="sidebar-icon-img"
              />
              <span v-else-if="cat.emoji" class="sidebar-emoji">{{ cat.emoji }}</span>
              <svg v-else-if="cat.icon" class="sidebar-icon-svg" viewBox="0 0 24 24">
                <use :href="getIconHref(cat.icon)" />
              </svg>
              <span
                v-else
                class="sidebar-icon-dot"
                :style="{ backgroundColor: `#${cat.color}` }"
              />
            </div>
            <span class="text-sm dark:text-gray-300 truncate flex-1">{{ cat.name }}</span>
            <span class="text-xs text-gray-400">{{ cat.topic_count }}</span>
          </div>
          <div
            v-if="hasHierarchy && (childrenByParent.get(cat.id)?.length || 0) > 0"
            class="ml-4 space-y-1"
          >
            <div
              v-for="child in childrenByParent.get(cat.id)?.slice(0, 6)"
              :key="child.id"
              class="flex items-center gap-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
              @click="emit('clickCategory', child)"
            >
              <span class="sidebar-icon">
                <img
                  v-if="child.uploaded_logo?.url"
                  :src="getImageUrl(child.uploaded_logo.url)"
                  :alt="child.name"
                  class="sidebar-icon-img"
                />
                <img
                  v-else-if="child.uploaded_logo_dark?.url"
                  :src="getImageUrl(child.uploaded_logo_dark.url)"
                  :alt="child.name"
                  class="sidebar-icon-img"
                />
                <span v-else-if="child.emoji" class="sidebar-emoji">{{ child.emoji }}</span>
                <svg v-else-if="child.icon" class="sidebar-icon-svg" viewBox="0 0 24 24">
                  <use :href="getIconHref(child.icon)" />
                </svg>
                <span
                  v-else
                  class="sidebar-icon-dot"
                  :style="{ backgroundColor: `#${child.color}` }"
                />
              </span>
              <span class="text-xs dark:text-gray-300 truncate flex-1">{{ child.name }}</span>
            </div>
            <div
              v-if="(childrenByParent.get(cat.id)?.length || 0) > 6"
              class="text-xs text-gray-400 ml-1"
            >
              还有 {{ (childrenByParent.get(cat.id)?.length || 0) - 6 }} 个子分类...
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Active users section -->
    <div
      v-if="users.length > 0"
      class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700"
    >
      <h3 class="text-sm font-semibold mb-3 dark:text-white">活跃用户</h3>
      <div class="flex flex-wrap gap-2">
        <img
          v-for="user in users.slice(0, 20)"
          :key="user.id"
          :src="getAvatarUrl(user.avatar_template, baseUrl, 32)"
          :alt="user.username"
          :title="user.username"
          class="w-8 h-8 rounded-full cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
          @click="emit('clickUser', user.username)"
        />
      </div>
      <div v-if="users.length > 20" class="text-xs text-gray-400 mt-2">
        还有 {{ users.length - 20 }} 位用户...
      </div>
    </div>

    <!-- Stats section -->
    <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700">
      <h3 class="text-sm font-semibold mb-3 dark:text-white">统计</h3>
      <div class="space-y-2 text-sm">
        <div class="flex justify-between">
          <span class="text-gray-500">分类数</span>
          <span class="dark:text-gray-300">{{ categories.length }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">活跃用户</span>
          <span class="dark:text-gray-300">{{ users.length }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sidebar-icon {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: rgba(148, 163, 184, 0.15);
  flex-shrink: 0;
}

.sidebar-icon-img {
  width: 14px;
  height: 14px;
  object-fit: contain;
}

.sidebar-emoji {
  font-size: 12px;
}

.sidebar-icon-svg {
  width: 12px;
  height: 12px;
  fill: currentColor;
}

.sidebar-icon-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  display: inline-block;
}
</style>
