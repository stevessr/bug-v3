import { getChromeAPI } from '../utils/main'

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

function pathSegment(value: unknown, name: string): string {
  const text = String(value || '').trim()
  if (!text) throw new Error(`缺少 ${name}`)
  return encodeURIComponent(text)
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

function getNextPage(moreTopicsUrl: unknown): number | null {
  if (typeof moreTopicsUrl !== 'string' || !moreTopicsUrl) return null
  try {
    const parsed = new URL(moreTopicsUrl, 'https://discourse.invalid')
    const page = Number(parsed.searchParams.get('page'))
    return Number.isFinite(page) && page >= 0 ? Math.floor(page) : null
  } catch {
    return null
  }
}

function mapTopicList(data: any) {
  const topicList = data?.topic_list || {}
  const topics = Array.isArray(topicList.topics) ? topicList.topics : []
  const nextPage = getNextPage(topicList.more_topics_url)
  return {
    can_create_topic: topicList.can_create_topic,
    more_topics_url: topicList.more_topics_url,
    per_page: topicList.per_page,
    cursor: {
      has_more: Boolean(topicList.more_topics_url),
      next_page: nextPage
    },
    topics: topics.map(mapTopicSummary)
  }
}

function buildReplyEdges(posts: any[]) {
  return posts
    .map(post => {
      const from = Number(post?.post_number)
      const to = Number(post?.reply_to_post_number)
      if (!Number.isFinite(from) || from <= 0 || !Number.isFinite(to) || to <= 0) return null
      return { from_post_number: from, to_post_number: to }
    })
    .filter(Boolean)
}

function buildParticipants(posts: any[]): string[] {
  return [
    ...new Set(
      posts
        .map(post => String(post?.username || '').trim())
        .filter(Boolean)
    )
  ]
}

type DiscourseRoute =
  | { kind: 'topic'; topicId: number; postNumber?: number }
  | { kind: 'category'; slug: string; categoryId: number; filter?: string }
  | { kind: 'tag'; tag: string }
  | { kind: 'user'; username: string }
  | { kind: 'feed'; strategy: BrowseStrategy }
  | { kind: 'search'; query: string }
  | { kind: 'other'; pathname: string }

function parseDiscourseRoute(url: string): DiscourseRoute {
  const parsed = new URL(url)
  const pathname = parsed.pathname.replace(/\/+$/, '') || '/'

  const topicMatch = pathname.match(/^\/t\/(?:[^/]+\/)?(\d+)(?:\/(\d+))?(?:\/|$)/)
  if (topicMatch) {
    return {
      kind: 'topic',
      topicId: Number(topicMatch[1]),
      postNumber: topicMatch[2] ? Number(topicMatch[2]) : undefined
    }
  }

  const categoryMatch = pathname.match(/^\/c\/([^/]+)\/(\d+)(?:\/l\/([^/]+))?(?:\/|$)/)
  if (categoryMatch) {
    return {
      kind: 'category',
      slug: decodeURIComponent(categoryMatch[1]),
      categoryId: Number(categoryMatch[2]),
      filter: categoryMatch[3] ? decodeURIComponent(categoryMatch[3]) : undefined
    }
  }

  const tagMatch = pathname.match(/^\/tag\/([^/]+)(?:\/|$)/)
  if (tagMatch) return { kind: 'tag', tag: decodeURIComponent(tagMatch[1]) }

  const userMatch = pathname.match(/^\/u\/([^/]+)(?:\/|$)/)
  if (userMatch) return { kind: 'user', username: decodeURIComponent(userMatch[1]) }

  if (pathname === '/new') return { kind: 'feed', strategy: 'new' }
  if (pathname === '/unread') return { kind: 'feed', strategy: 'unread' }
  if (pathname === '/top') return { kind: 'feed', strategy: 'top' }
  if (pathname === '/' || pathname === '/latest') return { kind: 'feed', strategy: 'latest' }

  if (pathname === '/search') {
    return { kind: 'search', query: parsed.searchParams.get('q') || '' }
  }

  return { kind: 'other', pathname }
}

async function getTargetTab(args: Record<string, any>): Promise<chrome.tabs.Tab> {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI?.tabs) throw new Error('浏览器 tabs API 不可用')

  const requestedTabId = Number(args.tabId || 0)
  if (requestedTabId > 0 && chromeAPI.tabs.get) {
    const tab = await chromeAPI.tabs.get(requestedTabId)
    if (!tab?.url) throw new Error(`标签页 ${requestedTabId} 没有可读取 URL`)
    return tab
  }

  const tabs = await chromeAPI.tabs.query({ active: true, lastFocusedWindow: true })
  const tab = tabs[0]
  if (!tab?.url) throw new Error('没有可读取的活动标签页')
  return tab
}

