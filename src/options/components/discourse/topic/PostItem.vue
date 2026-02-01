<script setup lang="ts">
import { REACTIONS } from '../../../utils/linuxDoReaction'
import type { DiscoursePost, ParsedContent } from '../types'
import { formatTime, getAvatarUrl } from '../utils'

import PostContent from './PostContent.vue'

const props = defineProps<{
  post: DiscoursePost
  baseUrl: string
  parsed: ParsedContent
  isPostLiked: (post: DiscoursePost, reactionId: string) => boolean
  getReactionCount: (post: DiscoursePost, reactionId: string) => number
  isLiking: boolean
}>()

const emit = defineEmits<{
  (e: 'openUser', username: string): void
  (e: 'replyTo', payload: { postNumber: number; username: string }): void
  (e: 'toggleReplies', post: DiscoursePost): void
  (e: 'toggleLike', post: DiscoursePost, reactionId: string): void
}>()

const handleUserClick = (username: string) => {
  emit('openUser', username)
}

const handleReplyClick = () => {
  emit('replyTo', { postNumber: props.post.post_number, username: props.post.username })
}

const handleToggleLike = (reactionId: string) => {
  emit('toggleLike', props.post, reactionId)
}

const handleToggleReplies = () => {
  emit('toggleReplies', props.post)
}
</script>

<template>
  <div
    :data-post-number="props.post.post_number"
    class="post-item p-4 rounded-lg border dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
  >
    <!-- Post header -->
    <div class="flex items-center gap-3 mb-3">
      <img
        :src="getAvatarUrl(props.post.avatar_template, props.baseUrl)"
        :alt="props.post.username"
        class="w-10 h-10 rounded-full cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
        :title="`查看 ${props.post.username} 的主页`"
        @click="handleUserClick(props.post.username)"
      />
      <div>
        <div
          class="font-medium dark:text-white cursor-pointer hover:text-blue-500"
          @click="handleUserClick(props.post.username)"
        >
          {{ props.post.name || props.post.username }}
        </div>
        <div class="text-xs text-gray-500">
          <span
            class="cursor-pointer hover:text-blue-500"
            @click="handleUserClick(props.post.username)"
          >
            @{{ props.post.username }}
          </span>
          · #{{ props.post.post_number }} · {{ formatTime(props.post.created_at) }}
        </div>
      </div>
    </div>

    <!-- Post content -->
    <PostContent :segments="props.parsed.segments" />

    <!-- Post footer -->
    <div class="flex items-center gap-4 mt-3 text-xs text-gray-500 post-actions">
      <div class="reactions-list">
        <button
          v-for="item in REACTIONS"
          :key="item.id"
          class="reaction-item"
          :class="{ active: props.isPostLiked(props.post, item.id) }"
          :disabled="props.isLiking"
          @click="handleToggleLike(item.id)"
          :title="item.name"
        >
          <span class="emoji">{{ item.emoji }}</span>
          <span class="count">{{ props.getReactionCount(props.post, item.id) }}</span>
        </button>
      </div>
      <button class="post-action-btn" @click="handleReplyClick">回复</button>
      <span v-if="props.post.like_count > 0">{{ props.post.like_count }} 赞</span>
      <button
        v-if="props.post.reply_count > 0"
        class="post-action-btn post-replies-toggle"
        @click="handleToggleReplies"
      >
        {{ props.post.reply_count }} 回复
      </button>
    </div>
  </div>
</template>

<style scoped src="../css/PostItem.css"></style>
