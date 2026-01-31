<script setup lang="ts">
import { computed } from 'vue'

import type { DiscourseTopicDetail, DiscoursePost, ParsedContent, SuggestedTopic } from './types'
import { formatTime, getAvatarUrl, parsePostContent } from './utils'
import DiscourseTopicList from './DiscourseTopicList.vue'

const props = defineProps<{
  topic: DiscourseTopicDetail
  baseUrl: string
  isLoadingMore: boolean
  hasMorePosts: boolean
}>()

const emit = defineEmits<{
  (e: 'openSuggestedTopic', topic: SuggestedTopic): void
  (e: 'openUser', username: string): void
}>()

// Parse posts and cache results
const parsedPosts = computed(() => {
  if (!props.topic?.post_stream?.posts) return new Map<number, ParsedContent>()

  const map = new Map<number, ParsedContent>()
  for (const post of props.topic.post_stream.posts) {
    map.set(post.id, parsePostContent(post.cooked))
  }
  return map
})

const getParsedPost = (postId: number): ParsedContent => {
  return parsedPosts.value.get(postId) || { html: '', images: [] }
}

const handleSuggestedClick = (topic: SuggestedTopic) => {
  emit('openSuggestedTopic', topic)
}

const handleUserClick = (username: string) => {
  emit('openUser', username)
}
</script>

<template>
  <div class="space-y-4">
    <!-- Topic title -->
    <div class="border-b dark:border-gray-700 pb-4">
      <h1 class="text-xl font-bold dark:text-white" v-html="topic.fancy_title || topic.title" />
      <div class="flex items-center gap-4 mt-2 text-sm text-gray-500">
        <span>{{ topic.posts_count }} 回复</span>
        <span>{{ topic.views }} 浏览</span>
        <span>{{ topic.like_count }} 赞</span>
        <span>创建于 {{ formatTime(topic.created_at) }}</span>
      </div>
    </div>

    <!-- Posts list -->
    <div v-if="topic.post_stream?.posts" class="posts-list space-y-4">
      <div
        v-for="post in topic.post_stream.posts"
        :key="post.id"
        class="post-item p-4 rounded-lg border dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
      >
        <!-- Post header -->
        <div class="flex items-center gap-3 mb-3">
          <img
            :src="getAvatarUrl(post.avatar_template, baseUrl)"
            :alt="post.username"
            class="w-10 h-10 rounded-full cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
            :title="`查看 ${post.username} 的主页`"
            @click="handleUserClick(post.username)"
          />
          <div>
            <div
              class="font-medium dark:text-white cursor-pointer hover:text-blue-500"
              @click="handleUserClick(post.username)"
            >
              {{ post.name || post.username }}
            </div>
            <div class="text-xs text-gray-500">
              <span
                class="cursor-pointer hover:text-blue-500"
                @click="handleUserClick(post.username)"
              >
                @{{ post.username }}
              </span>
              · #{{ post.post_number }} · {{ formatTime(post.created_at) }}
            </div>
          </div>
        </div>

        <!-- Post content -->
        <div class="post-content prose dark:prose-invert max-w-none text-sm">
          <div v-html="getParsedPost(post.id).html" />
          <!-- Image preview group -->
          <a-image-preview-group v-if="getParsedPost(post.id).images.length > 0">
            <div class="post-images grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
              <a-image
                v-for="(img, idx) in getParsedPost(post.id).images"
                :key="idx"
                :src="img"
                :fallback="'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5Ij5JbWFnZTwvdGV4dD48L3N2Zz4='"
                class="rounded cursor-pointer object-cover"
                :style="{ maxHeight: '200px' }"
              />
            </div>
          </a-image-preview-group>
        </div>

        <!-- Post footer -->
        <div class="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <span v-if="post.like_count > 0">{{ post.like_count }} 赞</span>
          <span v-if="post.reply_count > 0">{{ post.reply_count }} 回复</span>
        </div>
      </div>
    </div>
    <div v-else class="text-center text-gray-500 py-8">加载帖子中...</div>

    <!-- Loading more indicator -->
    <div v-if="isLoadingMore" class="flex items-center justify-center py-4">
      <a-spin />
      <span class="ml-2 text-gray-500">加载更多帖子...</span>
    </div>

    <!-- End of posts indicator -->
    <div
      v-if="!hasMorePosts && topic.post_stream?.posts?.length"
      class="text-center text-gray-400 py-4 text-sm"
    >
      已加载全部 {{ topic.post_stream.posts.length }} 条帖子
    </div>

    <!-- Suggested topics -->
    <div
      v-if="topic.suggested_topics && topic.suggested_topics.length > 0"
      class="mt-8 pt-6 border-t dark:border-gray-700"
    >
      <h3 class="text-lg font-semibold mb-4 dark:text-white">推荐话题</h3>
      <DiscourseTopicList
        :topics="topic.suggested_topics"
        :baseUrl="baseUrl"
        @click="handleSuggestedClick"
      />
    </div>

    <!-- Related topics -->
    <div
      v-if="topic.related_topics && topic.related_topics.length > 0"
      class="mt-6 pt-6 border-t dark:border-gray-700"
    >
      <h3 class="text-lg font-semibold mb-4 dark:text-white">相关话题</h3>
      <DiscourseTopicList
        :topics="topic.related_topics"
        :baseUrl="baseUrl"
        @click="handleSuggestedClick"
      />
    </div>
  </div>
