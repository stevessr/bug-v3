import { shallowRef } from 'vue'

import type { DiscoursePost, ParsedContent } from '../types'

type PageFetch = typeof import('../utils').pageFetch
type ExtractData = typeof import('../utils').extractData
type ParsePost = typeof import('../utils').parsePostContent

export function usePostRelations(options: {
  baseUrl: string
  topicId: number
  posts: DiscoursePost[]
  pageFetch: PageFetch
  extractData: ExtractData
  parsePostContent: ParsePost
}) {
  const expandedReplies = shallowRef<Set<number>>(new Set())
  const replyMap = shallowRef<Map<number, DiscoursePost[]>>(new Map())
  const replyParsedCache = new Map<number, ParsedContent>()
  const expandedParents = shallowRef<Set<number>>(new Set())
  const parentPostCache = shallowRef<Map<number, DiscoursePost>>(new Map())
  const parentParsedCache = new Map<number, ParsedContent>()
  const parentLoading = shallowRef<Set<number>>(new Set())

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

  const getParentPostByNumber = (postNumber: number): DiscoursePost | null => {
    const local = options.posts.find(post => post.post_number === postNumber)
    if (local) return local
    return parentPostCache.value.get(postNumber) || null
  }

  const getParentPost = (post: DiscoursePost): DiscoursePost | null => {
    if (!post.reply_to_post_number) return null
    return getParentPostByNumber(post.reply_to_post_number)
  }

  const getParsedParent = (post: DiscoursePost, getParsedPost: (id: number) => ParsedContent) => {
    const parent = getParentPost(post)
    if (!parent) return null
    const parsedFromMain = getParsedPost(parent.id)
    if (parsedFromMain?.html) return parsedFromMain
    const cached = parentParsedCache.get(parent.id)
    if (cached) return cached
    const parsed = options.parsePostContent(parent.cooked, options.baseUrl)
    parentParsedCache.set(parent.id, parsed)
    return parsed
  }

  const getParsedReply = (post: DiscoursePost): ParsedContent => {
    const cached = replyParsedCache.get(post.id)
    if (cached) return cached
    const parsed = options.parsePostContent(post.cooked, options.baseUrl)
    replyParsedCache.set(post.id, parsed)
    return parsed
  }

  const fetchParentForPost = async (post: DiscoursePost) => {
    if (!options.topicId) return
    if (!post.reply_to_post_number) return

    const parentNumber = post.reply_to_post_number
    if (getParentPostByNumber(parentNumber)) return

    parentLoading.value = new Set(parentLoading.value)
    parentLoading.value.add(post.post_number)

    try {
      const result = await options.pageFetch<any>(
        `${options.baseUrl}/posts/by_number/${options.topicId}/${parentNumber}.json`
      )
      if (result.status === 404) return
      const data = options.extractData(result)
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
    if (!options.topicId) return
    const postNumber = post.post_number
    const localReplies = options.posts.filter(p => p.reply_to_post_number === postNumber) || []

    const replies = [...localReplies]

    if (post.reply_count && replies.length < post.reply_count) {
      try {
        const result = await options.pageFetch<any>(
          `${options.baseUrl}/t/${options.topicId}/${postNumber}.json`
        )
        const data = options.extractData(result)
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

  const resetRelations = () => {
    expandedReplies.value = new Set()
    replyMap.value = new Map()
    replyParsedCache.clear()
    expandedParents.value = new Set()
    parentPostCache.value = new Map()
    parentLoading.value = new Set()
    parentParsedCache.clear()
  }

  return {
    expandedReplies,
    replyMap,
    expandedParents,
    parentPostCache,
    parentLoading,
    getRepliesForPost,
    getParsedReply,
    getParentPost,
    getParsedParent,
    isRepliesExpanded,
    isParentExpanded,
    isParentLoading,
    handleToggleReplies,
    handleToggleParent,
    resetRelations
  }
}
