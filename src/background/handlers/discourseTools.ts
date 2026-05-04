import { getChromeAPI } from '../utils/main'

import type { BrowseStrategy } from '@/types/type'

async function getDiscourseCsrfToken(baseUrl: string): Promise<string> {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI) return ''

  let host = ''
  let origin = ''
  try {
    const parsed = new URL(baseUrl)
    host = parsed.hostname
    origin = parsed.origin
  } catch {
    return ''
  }

  try {
    if (chromeAPI.cookies?.getAll) {
      const cookies = await chromeAPI.cookies.getAll({ domain: host })
      const tokenCookie = cookies.find((cookie: any) =>
        ['csrf_token', 'XSRF-TOKEN', '_csrf'].includes(cookie.name)
      )
      if (tokenCookie?.value) return tokenCookie.value
    }
  } catch {
    // ignore cookie failures
  }

  try {
    if (chromeAPI.tabs?.query) {
      const tabs = await chromeAPI.tabs.query({ url: `${origin}/*` })
      for (const tab of tabs) {
        if (!tab.id) continue
        try {
          const resp = await chromeAPI.tabs.sendMessage(tab.id, { type: 'GET_CSRF_TOKEN' })
          if (resp?.csrfToken) return resp.csrfToken
        } catch {
          continue
        }
      }
    }
  } catch {
    // ignore tab failures
  }

  return ''
}

async function buildDiscourseHeaders(
  baseUrl: string,
  headers: Record<string, string>
): Promise<Record<string, string>> {
  const csrfToken = await getDiscourseCsrfToken(baseUrl)
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken
  return headers
}

function isDiscoursePostLiked(post: any): boolean {
  if (post?.current_user_reaction) return true
  if (Array.isArray(post?.actions_summary)) {
    const likeAction = post.actions_summary.find((a: any) => a.id === 2)
    if (likeAction?.acted) return true
  }
  return false
}

async function fetchDiscoursePost(baseUrl: string, postId: number): Promise<any> {
  const postUrl = `${baseUrl}/posts/${postId}.json`
  const postResp = await fetch(postUrl, {
    credentials: 'include',
    headers: { Accept: 'application/json' }
  })
  if (!postResp.ok) {
    throw new Error(`获取帖子失败：HTTP ${postResp.status}`)
  }
  return postResp.json()
}

async function toggleDiscourseReaction(
  baseUrl: string,
  postId: number,
  reactionId: string
): Promise<{ ok: boolean; data?: any }> {
  const url = `${baseUrl}/discourse-reactions/posts/${postId}/custom-reactions/${reactionId}/toggle.json`
  const headers = await buildDiscourseHeaders(baseUrl, {
    'X-Requested-With': 'XMLHttpRequest',
    'Content-Type': 'application/json',
    'Discourse-Logged-In': 'true'
  })
  const response = await fetch(url, {
    method: 'PUT',
    credentials: 'include',
    headers
  })
  const data = await response.json().catch(() => null)
  return { ok: response.ok, data }
}

