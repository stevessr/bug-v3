<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'

import { REACTIONS } from '../../utils/linuxDoReaction'

import type {
  DiscourseTopicDetail,
  DiscoursePost,
  ParsedContent,
  SuggestedTopic,
  LightboxImage
} from './types'
import { formatTime, getAvatarUrl, parsePostContent, pageFetch, extractData } from './utils'
import { togglePostLike } from './actions'
import TopicList from './TopicList.vue'
import Composer from './Composer.vue'

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
  (e: 'openQuote', payload: { topicId: number; postNumber: number }): void
}>()

const postsListRef = ref<HTMLElement | null>(null)
const replyTarget = ref<{ postNumber: number; username: string } | null>(null)
const likedPostIds = ref<Set<number>>(new Set())
const likingPostIds = ref<Set<number>>(new Set())

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
  // Check current_user_reaction from API response
  const currentUserReaction = postAny?.current_user_reaction
  if (currentUserReaction) {
    if (typeof currentUserReaction === 'string') {
      return currentUserReaction === reactionId
    } else if (typeof currentUserReaction === 'object' && currentUserReaction.id) {
      return currentUserReaction.id === reactionId
    }
  }
  const summary = postAny?.actions_summary || []
  if (Array.isArray(summary)) {
    if (reactionId === 'heart' && summary.some((item: any) => item?.id === 2 && item?.acted))
      return true
  }
  const reactions = postAny?.reactions
  if (Array.isArray(reactions)) {
    const item = reactions.find((r: any) => r?.id === reactionId)
    if (item?.reacted) return true
  } else if (reactions && typeof reactions === 'object') {
    const items = Object.values(reactions) as any[]
    if (items.some(item => item?.id === reactionId && item?.reacted)) return true
  }
  return false
}

const getReactionCount = (post: DiscoursePost, reactionId: string): number => {
  const postAny = post as any
  const reactions = postAny?.reactions
  if (Array.isArray(reactions)) {
    const item = reactions.find((r: any) => r?.id === reactionId)
    if (item && typeof item.count === 'number') {
      return item.count
    }
  } else if (reactions && typeof reactions === 'object') {
    const item = reactions[reactionId]
    if (item && typeof item === 'object' && typeof item.count === 'number') {
      return item.count
    }
  }
  return 0
}

const toggleLike = async (post: DiscoursePost, reactionId: string) => {
  if (likingPostIds.value.has(post.id)) return
  likingPostIds.value.add(post.id)
  const wasLiked = isPostLiked(post, reactionId)
  try {
    const data = await togglePostLike(props.baseUrl, post.id, reactionId)
    // Update post with response data
    const postAny = post as any
    if (data) {
      postAny.reactions = data.reactions || []
      postAny.current_user_reaction = data.current_user_reaction
      postAny.reaction_users_count = data.reaction_users_count || 0
    }
    // Sync likedPostIds with current_user_reaction
    if (data?.current_user_reaction) {
      likedPostIds.value.add(post.id)
    } else {
      likedPostIds.value.delete(post.id)
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

  // Check if clicked on quote title (to navigate)
  const titleLink = target?.closest('.quote-title__text-content, .quote-controls')
  if (titleLink) {
    const aside = target?.closest('aside.quote') as HTMLElement | null
    if (!aside) return

    const topicId = aside.getAttribute('data-topic')
    const postNumber = aside.getAttribute('data-post')
    if (!topicId || !postNumber) return

    event.preventDefault()
    event.stopPropagation()
    emit('openQuote', { topicId: parseInt(topicId), postNumber: parseInt(postNumber) })
    return
  }

  // Original expand/collapse logic
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

const getCarouselImg = (images: LightboxImage[], index: number) => {
  const image = images[index]
  return image?.thumbSrc || image?.href || ''
}

const getLightboxThumb = (image: LightboxImage) => {
  return image.thumbSrc || image.href
}

type ImageGridSegment = Extract<ParsedContent['segments'][number], { type: 'image-grid' }>

const getImageGridItems = (segment: ImageGridSegment) => {
  if (segment.columns.length <= 1) return segment.columns[0] || []
  return segment.columns.flat()
}

const getImageGridColumnsCount = (segment: ImageGridSegment) => {
  if (segment.columnsCount) return Math.max(segment.columnsCount, 1)
  if (segment.columns.length > 1) return segment.columns.length
  return 2
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
                arrows
                dots-class="slick-dots slick-thumb"
              >
                <template #customPaging="{ i }">
                  <a class="post-carousel-thumb">
                    <img :src="getCarouselImg(segment.images, i)" />
                  </a>
                </template>
                <div
                  v-for="(img, imgIndex) in segment.images"
                  :key="imgIndex"
                  class="post-carousel-slide"
                >
                  <a-image
                    class="post-carousel-image"
                    :src="getLightboxThumb(img)"
                    :preview="{ src: img.href }"
                    :alt="img.alt || ''"
                    :width="img.width"
                    :height="img.height"
                    :srcset="img.srcset"
                    :data-base62-sha1="img.base62Sha1"
                    :data-dominant-color="img.dominantColor"
                    :loading="img.loading || 'lazy'"
                    :style="img.style"
                  />
                </div>
              </a-carousel>
              <div
                v-else-if="segment.type === 'image-grid'"
                class="post-image-grid"
                :style="{ '--grid-columns': getImageGridColumnsCount(segment) }"
              >
                <div
                  v-for="(img, imgIndex) in getImageGridItems(segment)"
                  :key="imgIndex"
                  class="post-image-grid-item"
                >
                  <img
                    class="post-image-grid-image"
                    :src="getLightboxThumb(img)"
                    :alt="img.alt || ''"
                    :width="img.width"
                    :height="img.height"
                    :srcset="img.srcset"
                    :data-base62-sha1="img.base62Sha1"
                    :data-dominant-color="img.dominantColor"
                    :loading="img.loading || 'lazy'"
                    :style="img.style"
                  />
                </div>
              </div>
              <a-image
                v-else
                :src="getLightboxThumb(segment.image)"
                :preview="{ src: segment.image.href }"
                :alt="segment.image.alt || ''"
                :data-base62-sha1="segment.image.base62Sha1"
                :data-dominant-color="segment.image.dominantColor"
                :loading="segment.image.loading || 'lazy'"
                :style="segment.image.style"
                :fallback="'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5Ij5JbWFnZTwvdGV4dD48L3N2Zz4='"
                class="post-inline-image rounded cursor-pointer"
              />
            </template>
          </a-image-preview-group>
        </div>

        <!-- Post footer -->
        <div class="flex items-center gap-4 mt-3 text-xs text-gray-500 post-actions">
          <div class="reactions-list">
            <button
              v-for="item in REACTIONS"
              :key="item.id"
              class="reaction-item"
              :class="{ active: isPostLiked(post, item.id) }"
              :disabled="likingPostIds.has(post.id)"
              @click="toggleLike(post, item.id)"
              :title="item.name"
            >
              <span class="emoji">{{ item.emoji }}</span>
              <span class="count">{{ getReactionCount(post, item.id) }}</span>
            </button>
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
      <TopicList
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
      <TopicList
        :topics="topic.related_topics"
        :baseUrl="baseUrl"
        @click="handleSuggestedClick"
      />
    </div>
  </div>
</template>

<style scoped src="./TopicView.css"></style>
