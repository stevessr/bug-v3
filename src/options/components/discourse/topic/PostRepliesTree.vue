<script setup lang="ts">
import type { DiscoursePost, ParsedContent } from '../types'

import PostReplyItem from './PostReplyItem.vue'

defineOptions({ name: 'PostRepliesTree' })

const props = defineProps<{
  posts: DiscoursePost[]
  baseUrl: string
  getParsed: (post: DiscoursePost) => ParsedContent
  getReplies: (postNumber: number) => DiscoursePost[]
  isExpanded: (postNumber: number) => boolean
}>()

const emit = defineEmits<{
  (e: 'openUser', username: string): void
  (e: 'toggleReplies', post: DiscoursePost): void
  (e: 'navigate', url: string): void
}>()

const handleOpenUser = (username: string) => {
  emit('openUser', username)
}

const handleToggleReplies = (post: DiscoursePost) => {
  emit('toggleReplies', post)
}

const handleContentNavigation = (url: string) => {
  emit('navigate', url)
}
</script>

<template>
  <template v-for="post in props.posts" :key="post.id">
    <PostReplyItem
      :post="post"
      :baseUrl="props.baseUrl"
      :parsed="props.getParsed(post)"
      @openUser="handleOpenUser"
      @toggleReplies="handleToggleReplies"
      @navigate="handleContentNavigation"
    />
    <div v-if="props.isExpanded(post.post_number)" class="pl-6 mt-3 space-y-3">
      <PostRepliesTree
        :posts="props.getReplies(post.post_number)"
        :baseUrl="props.baseUrl"
        :getParsed="props.getParsed"
        :getReplies="props.getReplies"
        :isExpanded="props.isExpanded"
        @openUser="handleOpenUser"
        @toggleReplies="handleToggleReplies"
        @navigate="handleContentNavigation"
      />
    </div>
  </template>
</template>
