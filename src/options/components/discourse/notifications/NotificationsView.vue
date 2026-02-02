<script setup lang="ts">
import { computed } from 'vue'

import type { DiscourseNotification, DiscourseNotificationFilter } from '../types'

const props = defineProps<{
  notifications: DiscourseNotification[]
  filter: DiscourseNotificationFilter
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'changeFilter', filter: DiscourseNotificationFilter): void
  (e: 'open', path: string): void
}>()

const baseFilters: Array<{ key: DiscourseNotificationFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'replies', label: '回复' },
  { key: 'mentions', label: '提及' },
  { key: 'likes', label: '点赞' },
  { key: 'messages', label: '私信' },
  { key: 'badges', label: '徽章' },
  { key: 'other', label: '其他' }
]

const typeLabelMap: Record<number, DiscourseNotificationFilter> = {
  1: 'mentions',
  2: 'replies',
  3: 'mentions',
  5: 'mentions',
  6: 'likes',
  7: 'likes',
  8: 'likes',
  9: 'messages',
  12: 'badges'
}

const formatFilter = (n: DiscourseNotification) => {
  return typeLabelMap[n.notification_type] || 'other'
}

const getCategoryMeta = (n: DiscourseNotification) => {
  const data = n.data || {}
  const id =
    data.category_id ??
    data.categoryId ??
    data.category?.id ??
    data.category_id?.id ??
    null
  const name =
    data.category_name ??
    data.categoryName ??
    data.category?.name ??
    data.category_slug ??
    data.category?.slug ??
    ''
  return {
    id: typeof id === 'number' ? id : Number(id) || null,
    name: String(name || '')
  }
}

const categoryFilters = computed(() => {
  const map = new Map<string, string>()
  props.notifications.forEach(item => {
    const meta = getCategoryMeta(item)
    if (meta.id) {
      map.set(`category:${meta.id}`, meta.name || `分类 ${meta.id}`)
      return
    }
    if (meta.name) {
      map.set(`category:${meta.name}`, meta.name)
    }
  })
  return Array.from(map.entries()).map(([key, label]) => ({
    key: key as DiscourseNotificationFilter,
    label
  }))
})

const filters = computed(() => [...baseFilters, ...categoryFilters.value])

const filteredNotifications = computed(() => {
  if (props.filter === 'all') return props.notifications
  if (String(props.filter).startsWith('category:')) {
    const rawKey = String(props.filter).slice('category:'.length)
    return props.notifications.filter(item => {
      const meta = getCategoryMeta(item)
      if (meta.id && String(meta.id) === rawKey) return true
      if (meta.name && meta.name === rawKey) return true
      return false
    })
  }
  return props.notifications.filter(n => formatFilter(n) === props.filter)
})

const formatTitle = (n: DiscourseNotification) => {
  return n.fancy_title || n.data?.topic_title || n.data?.title || '通知'
}

const formatActor = (n: DiscourseNotification) => {
  return n.data?.display_username || n.data?.username || n.data?.original_username || ''
}

const buildPath = (n: DiscourseNotification) => {
  const topicId = n.topic_id || n.data?.topic_id
  const slug = n.slug || n.data?.slug || 'topic'
  const postNumber = n.post_number || n.data?.post_number
  if (topicId && postNumber) return `/t/${slug}/${topicId}/${postNumber}`
  if (topicId) return `/t/${slug}/${topicId}`
  return ''
}

const handleOpen = (n: DiscourseNotification) => {
  const path = buildPath(n)
  if (path) emit('open', path)
}
</script>

<template>
  <div class="notifications-view space-y-4">
    <div class="flex flex-wrap gap-2">
      <a-button
        v-for="item in filters"
        :key="item.key"
        size="small"
        :type="props.filter === item.key ? 'primary' : 'default'"
        @click="emit('changeFilter', item.key)"
      >
        {{ item.label }}
      </a-button>
    </div>

    <div v-if="props.loading" class="flex items-center gap-2 text-gray-500">
      <a-spin size="small" />
      正在加载通知...
    </div>

    <div v-else-if="filteredNotifications.length === 0" class="text-gray-500">
      暂无通知
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="item in filteredNotifications"
        :key="item.id"
        class="notification-item p-3 rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800"
        :class="{ unread: !item.read }"
        @click="handleOpen(item)"
      >
        <div class="flex items-center justify-between">
          <div class="font-medium dark:text-white" v-html="formatTitle(item)" />
          <span class="text-xs text-gray-400">{{ item.created_at }}</span>
        </div>
        <div class="text-xs text-gray-500 mt-1">
          <span v-if="formatActor(item)">@{{ formatActor(item) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notification-item {
  cursor: pointer;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}

.notification-item.unread {
  border-color: rgba(59, 130, 246, 0.6);
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.1);
}
</style>
