import {
  discourseRequest,
  ensureDiscoursePostLiked,
  ensureDiscoursePostUnliked,
  fetchDiscoursePost,
  fetchDiscourseTopic,
  fetchDiscourseTopicList,
  fetchDiscourseTopicWithPosts,
  isDiscoursePostLiked,
  mapDiscoursePost,
  normalizeDiscourseBaseUrl,
  sendDiscourseTimings
} from './discourseClient'

import type { BrowseStrategy } from '@/types/type'

function getBaseUrl(args: Record<string, any>): string {
  return normalizeDiscourseBaseUrl(args.baseUrl || 'https://linux.do')
}

function positiveInteger(value: unknown, name: string): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`缺少或无效 ${name}`)
  return Math.floor(parsed)
}

function optionalPage(value: unknown): number {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(parsed, max))
}

function mapTopicSummary(topic: any) {
  return {
    id: topic.id,
    title: topic.title,
    fancy_title: topic.fancy_title,
    slug: topic.slug,
    posts_count: topic.posts_count,
    reply_count: topic.reply_count,
    views: topic.views,
    like_count: topic.like_count,
    category_id: topic.category_id,
    tags: topic.tags,
    pinned: topic.pinned,
    closed: topic.closed,
    archived: topic.archived,
    visible: topic.visible,
    created_at: topic.created_at,
    last_posted_at: topic.last_posted_at,
    last_poster_username: topic.last_poster_username,
    posters: topic.posters
  }
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length)
  let cursor = 0
  const runners = Array.from(
    { length: Math.min(Math.max(concurrency, 1), values.length) },
    async () => {
      while (true) {
        const index = cursor++
        if (index >= values.length) return
        results[index] = await worker(values[index])
      }
    }
  )
  await Promise.all(runners)
  return results
}

