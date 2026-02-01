<script setup lang="ts">
import type { DiscourseTopic, SuggestedTopic } from '../types'
import { formatTime } from '../utils'

defineProps<{
  topics: DiscourseTopic[] | SuggestedTopic[]
  baseUrl: string
}>()

const emit = defineEmits<{
  (e: 'click', topic: DiscourseTopic | SuggestedTopic): void
  (e: 'middleClick', url: string): void
}>()

const handleClick = (topic: DiscourseTopic | SuggestedTopic) => {
  emit('click', topic)
}

const getUnreadCount = (topic: DiscourseTopic | SuggestedTopic) => {
  const unread =
    (topic as DiscourseTopic).unread_posts ??
    (topic as DiscourseTopic).new_posts ??
    (topic as DiscourseTopic).unread ??
    0
  return typeof unread === 'number' ? unread : 0
}

const getTargetPostNumber = (topic: DiscourseTopic | SuggestedTopic) => {
  const unread = getUnreadCount(topic)
  const lastRead = (topic as DiscourseTopic).last_read_post_number
  if (unread > 0 && typeof lastRead === 'number' && lastRead >= 0) {
    return lastRead + 1
  }
  return null
}

const getTopicUrl = (topic: DiscourseTopic | SuggestedTopic, baseUrl: string) => {
  const target = getTargetPostNumber(topic)
  return target
    ? `${baseUrl}/t/${topic.slug}/${topic.id}/${target}`
    : `${baseUrl}/t/${topic.slug}/${topic.id}`
}

const handleMiddleClick = (topic: DiscourseTopic | SuggestedTopic, baseUrl: string) => {
  emit('middleClick', getTopicUrl(topic, baseUrl))
}
</script>

<template>
  <div class="space-y-2">
    <div
      v-for="topic in topics"
      :key="topic.id"
      class="topic-item p-3 rounded-lg border dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      @click="handleClick(topic)"
      @click.middle="handleMiddleClick(topic, baseUrl)"
    >
      <div class="flex items-start gap-3">
        <div class="flex-1 min-w-0">
          <div
            class="font-medium dark:text-white truncate"
            v-html="topic.fancy_title || topic.title"
          />
          <div class="flex items-center gap-4 mt-1 text-xs text-gray-500">
            <span>{{ topic.posts_count }} 回复</span>
            <span>{{ topic.views }} 浏览</span>
            <span>{{ topic.like_count }} 赞</span>
            <span>{{ formatTime(topic.last_posted_at || topic.created_at) }}</span>
            <span v-if="getUnreadCount(topic) > 0" class="topic-unread">
              未读 +{{ getUnreadCount(topic) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="../css/TopicList.css"></style>