async function getCurrentPageContext(args: Record<string, any>) {
  const tab = await getTargetTab(args)
  const tabUrl = new URL(String(tab.url))
  if (!['http:', 'https:'].includes(tabUrl.protocol)) {
    throw new Error(`当前标签页不是 HTTP(S) 页面：${tabUrl.protocol}`)
  }

  const baseUrl = args.baseUrl
    ? normalizeDiscourseBaseUrl(String(args.baseUrl))
    : normalizeDiscourseBaseUrl(tabUrl.origin)
  if (new URL(baseUrl).origin !== tabUrl.origin) {
    throw new Error('baseUrl 与当前标签页 origin 不一致')
  }

  const route = parseDiscourseRoute(tabUrl.toString())
  const includeRaw = Boolean(args.includeRaw)
  const maxPosts = Math.floor(boundedNumber(args.maxPosts, 40, 1, 200))
  const source = {
    tab_id: tab.id,
    title: tab.title,
    url: tab.url,
    base_url: baseUrl
  }

  if (route.kind === 'topic') {
    const params = new URLSearchParams()
    if (route.postNumber) params.set('post_number', String(route.postNumber))
    if (includeRaw) params.set('include_raw', '1')
    const suffix = params.size ? `?${params.toString()}` : ''
    const data = await discourseRequest<any>(baseUrl, `/t/${route.topicId}.json${suffix}`)
    const rawPosts = Array.isArray(data?.post_stream?.posts) ? data.post_stream.posts : []
    const posts = rawPosts.slice(0, maxPosts)
    return {
      success: true,
      source,
      route,
      context: {
        topic: {
          id: data.id,
          title: data.title,
          fancy_title: data.fancy_title,
          slug: data.slug,
          posts_count: data.posts_count,
          reply_count: data.reply_count,
          category_id: data.category_id,
          tags: data.tags,
          created_at: data.created_at,
          last_posted_at: data.last_posted_at
        },
        anchor_post_number: route.postNumber || null,
        posts: posts.map((post: any) => mapDiscoursePost(post, includeRaw)),
        reply_edges: buildReplyEdges(posts),
        participants: buildParticipants(posts)
      }
    }
  }

  if (route.kind === 'category') {
    const filterPath = route.filter ? `/l/${encodeURIComponent(route.filter)}` : ''
    const data = await discourseRequest<any>(
      baseUrl,
      `/c/${encodeURIComponent(route.slug)}/${route.categoryId}${filterPath}.json`
    )
    return {
      success: true,
      source,
      route,
      context: {
        category: data?.category || { id: route.categoryId, slug: route.slug },
        ...mapTopicList(data)
      }
    }
  }

  if (route.kind === 'tag') {
    const data = await discourseRequest<any>(baseUrl, `/tag/${encodeURIComponent(route.tag)}.json`)
    return { success: true, source, route, context: mapTopicList(data) }
  }

  if (route.kind === 'user') {
    const data = await discourseRequest<any>(baseUrl, `/u/${encodeURIComponent(route.username)}.json`)
    const user = data?.user || data
    return {
      success: true,
      source,
      route,
      context: {
        user: {
          id: user?.id,
          username: user?.username,
          name: user?.name,
          title: user?.title,
          trust_level: user?.trust_level,
          avatar_template: user?.avatar_template,
          created_at: user?.created_at,
          last_seen_at: user?.last_seen_at,
          post_count: user?.post_count,
          topic_count: user?.topic_count,
          bio_cooked: user?.bio_cooked,
          primary_group_name: user?.primary_group_name
        }
      }
    }
  }

  if (route.kind === 'feed') {
    const data = await fetchDiscourseTopicList(baseUrl, route.strategy, 0)
    return { success: true, source, route, context: mapTopicList(data) }
  }

  if (route.kind === 'search' && route.query) {
    const params = new URLSearchParams({ q: route.query })
    const data = await discourseRequest<any>(baseUrl, `/search.json?${params.toString()}`)
    return {
      success: true,
      source,
      route,
      context: {
        topics: (data?.topics || []).map(mapTopicSummary),
        posts: (data?.posts || []).slice(0, maxPosts).map((post: any) => ({
          id: post.id,
          topic_id: post.topic_id,
          post_number: post.post_number,
          username: post.username,
          created_at: post.created_at,
          blurb: post.blurb,
          like_count: post.like_count
        }))
      }
    }
  }

  let basic: any = null
  try {
    basic = await discourseRequest<any>(baseUrl, '/site/basic-info.json')
  } catch {
    await discourseRequest<any>(baseUrl, '/site.json')
  }
  return {
    success: true,
    source,
    route,
    context: basic
      ? { site: { title: basic.title, description: basic.description, logo_url: basic.logo_url } }
      : { site: { detected: true } }
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

    case 'discourse.get_current_page':
      return getCurrentPageContext(args)

    case 'discourse.get_topic_list': {
      const baseUrl = getBaseUrl(args)
      const strategy = (args.strategy || 'latest') as BrowseStrategy
      const page = optionalPage(args.page)
      const data = await fetchDiscourseTopicList(baseUrl, strategy, page)
      return {
        success: true,
        strategy,
        page,
        ...mapTopicList(data)
      }
    }

    case 'discourse.get_site_info': {
      const baseUrl = getBaseUrl(args)
      const site = await discourseRequest<any>(baseUrl, '/site.json')
      let basic: any = null
      try {
        basic = await discourseRequest<any>(baseUrl, '/site/basic-info.json')
      } catch {
        // Older/custom Discourse installs may not expose the basic-info endpoint.
      }

      const categories = Array.isArray(site?.categories) ? site.categories : []
      return {
        success: true,
        basic: basic
          ? {
              title: basic.title,
              description: basic.description,
              logo_url: basic.logo_url,
              logo_small_url: basic.logo_small_url,
              mobile_logo_url: basic.mobile_logo_url,
              apple_touch_icon_url: basic.apple_touch_icon_url,
              favicon_url: basic.favicon_url
            }
          : null,
        capabilities: {
          can_create_tag: site?.can_create_tag,
          can_tag_topics: site?.can_tag_topics,
          can_create_topic: site?.can_create_topic,
          can_create_post: site?.can_create_post,
          tags_filter_regexp: site?.tags_filter_regexp
        },
        categories: categories.map((category: any) => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
          color: category.color,
          text_color: category.text_color,
          parent_category_id: category.parent_category_id,
          topic_count: category.topic_count,
          post_count: category.post_count,
          read_restricted: category.read_restricted
        })),
        top_tags: site?.top_tags || [],
        trust_levels: site?.trust_levels || [],
        post_action_types: site?.post_action_types || [],
        auth_providers: site?.auth_providers || []
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
      const nextPostOffset = truncated ? posts.length : null

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
          truncated,
          next_post_offset: nextPostOffset
        },
        reply_edges: buildReplyEdges(posts),
        participants: buildParticipants(posts),
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

      const loaded = posts.filter(Boolean)
      return {
        success: true,
        topicId,
        reply_edges: buildReplyEdges(loaded),
        participants: buildParticipants(loaded),
        posts: loaded
      }
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

    case 'discourse.get_category_topics': {
      const baseUrl = getBaseUrl(args)
      const slug = pathSegment(args.slug || args.categorySlug, 'slug')
      const categoryId = positiveInteger(args.categoryId, 'categoryId')
      const page = optionalPage(args.page)
      const filter = String(args.filter || '').trim()
      const allowedFilters = new Set([
        'latest',
        'unread',
        'new',
        'unseen',
        'top',
        'read',
        'posted',
        'bookmarks'
      ])
      if (filter && !allowedFilters.has(filter)) throw new Error(`不支持的分类过滤器：${filter}`)

      const params = new URLSearchParams()
      if (page > 0) params.set('page', String(page))
      const suffix = params.size ? `?${params.toString()}` : ''
      const filterPath = filter ? `/l/${filter}` : ''
      const data = await discourseRequest<any>(
        baseUrl,
        `/c/${slug}/${categoryId}${filterPath}.json${suffix}`
      )

      return {
        success: true,
        category: data?.category
          ? {
              id: data.category.id,
              name: data.category.name,
              slug: data.category.slug,
              description_text: data.category.description_text,
              parent_category_id: data.category.parent_category_id,
              topic_count: data.category.topic_count
            }
          : { id: categoryId, slug: decodeURIComponent(slug) },
        filter: filter || null,
        page,
        ...mapTopicList(data)
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
          name: tag.name || tag.text,
          text: tag.text,
          topic_count: tag.topic_count ?? tag.count,
          count: tag.count,
          pm_count: tag.pm_count,
          target_tag: tag.target_tag,
          staff: tag.staff
        }))
      }
    }

    case 'discourse.get_tag_topics': {
      const baseUrl = getBaseUrl(args)
      const tag = pathSegment(args.tag || args.name, 'tag')
      const page = optionalPage(args.page)
      const params = new URLSearchParams()
      if (page > 0) params.set('page', String(page))
      const suffix = params.size ? `?${params.toString()}` : ''
      const data = await discourseRequest<any>(baseUrl, `/tag/${tag}.json${suffix}`)
      return {
        success: true,
        tag: decodeURIComponent(tag),
        page,
        ...mapTopicList(data)
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

    case 'discourse.get_user': {
      const baseUrl = getBaseUrl(args)
      const username = pathSegment(args.username, 'username')
      const data = await discourseRequest<any>(baseUrl, `/u/${username}.json`)
      const user = data?.user || data
      return {
        success: true,
        user: {
          id: user?.id,
          username: user?.username,
          name: user?.name,
          avatar_template: user?.avatar_template,
          title: user?.title,
          trust_level: user?.trust_level,
          moderator: user?.moderator,
          admin: user?.admin,
          staged: user?.staged,
          created_at: user?.created_at,
          last_seen_at: user?.last_seen_at,
          last_posted_at: user?.last_posted_at,
          post_count: user?.post_count,
          topic_count: user?.topic_count,
          time_read: user?.time_read,
          recent_time_read: user?.recent_time_read,
          likes_received: user?.likes_received,
          likes_given: user?.likes_given,
          bio_cooked: user?.bio_cooked,
          location: user?.location,
          website_name: user?.website_name,
          website: user?.website,
          primary_group_name: user?.primary_group_name,
          flair_group_id: user?.flair_group_id,
          featured_user_badge_ids: user?.featured_user_badge_ids,
          user_fields: user?.user_fields
        }
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
        reply_edges: buildReplyEdges(posts),
        participants: buildParticipants(posts),
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
        cursor: {
          next_offset: (data?.user_actions || []).length >= limit ? offset + limit : null,
          has_more: (data?.user_actions || []).length >= limit
        },
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
          nextPostOffset: truncated ? posts.length : null,
          timingsSent,
          timingError
        },
        reply_edges: buildReplyEdges(posts),
        participants: buildParticipants(posts),
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

      const grouped = data?.grouped_search_result || {}
      return {
        success: true,
        query,
        page,
        cursor: {
          has_more: Boolean(grouped?.more_posts || grouped?.more_users || grouped?.more_categories),
          next_page: grouped?.more_posts || grouped?.more_users ? page + 1 : null
        },
        grouped_search_result: grouped,
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
