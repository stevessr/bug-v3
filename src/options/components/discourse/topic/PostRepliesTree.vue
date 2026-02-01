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
  getParent: (post: DiscoursePost) => DiscoursePost | null
  getParentParsed: (post: DiscoursePost) => ParsedContent | null
  isParentExpanded: (postNumber: number) => boolean
  isParentLoading: (postNumber: number) => boolean
}>()

const emit = defineEmits<{
  (e: 'openUser', username: string): void
  (e: 'toggleReplies', post: DiscoursePost): void
  (e: 'toggleParent', post: DiscoursePost): void
  (e: 'navigate', url: string): void
  (e: 'jumpToPost', postNumber: number): void
}>()

const handleOpenUser = (username: string) => {
  emit('openUser', username)
}

const handleToggleReplies = (post: DiscoursePost) => {
  emit('toggleReplies', post)
}

const handleToggleParent = (post: DiscoursePost) => {
  emit('toggleParent', post)
}

const handleContentNavigation = (url: string) => {
  emit('navigate', url)
}

const handleJumpToPost = (postNumber: number) => {
  emit('jumpToPost', postNumber)
}
</script>

<template>
  <template v-for="post in props.posts" :key="post.id">
    <PostReplyItem
      :post="post"
      :baseUrl="props.baseUrl"
      :parsed="props.getParsed(post)"
      :parentPost="props.getParent(post)"
      :parentParsed="props.getParentParsed(post)"
      :isParentExpanded="props.isParentExpanded(post.post_number)"
      :isParentLoading="props.isParentLoading(post.post_number)"
      @openUser="handleOpenUser"
      @toggleReplies="handleToggleReplies"
      @toggleParent="handleToggleParent"
      @navigate="handleContentNavigation"
      @jumpToPost="handleJumpToPost"
    />
    <div v-if="props.isExpanded(post.post_number)" class="pl-6 mt-3 space-y-3">
      <PostRepliesTree
        :posts="props.getReplies(post.post_number)"
        :baseUrl="props.baseUrl"
        :getParsed="props.getParsed"
        :getReplies="props.getReplies"
        :isExpanded="props.isExpanded"
        :getParent="props.getParent"
        :getParentParsed="props.getParentParsed"
        :isParentExpanded="props.isParentExpanded"
        :isParentLoading="props.isParentLoading"
        @openUser="handleOpenUser"
        @toggleReplies="handleToggleReplies"
        @toggleParent="handleToggleParent"
        @navigate="handleContentNavigation"
        @jumpToPost="handleJumpToPost"
      />
    </div>
  </template>
</template>
