<script setup lang="ts">
import { computed } from 'vue'

import type { DiscoursePost, ParsedContent } from '../types'
import { formatTime, getAvatarUrl } from '../utils'

import PostContent from './PostContent.vue'

const props = defineProps<{
  post: DiscoursePost
  parsed: ParsedContent
  baseUrl: string
  getParentPost: (post: DiscoursePost) => DiscoursePost | null
  getParentParsed: (post: DiscoursePost) => ParsedContent | null
  isParentExpanded: (post: DiscoursePost) => boolean
  isParentLoading: (post: DiscoursePost) => boolean
}>()

const emit = defineEmits<{
  (e: 'openUser', username: string): void
  (e: 'jumpToPost', postNumber: number): void
  (e: 'navigate', url: string): void
  (e: 'toggleParent', post: DiscoursePost): void
}>()

const hasParent = computed(() => !!props.post.reply_to_post_number)
const parentPost = computed(() => props.getParentPost(props.post))
const parentParsed = computed(() => props.getParentParsed(props.post))
const isExpanded = computed(() => props.isParentExpanded(props.post))
const isLoading = computed(() => props.isParentLoading(props.post))

const handleUserClick = (username: string) => {
  emit('openUser', username)
}

const handleJumpToPost = () => {
  emit('jumpToPost', props.post.post_number)
}

const handleToggleParent = () => {
  emit('toggleParent', props.post)
}

const handleContentNavigation = (url: string) => {
  emit('navigate', url)
}
</script>

<template>
  <div class="post-parent-preview">
    <div v-if="hasParent && isExpanded" class="post-parent-preview-nested">
      <div v-if="isLoading" class="text-xs text-gray-500">上文加载中...</div>
      <PostParentPreview
        v-else-if="parentPost && parentParsed"
        :post="parentPost"
        :parsed="parentParsed"
        :baseUrl="baseUrl"
        :getParentPost="getParentPost"
        :getParentParsed="getParentParsed"
        :isParentExpanded="isParentExpanded"
        :isParentLoading="isParentLoading"
        @openUser="handleUserClick"
        @jumpToPost="emit('jumpToPost', $event)"
        @navigate="handleContentNavigation"
        @toggleParent="emit('toggleParent', $event)"
      />
      <div v-else class="text-xs text-gray-500">上文不可用</div>
    </div>

    <div class="post-parent-header">
      <img
        :src="getAvatarUrl(props.post.avatar_template, props.baseUrl, 32)"
        :alt="props.post.username"
        class="post-parent-avatar"
        @click="handleUserClick(props.post.username)"
      />
      <div class="post-parent-title">
        <span class="post-parent-name" @click="handleUserClick(props.post.username)">
          {{ props.post.name || props.post.username }}
        </span>
        <span class="post-parent-time">
          {{ formatTime(props.post.created_at) }}
        </span>
      </div>
      <div class="post-parent-actions">
        <button v-if="hasParent" class="post-parent-toggle" @click="handleToggleParent">
          {{ isExpanded ? '收起上文' : '展开上文' }}
        </button>
        <button class="post-parent-jump" @click="handleJumpToPost">跳到帖子</button>
      </div>
    </div>
    <PostContent
      :segments="parsed.segments"
      :baseUrl="baseUrl"
      :postId="props.post.id"
      :polls="props.post.polls"
      :footnotes="parsed.footnotes"
      @navigate="handleContentNavigation"
    />
  </div>
</template>

<style scoped src="../css/PostParentPreview.css"></style>