</template>

<style scoped>
.post-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
}

.post-content :deep(a) {
  color: #3b82f6;
  text-decoration: none;
}

.post-content :deep(a:hover) {
  text-decoration: underline;
}

.post-content :deep(pre) {
  background: #1f2937;
  color: #e5e7eb;
  padding: 1rem;
  border-radius: 4px;
  overflow-x: auto;
}

.post-content :deep(code) {
  background: #374151;
  padding: 0.125rem 0.25rem;
  border-radius: 2px;
  font-size: 0.875em;
}

.post-content :deep(blockquote) {
  border-left: 3px solid #3b82f6;
  padding-left: 1rem;
  margin-left: 0;
  color: #6b7280;
}

.post-content :deep(.emoji) {
  width: 1.25em;
  height: 1.25em;
  vertical-align: middle;
}

/* Onebox styles */
.post-content :deep(.onebox) {
  display: block;
  margin: 1rem 0;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  background: #f9fafb;
  transition: box-shadow 0.2s;
}

.post-content :deep(.onebox:hover) {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* Dark mode onebox */
:global(.dark) .post-content :deep(.onebox) {
  background: #1f2937;
  border-color: #374151;
}

/* Onebox header (source) */
.post-content :deep(.onebox .source) {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: #f3f4f6;
  border-bottom: 1px solid #e5e7eb;
  font-size: 0.8rem;
}

:global(.dark) .post-content :deep(.onebox .source) {
  background: #374151;
  border-color: #4b5563;
}

.post-content :deep(.onebox .source .site-icon) {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  flex-shrink: 0;
}

.post-content :deep(.onebox .source a) {
  color: #6b7280;
  font-size: 0.75rem;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

:global(.dark) .post-content :deep(.onebox .source a) {
  color: #9ca3af;
}

/* Onebox body */
.post-content :deep(.onebox .onebox-body) {
  padding: 12px;
}

.post-content :deep(.onebox .onebox-body .aspect-image) {
  margin-bottom: 10px;
  border-radius: 6px;
  overflow: hidden;
}

.post-content :deep(.onebox .onebox-body .thumbnail) {
  width: 100%;
  max-height: 200px;
  object-fit: cover;
  border-radius: 6px;
}

.post-content :deep(.onebox .onebox-body h3) {
  margin: 0 0 8px 0;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
}

.post-content :deep(.onebox .onebox-body h3 a) {
  color: #1f2937;
}

:global(.dark) .post-content :deep(.onebox .onebox-body h3 a) {
  color: #f3f4f6;
}

.post-content :deep(.onebox .onebox-body p) {
  margin: 0;
  font-size: 0.875rem;
  color: #6b7280;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

:global(.dark) .post-content :deep(.onebox .onebox-body p) {
  color: #9ca3af;
}

/* Onebox metadata */
.post-content :deep(.onebox .onebox-metadata) {
  padding: 0 12px 10px;
  font-size: 0.75rem;
  color: #9ca3af;
}

/* Lazyload placeholder */
.post-content :deep(.onebox .lazyYT) {
  position: relative;
  padding-bottom: 56.25%;
  height: 0;
  overflow: hidden;
  background: #000;
  border-radius: 6px;
}

.post-content :deep(.onebox .lazyYT img) {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Video onebox */
.post-content :deep(.onebox.video-onebox) {
  background: #000;
}

.post-content :deep(.onebox.video-onebox .source) {
  background: rgba(0, 0, 0, 0.8);
  border-color: transparent;
}

.post-content :deep(.onebox.video-onebox .source a) {
  color: #fff;
}

/* GitHub onebox */
.post-content :deep(.onebox.githubfolder),
.post-content :deep(.onebox.githubblob),
.post-content :deep(.onebox.githubcommit),
.post-content :deep(.onebox.githubpullrequest) {
  border-left: 3px solid #24292e;
}

:global(.dark) .post-content :deep(.onebox.githubfolder),
:global(.dark) .post-content :deep(.onebox.githubblob),
:global(.dark) .post-content :deep(.onebox.githubcommit),
:global(.dark) .post-content :deep(.onebox.githubpullrequest) {
  border-left-color: #58a6ff;
}

/* Twitter/X onebox */
.post-content :deep(.onebox.twitterstatus) {
  border-left: 3px solid #1da1f2;
}

/* Clear float helper */
.post-content :deep(.onebox > div[style*='clear: both']) {
  display: none;
}
</style>
