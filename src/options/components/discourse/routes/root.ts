import type { Ref } from 'vue'

import type {
  BrowserTab,
  DiscourseTag,
  DiscourseTagGroup,
  DiscourseUser,
  TopicListType
} from '../types'
import { pageFetch, extractData } from '../utils'
import { ensurePreloadedCategoriesLoaded, isLinuxDoUrl } from '../linux.do/preloadedCategories'

import { normalizeCategoriesFromResponse } from './categories'

export async function loadHome(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  users: Ref<Map<number, DiscourseUser>>
) {
  if (isLinuxDoUrl(baseUrl.value)) {
    await ensurePreloadedCategoriesLoaded()
  }

  const [catResult, topicResult] = await Promise.all([
    pageFetch<any>(`${baseUrl.value}/categories.json`),
    pageFetch<any>(`${baseUrl.value}/${tab.topicListType || 'latest'}.json`)
  ])

  const catData = extractData(catResult)
  const topicData = extractData(topicResult)

  tab.categories = normalizeCategoriesFromResponse(catData)

  if (topicData?.topic_list?.topics) {
    tab.topics = topicData.topic_list.topics
    tab.hasMoreTopics = topicData.topic_list.more_topics_url ? true : false
  } else {
    tab.topics = []
    tab.hasMoreTopics = false
  }

  tab.topicsPage = 0
  tab.currentCategorySlug = ''
  tab.currentCategoryId = null
  tab.currentCategoryName = ''
  tab.currentTagName = ''
  tab.tagGroups = []

  if (topicData?.users) {
    tab.activeUsers = topicData.users
    topicData.users.forEach((u: DiscourseUser) => users.value.set(u.id, u))
  } else {
    tab.activeUsers = []
  }
}

export async function changeTopicListType(
  tab: BrowserTab,
  type: TopicListType,
  baseUrl: Ref<string>,
  users: Ref<Map<number, DiscourseUser>>
) {
  tab.topicListType = type
  tab.topicsPage = 0
  tab.currentTagName = ''
  tab.tagGroups = []

  const result = await pageFetch<any>(`${baseUrl.value}/${type}.json`)
  const data = extractData(result)

  if (data?.topic_list?.topics) {
    tab.topics = data.topic_list.topics
    tab.hasMoreTopics = data.topic_list.more_topics_url ? true : false
  } else {
    tab.topics = []
    tab.hasMoreTopics = false
  }

  if (data?.users) {
    tab.activeUsers = data.users
    data.users.forEach((u: DiscourseUser) => users.value.set(u.id, u))
  }
}

export async function loadCategories(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  users: Ref<Map<number, DiscourseUser>>
) {
  if (isLinuxDoUrl(baseUrl.value)) {
    await ensurePreloadedCategoriesLoaded()
  }

  let data: any = null
  try {
    const result = await pageFetch<any>(`${baseUrl.value}/categories_and_latest.json`)
    data = extractData(result)
  } catch {
    const fallbackResult = await pageFetch<any>(`${baseUrl.value}/categories.json`)
    data = extractData(fallbackResult)
  }

  tab.categories = normalizeCategoriesFromResponse(data)

  tab.topics = []
  tab.hasMoreTopics = false
  tab.topicsPage = 0
  tab.currentCategorySlug = ''
  tab.currentCategoryId = null
  tab.currentCategoryName = ''
  tab.currentTagName = ''
  tab.tagGroups = []
  tab.activeUsers = data?.users || []
  if (Array.isArray(data?.users)) {
    data.users.forEach((u: DiscourseUser) => users.value.set(u.id, u))
  }
}

export async function loadPosted(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  users: Ref<Map<number, DiscourseUser>>
) {
  const result = await pageFetch<any>(`${baseUrl.value}/posted.json`)
  const data = extractData(result)

  if (data?.topic_list?.topics) {
    tab.topics = data.topic_list.topics
    tab.hasMoreTopics = data.topic_list.more_topics_url ? true : false
  } else {
    tab.topics = []
    tab.hasMoreTopics = false
  }

  tab.topicsPage = 0
  tab.currentCategorySlug = ''
  tab.currentCategoryId = null
  tab.currentCategoryName = ''
  tab.currentTagName = ''
  tab.tagGroups = []

  if (data?.users) {
    tab.activeUsers = data.users
    data.users.forEach((u: DiscourseUser) => users.value.set(u.id, u))
  } else {
    tab.activeUsers = []
  }

  // Keep categories empty for posted view
  tab.categories = []
}

