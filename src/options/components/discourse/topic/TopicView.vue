<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'

import type { DiscourseTopicDetail, DiscoursePost, ParsedContent, SuggestedTopic } from '../types'
import { parsePostContent, pageFetch, extractData } from '../utils'
import { togglePostLike } from '../actions'
import TopicHeader from './TopicHeader.vue'
import PostItem from './PostItem.vue'
import TopicList from './TopicList.vue'

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

const handleReplyClick = (payload: { postNumber: number; username: string }) => {
  emit('replyTo', payload)
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
    likedPostIds.value = new Set()
    likingPostIds.value = new Set()
  }
)

const handleQuoteToggle = async (event: Event) => {
  const target = event.target as HTMLElement | null

  const spoiler = target?.closest('.spoiled') as HTMLElement | null
  if (spoiler) {
    const isBlurred =
      spoiler.classList.contains('spoiler-blurred') ||
      spoiler.getAttribute('data-spoiler-state') === 'blurred'
    if (isBlurred) {
      spoiler.classList.remove('spoiler-blurred')
      spoiler.setAttribute('data-spoiler-state', 'revealed')
      spoiler.setAttribute('aria-expanded', 'true')
      spoiler.querySelectorAll('[aria-hidden="true"]').forEach(el => {
        el.setAttribute('aria-hidden', 'false')
      })
    } else {
      spoiler.classList.add('spoiler-blurred')
      spoiler.setAttribute('data-spoiler-state', 'blurred')
      spoiler.setAttribute('aria-expanded', 'false')
      spoiler.querySelectorAll('[aria-hidden="false"]').forEach(el => {
        el.setAttribute('aria-hidden', 'true')
      })
    }
    event.preventDefault()
    event.stopPropagation()
    return
  }

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
    <TopicHeader :topic="topic" />

    <!-- Posts list -->
    <div v-if="topic.post_stream?.posts" ref="postsListRef" class="posts-list space-y-4">
      <PostItem
        v-for="post in topic.post_stream.posts"
        :key="post.id"
        :post="post"
        :baseUrl="baseUrl"
        :parsed="getParsedPost(post.id)"
        :isPostLiked="isPostLiked"
        :getReactionCount="getReactionCount"
        :isLiking="likingPostIds.has(post.id)"
        @openUser="handleUserClick"
        @replyTo="handleReplyClick"
        @toggleLike="toggleLike"
      />
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

<style scoped src="../css/TopicView.css"></style>
