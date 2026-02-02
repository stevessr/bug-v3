import type { Ref } from 'vue'

import type { BrowserTab, DiscourseTag, DiscourseUser, TopicListType } from '../types'
import { pageFetch, extractData } from '../utils'

import { normalizeCategoriesFromResponse } from './categories'

export async function loadHome(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  users: Ref<Map<number, DiscourseUser>>
) {
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
  tab.topics = []
  tab.categories = []
  tab.activeUsers = []
  tab.hasMoreTopics = false
  tab.topicsPage = 0
  tab.currentCategorySlug = ''
  tab.currentCategoryId = null
  tab.currentCategoryName = ''
}