export async function loadBookmarks(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  users: Ref<Map<number, DiscourseUser>>
) {
  const result = await pageFetch<any>(`${baseUrl.value}/bookmarks.json`)
  const data = extractData(result)

  if (data?.topic_list?.topics) {
    tab.topics = data.topic_list.topics
    tab.hasMoreTopics = data.topic_list.more_topics_url ? true : false
  } else {
    tab.topics = []
    tab.hasMoreTopics = false
  }

  tab.topicsPage = 0
  tab.currentCategorySlug = ''
  tab.currentCategoryId = null
  tab.currentCategoryName = ''
  tab.currentTagName = ''
  tab.tagGroups = []

  if (data?.users) {
    tab.activeUsers = data.users
    data.users.forEach((u: DiscourseUser) => users.value.set(u.id, u))
  } else {
    tab.activeUsers = []
  }

  // Keep categories empty for bookmarks view
  tab.categories = []
}

function normalizeTagsFromResponse(data: any): DiscourseTag[] {
  if (!Array.isArray(data?.tags)) return []
  return data.tags
    .filter((item: any) => item && typeof item.name === 'string')
    .map((item: any) => ({
      id: Number(item.id) || 0,
      text: typeof item.text === 'string' ? item.text : item.name,
      name: item.name,
      description: item.description ?? null,
      count: Number(item.count) || 0,
      pm_only: Boolean(item.pm_only),
      target_tag: item.target_tag ?? null
    }))
}

export async function loadTags(tab: BrowserTab, baseUrl: Ref<string>) {
  const result = await pageFetch<any>(`${baseUrl.value}/tags.json`)
  const data = extractData(result)

  tab.tags = normalizeTagsFromResponse(data)
  tab.tagGroups = normalizeTagGroupsFromResponse(data, tab.tags)
  tab.topics = []
  tab.categories = []
  tab.activeUsers = []
  tab.hasMoreTopics = false
  tab.topicsPage = 0
  tab.currentCategorySlug = ''
  tab.currentCategoryId = null
  tab.currentCategoryName = ''
  tab.currentTagName = ''
}

export async function loadTag(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  users: Ref<Map<number, DiscourseUser>>,
  tagName: string
) {
  const encodedTag = encodeURIComponent(tagName)
  const result = await pageFetch<any>(`${baseUrl.value}/tag/${encodedTag}.json`)
  const data = extractData(result)

  if (data?.topic_list?.topics) {
    tab.topics = data.topic_list.topics
  } else {
    tab.topics = []
  }

  tab.hasMoreTopics = false
  tab.topicsPage = 0
  tab.categories = []
  tab.currentCategorySlug = ''
  tab.currentCategoryId = null
  tab.currentCategoryName = ''
  tab.currentTagName = tagName
  tab.tagGroups = []

  if (Array.isArray(data?.users)) {
    tab.activeUsers = data.users
    data.users.forEach((u: DiscourseUser) => users.value.set(u.id, u))
  } else {
    tab.activeUsers = []
  }
}

function normalizeTagGroupsFromResponse(data: any, allTags: DiscourseTag[]): DiscourseTagGroup[] {
  const rawGroups = data?.extras?.tag_groups
  if (!Array.isArray(rawGroups)) return []

  const groups: DiscourseTagGroup[] = rawGroups
    .filter((group: any) => group && typeof group.name === 'string')
    .map((group: any) => ({
      id: Number(group.id) || 0,
      name: group.name,
      tags: normalizeTagsFromResponse({ tags: group.tags || [] })
    }))
    .filter(group => group.tags.length > 0)

  const groupedNames = new Set(
    groups.flatMap(group => group.tags.map(tag => tag.name.toLocaleLowerCase()))
  )
  const ungroupedTags = allTags.filter(tag => !groupedNames.has(tag.name.toLocaleLowerCase()))
  if (ungroupedTags.length > 0) {
    groups.push({ id: 0, name: '其他标签', tags: ungroupedTags })
  }

  return groups
}
