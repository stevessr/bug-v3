<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, shallowRef, nextTick } from 'vue'
import { message } from 'ant-design-vue'
import hljs from 'highlight.js'
import '../css/highlight.css'

import type {
  DiscourseTopicDetail,
  DiscoursePost,
  ParsedContent,
  SuggestedTopic,
  DiscourseUserProfile
} from '../types'
import { parsePostContent, pageFetch, extractData } from '../utils'
import {
  togglePostLike,
  toggleBookmark,
  flagPost,
  assignPost,
  editPost,
  deletePost,
  toggleWiki
} from '../actions'

import TopicHeader from './TopicHeader.vue'
import PostItem from './PostItem.vue'
import PostParentPreview from './PostParentPreview.vue'
import PostRepliesTree from './PostRepliesTree.vue'
import TopicList from './TopicList.vue'

const props = defineProps<{
  topic: DiscourseTopicDetail
  baseUrl: string
  isLoadingMore: boolean
  hasMorePosts: boolean
  targetPostNumber?: number | null
  currentUser?: DiscourseUserProfile | null
  currentUsername?: string | null
}>()

const emit = defineEmits<{
  (e: 'openSuggestedTopic', topic: SuggestedTopic): void
  (e: 'openUser', username: string): void
  (e: 'refresh'): void
  (e: 'replyTo', payload: { postNumber: number; username: string }): void
  (e: 'openQuote', payload: { topicId: number; postNumber: number }): void
  (e: 'navigate', url: string): void
  (e: 'editPost', post: DiscoursePost): void
}>()

const postsListRef = ref<HTMLElement | null>(null)
const likedPostIds = ref<Set<number>>(new Set())
const likingPostIds = ref<Set<number>>(new Set())
const expandedReplies = shallowRef<Set<number>>(new Set())
const replyMap = shallowRef<Map<number, DiscoursePost[]>>(new Map())
const replyParsedCache = new Map<number, ParsedContent>()
const expandedParents = shallowRef<Set<number>>(new Set())
const parentPostCache = shallowRef<Map<number, DiscoursePost>>(new Map())
const parentParsedCache = new Map<number, ParsedContent>()
const parentLoading = shallowRef<Set<number>>(new Set())

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

const getParsedReply = (post: DiscoursePost): ParsedContent => {
  const cached = replyParsedCache.get(post.id)
  if (cached) return cached
  const parsed = parsePostContent(post.cooked, props.baseUrl)
  replyParsedCache.set(post.id, parsed)
  return parsed
}

const getParentPostByNumber = (postNumber: number): DiscoursePost | null => {
  const local = props.topic.post_stream?.posts?.find(post => post.post_number === postNumber)
  if (local) return local
  return parentPostCache.value.get(postNumber) || null
}

const getParentPost = (post: DiscoursePost): DiscoursePost | null => {
  if (!post.reply_to_post_number) return null
  return getParentPostByNumber(post.reply_to_post_number)
}

const getParsedParent = (post: DiscoursePost): ParsedContent | null => {
  const parent = getParentPost(post)
  if (!parent) return null
  const parsedFromMain = parsedPosts.value.get(parent.id)
  if (parsedFromMain) return parsedFromMain
  const cached = parentParsedCache.get(parent.id)
  if (cached) return cached
  const parsed = parsePostContent(parent.cooked, props.baseUrl)
  parentParsedCache.set(parent.id, parsed)
  return parsed
}

const getRepliesForPost = (postNumber: number): DiscoursePost[] => {
  return replyMap.value.get(postNumber) || []
}

const isRepliesExpanded = (postNumber: number) => {
  return expandedReplies.value.has(postNumber)
}

const isParentExpanded = (postNumber: number) => {
  return expandedParents.value.has(postNumber)
}

const isParentLoading = (postNumber: number) => {
  return parentLoading.value.has(postNumber)
}

