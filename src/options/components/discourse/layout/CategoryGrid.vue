<script setup lang="ts">
import { computed } from 'vue'

import type { DiscourseCategory, DiscourseTopic } from '../types'
import { formatTime, getAvatarUrl } from '../utils'

type CategoryTopic = NonNullable<DiscourseCategory['topics']>[number]

const props = withDefaults(
  defineProps<{
    categories: DiscourseCategory[]
    title?: string
    baseUrl?: string
    layout?: 'grid' | 'directory'
  }>(),
  {
    title: '分类',
    baseUrl: '',
    layout: 'grid'
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
  (e: 'topicClick', topic: DiscourseTopic): void
}>()

const getImageUrl = (url?: string | null) => {
  if (!url) return ''
  return url.startsWith('http') ? url : `${props.baseUrl}${url}`
}

const getIconHref = (icon?: string | null) => {
  if (!icon) return ''
  return `#${icon}`
}

const getTopicTitle = (topic: CategoryTopic) => {
  return topic.fancy_title || topic.title
}
</script>

<template>
  <div v-if="props.categories.length > 0">
    <h3 class="text-lg font-semibold mb-3 dark:text-white">{{ props.title }}</h3>
    <div v-if="props.layout === 'directory'" class="category-directory">
      <div
        v-for="cat in topCategories"
        :key="cat.id"
        class="category-directory-row"
        :style="{ borderLeftColor: `#${cat.color}` }"
      >
        <div class="category-directory-left" @click="emit('click', cat)">
          <div class="category-directory-title-wrap">
            <div
              class="category-icon-wrap category-icon-wrap-lg"
              :style="{ color: `#${cat.color}` }"
            >
              <img
                v-if="cat.uploaded_logo?.url"
                :src="getImageUrl(cat.uploaded_logo.url)"
                :alt="cat.name"
                class="category-icon-img category-icon-img-lg"
              />
              <img
                v-else-if="cat.uploaded_logo_dark?.url"
                :src="getImageUrl(cat.uploaded_logo_dark.url)"
                :alt="cat.name"
                class="category-icon-img category-icon-img-lg"
              />
              <span v-else-if="cat.emoji" class="category-emoji">{{ cat.emoji }}</span>
              <svg v-else-if="cat.icon" class="category-icon-svg" viewBox="0 0 24 24">
                <use :href="getIconHref(cat.icon)" />
              </svg>
              <span
                v-else
                class="category-icon-dot category-icon-dot-lg"
                :style="{ backgroundColor: `#${cat.color}` }"
              />
            </div>
            <div>
              <div class="font-semibold dark:text-white">{{ cat.name }}</div>
              <div class="text-xs text-gray-500">{{ cat.topic_count }} 话题</div>
            </div>
          </div>
          <div class="text-xs text-gray-500 mt-2 line-clamp-2">
            {{ cat.description_excerpt || cat.description || '' }}
          </div>
          <div
            v-if="hasHierarchy && (childrenByParent.get(cat.id)?.length || 0) > 0"
            class="mt-2 flex flex-wrap gap-x-2 gap-y-1"
          >
            <button
              v-for="child in childrenByParent.get(cat.id)?.slice(0, 8)"
              :key="child.id"
              class="subcategory-chip"
              @click.stop="emit('click', child)"
            >
              {{ child.name }}
            </button>
          </div>
        </div>

        <div class="category-directory-right">
          <div
            v-for="topic in (cat.topics || []).slice(0, 10)"
            :key="topic.id"
            class="category-topic-row"
            @click="emit('topicClick', topic as DiscourseTopic)"
          >
            <span class="category-topic-title" :title="getTopicTitle(topic)">
              {{ getTopicTitle(topic) }}
            </span>
            <span class="category-topic-meta">
              <img
                v-if="topic.last_poster?.avatar_template"
                :src="getAvatarUrl(topic.last_poster.avatar_template, baseUrl || '', 24)"
                class="category-topic-avatar"
                :alt="topic.last_poster?.username || ''"
              />
              <span v-if="topic.last_poster?.username" class="truncate max-w-[100px]">
                {{ topic.last_poster.username }}
              </span>
              <span v-if="topic.last_posted_at">{{ formatTime(topic.last_posted_at) }}</span>
              <span>{{ topic.reply_count ?? 0 }}</span>
            </span>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      <div
        v-for="cat in topCategories"
        :key="cat.id"
        class="p-3 rounded-lg border dark:border-gray-700 cursor-pointer hover:shadow-md transition-shadow"
        :style="{ borderLeftColor: `#${cat.color}`, borderLeftWidth: '4px' }"
        @click="emit('click', cat)"
      >
        <div class="flex items-center gap-2">
          <div class="category-icon-wrap" :style="{ color: `#${cat.color}` }">
            <img
              v-if="cat.uploaded_logo?.url"
              :src="getImageUrl(cat.uploaded_logo.url)"
              :alt="cat.name"
              class="category-icon-img"
            />
            <img
              v-else-if="cat.uploaded_logo_dark?.url"
              :src="getImageUrl(cat.uploaded_logo_dark.url)"
              :alt="cat.name"
              class="category-icon-img"
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
                <img
                  v-if="child.uploaded_logo?.url"
                  :src="getImageUrl(child.uploaded_logo.url)"
                  :alt="child.name"
                  class="subcategory-icon-img"
                />
                <img
                  v-else-if="child.uploaded_logo_dark?.url"
                  :src="getImageUrl(child.uploaded_logo_dark.url)"
                  :alt="child.name"
                  class="subcategory-icon-img"
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