export async function handleDiscourseTool(
  toolName: string,
  args: Record<string, any>
): Promise<any> {
  switch (toolName) {
    case 'discourse.like_post': {
      const baseUrl = getBaseUrl(args)
      const postId = positiveInteger(args.postId, 'postId')
      const reactionId = String(args.reactionId || 'heart')
      const result = await ensureDiscoursePostLiked(baseUrl, postId, reactionId)
      return { success: true, postId, ...result }
    }

    case 'discourse.get_topic_list': {
      const baseUrl = getBaseUrl(args)
      const strategy = (args.strategy || 'latest') as BrowseStrategy
      const page = optionalPage(args.page)
      const data = await fetchDiscourseTopicList(baseUrl, strategy, page)
      const topics = Array.isArray(data?.topic_list?.topics) ? data.topic_list.topics : []
      return {
        success: true,
        strategy,
        page,
        can_create_topic: data?.topic_list?.can_create_topic,
        more_topics_url: data?.topic_list?.more_topics_url,
        topics: topics.map(mapTopicSummary)
      }
    }

    case 'discourse.get_topic': {
      const baseUrl = getBaseUrl(args)
      const topicId = positiveInteger(args.topicId, 'topicId')
      const includeRaw = Boolean(args.includeRaw)
      const maxPosts = Math.floor(boundedNumber(args.maxPosts, 200, 1, 2000))
      const { topic, posts, stream, truncated } = await fetchDiscourseTopicWithPosts(
        baseUrl,
        topicId,
        { includeRaw, maxPosts }
      )

      return {
        success: true,
        id: topic.id,
        title: topic.title,
        fancy_title: topic.fancy_title,
        slug: topic.slug,
        posts_count: topic.posts_count,
        reply_count: topic.reply_count,
        views: topic.views,
        like_count: topic.like_count,
        category_id: topic.category_id,
        tags: topic.tags,
        created_at: topic.created_at,
        last_posted_at: topic.last_posted_at,
        post_stream: {
          total_ids: stream.length,
          loaded: posts.length,
          truncated
        },
        posts: posts.map(post => mapDiscoursePost(post, includeRaw))
      }
    }

    case 'discourse.get_post': {
      const baseUrl = getBaseUrl(args)
      const postId = positiveInteger(args.postId, 'postId')
      const includeRaw = Boolean(args.includeRaw)
      const data = await fetchDiscoursePost(baseUrl, postId)
      return { success: true, ...mapDiscoursePost(data, includeRaw) }
    }

    case 'discourse.get_topic_posts': {
      const baseUrl = getBaseUrl(args)
      const topicId = positiveInteger(args.topicId, 'topicId')
      const includeRaw = Boolean(args.includeRaw)
      const postNumbers = Array.isArray(args.postNumbers)
        ? [...new Set(args.postNumbers.map(Number).filter(value => Number.isFinite(value) && value > 0))]
        : []
      if (postNumbers.length === 0) throw new Error('缺少 postNumbers')
      if (postNumbers.length > 100) throw new Error('单次最多获取 100 个楼层')

      const posts = await mapWithConcurrency(postNumbers, 4, async postNumber => {
        const params = new URLSearchParams({ post_number: String(postNumber) })
        if (includeRaw) params.set('include_raw', '1')
        const data = await discourseRequest<any>(
          baseUrl,
          `/t/${topicId}.json?${params.toString()}`
        )
        const post = (data?.post_stream?.posts || []).find(
          (item: any) => item.post_number === postNumber
        )
        return post ? mapDiscoursePost(post, includeRaw) : null
      })

      return { success: true, topicId, posts: posts.filter(Boolean) }
    }

    case 'discourse.get_category_list': {
      const baseUrl = getBaseUrl(args)
      const data = await discourseRequest<any>(baseUrl, '/categories.json')
      const categories = Array.isArray(data?.category_list?.categories)
        ? data.category_list.categories
        : []
      return {
        success: true,
        categories: categories.map((category: any) => ({
          id: category.id,
          name: category.name,
          color: category.color,
          text_color: category.text_color,
          slug: category.slug,
          topic_count: category.topic_count,
          post_count: category.post_count,
          position: category.position,
          parent_category_id: category.parent_category_id,
          description_text: category.description_text,
          read_restricted: category.read_restricted
        }))
      }
    }

    case 'discourse.get_tag_list': {
      const baseUrl = getBaseUrl(args)
      const data = await discourseRequest<any>(baseUrl, '/tags.json')
      const tags = Array.isArray(data?.tags) ? data.tags : []
      return {
        success: true,
        tags: tags.map((tag: any) => ({
          id: tag.id,
          name: tag.name,
          topic_count: tag.topic_count,
          staff: tag.staff
        }))
      }
    }

    case 'discourse.search_user': {
      const baseUrl = getBaseUrl(args)
      const term = String(args.term || '').trim()
      if (!term) throw new Error('缺少 term')
      const params = new URLSearchParams({ term })
      const data = await discourseRequest<any>(baseUrl, `/u/search/users.json?${params.toString()}`)
      return {
        success: true,
        users: (data?.users || []).map((user: any) => ({
          id: user.id,
          username: user.username,
          name: user.name,
          avatar_template: user.avatar_template,
          trust_level: user.trust_level
        }))
      }
    }

    case 'discourse.get_notifications': {
      const baseUrl = getBaseUrl(args)
      const page = optionalPage(args.page)
      const params = new URLSearchParams()
      if (page > 0) params.set('page', String(page))
      const suffix = params.size ? `?${params.toString()}` : ''
      const data = await discourseRequest<any>(baseUrl, `/notifications.json${suffix}`)
      return {
        success: true,
        page,
        total_rows_notifications: data?.total_rows_notifications,
        seen_notification_id: data?.seen_notification_id,
        notifications: data?.notifications || []
      }
    }

    case 'discourse.get_bookmarks': {
      const baseUrl = getBaseUrl(args)
      const page = optionalPage(args.page)
      const params = new URLSearchParams()
      if (page > 0) params.set('page', String(page))
      const suffix = params.size ? `?${params.toString()}` : ''
      const data = await discourseRequest<any>(baseUrl, `/bookmarks.json${suffix}`)
      return {
        success: true,
        page,
        bookmarks: data?.bookmarks || data?.user_bookmark_list?.bookmarks || []
      }
    }

    case 'discourse.get_post_context': {
      const baseUrl = getBaseUrl(args)
      const postId = positiveInteger(args.postId, 'postId')
      const includeRaw = Boolean(args.includeRaw)
      let topicId = Number(args.topicId || 0)
      let postNumber = Number(args.postNumber || 0)

      if (!topicId || !postNumber) {
        const postData = await fetchDiscoursePost(baseUrl, postId)
        topicId = Number(postData.topic_id || 0)
        postNumber = Number(postData.post_number || 0)
      }
      if (!topicId || !postNumber) throw new Error('无法解析 topicId 或 postNumber')

      const params = new URLSearchParams({ post_number: String(postNumber) })
      if (includeRaw) params.set('include_raw', '1')
      const data = await discourseRequest<any>(baseUrl, `/t/${topicId}.json?${params.toString()}`)
      const posts = Array.isArray(data?.post_stream?.posts) ? data.post_stream.posts : []

      return {
        success: true,
        topic: {
          id: data.id,
          title: data.title,
          slug: data.slug,
          posts_count: data.posts_count,
          category_id: data.category_id,
          tags: data.tags
        },
        anchor: { postId, postNumber, topicId },
        posts: posts.map((post: any) => mapDiscoursePost(post, includeRaw))
      }
    }

    case 'discourse.send_timings': {
      const baseUrl = getBaseUrl(args)
      const topicId = positiveInteger(args.topicId, 'topicId')
      const timeMs = boundedNumber(args.timeMs, 10000, 1000, 30 * 60 * 1000)
      const postNumbers = Array.isArray(args.postNumbers) ? args.postNumbers : [1]
      await sendDiscourseTimings(baseUrl, topicId, postNumbers, timeMs)
      return { success: true, topicId, timeMs }
    }

    case 'discourse.create_post': {
      const baseUrl = getBaseUrl(args)
      const topicId = positiveInteger(args.topicId, 'topicId')
      const raw = String(args.raw || '')
      const replyToPostNumber = args.replyToPostNumber
        ? positiveInteger(args.replyToPostNumber, 'replyToPostNumber')
        : undefined
      if (!raw.trim()) throw new Error('缺少回复内容 raw')

      const body: Record<string, any> = { topic_id: topicId, raw }
      if (replyToPostNumber) body.reply_to_post_number = replyToPostNumber
      const data = await discourseRequest<any>(
        baseUrl,
        '/posts.json',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        },
        { csrf: true }
      )

      return {
        success: true,
        post: {
          id: data?.id,
          post_number: data?.post_number,
          topic_id: data?.topic_id,
          created_at: data?.created_at
        }
      }
    }

    case 'discourse.like_topic': {
      const baseUrl = getBaseUrl(args)
      const topicId = positiveInteger(args.topicId, 'topicId')
      const reactionId = String(args.reactionId || 'heart')
      const topic = await fetchDiscourseTopic(baseUrl, topicId)
      const firstPost = topic?.post_stream?.posts?.[0]
      if (!firstPost?.id) throw new Error('未找到首帖')
      const result = await ensureDiscoursePostLiked(baseUrl, Number(firstPost.id), reactionId)
      return { success: true, topicId, postId: Number(firstPost.id), ...result }
    }

    case 'discourse.unlike_post': {
      const baseUrl = getBaseUrl(args)
      const postId = positiveInteger(args.postId, 'postId')
      const reactionId = String(args.reactionId || 'heart')
      const result = await ensureDiscoursePostUnliked(baseUrl, postId, reactionId)
      return { success: true, postId, ...result }
    }

    case 'discourse.bookmark_post': {
      const baseUrl = getBaseUrl(args)
      const postId = positiveInteger(args.postId, 'postId')
      const name = args.name ? String(args.name) : undefined
      const data = await discourseRequest<any>(
        baseUrl,
        '/bookmarks.json',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ post_id: postId, name })
        },
        { csrf: true }
      )
      return { success: true, bookmark: data }
    }

    case 'discourse.unbookmark_post': {
      const baseUrl = getBaseUrl(args)
      const postId = positiveInteger(args.postId, 'postId')
      const postData = await fetchDiscoursePost(baseUrl, postId)
      const bookmarkId = postData?.bookmark_id
      if (!bookmarkId) return { success: true, alreadyUnbookmarked: true }
      await discourseRequest(
        baseUrl,
        `/bookmarks/${bookmarkId}.json`,
        { method: 'DELETE' },
        { csrf: true }
      )
      return { success: true }
    }

    case 'discourse.get_user_activity': {
      const baseUrl = getBaseUrl(args)
      const username = String(args.username || '').trim()
      const filter = String(args.filter || '4,5')
      const limit = Math.floor(boundedNumber(args.limit, 20, 1, 100))
      const offset = Math.floor(boundedNumber(args.offset, 0, 0, 100000))
      if (!username) throw new Error('缺少 username')

      const params = new URLSearchParams({ username, filter, limit: String(limit) })
      if (offset > 0) params.set('offset', String(offset))
      const data = await discourseRequest<any>(baseUrl, `/user_actions.json?${params.toString()}`)
      return {
        success: true,
        offset,
        limit,
        user_actions: (data?.user_actions || []).map((action: any) => ({
          post_id: action.post_id,
          post_number: action.post_number,
          topic_id: action.topic_id,
          topic_title: action.title,
          action_type: action.action_type,
          username: action.username,
          acting_username: action.acting_username,
          created_at: action.created_at,
          excerpt: action.excerpt
        }))
      }
    }

    case 'discourse.browse_topic': {
      const baseUrl = getBaseUrl(args)
      const topicId = positiveInteger(args.topicId, 'topicId')
      const readTimeMs = boundedNumber(args.readTimeMs, 10000, 1000, 30 * 60 * 1000)
      const shouldLike = Boolean(args.like)
      const maxPosts = Math.floor(boundedNumber(args.maxPosts, 200, 1, 2000))
      const { topic, posts, stream, truncated } = await fetchDiscourseTopicWithPosts(
        baseUrl,
        topicId,
        { maxPosts }
      )

      const postNumbers = posts
        .map((post: any) => Number(post.post_number))
        .filter((postNumber: number) => Number.isFinite(postNumber) && postNumber > 0)

      let timingsSent = false
      let timingError: string | undefined
      try {
        await sendDiscourseTimings(baseUrl, topicId, postNumbers, readTimeMs)
        timingsSent = true
      } catch (error) {
        timingError = error instanceof Error ? error.message : String(error)
      }

      let liked = false
      let likePostId: number | undefined
      let likeError: string | undefined
      if (shouldLike) {
        const unlikedPost = posts.find((post: any) => !isDiscoursePostLiked(post))
        if (unlikedPost?.id) {
          try {
            const result = await ensureDiscoursePostLiked(
              baseUrl,
              Number(unlikedPost.id),
              'heart'
            )
            liked = result.liked
            likePostId = Number(unlikedPost.id)
          } catch (error) {
            likeError = error instanceof Error ? error.message : String(error)
          }
        }
      }

      return {
        success: true,
        topic: {
          id: topic.id,
          title: topic.title,
          slug: topic.slug,
          posts_count: topic.posts_count,
          category_id: topic.category_id,
          tags: topic.tags
        },
        browsing: {
          readTimeMs,
          loadedPosts: posts.length,
          totalPostIds: stream.length,
          truncated,
          timingsSent,
          timingError
        },
        liked,
        likePostId,
        likeError
      }
    }

    case 'discourse.search': {
      const baseUrl = getBaseUrl(args)
      const query = String(args.q || args.query || '').trim()
      const page = optionalPage(args.page)
      const type = args.type ? String(args.type) : ''
      if (!query) throw new Error('缺少搜索关键词 q')

      const params = new URLSearchParams({ q: query })
      if (page > 0) params.set('page', String(page))
      if (type) params.set('type', type)
      const data = await discourseRequest<any>(baseUrl, `/search.json?${params.toString()}`)

      return {
        success: true,
        query,
        page,
        grouped_search_result: data?.grouped_search_result,
        topics: (data?.topics || []).map(mapTopicSummary),
        posts: (data?.posts || []).map((post: any) => ({
          id: post.id,
          topic_id: post.topic_id,
          post_number: post.post_number,
          username: post.username,
          created_at: post.created_at,
          blurb: post.blurb,
          like_count: post.like_count
        })),
        users: data?.users || [],
        categories: data?.categories || [],
        tags: data?.tags || []
      }
    }

    default:
      throw new Error(`未知 Discourse 工具：${toolName}`)
  }
}
