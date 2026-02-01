<script setup lang="ts">
import type { DiscoursePost, ParsedContent } from '../types'
import { formatTime, getAvatarUrl } from '../utils'

import PostContent from './PostContent.vue'

const props = defineProps<{
  post: DiscoursePost
  baseUrl: string
  parsed: ParsedContent
}>()

const emit = defineEmits<{
  (e: 'openUser', username: string): void
  (e: 'toggleReplies', post: DiscoursePost): void
}>()

const handleUserClick = (username: string) => {
  emit('openUser', username)
}

const handleToggleReplies = () => {
  emit('toggleReplies', props.post)
}
</script>

<template>
  <div class="post-reply-item border-l border-gray-200 dark:border-gray-700 pl-4">
    <div class="flex items-center gap-2 mb-2">
      <img
        :src="getAvatarUrl(props.post.avatar_template, props.baseUrl, 32)"
        :alt="props.post.username"
        class="w-8 h-8 rounded-full cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
        :title="`查看 ${props.post.username} 的主页`"
        @click="handleUserClick(props.post.username)"
      />
      <div class="text-sm">
        <span
          class="font-medium dark:text-white cursor-pointer hover:text-blue-500"
          @click="handleUserClick(props.post.username)"
        >
          {{ props.post.name || props.post.username }}
        </span>
        <span class="text-xs text-gray-500 ml-2">
          @{{ props.post.username }} · #{{ props.post.post_number }} ·
          {{ formatTime(props.post.created_at) }}
        </span>
      </div>
    </div>
    <div v-if="props.post.reply_to_user?.username" class="text-xs text-gray-500 mb-2">
      回复 @{{ props.post.reply_to_user.username }}
    </div>
    <PostContent :segments="props.parsed.segments" />
    <div v-if="props.post.reply_count > 0" class="mt-2 text-xs text-gray-500">
      <button class="post-replies-toggle" @click="handleToggleReplies">
        {{ props.post.reply_count }} 回复
      </button>
    </div>
  </div>
</template>

<style scoped src="../css/PostReplyItem.css"></style>