export async function handleDiscourseTool(
  toolName: string,
  args: Record<string, any>
): Promise<any> {
  switch (toolName) {
    // ========== Discourse 工具 ==========

    case 'discourse.like_post': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const postId = Number(args.postId)
      if (!postId) throw new Error('缺少 postId')
      const reactionId = String(args.reactionId || 'heart')

      const url = `${baseUrl}/discourse-reactions/posts/${postId}/custom-reactions/${reactionId}/toggle.json`
      const headers = await buildDiscourseHeaders(baseUrl, {
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json',
        'Discourse-Logged-In': 'true'
      })
      const response = await fetch(url, {
        method: 'PUT',
        credentials: 'include',
        headers
      })

      if (!response.ok) {
        throw new Error(`点赞失败：HTTP ${response.status}`)
      }

      const data = await response.json()
      return { success: true, data }
    }

    case 'discourse.get_topic_list': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const strategy = (args.strategy || 'latest') as BrowseStrategy
      const page = Number(args.page || 0)

      const endpoints: Record<string, string> = {
        latest: '/latest.json',
        new: '/new.json',
        unread: '/unread.json',
        top: '/top.json'
      }

      const endpoint = endpoints[strategy] || endpoints.latest
      const url = `${baseUrl}${endpoint}?page=${page}`

      const response = await fetch(url, {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      })

      if (!response.ok) {
        throw new Error(`获取话题列表失败：HTTP ${response.status}`)
      }

      const data = await response.json()
      const topics = data.topic_list?.topics || []
      return {
        topics: topics.map((t: any) => ({
          id: t.id,
          title: t.title,
          slug: t.slug,
          posts_count: t.posts_count,
          views: t.views,
          like_count: t.like_count,
          created_at: t.created_at,
          last_posted_at: t.last_posted_at
        }))
      }
    }

    case 'discourse.get_topic': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const topicId = Number(args.topicId)
      if (!topicId) throw new Error('缺少 topicId')

      const url = `${baseUrl}/t/${topicId}.json`
      const response = await fetch(url, {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      })

      if (!response.ok) {
        throw new Error(`获取话题失败：HTTP ${response.status}`)
      }

      const data = await response.json()
      return {
        id: data.id,
        title: data.title,
        slug: data.slug,
        posts_count: data.posts_count,
        views: data.views,
        like_count: data.like_count,
        posts:
          data.post_stream?.posts?.map((p: any) => ({
            id: p.id,
            post_number: p.post_number,
            username: p.username,
            created_at: p.created_at,
            cooked: p.cooked,
            liked: !!(
              p.current_user_reaction || p.actions_summary?.find((a: any) => a.id === 2 && a.acted)
            )
          })) || []
      }
    }

    case 'discourse.get_post': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const postId = Number(args.postId)
      const includeRaw = Boolean(args.includeRaw)
      if (!postId) throw new Error('缺少 postId')

      const data = await fetchDiscoursePost(baseUrl, postId)
      return {
        id: data.id,
        topic_id: data.topic_id,
        post_number: data.post_number,
        username: data.username,
        created_at: data.created_at,
        cooked: data.cooked,
        raw: includeRaw ? data.raw : undefined,
        liked: isDiscoursePostLiked(data)
      }
    }

    case 'discourse.get_topic_posts': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const topicId = Number(args.topicId)
      const includeRaw = Boolean(args.includeRaw)
      const postNumbers = Array.isArray(args.postNumbers) ? args.postNumbers : []

      if (!topicId) throw new Error('缺少 topicId')
      if (postNumbers.length === 0) throw new Error('缺少 postNumbers')

      const requests = postNumbers.map(async (postNumber: number) => {
        const topicUrl = new URL(`${baseUrl}/t/${topicId}.json`)
        topicUrl.searchParams.set('post_number', String(postNumber))
        if (includeRaw) topicUrl.searchParams.set('include_raw', '1')

        const response = await fetch(topicUrl.toString(), {
          credentials: 'include',
          headers: { Accept: 'application/json' }
        })
        if (!response.ok) {
          throw new Error(`获取楼层 ${postNumber} 失败：HTTP ${response.status}`)
        }
        const data = await response.json()
        const post = (data.post_stream?.posts || []).find((p: any) => p.post_number === postNumber)
        if (!post) return null
        return {
          id: post.id,
          post_number: post.post_number,
          username: post.username,
          created_at: post.created_at,
          cooked: post.cooked,
          raw: includeRaw ? post.raw : undefined,
          liked: isDiscoursePostLiked(post)
        }
      })

      const posts = (await Promise.all(requests)).filter(Boolean)
      return { success: true, topicId, posts }
    }

    case 'discourse.get_category_list': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const url = `${baseUrl}/categories.json`
      const response = await fetch(url, {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      })
      if (!response.ok) {
        throw new Error(`获取分类失败：HTTP ${response.status}`)
      }
      const data = await response.json()
      const categories = data.category_list?.categories || []
      return {
        categories: categories.map((c: any) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          topic_count: c.topic_count,
          post_count: c.post_count
        }))
      }
    }

    case 'discourse.get_tag_list': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const url = `${baseUrl}/tags.json`
      const response = await fetch(url, {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      })
      if (!response.ok) {
        throw new Error(`获取标签失败：HTTP ${response.status}`)
      }
      const data = await response.json()
      const tags = data.tags || []
      return {
        tags: tags.map((t: any) => ({
          id: t.id,
          name: t.name,
          topic_count: t.topic_count
        }))
      }
    }

    case 'discourse.search_user': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const term = String(args.term || '').trim()
      if (!term) throw new Error('缺少 term')

      const url = `${baseUrl}/u/search/users.json?term=${encodeURIComponent(term)}`
      const response = await fetch(url, {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      })
      if (!response.ok) {
        throw new Error(`搜索用户失败：HTTP ${response.status}`)
      }
      const data = await response.json()
      const users = data.users || []
      return {
        users: users.map((u: any) => ({
          id: u.id,
          username: u.username,
          name: u.name,
          avatar_template: u.avatar_template
        }))
      }
    }

    case 'discourse.get_notifications': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const page = Number(args.page || 0)
      const url = new URL(`${baseUrl}/notifications.json`)
      if (page > 0) url.searchParams.set('page', String(page))
      const response = await fetch(url.toString(), {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      })
      if (!response.ok) {
        throw new Error(`获取通知失败：HTTP ${response.status}`)
      }
      const data = await response.json()
      return { notifications: data.notifications || [] }
    }

    case 'discourse.get_bookmarks': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const page = Number(args.page || 0)
      const url = new URL(`${baseUrl}/bookmarks.json`)
      if (page > 0) url.searchParams.set('page', String(page))
      const response = await fetch(url.toString(), {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      })
      if (!response.ok) {
        throw new Error(`获取书签失败：HTTP ${response.status}`)
      }
      const data = await response.json()
      return { bookmarks: data.bookmarks || [] }
    }

    case 'discourse.get_post_context': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const postId = Number(args.postId)
      const includeRaw = Boolean(args.includeRaw)
      let topicId = Number(args.topicId || 0)
      let postNumber = Number(args.postNumber || 0)

      if (!postId) throw new Error('缺少 postId')

      if (!topicId || !postNumber) {
        const postUrl = `${baseUrl}/posts/${postId}.json`
        const postResp = await fetch(postUrl, {
          credentials: 'include',
          headers: { Accept: 'application/json' }
        })
        if (!postResp.ok) {
          throw new Error(`获取帖子失败：HTTP ${postResp.status}`)
        }
        const postData = await postResp.json()
        topicId = Number(postData.topic_id || 0)
        postNumber = Number(postData.post_number || 0)
        if (!topicId || !postNumber) {
          throw new Error('无法解析 topicId 或 postNumber')
        }
      }

      const topicUrl = new URL(`${baseUrl}/t/${topicId}.json`)
      topicUrl.searchParams.set('post_number', String(postNumber))
      if (includeRaw) topicUrl.searchParams.set('include_raw', '1')

      const topicResp = await fetch(topicUrl.toString(), {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      })

      if (!topicResp.ok) {
        throw new Error(`获取上下文失败：HTTP ${topicResp.status}`)
      }

      const data = await topicResp.json()
      const posts = data.post_stream?.posts || []
      return {
        success: true,
        topic: {
          id: data.id,
          title: data.title,
          slug: data.slug,
          posts_count: data.posts_count
        },
        anchor: { postId, postNumber, topicId },
        posts: posts.map((p: any) => ({
          id: p.id,
          post_number: p.post_number,
          username: p.username,
          created_at: p.created_at,
          cooked: p.cooked,
          raw: includeRaw ? p.raw : undefined,
          liked: !!(
            p.current_user_reaction || p.actions_summary?.find((a: any) => a.id === 2 && a.acted)
          )
        }))
      }
    }

    case 'discourse.send_timings': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const topicId = Number(args.topicId)
      const timeMs = Number(args.timeMs || 10000)
      const postNumbers = Array.isArray(args.postNumbers) ? args.postNumbers : [1]

      if (!topicId) throw new Error('缺少 topicId')

      const timings: Record<string, number> = {}
      postNumbers.forEach((pn: number) => {
        timings[String(pn)] = timeMs
      })

      const url = `${baseUrl}/topics/timings`
      const headers = await buildDiscourseHeaders(baseUrl, {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        'Discourse-Logged-In': 'true'
      })
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: new URLSearchParams({
          topic_id: String(topicId),
          topic_time: String(timeMs),
          timings: JSON.stringify(timings)
        }).toString()
      })

      return { success: response.ok }
    }

    case 'discourse.create_post': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const topicId = Number(args.topicId)
      const raw = String(args.raw || '')
      const replyToPostNumber = args.replyToPostNumber ? Number(args.replyToPostNumber) : undefined

      if (!topicId) throw new Error('缺少 topicId')
      if (!raw.trim()) throw new Error('缺少回复内容 raw')

      const url = `${baseUrl}/posts.json`
      const body: Record<string, any> = {
        topic_id: topicId,
        raw: raw
      }
      if (replyToPostNumber) {
        body.reply_to_post_number = replyToPostNumber
      }

      const headers = await buildDiscourseHeaders(baseUrl, {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'Discourse-Logged-In': 'true'
      })
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.errors?.join(', ') || `回复失败：HTTP ${response.status}`)
      }

      const data = await response.json()
      return {
        success: true,
        post: {
          id: data.id,
          post_number: data.post_number,
          topic_id: data.topic_id,
          created_at: data.created_at
        }
      }
    }

    case 'discourse.like_topic': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const topicId = Number(args.topicId)
      const reactionId = String(args.reactionId || 'heart')
      if (!topicId) throw new Error('缺少 topicId')

      const topicUrl = `${baseUrl}/t/${topicId}.json`
      const topicResponse = await fetch(topicUrl, {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      })
      if (!topicResponse.ok) {
        throw new Error(`获取话题失败：HTTP ${topicResponse.status}`)
      }

      const topicData = await topicResponse.json()
      const firstPost = topicData.post_stream?.posts?.[0]
      if (!firstPost?.id) throw new Error('未找到首帖')

      if (isDiscoursePostLiked(firstPost)) {
        return { success: true, liked: true, alreadyLiked: true, postId: firstPost.id }
      }

      const result = await toggleDiscourseReaction(baseUrl, firstPost.id, reactionId)
      if (!result.ok) {
        throw new Error('点赞失败')
      }
      return { success: true, liked: true, postId: firstPost.id, data: result.data }
    }

    case 'discourse.unlike_post': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const postId = Number(args.postId)
      const reactionId = String(args.reactionId || 'heart')
      if (!postId) throw new Error('缺少 postId')

      const postData = await fetchDiscoursePost(baseUrl, postId)
      if (!isDiscoursePostLiked(postData)) {
        return { success: true, liked: false, alreadyUnliked: true }
      }

      const result = await toggleDiscourseReaction(baseUrl, postId, reactionId)
      if (!result.ok) {
        throw new Error('取消点赞失败')
      }
      return { success: true, liked: false, data: result.data }
    }

    case 'discourse.bookmark_post': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const postId = Number(args.postId)
      const name = args.name ? String(args.name) : undefined
      if (!postId) throw new Error('缺少 postId')

      const headers = await buildDiscourseHeaders(baseUrl, {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'Discourse-Logged-In': 'true'
      })

      const response = await fetch(`${baseUrl}/bookmarks.json`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ post_id: postId, name })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.errors?.join(', ') || `书签失败：HTTP ${response.status}`)
      }

      const data = await response.json()
      return { success: true, bookmark: data }
    }

    case 'discourse.unbookmark_post': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const postId = Number(args.postId)
      if (!postId) throw new Error('缺少 postId')

      const postData = await fetchDiscoursePost(baseUrl, postId)
      const bookmarkId = postData?.bookmark_id
      if (!bookmarkId) {
        return { success: true, alreadyUnbookmarked: true }
      }

      const headers = await buildDiscourseHeaders(baseUrl, {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'Discourse-Logged-In': 'true'
      })

      const response = await fetch(`${baseUrl}/bookmarks/${bookmarkId}.json`, {
        method: 'DELETE',
        credentials: 'include',
        headers
      })

      if (!response.ok) {
        throw new Error(`取消书签失败：HTTP ${response.status}`)
      }

      return { success: true }
    }

    case 'discourse.get_user_activity': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const username = String(args.username || '')
      const filter = String(args.filter || '4,5')
      const limit = Number(args.limit || 20)
      const offset = Number(args.offset || 0)

      if (!username) throw new Error('缺少 username')

      const url = new URL(`${baseUrl}/user_actions.json`)
      url.searchParams.set('username', username)
      url.searchParams.set('filter', filter)
      url.searchParams.set('limit', String(limit))
      if (offset > 0) url.searchParams.set('offset', String(offset))
      const response = await fetch(url, {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      })

      if (!response.ok) {
        throw new Error(`获取用户活动失败：HTTP ${response.status}`)
      }

      const data = await response.json()
      return {
        success: true,
        offset,
        limit,
        user_actions: (data.user_actions || []).map((a: any) => ({
          post_id: a.post_id,
          post_number: a.post_number,
          topic_id: a.topic_id,
          topic_title: a.title,
          action_type: a.action_type,
          created_at: a.created_at
        }))
      }
    }

    case 'discourse.browse_topic': {
      // 综合浏览话题：获取详情 + 发送阅读时间 + 可选点赞
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const topicId = Number(args.topicId)
      const readTimeMs = Number(args.readTimeMs || 10000)
      const shouldLike = Boolean(args.like)

      if (!topicId) throw new Error('缺少 topicId')

      // 获取话题详情
      const topicUrl = `${baseUrl}/t/${topicId}.json`
      const topicResponse = await fetch(topicUrl, {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      })

      if (!topicResponse.ok) {
        throw new Error(`获取话题失败：HTTP ${topicResponse.status}`)
      }

      const topicData = await topicResponse.json()
      const posts = topicData.post_stream?.posts || []
      const postNumbers = posts.map((p: any) => p.post_number)

      // 发送阅读时间
      const timings: Record<string, number> = {}
      postNumbers.forEach((pn: number) => {
        timings[String(pn)] = readTimeMs
      })

      const timingsHeaders = await buildDiscourseHeaders(baseUrl, {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        'Discourse-Logged-In': 'true'
      })
      await fetch(`${baseUrl}/topics/timings`, {
        method: 'POST',
        credentials: 'include',
        headers: timingsHeaders,
        body: new URLSearchParams({
          topic_id: String(topicId),
          topic_time: String(readTimeMs),
          timings: JSON.stringify(timings)
        }).toString()
      })

      let liked = false
      if (shouldLike && posts.length > 0) {
        // 找一个未点赞的帖子
        const unlikedPost = posts.find((p: any) => {
          if (p.current_user_reaction) return false
          if (Array.isArray(p.actions_summary)) {
            const likeAction = p.actions_summary.find((a: any) => a.id === 2)
            if (likeAction?.acted) return false
          }
          return true
        })

        if (unlikedPost) {
          const likeUrl = `${baseUrl}/discourse-reactions/posts/${unlikedPost.id}/custom-reactions/heart/toggle.json`
          const likeHeaders = await buildDiscourseHeaders(baseUrl, {
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/json',
            'Discourse-Logged-In': 'true'
          })
          const likeResponse = await fetch(likeUrl, {
            method: 'PUT',
            credentials: 'include',
            headers: likeHeaders
          })
          liked = likeResponse.ok
        }
      }

      return {
        success: true,
        topic: {
          id: topicData.id,
          title: topicData.title,
          posts_count: topicData.posts_count
        },
        readTimeMs,
        liked
      }
    }

    case 'discourse.search': {
      const baseUrl = String(args.baseUrl || 'https://linux.do').replace(/\/$/, '')
      const query = String(args.q || args.query || '').trim()
      const page = Number(args.page || 0)
      const type = args.type ? String(args.type) : ''

      if (!query) throw new Error('缺少搜索关键词 q')

      const searchUrl = new URL(`${baseUrl}/search.json`)
      searchUrl.searchParams.set('q', query)
      if (page > 0) searchUrl.searchParams.set('page', String(page))
      if (type) searchUrl.searchParams.set('type', type)

      const response = await fetch(searchUrl.toString(), {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      })

      if (!response.ok) {
        throw new Error(`搜索失败：HTTP ${response.status}`)
      }

      const data = await response.json()
      const topics = (data.topics || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        slug: t.slug,
        posts_count: t.posts_count,
        views: t.views,
        like_count: t.like_count,
        created_at: t.created_at,
        last_posted_at: t.last_posted_at
      }))
      const posts = (data.posts || []).map((p: any) => ({
        id: p.id,
        topic_id: p.topic_id,
        post_number: p.post_number,
        username: p.username,
        created_at: p.created_at,
        blurb: p.blurb
      }))

      return {
        success: true,
        query,
        page,
        topics,
        posts
      }
    }

    default:
      throw new Error(`未知 Discourse 工具：${toolName}`)
  }
}
