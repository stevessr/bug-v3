<script setup lang="ts">
import type { DiscourseTopicDetail } from '../types'
import { formatTime } from '../utils'

const props = defineProps<{
  topic: DiscourseTopicDetail
}>()
</script>

<template>
  <div class="border-b dark:border-gray-700 pb-4">
    <h1 class="text-xl font-bold dark:text-white">
      {{ props.topic.fancy_title || props.topic.title }}
    </h1>
    <div class="flex items-center gap-4 mt-2 text-sm text-gray-500">
      <span>{{ props.topic.posts_count }} 回复</span>
      <span>创建于 {{ formatTime(props.topic.created_at) }}</span>
    </div>
  </div>
</template>
