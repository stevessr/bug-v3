import { ref } from 'vue'

import type { DiscoursePost, DiscourseFlagType } from '../types'
import type { extractData, pageFetch } from '../utils'
import {
  togglePostLike,
  toggleBookmark,
  flagPost,
  fetchFlagTypes,
  deletePost,
  toggleWiki
} from '../actions'

type Notify = {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

export function usePostActions(options: {
  baseUrl: string
  pageFetch: typeof pageFetch
  extractData: typeof extractData
  notify: Notify
  onRefresh?: () => void
}) {
  const likedPostIds = ref<Set<number>>(new Set())
  const likingPostIds = ref<Set<number>>(new Set())

  // Flag modal state
  const flagModalOpen = ref(false)
  const flagModalPost = ref<DiscoursePost | null>(null)
  const flagTypes = ref<DiscourseFlagType[]>([])
  const flagTypesLoading = ref(false)
  const flagSubmitting = ref(false)

  const isPostLiked = (post: DiscoursePost, reactionId: string) => {
    if (likedPostIds.value.has(post.id)) return true
    const postAny = post as any
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
    try {
      const data = await togglePostLike(options.baseUrl, post.id, reactionId)
      const postAny = post as any
      if (data) {
        postAny.reactions = data.reactions || []
        postAny.current_user_reaction = data.current_user_reaction
        postAny.reaction_users_count = data.reaction_users_count || 0
      }
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
      const bookmarkId = postAny.bookmark_id || postAny.bookmarkId || null
      await toggleBookmark(options.baseUrl, {
        postId: post.id,
        bookmarked: !currentBookmarked,
        bookmark_id: bookmarkId
      })
      postAny.bookmarked = !currentBookmarked
      options.notify.success(postAny.bookmarked ? '已添加书签' : '已删除书签')
    } catch (error) {
      console.warn('[DiscourseBrowser] bookmark failed:', error)
      options.notify.error('书签操作失败')
    }
  }

  const handleFlag = async (post: DiscoursePost) => {
    flagModalPost.value = post
    flagModalOpen.value = true
    flagTypesLoading.value = true

    try {
      const types = await fetchFlagTypes(options.baseUrl)
      // Filter to only show flags that apply to Post
      flagTypes.value = types.filter(
        t => !t.applies_to || t.applies_to.length === 0 || t.applies_to.includes('Post')
      )
    } catch (error) {
      console.warn('[DiscourseBrowser] fetch flag types failed:', error)
      options.notify.error('获取举报类型失败')
      flagModalOpen.value = false
    } finally {
      flagTypesLoading.value = false
    }
  }

  const closeFlagModal = () => {
    flagModalOpen.value = false
    flagModalPost.value = null
  }

  const submitFlag = async (flagTypeId: number, message: string) => {
    if (!flagModalPost.value) return

    flagSubmitting.value = true
    try {
      await flagPost(options.baseUrl, {
        postId: flagModalPost.value.id,
        flagType: String(flagTypeId),
        message,
        flagTopic: false
      })
      options.notify.success('举报成功')
      closeFlagModal()
    } catch (error) {
      console.warn('[DiscourseBrowser] flag failed:', error)
      const errMsg = error instanceof Error ? error.message : '举报失败'
      options.notify.error(errMsg)
    } finally {
      flagSubmitting.value = false
    }
  }

  const handleAssign = async (_post: DiscoursePost) => {
    void _post
    options.notify.info('指定功能需要选择用户，请在 Web 界面中使用')
  }

  const handleDelete = async (post: DiscoursePost) => {
    try {
      await deletePost(options.baseUrl, post.id)
      const postAny = post as any
      postAny.hidden = true
      options.notify.success('删除成功')
      options.onRefresh?.()
    } catch (error) {
      console.warn('[DiscourseBrowser] delete failed:', error)
      options.notify.error('删除失败')
    }
  }

  const handleWiki = async (post: DiscoursePost) => {
    try {
      const postAny = post as any
      const currentWiki = postAny.wiki || false
      await toggleWiki(options.baseUrl, post.id, !currentWiki)
      const postResult = await options.pageFetch<any>(`${options.baseUrl}/posts/${post.id}.json`)
      const postData = options.extractData(postResult)
      if (postData && typeof postData === 'object') {
        Object.assign(postAny, postData)
      } else {
        postAny.wiki = !currentWiki
      }
      options.notify.success(postAny.wiki ? '已启用 Wiki' : '已禁用 Wiki')
    } catch (error) {
      console.warn('[DiscourseBrowser] wiki failed:', error)
      options.notify.error('Wiki 操作失败')
    }
  }

  return {
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
  }
}
