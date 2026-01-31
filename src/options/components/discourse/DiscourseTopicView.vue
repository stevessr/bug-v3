<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'

import type { DiscourseTopicDetail, DiscoursePost, ParsedContent, SuggestedTopic } from './types'
import { formatTime, getAvatarUrl, parsePostContent, pageFetch, extractData } from './utils'
import { togglePostLike } from './actions'
import { REACTIONS } from '../../utils/linuxDoReaction'
import DiscourseTopicList from './DiscourseTopicList.vue'
import DiscourseComposer from './DiscourseComposer.vue'

const props = defineProps<{
  topic: DiscourseTopicDetail
  baseUrl: string
  isLoadingMore: boolean
  hasMorePosts: boolean
  targetPostNumber?: number | null
}>()

const emit = defineEmits<{
  (e: 'openSuggestedTopic', topic: SuggestedTopic): void
  (e: 'openUser', username: string): void
  (e: 'refresh'): void
  (e: 'replyTo', payload: { postNumber: number; username: string }): void
}>()

const postsListRef = ref<HTMLElement | null>(null)
const replyTarget = ref<{ postNumber: number; username: string } | null>(null)
const likedPostIds = ref<Set<number>>(new Set())
const likingPostIds = ref<Set<number>>(new Set())
const activeReactionPostId = ref<number | null>(null)

// Parse posts and cache results
const parsedPosts = computed(() => {
  if (!props.topic?.post_stream?.posts) return new Map<number, ParsedContent>()

  const map = new Map<number, ParsedContent>()
  for (const post of props.topic.post_stream.posts) {
    map.set(post.id, parsePostContent(post.cooked, props.baseUrl))
  }
  return map
})

const getParsedPost = (postId: number): ParsedContent => {
  return parsedPosts.value.get(postId) || { html: '', images: [], segments: [] }
}

const handleSuggestedClick = (topic: SuggestedTopic) => {
  emit('openSuggestedTopic', topic)
}

const handleUserClick = (username: string) => {
  emit('openUser', username)
}

const handleReplyClick = (post: DiscoursePost) => {
  replyTarget.value = { postNumber: post.post_number, username: post.username }
  emit('replyTo', replyTarget.value)
}

const handleClearReply = () => {
  replyTarget.value = null
}

const isPostLiked = (post: DiscoursePost, reactionId: string) => {
  if (likedPostIds.value.has(post.id)) return true
  const postAny = post as any
  const summary = postAny?.actions_summary || []
  if (Array.isArray(summary)) {
    if (reactionId === 'heart' && summary.some((item: any) => item?.id === 2 && item?.acted))
      return true
  }
  const reactions = postAny?.reactions
  if (reactions && typeof reactions === 'object') {
    const items = Object.values(reactions) as any[]
    if (items.some(item => item?.id === reactionId && item?.reacted)) return true
  }
  return false
}

const toggleLike = async (post: DiscoursePost, reactionId: string) => {
  if (likingPostIds.value.has(post.id)) return
  likingPostIds.value.add(post.id)
  const wasLiked = isPostLiked(post, reactionId)
  try {
    await togglePostLike(props.baseUrl, post.id, reactionId)
    if (wasLiked) {
      likedPostIds.value.delete(post.id)
      if (reactionId === 'heart') {
        post.like_count = Math.max(0, post.like_count - 1)
      }
    } else {
      likedPostIds.value.add(post.id)
      if (reactionId === 'heart') {
        post.like_count = (post.like_count || 0) + 1
      }
    }
  } catch (error) {
    console.warn('[DiscourseBrowser] toggle like failed:', error)
  } finally {
    likingPostIds.value.delete(post.id)
  }
}

const handleReplyPosted = () => {
  replyTarget.value = null
  emit('refresh')
}