const fetchParentForPost = async (post: DiscoursePost) => {
  if (!props.topic?.id) return
  if (!post.reply_to_post_number) return

  const parentNumber = post.reply_to_post_number
  if (getParentPostByNumber(parentNumber)) return

  parentLoading.value = new Set(parentLoading.value)
  parentLoading.value.add(post.post_number)

  try {
    const result = await pageFetch<any>(
      `${props.baseUrl}/posts/by_number/${props.topic.id}/${parentNumber}.json`
    )
    if (result.status === 404) return
    const data = extractData(result)
    if (data?.id) {
      parentPostCache.value = new Map(parentPostCache.value)
      parentPostCache.value.set(parentNumber, data as DiscoursePost)
    }
  } catch (error) {
    console.warn('[DiscourseBrowser] fetch parent failed:', error)
  } finally {
    parentLoading.value = new Set(parentLoading.value)
    parentLoading.value.delete(post.post_number)
  }
}

const fetchRepliesForPost = async (post: DiscoursePost) => {
  if (!props.topic?.id) return
  const postNumber = post.post_number
  const localReplies =
    props.topic.post_stream?.posts?.filter(p => p.reply_to_post_number === postNumber) || []

  const replies = [...localReplies]

  if (post.reply_count && replies.length < post.reply_count) {
    try {
      const result = await pageFetch<any>(`${props.baseUrl}/t/${props.topic.id}/${postNumber}.json`)
      const data = extractData(result)
      const fetched = (data?.post_stream?.posts || []).filter(
        (p: DiscoursePost) => p.reply_to_post_number === postNumber
      )
      const seen = new Set(replies.map(p => p.id))
      fetched.forEach((p: DiscoursePost) => {
        if (!seen.has(p.id)) {
          replies.push(p)
          seen.add(p.id)
        }
      })
    } catch (error) {
      console.warn('[DiscourseBrowser] fetch replies failed:', error)
    }
  }

  replyMap.value = new Map(replyMap.value)
  replyMap.value.set(postNumber, replies)
}

const handleToggleReplies = async (post: DiscoursePost) => {
  const postNumber = post.post_number
  const next = new Set(expandedReplies.value)
  if (next.has(postNumber)) {
    next.delete(postNumber)
    expandedReplies.value = next
    return
  }
  next.add(postNumber)
  expandedReplies.value = next
  if (!replyMap.value.has(postNumber)) {
    await fetchRepliesForPost(post)
  }
}

