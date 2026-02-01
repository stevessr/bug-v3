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

const handleMiddleClick = (topic: DiscourseTopic | SuggestedTopic, baseUrl: string) => {
  emit('middleClick', `${baseUrl}/t/${topic.slug}/${topic.id}`)
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
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="../css/TopicList.css"></style>
