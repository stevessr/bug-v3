import type { ComputedRef, Ref } from 'vue'

import type { BrowserTab, DiscourseTopic, DiscourseUser } from '../types'
import { pageFetch, extractData } from '../utils'

export async function loadCategory(
  tab: BrowserTab,
  slug: string,
  categoryId: number | null,
  baseUrl: Ref<string>,
  users: Ref<Map<number, DiscourseUser>>
) {
  const url = categoryId
    ? `${baseUrl.value}/c/${slug}/${categoryId}.json`
    : `${baseUrl.value}/c/${slug}.json`

  const result = await pageFetch<any>(url)
  const data = extractData(result)

  if (data?.topic_list?.topics) {
    tab.topics = data.topic_list.topics
    tab.hasMoreTopics = data.topic_list.more_topics_url ? true : false
  } else {
    tab.topics = []
    tab.hasMoreTopics = false
  }

  tab.topicsPage = 0
  tab.currentCategorySlug = slug
  tab.currentCategoryId =
    categoryId ??
    data?.category?.id ??
    data?.topic_list?.category?.id ??
    data?.topic_list?.category_id ??
    null

  if (data?.users) {
    tab.activeUsers = data.users
    data.users.forEach((u: DiscourseUser) => users.value.set(u.id, u))
  } else {
    tab.activeUsers = []
  }

  tab.categories = []
  if (tab.currentCategoryId) {
    try {
      const subResult = await pageFetch<any>(
        `${baseUrl.value}/categories.json?parent_category_id=${tab.currentCategoryId}`
      )
      const subData = extractData(subResult)
      if (subData?.category_list?.categories) {
        tab.categories = subData.category_list.categories
      } else if (subData?.categories) {
        tab.categories = subData.categories
      }
    } catch (e) {
      console.warn('[DiscourseBrowser] loadCategory subcategories error:', e)
      tab.categories = []
    }
  }
}

export async function loadMoreTopics(
  activeTab: ComputedRef<BrowserTab | undefined>,
  baseUrl: Ref<string>,
  users: Ref<Map<number, DiscourseUser>>,
  isLoadingMore: Ref<boolean>
) {
  const tab = activeTab.value
  if (!tab || isLoadingMore.value || !tab.hasMoreTopics) return
  if (tab.viewType !== 'home' && tab.viewType !== 'category') return

  isLoadingMore.value = true
  tab.topicsPage++

  try {
    let url: string
    if (tab.viewType === 'home') {
      url = `${baseUrl.value}/latest.json?page=${tab.topicsPage}`
    } else {
      if (tab.currentCategoryId) {
        url = `${baseUrl.value}/c/${tab.currentCategorySlug}/${tab.currentCategoryId}.json?page=${tab.topicsPage}`
      } else {
        url = `${baseUrl.value}/c/${tab.currentCategorySlug}.json?page=${tab.topicsPage}`
      }
    }

    const result = await pageFetch<any>(url)
    const data = extractData(result)

    if (data?.topic_list?.topics && data.topic_list.topics.length > 0) {
      const existingIds = new Set(tab.topics.map(t => t.id))
      const newTopics = data.topic_list.topics.filter((t: DiscourseTopic) => !existingIds.has(t.id))
      tab.topics = [...tab.topics, ...newTopics]
      tab.hasMoreTopics = data.topic_list.more_topics_url ? true : false
    } else {
      tab.hasMoreTopics = false
    }

    if (data?.users) {
      data.users.forEach((u: DiscourseUser) => users.value.set(u.id, u))
    }
  } catch (e) {
    console.error('[DiscourseBrowser] loadMoreTopics error:', e)
    tab.hasMoreTopics = false
  } finally {
    isLoadingMore.value = false
  }
}
