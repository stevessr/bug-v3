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
  if (filters.inTitle) tokens.push('in:title')
  if (filters.inFirst) tokens.push('in:first')
  if (filters.status) tokens.push(`status:${filters.status}`)
  if (filters.order) tokens.push(`order:${filters.order}`)
  if (filters.category) tokens.push(`category:${filters.category}`)
  if (filters.tags) tokens.push(`tags:${filters.tags}`)
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
