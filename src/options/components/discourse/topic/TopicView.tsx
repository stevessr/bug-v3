import {
  defineComponent,
  computed,
  ref,
  onMounted,
  onUnmounted,
  watch,
  shallowRef,
  nextTick
} from 'vue'
import { message, Spin, Modal } from 'ant-design-vue'
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
import { assignPost, setTopicNotificationLevel } from '../actions'

import TopicHeader from './TopicHeader'
import PostItem from './PostItem'
import PostParentPreview from './PostParentPreview'
import PostRepliesTree from './PostRepliesTree'
import TopicExtras from './TopicExtras'
import TopicFooter from './TopicFooter'
import TopicTimeline from './TopicTimeline'
import { useAiSummary } from './useAiSummary'
import { usePostActions } from './usePostActions'
import { useTopicArchive } from './useTopicArchive'
import { usePostRelations } from './usePostRelations'
import '../css/TopicView.css'

export default defineComponent({
  name: 'TopicView',
  props: {
    topic: { type: Object as () => DiscourseTopicDetail, required: true },
    baseUrl: { type: String, required: true },
    isLoadingMore: { type: Boolean, required: true },
    hasMorePosts: { type: Boolean, required: true },
    targetPostNumber: { type: Number as () => number | null, default: null },
    currentUser: { type: Object as () => DiscourseUserProfile | null, default: null },
    currentUsername: { type: String, default: null }
  },
  emits: [
    'openSuggestedTopic',
    'openUser',
    'refresh',
    'replyTo',
    'openQuote',
    'navigate',
    'editPost'
  ],
  setup(props, { emit }) {
    const postsListRef = ref<HTMLElement | null>(null)
    const timelinePostNumber = ref(1)
    const timelineTicking = ref(false)
    const {
      aiSummary,
      aiMeta,
      aiLoading,
      aiAvailable,
      aiErrorMessage,
      showAiSummaryModal,
      handleAiSummary,
      handleAiRegenerate
    } = useAiSummary({
      baseUrl: props.baseUrl,
      topicId: props.topic.id,
      notify: message
    })

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

    const {
      isRepliesExpanded,
      isParentExpanded,
      isParentLoading,
      getRepliesForPost,
      getParsedReply,
      getParentPost,
      getParsedParent,
      handleToggleReplies,
      handleToggleParent,
      resetRelations
    } = usePostRelations({
      baseUrl: props.baseUrl,
      topicId: props.topic.id,
      posts: props.topic.post_stream?.posts || [],
      pageFetch,
      extractData,
      parsePostContent
    })

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

    const {
      likedPostIds,
      likingPostIds,
      isPostLiked,
      getReactionCount,
      toggleLike,
      handleBookmark,
      handleFlag,
      handleAssign,
      handleDelete,
      handleWiki
    } = usePostActions({
      baseUrl: props.baseUrl,
      pageFetch,
      extractData,
      notify: message,
      onRefresh: () => emit('refresh')
    })

    const handleEdit = (post: DiscoursePost) => {
      emit('editPost', post)
    }

    const firstPost = computed(() => {
      if (!props.topic?.post_stream?.posts) return null
      return (
        props.topic.post_stream.posts.find((item: DiscoursePost) => item.post_number === 1) ||
        props.topic.post_stream.posts[0] ||
        null
      )
    })

    const maxPostNumber = computed(() => {
      return (
        props.topic?.highest_post_number ||
        props.topic?.posts_count ||
        props.topic?.post_stream?.stream?.length ||
        props.topic?.post_stream?.posts?.length ||
        1
      )
    })

    const handleTopicReply = () => {
      if (!firstPost.value) return
      handleReplyClick({
        postNumber: firstPost.value.post_number,
        username: firstPost.value.username
      })
    }

    const handleTopicBookmark = async () => {
      if (!firstPost.value) return
      await handleBookmark(firstPost.value)
    }

    const handleTopicFlag = async () => {
      if (!firstPost.value) return
      await handleFlag(firstPost.value)
    }

    const handleTopicAssign = async () => {
      if (!firstPost.value) return
      const input = window.prompt('请输入要指定的用户名')
      if (!input) return
      const username = input.trim()
      if (!username) return
      try {
        const userResult = await pageFetch<any>(
          `${props.baseUrl}/u/${encodeURIComponent(username)}.json`
        )
        const userData = extractData(userResult)
        const assigneeId = userData?.user?.id
        if (!assigneeId) {
          message.error('未找到该用户')
          return
        }
        await assignPost(props.baseUrl, { postId: firstPost.value.id, assigneeId })
        message.success('指定成功')
      } catch (error) {
        console.warn('[DiscourseBrowser] assign failed:', error)
        message.error('指定失败')
      }
    }

    const handleChangeNotificationLevel = async (level: number) => {
      try {
        await setTopicNotificationLevel(props.baseUrl, props.topic.id, level)
        props.topic.notification_level = level
        message.success('通知等级已更新')
      } catch (error) {
        console.warn('[DiscourseBrowser] update notification level failed:', error)
        message.error('通知等级更新失败')
      }
    }

    const { isArchiving, archiveTopicAsWebp } = useTopicArchive({
      baseUrl: props.baseUrl,
      topicId: props.topic.id,
      topicTitle: props.topic?.title,
      getPosts: () => props.topic?.post_stream?.posts || [],
      getParsedPost,
      pageFetch,
      notify: message
    })

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

    const updateTimelineFromScroll = () => {
      const list = postsListRef.value
      if (!list || timelineTicking.value) return
      const container = list.closest('.content-area') as HTMLElement | null
      if (!container) return
      timelineTicking.value = true
      requestAnimationFrame(() => {
        const nodes = Array.from(list.querySelectorAll<HTMLElement>('[data-post-number]'))
        if (!nodes.length) {
          timelineTicking.value = false
          return
        }
        const containerTop = container.getBoundingClientRect().top
        let bestNum = timelinePostNumber.value
        let bestDelta = Number.POSITIVE_INFINITY
        nodes.forEach(node => {
          const raw = node.getAttribute('data-post-number')
          if (!raw) return
          const num = Number.parseInt(raw, 10)
          if (!Number.isFinite(num)) return
          const delta = Math.abs(node.getBoundingClientRect().top - containerTop - 24)
          if (delta < bestDelta) {
            bestDelta = delta
            bestNum = num
          }
        })
        timelinePostNumber.value = bestNum
        timelineTicking.value = false
      })
    }

    watch(
      () =>
        [props.targetPostNumber, props.topic?.id, props.topic?.post_stream?.posts?.length] as const,
      async ([value, topicId]) => {
        if (!value || !topicId) return
        const key = `${topicId}:${value}`
        if (lastAutoScrollKey.value === key) return
        await nextTick()
        scrollToPost(value)
        timelinePostNumber.value = value
      },
      { immediate: true }
    )

    watch(
      () => props.topic?.id,
      () => {
        likedPostIds.value = new Set()
        likingPostIds.value = new Set()
        resetRelations()
        timelinePostNumber.value = 1
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
      const container = postsListRef.value?.closest('.content-area') as HTMLElement | null
      container?.addEventListener('scroll', updateTimelineFromScroll)
      updateTimelineFromScroll()
    })

    onUnmounted(() => {
      postsListRef.value?.removeEventListener('click', handleQuoteToggle)
      const container = postsListRef.value?.closest('.content-area') as HTMLElement | null
      container?.removeEventListener('scroll', updateTimelineFromScroll)
    })

    return () => (
      <div class="topic-view flex gap-4">
        <div class="topic-main flex-1 min-w-0 space-y-4">
          <TopicHeader topic={props.topic} />

          {/* Posts list */}
          {props.topic.post_stream?.posts ? (
            <div ref={postsListRef} class="posts-list space-y-4">
              {props.topic.post_stream.posts.map(post => (
                <div key={post.id}>
                  {post.reply_to_post_number && isParentExpanded(post.post_number) && (
                    <div class="post-parent-outer">
                      {isParentLoading(post.post_number) ? (
                        <div class="text-xs text-gray-500">上文加载中...</div>
                      ) : getParentPost(post) && getParsedParent(post) ? (
                        <PostParentPreview
                          post={getParentPost(post)!}
                          parsed={getParsedParent(post)!}
                          baseUrl={props.baseUrl}
                          getParentPost={getParentPost}
                          getParentParsed={getParsedParent}
                          isParentExpanded={(postItem: DiscoursePost) =>
                            isParentExpanded(postItem.post_number)
                          }
                          isParentLoading={(postItem: DiscoursePost) =>
                            isParentLoading(postItem.post_number)
                          }
                          onOpenUser={handleUserClick}
                          onJumpToPost={scrollToPost}
                          onNavigate={handleContentNavigation}
                          onToggleParent={handleToggleParent}
                        />
                      ) : (
                        <div class="text-xs text-gray-500">上文不可用</div>
                      )}
                    </div>
                  )}
                  <PostItem
                    post={post}
                    baseUrl={props.baseUrl}
                    topicId={props.topic.id}
                    parsed={getParsedPost(post.id)}
                    isParentExpanded={isParentExpanded(post.post_number)}
                    isPostLiked={isPostLiked}
                    getReactionCount={getReactionCount}
                    isLiking={likingPostIds.value.has(post.id)}
                    currentUser={props.currentUser}
                    currentUsername={props.currentUsername}
                    onOpenUser={handleUserClick}
                    onReplyTo={handleReplyClick}
                    onToggleLike={toggleLike}
                    onToggleReplies={handleToggleReplies}
                    onToggleParent={handleToggleParent}
                    onNavigate={handleContentNavigation}
                    onBookmark={handleBookmark}
                    onFlag={handleFlag}
                    onAssign={handleAssign}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onWiki={handleWiki}
                    onArchiveTopic={archiveTopicAsWebp}
                    isArchiving={isArchiving.value}
                  />
                  {isRepliesExpanded(post.post_number) && (
                    <div class="pl-6 mt-3 space-y-3">
                      <PostRepliesTree
                        posts={getRepliesForPost(post.post_number)}
                        baseUrl={props.baseUrl}
                        getParsed={getParsedReply}
                        getReplies={getRepliesForPost}
                        isExpanded={isRepliesExpanded}
                        onOpenUser={handleUserClick}
                        onToggleReplies={handleToggleReplies}
                        onNavigate={handleContentNavigation}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div class="text-center text-gray-500 py-8">加载帖子中...</div>
          )}

          {/* Loading more indicator */}
          {props.isLoadingMore && (
            <div class="flex items-center justify-center py-4">
              <Spin />
              <span class="ml-2 text-gray-500">加载更多帖子...</span>
            </div>
          )}

          {/* End of posts indicator */}
          {!props.hasMorePosts && props.topic.post_stream?.posts?.length && (
            <div class="text-center text-gray-400 py-4 text-sm">
              已加载全部 {props.topic.post_stream.posts.length} 条帖子
            </div>
          )}

          <TopicFooter
            notificationLevel={
              props.topic.notification_level ?? props.topic.details?.notification_level ?? null
            }
            bookmarked={!!firstPost.value?.bookmarked}
            canAssign={
              !!props.currentUser && (props.currentUser.admin || props.currentUser.moderator)
            }
            aiAvailable={aiAvailable.value}
            aiLoading={aiLoading.value}
            onChangeLevel={handleChangeNotificationLevel}
            onBookmark={handleTopicBookmark}
            onFlag={handleTopicFlag}
            onAssign={handleTopicAssign}
            onReply={handleTopicReply}
            onAiSummary={handleAiSummary}
          />

          <TopicExtras
            suggested={props.topic.suggested_topics || []}
            related={props.topic.related_topics || []}
            baseUrl={props.baseUrl}
            onOpen={handleSuggestedClick}
          />
        </div>

        <div class="topic-aside hidden lg:block w-56">
          <div class="topic-aside__inner">
            <TopicTimeline
              posts={props.topic.post_stream?.posts || []}
              maxPostNumber={maxPostNumber.value}
              currentPostNumber={timelinePostNumber.value}
              onJump={scrollToPost}
            />
          </div>
        </div>

        <Modal
          open={showAiSummaryModal.value}
          title="AI 总结"
          footer={null}
          width="720px"
          onCancel={() => {
            showAiSummaryModal.value = false
          }}
        >
          <div class="space-y-3">
            {aiLoading.value && <div class="text-sm text-gray-500">生成中...</div>}
            {aiSummary.value && (
              <div class="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap">
                {aiSummary.value}
              </div>
            )}
            {aiErrorMessage.value && (
              <div class="text-sm text-red-500">{aiErrorMessage.value}</div>
            )}
            {aiMeta.value && (
              <div class="text-xs text-gray-500">
                {aiMeta.value.outdated ? '内容已过期' : '已更新'}
                {aiMeta.value.algorithm && ` · ${aiMeta.value.algorithm}`}
                {aiMeta.value.updatedAt && ` · ${aiMeta.value.updatedAt}`}
                {typeof aiMeta.value.newPosts === 'number' &&
                  ` · 新增 ${aiMeta.value.newPosts} 条`}
              </div>
            )}
            {(aiMeta.value?.outdated || aiMeta.value?.canRegenerate) && (
              <div>
                <button
                  type="button"
                  class="px-3 py-1 text-sm bg-blue-600 text-white rounded"
                  disabled={aiLoading.value}
                  onClick={handleAiRegenerate}
                >
                  重新生成
                </button>
              </div>
            )}
          </div>
        </Modal>
      </div>
    )
  }
})
