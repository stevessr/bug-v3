import { defineComponent, computed, ref, watch } from 'vue'
import { message, Spin } from 'ant-design-vue'

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
import TopicPostsList from './TopicPostsList'
import TopicExtras from './TopicExtras'
import TopicFooter from './TopicFooter'
import TopicAside from './TopicAside'
import { useAiSummary } from './useAiSummary'
import { usePostActions } from './usePostActions'
import { useTopicArchive } from './useTopicArchive'
import { usePostRelations } from './usePostRelations'
import { useTopicNavigation } from './useTopicNavigation'
import AiSummaryModal from './AiSummaryModal'
import FlagModal from './FlagModal'
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
    currentUsername: { type: String, default: undefined },
    ensurePostLoaded: {
      type: Function as () => (postNumber: number) => Promise<void> | void,
      default: null
    }
  },
  emits: [
    'openSuggestedTopic',
    'openUser',
    'refresh',
    'replyTo',
    'openQuote',
    'navigate',
    'editPost',
    'toggleSummaryMode'
  ],
  setup(props, { emit }) {
    const postsListRef = ref<HTMLElement | null>(null)
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

    const topicOverride = ref<DiscourseTopicDetail | null>(null)
    const summaryMode = ref(false)
    const summaryLoading = ref(false)
    const viewStats = ref<{ views: number | null; users: number | null } | null>(null)
    const viewDetails = ref<{
      views: Array<Record<string, any>>
      users: Array<Record<string, any>>
    } | null>(null)
    const likeStats = ref<number | null>(null)
    const likeDetails = ref<
      Array<{ postNumber: number; likeCount: number; username: string; blurb?: string }>
    >([])

    const activeTopic = computed(() => topicOverride.value ?? props.topic)

    const viewCount = computed(() => viewStats.value?.views ?? activeTopic.value?.views ?? null)
    const likeCount = computed(() => likeStats.value ?? activeTopic.value?.like_count ?? null)
    const participants = computed(() => activeTopic.value?.details?.participants || [])
    const userCount = computed(() => viewStats.value?.users ?? participants.value.length)

    const sumStats = (items?: Array<Record<string, any>> | null) => {
      if (!items?.length) return null
      return items.reduce((total, item) => {
        const value = Number(item?.count ?? item?.views ?? item?.value ?? 0)
        return total + (Number.isNaN(value) ? 0 : value)
      }, 0)
    }

    const fetchViewStats = async (topicId: number) => {
      try {
        const result = await pageFetch<any>(`${props.baseUrl}/t/${topicId}/view-stats.json`)
        const data = extractData(result)
        const views = sumStats(data?.views ?? data?.view_stats ?? null)
        const users = sumStats(data?.users ?? data?.unique_users ?? data?.stats ?? null)
        viewStats.value = {
          views,
          users
        }
        viewDetails.value = {
          views: (data?.views ?? data?.view_stats ?? []) as Array<Record<string, any>>,
          users: (data?.users ?? data?.unique_users ?? data?.stats ?? []) as Array<
            Record<string, any>
          >
        }
      } catch (error) {
        console.warn('[DiscourseBrowser] load view stats failed:', error)
        viewStats.value = null
        viewDetails.value = null
      }
    }

    const fetchLikeStats = async (topicId: number) => {
      try {
        const query = encodeURIComponent(`" " topic:${topicId} order:likes`)
        const result = await pageFetch<any>(`${props.baseUrl}/search.json?q=${query}`)
        const data = extractData(result)
        const posts = (data?.posts || []) as Array<Record<string, any>>
        const totalLikes = posts.reduce((total, post) => {
          const value = Number(post?.like_count ?? post?.likeCount ?? 0)
          return total + (Number.isNaN(value) ? 0 : value)
        }, 0)
        likeStats.value = totalLikes || null
        likeDetails.value = posts.slice(0, 8).map(post => ({
          postNumber: Number(post?.post_number ?? post?.postNumber ?? 0),
          likeCount: Number(post?.like_count ?? post?.likeCount ?? 0),
          username: String(post?.username ?? post?.user?.username ?? ''),
          blurb: post?.blurb ?? post?.excerpt ?? ''
        }))
      } catch (error) {
        console.warn('[DiscourseBrowser] load like stats failed:', error)
        likeStats.value = null
        likeDetails.value = []
      }
    }

    const fetchTopicStats = async (topicId: number) => {
      await Promise.all([fetchViewStats(topicId), fetchLikeStats(topicId)])
    }

    const updateTopicOverride = (data: DiscourseTopicDetail | null, mode: 'summary' | 'full') => {
      topicOverride.value = data
      summaryMode.value = mode === 'summary'
      emit('toggleSummaryMode', summaryMode.value)
    }

    const handleToggleSummary = async () => {
      if (summaryLoading.value) return
      summaryLoading.value = true
      try {
        if (summaryMode.value) {
          const targetPostNumber = props.targetPostNumber ?? props.topic.last_read_post_number ?? 1
          const endpoint = `${props.baseUrl}/t/${props.topic.id}/${targetPostNumber}.json?forceLoad=true`
          const result = await pageFetch<any>(endpoint)
          const data = extractData(result)
          if (data?.id) {
            updateTopicOverride(data as DiscourseTopicDetail, 'full')
          } else {
            updateTopicOverride(null, 'full')
          }
        } else {
          const endpoint = `${props.baseUrl}/t/${props.topic.id}.json?filter=summary`
          const result = await pageFetch<any>(endpoint)
          const data = extractData(result)
          if (data?.id) {
            updateTopicOverride(data as DiscourseTopicDetail, 'summary')
          }
        }
      } catch (error) {
        console.warn('[DiscourseBrowser] toggle summary failed:', error)
        message.error('切换热门回复失败')
      } finally {
        summaryLoading.value = false
      }
    }

    watch(
      () => props.topic.id,
      topicId => {
        topicOverride.value = null
        summaryMode.value = false
        emit('toggleSummaryMode', false)
        void fetchTopicStats(topicId)
      },
      { immediate: true }
    )

    // Parse posts and cache results
    const parsedPosts = computed(() => {
      if (!activeTopic.value?.post_stream?.posts) return new Map<number, ParsedContent>()

      const map = new Map<number, ParsedContent>()
      for (const post of activeTopic.value.post_stream.posts) {
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
      getPosts: () => activeTopic.value?.post_stream?.posts || [],
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
      handleWiki,
      // Flag modal
      flagModalOpen,
      flagModalPost,
      flagTypes,
      flagTypesLoading,
      flagSubmitting,
      closeFlagModal,
      submitFlag
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
      if (!activeTopic.value?.post_stream?.posts) return null
      return (
        activeTopic.value.post_stream.posts.find((item: DiscoursePost) => item.post_number === 1) ||
        activeTopic.value.post_stream.posts[0] ||
        null
      )
    })

    const maxPostNumber = computed(() => {
      return (
        activeTopic.value?.highest_post_number ||
        activeTopic.value?.posts_count ||
        activeTopic.value?.post_stream?.stream?.length ||
        activeTopic.value?.post_stream?.posts?.length ||
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
        if (topicOverride.value) {
          topicOverride.value.notification_level = level
        }
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

    const { timelinePostNumber, highlightedPostNumber, scrollToPost } = useTopicNavigation({
      baseUrl: props.baseUrl,
      topicId: props.topic.id,
      postsListRef,
      targetPostNumber: props.targetPostNumber || null,
      pageFetch,
      extractData,
      parsePostContent,
      emitOpenQuote: payload => emit('openQuote', payload),
      ensurePostLoaded: props.ensurePostLoaded || undefined,
      notify: message
    })

    watch(
      () => props.topic?.id,
      () => {
        likedPostIds.value = new Set()
        likingPostIds.value = new Set()
        resetRelations()
        timelinePostNumber.value = 1
      }
    )

    return () => (
      <div class="topic-view flex gap-4">
        <div class="topic-main flex-1 min-w-0 space-y-4">
          <TopicHeader topic={activeTopic.value} />

          {/* Posts list */}
          {activeTopic.value.post_stream?.posts ? (
            <div ref={postsListRef}>
              <TopicPostsList
                posts={activeTopic.value.post_stream.posts}
                baseUrl={props.baseUrl}
                topicId={activeTopic.value.id}
                currentUser={props.currentUser}
                currentUsername={props.currentUsername}
                highlightedPostNumber={highlightedPostNumber.value}
                getParsedPost={getParsedPost}
                isParentExpanded={isParentExpanded}
                isParentLoading={isParentLoading}
                getParentPost={getParentPost}
                getParsedParent={getParsedParent}
                isRepliesExpanded={isRepliesExpanded}
                getRepliesForPost={getRepliesForPost}
                getParsedReply={getParsedReply}
                isPostLiked={isPostLiked}
                getReactionCount={getReactionCount}
                isLiking={(postId: number) => likingPostIds.value.has(postId)}
                onOpenUser={handleUserClick}
                onReplyTo={handleReplyClick}
                onToggleLike={toggleLike}
                onToggleReplies={handleToggleReplies}
                onToggleParent={handleToggleParent}
                onNavigate={handleContentNavigation}
                onJumpToPost={scrollToPost}
                onBookmark={handleBookmark}
                onFlag={handleFlag}
                onAssign={handleAssign}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onWiki={handleWiki}
                onArchiveTopic={archiveTopicAsWebp}
                isArchiving={isArchiving.value}
              />
            </div>
          ) : (
            <div class="text-center text-gray-500 py-8">加载帖子中...</div>
          )}

          {/* Loading more indicator */}
          {!summaryMode.value && props.isLoadingMore && (
            <div class="flex items-center justify-center py-4">
              <Spin />
              <span class="ml-2 text-gray-500">加载更多帖子...</span>
            </div>
          )}

          {/* End of posts indicator */}
          {!summaryMode.value &&
            !props.hasMorePosts &&
            activeTopic.value.post_stream?.posts?.length && (
              <div class="text-center text-gray-400 py-4 text-sm">
                已加载全部 {activeTopic.value.post_stream.posts.length} 条帖子
              </div>
            )}

          <TopicFooter
            notificationLevel={
              activeTopic.value.notification_level ??
              activeTopic.value.details?.notification_level ??
              null
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
            suggested={activeTopic.value.suggested_topics || []}
            related={activeTopic.value.related_topics || []}
            baseUrl={props.baseUrl}
            onOpen={handleSuggestedClick}
          />
        </div>

        <TopicAside
          posts={activeTopic.value.post_stream?.posts || []}
          baseUrl={props.baseUrl}
          maxPostNumber={maxPostNumber.value}
          currentPostNumber={timelinePostNumber.value}
          onJump={scrollToPost}
          viewCount={viewCount.value}
          likeCount={likeCount.value}
          userCount={userCount.value}
          viewDetails={viewDetails.value}
          likeDetails={likeDetails.value}
          participants={participants.value}
          summaryMode={summaryMode.value}
          summaryLoading={summaryLoading.value}
          onToggleSummary={handleToggleSummary}
        />

        <AiSummaryModal
          open={showAiSummaryModal.value}
          summary={aiSummary.value}
          loading={aiLoading.value}
          errorMessage={aiErrorMessage.value}
          meta={aiMeta.value}
          onCancel={() => {
            showAiSummaryModal.value = false
          }}
          onRegenerate={handleAiRegenerate}
        />

        <FlagModal
          open={flagModalOpen.value}
          post={flagModalPost.value}
          flagTypes={flagTypes.value}
          loading={flagTypesLoading.value}
          submitting={flagSubmitting.value}
          onCancel={closeFlagModal}
          onSubmit={submitFlag}
        />
      </div>
    )
  }
})