const scrollToPost = (postNumber: number) => {
  if (!postNumber) return
  requestAnimationFrame(() => {
    const el = document.querySelector(`[data-post-number="${postNumber}"]`) as HTMLElement | null
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
}

watch(
  () => props.targetPostNumber,
  value => {
    if (value) scrollToPost(value)
  },
  { immediate: true }
)

watch(
  () => props.topic?.id,
  () => {
    replyTarget.value = null
    likedPostIds.value = new Set()
    likingPostIds.value = new Set()
  }
)

const handleQuoteToggle = async (event: Event) => {
  const target = event.target as HTMLElement | null
  const button = target?.closest('button.quote-toggle') as HTMLButtonElement | null
  if (!button) return

  const aside = button.closest('aside.quote') as HTMLElement | null
  if (!aside) return

  event.preventDefault()
  event.stopPropagation()

  const blockquote = aside.querySelector('blockquote') as HTMLElement | null
  if (!blockquote) return

  const expanded = aside.getAttribute('data-expanded') === 'true'
  const original = blockquote.getAttribute('data-original-html')

  if (expanded) {
    if (original !== null) {
      blockquote.innerHTML = original
    }
    aside.setAttribute('data-expanded', 'false')
    button.setAttribute('aria-expanded', 'false')
    return
  }

  if (original === null) {
    blockquote.setAttribute('data-original-html', blockquote.innerHTML)
  }

  const topicId = aside.getAttribute('data-topic')
  const postNumber = aside.getAttribute('data-post')
  if (!topicId || !postNumber) return

  button.classList.add('is-loading')
  button.setAttribute('aria-expanded', 'true')
  aside.setAttribute('data-expanded', 'true')

  try {
    const result = await pageFetch<any>(
      `${props.baseUrl}/posts/by_number/${topicId}/${postNumber}.json`
    )

    if (result.status === 404) {
      blockquote.innerHTML = '<div class="quote-error">引用内容不存在 (404)</div>'
      return
    }

    const data = extractData(result)
    if (data?.cooked) {
      const parsed = parsePostContent(data.cooked, props.baseUrl)
      blockquote.innerHTML = parsed.html

      const existingImages = blockquote.querySelector('.quote-images')
      if (existingImages) existingImages.remove()

      if (parsed.images.length > 0) {
        const imagesWrap = document.createElement('div')
        imagesWrap.className = 'quote-images'
        parsed.images.forEach(url => {
          const img = document.createElement('img')
          img.src = url
          img.alt = ''
          img.loading = 'lazy'
          imagesWrap.appendChild(img)
        })
        blockquote.appendChild(imagesWrap)
      }
    } else if (result.ok === false) {
      const statusText = result.status ? ` (${result.status})` : ''
      blockquote.innerHTML = `<div class="quote-error">引用内容加载失败${statusText}</div>`
    }
  } catch (error) {
    console.warn('[DiscourseBrowser] expand quote failed:', error)
    aside.setAttribute('data-expanded', 'false')
    button.setAttribute('aria-expanded', 'false')
  } finally {
    button.classList.remove('is-loading')
  }
}

onMounted(() => {
  postsListRef.value?.addEventListener('click', handleQuoteToggle)
})

onUnmounted(() => {
  postsListRef.value?.removeEventListener('click', handleQuoteToggle)
})
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
    <div v-if="topic.post_stream?.posts" ref="postsListRef" class="posts-list space-y-4">
      <div
        v-for="post in topic.post_stream.posts"
        :key="post.id"
        :data-post-number="post.post_number"
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
          <a-image-preview-group>
            <template v-for="(segment, idx) in getParsedPost(post.id).segments" :key="idx">
              <div
                v-if="segment.type === 'html'"
                class="post-content-fragment"
                v-html="segment.html"
              />
              <a-carousel
                v-else-if="segment.type === 'carousel'"
                class="post-carousel"
                :dots="true"
              >
                <div
                  v-for="(img, imgIndex) in segment.images"
                  :key="imgIndex"
                  class="post-carousel-slide"
                >
                  <a-image
                    :src="img"
                    :fallback="'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5Ij5JbWFnZTwvdGV4dD48L3N2Zz4='"
                    class="post-inline-image rounded cursor-pointer"
                    :style="{ maxHeight: '420px' }"
                  />
                </div>
              </a-carousel>
              <a-image
                v-else
                :src="segment.src"
                :fallback="'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5Ij5JbWFnZTwvdGV4dD48L3N2Zz4='"
                class="post-inline-image rounded cursor-pointer"
                :style="{ maxHeight: '420px' }"
              />
            </template>
          </a-image-preview-group>
        </div>

        <!-- Post footer -->
        <div class="flex items-center gap-4 mt-3 text-xs text-gray-500 post-actions">
          <div
            class="reaction-trigger"
            @mouseenter="activeReactionPostId = post.id"
            @mouseleave="activeReactionPostId = null"
          >
            <button
              class="post-action-btn"
              :disabled="likingPostIds.has(post.id)"
              @click="activeReactionPostId = activeReactionPostId === post.id ? null : post.id"
            >
              反应
            </button>
            <div class="reaction-picker" :class="{ visible: activeReactionPostId === post.id }">
              <button
                v-for="item in REACTIONS"
                :key="item.id"
                class="reaction-item"
                :class="{ active: isPostLiked(post, item.id) }"
                @click="toggleLike(post, item.id)"
              >
                <span class="emoji">{{ item.emoji }}</span>
                <span class="label">{{ item.name }}</span>
              </button>
            </div>
          </div>
          <button class="post-action-btn" @click="handleReplyClick(post)">回复</button>
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

.post-content :deep(.post-content-fragment) {
  display: contents;
}

.post-content :deep(.post-inline-image) {
  display: block;
  margin: 0.5rem 0;
}

.post-content :deep(.post-carousel) {
  margin: 0.5rem 0;
}

.post-content :deep(.post-carousel-slide) {
  display: flex;
  justify-content: center;
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

.post-action-btn {
  color: #64748b;
  transition: color 0.15s ease;
}

.post-action-btn:hover {
  color: #1d4ed8;
}

.post-action-btn.active {
  color: #ef4444;
}

.post-action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.reaction-trigger {
  position: relative;
}

.reaction-picker {
  position: absolute;
  left: 0;
  bottom: 28px;
  display: none;
  min-width: 220px;
  max-width: 260px;
  padding: 8px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid #e5e7eb;
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.15);
  z-index: 20;
}

.dark .reaction-picker {
  background: rgba(17, 24, 39, 0.98);
  border-color: #374151;
}

.reaction-picker.visible {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.reaction-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 8px;
  background: transparent;
  color: #475569;
  text-align: left;
}

.reaction-item:hover {
  background: #f1f5f9;
  color: #1d4ed8;
}

.dark .reaction-item {
  color: #cbd5f5;
}

.dark .reaction-item:hover {
  background: #1f2937;
  color: #93c5fd;
}

.reaction-item.active {
  background: #fee2e2;
  color: #b91c1c;
}

.reaction-item .emoji {
  width: 18px;
}

.reaction-item .label {
  font-size: 11px;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Quote styles */
.post-content :deep(aside.quote) {
  border-left: 3px solid #94a3b8;
  background: #f7f2e3;
  padding: 0.75rem 1rem;
  margin: 0.75rem 0;
  border-radius: 6px;
}

:global(.dark) .post-content :deep(aside.quote) {
  background: #1f2937;
}

.post-content :deep(aside.quote .title) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
}

.post-content :deep(aside.quote .title .avatar) {
  width: 22px;
  height: 22px;
  border-radius: 9999px;
}

.post-content :deep(aside.quote .quote-title__text-content) {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.post-content :deep(aside.quote .badge-category__wrapper) {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8rem;
}

.post-content :deep(aside.quote .badge-category) {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.post-content :deep(aside.quote .badge-category svg) {
  width: 12px;
  height: 12px;
}

.post-content :deep(aside.quote .badge-category__name) {
  line-height: 1;
}

.post-content :deep(aside.quote blockquote) {
  display: block;
  margin: 0.5rem 0 0 0;
  color: #4b5563;
}

:global(.dark) .post-content :deep(aside.quote blockquote) {
  color: #d1d5db;
}

.post-content :deep(aside.quote .quote-controls) {
  display: inline-flex;
}

.post-content :deep(aside.quote .quote-toggle) {
  border: none;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  padding: 2px 4px;
  line-height: 1;
}

.post-content :deep(aside.quote .quote-toggle.is-loading) {
  opacity: 0.6;
  cursor: wait;
}

.post-content :deep(aside.quote .quote-images) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: 8px;
}

.post-content :deep(aside.quote .quote-images img) {
  width: 100%;
  height: auto;
  border-radius: 4px;
  object-fit: cover;
}

.post-content :deep(aside.quote .quote-error) {
  color: #b91c1c;
  font-size: 0.85rem;
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