const handleToggleParent = async (post: DiscoursePost) => {
  const postNumber = post.post_number
  const next = new Set(expandedParents.value)
  if (next.has(postNumber)) {
    next.delete(postNumber)
    expandedParents.value = next
    return
  }
  next.add(postNumber)
  expandedParents.value = next
  if (!getParentPost(post)) {
    await fetchParentForPost(post)
  }
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

const handleContentNavigation = (url: string) => {
  emit('navigate', url)
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

const handleBookmark = async (post: DiscoursePost) => {
  try {
    const postAny = post as any
    const currentBookmarked = postAny.bookmarked || false
    await toggleBookmark(props.baseUrl, {
      postId: post.id,
      bookmarked: !currentBookmarked
    })
    postAny.bookmarked = !currentBookmarked
    message.success(postAny.bookmarked ? '已添加书签' : '已删除书签')
  } catch (error) {
    console.warn('[DiscourseBrowser] bookmark failed:', error)
    message.error('书签操作失败')
  }
}

const handleFlag = async (post: DiscoursePost) => {
  try {
    await flagPost(props.baseUrl, {
      postId: post.id,
      flagType: '6', // Post action type ID 6: inappropriate content
      message: ''
    })
    message.success('举报成功')
  } catch (error) {
    console.warn('[DiscourseBrowser] flag failed:', error)
    message.error('举报失败')
  }
}

const handleAssign = async (post: DiscoursePost) => {
  message.info('指定功能需要选择用户，请在 Web 界面中使用')
}

const handleEdit = (post: DiscoursePost) => {
  emit('editPost', post)
}

const handleDelete = async (post: DiscoursePost) => {
  try {
    await deletePost(props.baseUrl, post.id)
    const postAny = post as any
    postAny.hidden = true
    message.success('删除成功')
    emit('refresh')
  } catch (error) {
    console.warn('[DiscourseBrowser] delete failed:', error)
    message.error('删除失败')
  }
}

const handleWiki = async (post: DiscoursePost) => {
  try {
    const postAny = post as any
    const currentWiki = postAny.wiki || false
    await toggleWiki(props.baseUrl, post.id, !currentWiki)
    const postResult = await pageFetch<any>(`${props.baseUrl}/posts/${post.id}.json`)
    const postData = extractData(postResult)
    if (postData && typeof postData === 'object') {
      Object.assign(postAny, postData)
    } else {
      postAny.wiki = !currentWiki
    }
    message.success(postAny.wiki ? '已启用 Wiki' : '已禁用 Wiki')
  } catch (error) {
    console.warn('[DiscourseBrowser] wiki failed:', error)
    message.error('Wiki 操作失败')
  }
}

const lastAutoScrollKey = ref<string | null>(null)

const scrollElementIntoView = (
  el: HTMLElement,
  container: HTMLElement | null,
  behavior: ScrollBehavior = 'smooth'
) => {
  if (container) {
    const elRect = el.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    const targetTop =
      elRect.top - containerRect.top + container.scrollTop - containerRect.height / 2
    const nextTop = Math.max(0, targetTop)
    container.scrollTo({ top: nextTop, behavior })
    if (behavior !== 'auto') {
      container.scrollTop = nextTop
    }
  } else {
    el.scrollIntoView({ behavior, block: 'center' })
  }
}

const findNearestPostElement = (targetPost: number): HTMLElement | null => {
  const list = postsListRef.value
  if (!list) return null
  const nodes = Array.from(list.querySelectorAll<HTMLElement>('[data-post-number]'))
  if (!nodes.length) return null
  let above: { num: number; el: HTMLElement } | null = null
  let below: { num: number; el: HTMLElement } | null = null
  for (const node of nodes) {
    const raw = node.getAttribute('data-post-number')
    if (!raw) continue
    const num = Number.parseInt(raw, 10)
    if (!Number.isFinite(num)) continue
    if (num >= targetPost) {
      if (!above || num < above.num) {
        above = { num, el: node }
      }
    } else if (!below || num > below.num) {
      below = { num, el: node }
    }
  }
  return above?.el || below?.el || null
}

const scrollToPost = (postNumber: number, attempt = 0) => {
  if (!postNumber) return
  const topicId = props.topic?.id
  const key = topicId ? `${topicId}:${postNumber}` : null
  requestAnimationFrame(() => {
    const list = postsListRef.value
    if (!list) {
      if (attempt < 40) {
        setTimeout(() => scrollToPost(postNumber, attempt + 1), 200)
      }
      return
    }
    const container = list?.closest('.content-area') as HTMLElement | null
    if (container && container.clientHeight === 0) {
      if (attempt < 40) {
        setTimeout(() => scrollToPost(postNumber, attempt + 1), 200)
      }
      return
    }
    const el = list?.querySelector(`[data-post-number="${postNumber}"]`) as HTMLElement | null
    const behavior: ScrollBehavior = attempt === 0 ? 'auto' : 'smooth'
    if (el) {
      scrollElementIntoView(el, container, behavior)
      if (key) lastAutoScrollKey.value = key
      return
    }

    const fallback = attempt >= 6 ? findNearestPostElement(postNumber) : null
    if (fallback) {
      scrollElementIntoView(fallback, container, behavior)
      if (key) lastAutoScrollKey.value = key
      return
    }

    if (attempt < 40) {
      setTimeout(() => scrollToPost(postNumber, attempt + 1), 200)
    }
  })
}

watch(
  () => [props.targetPostNumber, props.topic?.id, props.topic?.post_stream?.posts?.length] as const,
  async ([value, topicId]) => {
    if (!value || !topicId) return
    const key = `${topicId}:${value}`
    if (lastAutoScrollKey.value === key) return
    await nextTick()
    scrollToPost(value)
  },
  { immediate: true }
)

watch(
  () => props.topic?.id,
  () => {
    likedPostIds.value = new Set()
    likingPostIds.value = new Set()
    expandedReplies.value = new Set()
    replyMap.value = new Map()
    replyParsedCache.clear()
    expandedParents.value = new Set()
    parentPostCache.value = new Map()
    parentLoading.value = new Set()
    parentParsedCache.clear()
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

      // Apply highlighting to code blocks in the expanded quote
      const codeBlocks = blockquote.querySelectorAll('pre code')
      codeBlocks.forEach(block => {
        const el = block as HTMLElement
        const langMatch = Array.from(el.classList).find(cls => cls.startsWith('lang-'))
        if (langMatch) {
          const lang = langMatch.replace('lang-', '')
          if (hljs.getLanguage(lang)) {
            el.innerHTML = hljs.highlight(el.textContent || '', { language: lang }).value
            el.classList.add('hljs')
            return
          }
        }
        hljs.highlightElement(el)
      })
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
      <template v-for="post in topic.post_stream.posts" :key="post.id">
        <div
          v-if="post.reply_to_post_number && isParentExpanded(post.post_number)"
          class="post-parent-outer"
        >
          <div v-if="isParentLoading(post.post_number)" class="text-xs text-gray-500">
            上文加载中...
          </div>
          <PostParentPreview
            v-else-if="getParentPost(post) && getParsedParent(post)"
            :post="getParentPost(post)!"
            :parsed="getParsedParent(post)!"
            :baseUrl="baseUrl"
            :getParentPost="getParentPost"
            :getParentParsed="getParsedParent"
            :isParentExpanded="postItem => isParentExpanded(postItem.post_number)"
            :isParentLoading="postItem => isParentLoading(postItem.post_number)"
            @openUser="handleUserClick"
            @jumpToPost="scrollToPost"
            @navigate="handleContentNavigation"
            @toggleParent="handleToggleParent"
          />
          <div v-else class="text-xs text-gray-500">上文不可用</div>
        </div>
        <PostItem
          :post="post"
          :baseUrl="baseUrl"
          :topicId="topic.id"
          :parsed="getParsedPost(post.id)"
          :isParentExpanded="isParentExpanded(post.post_number)"
          :isPostLiked="isPostLiked"
          :getReactionCount="getReactionCount"
          :isLiking="likingPostIds.has(post.id)"
          :currentUser="currentUser"
          :currentUsername="currentUsername"
          @openUser="handleUserClick"
          @replyTo="handleReplyClick"
          @toggleLike="toggleLike"
          @toggleReplies="handleToggleReplies"
          @toggleParent="handleToggleParent"
          @navigate="handleContentNavigation"
          @bookmark="handleBookmark"
          @flag="handleFlag"
          @assign="handleAssign"
          @edit="handleEdit"
          @delete="handleDelete"
          @wiki="handleWiki"
        />
        <div v-if="isRepliesExpanded(post.post_number)" class="pl-6 mt-3 space-y-3">
          <PostRepliesTree
            :posts="getRepliesForPost(post.post_number)"
            :baseUrl="baseUrl"
            :getParsed="getParsedReply"
            :getReplies="getRepliesForPost"
            :isExpanded="isRepliesExpanded"
            @openUser="handleUserClick"
            @toggleReplies="handleToggleReplies"
          />
        </div>
      </template>
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
      <TopicList :topics="topic.related_topics" :baseUrl="baseUrl" @click="handleSuggestedClick" />
    </div>
  </div>
</template>

<style scoped src="../css/TopicView.css"></style>
