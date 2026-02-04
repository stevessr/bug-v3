import {
  defineComponent,
  computed,
  ref,
  watch
} from 'vue'
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

    const { timelinePostNumber, scrollToPost } = useTopicNavigation({
      baseUrl: props.baseUrl,
      topicId: props.topic.id,
      postsListRef,
      targetPostNumber: props.targetPostNumber || null,
      pageFetch,
      extractData,
      parsePostContent,
      emitOpenQuote: payload => emit('openQuote', payload),
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
          <TopicHeader topic={props.topic} />

          {/* Posts list */}
          {props.topic.post_stream?.posts ? (
            <div ref={postsListRef}>
              <TopicPostsList
                posts={props.topic.post_stream.posts}
                baseUrl={props.baseUrl}
                topicId={props.topic.id}
                currentUser={props.currentUser}
                currentUsername={props.currentUsername}
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
                isLiking={postId => likingPostIds.value.has(postId)}
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

        <TopicAside
          posts={props.topic.post_stream?.posts || []}
          maxPostNumber={maxPostNumber.value}
          currentPostNumber={timelinePostNumber.value}
          onJump={scrollToPost}
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
      </div>
    )
  }
})
