import type { Ref } from 'vue'

import type {
  BrowserTab,
  DiscourseUser,
  DiscourseSearchFilters,
  DiscourseSearchPost,
  DiscourseSearchTopic
} from '../types'
import { pageFetch, extractData } from '../utils'

const buildSearchQuery = (query: string, filters: DiscourseSearchFilters) => {
  const tokens: string[] = []
  const trimmed = query.trim()
  if (trimmed) tokens.push(trimmed)

  // In-filters (boolean)
  if (filters.inTitle) tokens.push('in:title')
  if (filters.inFirst) tokens.push('in:first')
  if (filters.inPinned) tokens.push('in:pinned')
  if (filters.inWiki) tokens.push('in:wiki')
  if (filters.inBookmarks) tokens.push('in:bookmarks')
  if (filters.inLikes) tokens.push('in:likes')
  if (filters.inPosted) tokens.push('in:posted')
  if (filters.inSeen) tokens.push('in:seen')
  if (filters.inUnseen) tokens.push('in:unseen')
  if (filters.inWatching) tokens.push('in:watching')
  if (filters.inTracking) tokens.push('in:tracking')
  if (filters.inMessages) tokens.push('in:messages')

  // Status and order
  if (filters.status) tokens.push(`status:${filters.status}`)
  if (filters.order) tokens.push(`order:${filters.order}`)

  // Category and tags
  if (filters.category) tokens.push(`category:${filters.category}`)
  if (filters.tags) tokens.push(`tags:${filters.tags}`)

  // User filters
  if (filters.postedBy) tokens.push(`@${filters.postedBy.replace(/^@/, '')}`)
  if (filters.assignedTo) tokens.push(`assigned:${filters.assignedTo}`)
  if (filters.group) tokens.push(`group:${filters.group}`)

  // Date filters
  if (filters.before) tokens.push(`before:${filters.before}`)
  if (filters.after) tokens.push(`after:${filters.after}`)

  // Post/view count filters
  if (filters.minPosts) tokens.push(`min_posts:${filters.minPosts}`)
  if (filters.maxPosts) tokens.push(`max_posts:${filters.maxPosts}`)
  if (filters.minViews) tokens.push(`min_views:${filters.minViews}`)
  if (filters.maxViews) tokens.push(`max_views:${filters.maxViews}`)

  return tokens.join(' ').trim()
}

export async function loadSearch(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  users: Ref<Map<number, DiscourseUser>>,
  query: string,
  filters: DiscourseSearchFilters,
  page = 0
) {
  if (!tab.searchState) return
  tab.searchState.loading = true
  tab.searchState.errorMessage = ''

  try {
    const builtQuery = buildSearchQuery(query, filters)
    const params = new URLSearchParams()
    params.set('q', builtQuery || query)
    if (page > 0) params.set('page', String(page))

    const result = await pageFetch<any>(`${baseUrl.value}/search.json?${params.toString()}`)
    const data = extractData(result) || {}

    const posts = (data.posts || []) as DiscourseSearchPost[]
    const topics = (data.topics || []) as DiscourseSearchTopic[]
    const resultUsers = (data.users || []) as DiscourseUser[]

    if (page === 0) {
      tab.searchState.posts = posts
      tab.searchState.topics = topics
      tab.searchState.users = resultUsers
    } else {
      const existingPostIds = new Set(tab.searchState.posts.map(item => item.id))
      tab.searchState.posts = [
        ...tab.searchState.posts,
        ...posts.filter(item => !existingPostIds.has(item.id))
      ]

      const existingTopicIds = new Set(tab.searchState.topics.map(item => item.id))
      tab.searchState.topics = [
        ...tab.searchState.topics,
        ...topics.filter(item => !existingTopicIds.has(item.id))
      ]

      const existingUserIds = new Set(tab.searchState.users.map(item => item.id))
      tab.searchState.users = [
        ...tab.searchState.users,
        ...resultUsers.filter(item => !existingUserIds.has(item.id))
      ]
    }

    tab.searchState.query = query
    tab.searchState.filters = { ...filters }
    tab.searchState.page = page
    tab.searchState.hasMore = Boolean(data.more_posts || data.more_topics) || posts.length >= 20

    if (resultUsers.length > 0) {
      resultUsers.forEach(user => users.value.set(user.id, user))
    }
  } catch (error) {
    tab.searchState.errorMessage = error instanceof Error ? error.message : '搜索失败'
    tab.searchState.hasMore = false
  } finally {
    tab.searchState.loading = false
  }
}
