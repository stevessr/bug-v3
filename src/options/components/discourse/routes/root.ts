import type { Ref } from 'vue'

import type { BrowserTab, DiscourseUser, TopicListType } from '../types'
import { pageFetch, extractData } from '../utils'

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

  if (catData?.category_list?.categories) {
    tab.categories = catData.category_list.categories
  } else if (catData?.categories) {
    tab.categories = catData.categories
  } else {
    tab.categories = []
  }

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
