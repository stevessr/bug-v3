import type { ComputedRef, Ref } from 'vue'

import type {
  BrowserTab,
  DiscourseCategory,
  DiscourseTopic,
  DiscourseUser,
  TopicListType
} from '../types'
import { buildTopicListApiUrl } from '../navigation'
import { pageFetch, extractData } from '../utils'
import {
  ensurePreloadedCategoriesLoaded,
  getAllPreloadedCategories,
  getPreloadedCategory
} from '../linux.do/preloadedCategories'

import { normalizeCategoriesFromResponse } from './categories'

function resolveCategoryId(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = typeof value === 'number' ? value : Number(value)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return null
}

function encodeCategorySlug(slug: string) {
  return slug
    .split('/')
    .filter(Boolean)
    .map(segment => encodeURIComponent(segment))
    .join('/')
}

/** Build the same category-list URL shape used by Discourse's `/c/.../l/...` routes. */
export function buildCategoryTopicListApiUrl(
  baseUrl: string,
  slug: string,
  categoryId: number | null,
  listType: TopicListType = 'latest',
  page?: number
) {
  const encodedSlug = encodeCategorySlug(slug)
  const categoryPath = `/c/${encodedSlug}${categoryId ? `/${categoryId}` : ''}`
  const listPath = listType === 'latest' ? categoryPath : `${categoryPath}/l/${listType}`
  const url = new URL(`${listPath}.json`, baseUrl)
  if (typeof page === 'number' && page > 0) {
    url.searchParams.set('page', String(page))
  }
  return url.toString()
}

function mergeCategoryLists(...lists: DiscourseCategory[][]): DiscourseCategory[] {
  const mergedById = new Map<number, DiscourseCategory>()

  lists.flat().forEach(category => {
    if (!category || !Number.isFinite(Number(category.id))) return

    const existing = mergedById.get(category.id)
    if (!existing) {
      mergedById.set(category.id, { ...category })
      return
    }

    const merged: DiscourseCategory = { ...existing }
    ;(Object.keys(category) as Array<keyof DiscourseCategory>).forEach(key => {
      const value = category[key]
      if (value !== undefined && value !== null && value !== '') {
        ;(merged as unknown as Record<string, unknown>)[key] = value
      }
    })

    const childIds = new Set<number>([
      ...(existing.subcategory_ids || []),
      ...(category.subcategory_ids || [])
    ])
    merged.subcategory_ids = childIds.size > 0 ? Array.from(childIds) : null
    mergedById.set(category.id, merged)
  })

  return Array.from(mergedById.values())
}

function directSubcategories(
  categories: DiscourseCategory[],
  categoryId: number,
  currentCategory: DiscourseCategory | null
) {
  const childIds = new Set<number>(currentCategory?.subcategory_ids || [])
  return categories.filter(
    category =>
      category.id !== categoryId &&
      (category.parent_category_id === categoryId || childIds.has(category.id))
  )
}

export async function loadCategory(
  tab: BrowserTab,
  slug: string,
  categoryId: number | null,
  baseUrl: Ref<string>,
  users: Ref<Map<number, DiscourseUser>>,
  listType: TopicListType = 'latest'
) {
  const url = buildCategoryTopicListApiUrl(baseUrl.value, slug, categoryId, listType)
  const [result] = await Promise.all([
    pageFetch<any>(url),
    ensurePreloadedCategoriesLoaded(baseUrl.value)
  ])
  const data = extractData(result)
  const rawCategory = data?.category ?? data?.topic_list?.category ?? null

  if (data?.topic_list?.topics) {
    tab.topics = data.topic_list.topics
    tab.hasMoreTopics = Boolean(data.topic_list.more_topics_url)
  } else {
    tab.topics = []
    tab.hasMoreTopics = false
  }

  const resolvedCategoryId = resolveCategoryId(
    categoryId,
    rawCategory?.id,
    data?.topic_list?.category_id
  )

  const responseCategories = rawCategory
    ? normalizeCategoriesFromResponse({ categories: [rawCategory] }, baseUrl.value)
    : []
  const preloadedCurrent = resolvedCategoryId
    ? getPreloadedCategory(resolvedCategoryId, slug, baseUrl.value)
    : getPreloadedCategory(null, slug, baseUrl.value)
  const preloadedCurrentCategories = preloadedCurrent
    ? normalizeCategoriesFromResponse({ categories: [preloadedCurrent] }, baseUrl.value)
    : []

  let fetchedCategories: DiscourseCategory[] = []
  if (resolvedCategoryId) {
    try {
      const subResult = await pageFetch<any>(
        `${baseUrl.value}/categories.json?parent_category_id=${resolvedCategoryId}`
      )
      fetchedCategories = normalizeCategoriesFromResponse(extractData(subResult), baseUrl.value)
    } catch (error) {
      console.warn('[DiscourseBrowser] loadCategory subcategories error:', error)
    }
  }

  const preloadedSubcategories = resolvedCategoryId
    ? normalizeCategoriesFromResponse(
        {
          categories: getAllPreloadedCategories(baseUrl.value).filter(
            category => category.parent_category_id === resolvedCategoryId
          )
        },
        baseUrl.value
      )
    : []

  // The live preload/site response enriches compact category payloads while
  // category-route data remains authoritative for the current list state.
  const allCategories = mergeCategoryLists(
    preloadedCurrentCategories,
    preloadedSubcategories,
    fetchedCategories,
    responseCategories
  )
  const currentCategory =
    allCategories.find(category => category.id === resolvedCategoryId) ||
    responseCategories.find(category => category.id === resolvedCategoryId) ||
    null

  tab.topicsPage = 0
  tab.currentCategorySlug = currentCategory?.slug || slug
  tab.currentCategoryId = resolvedCategoryId
  tab.currentCategoryName = currentCategory?.name || rawCategory?.name || ''
  tab.currentCategory = currentCategory
  tab.currentTagName = ''
  tab.topicListType = listType
  tab.topicListPeriod = null
  tab.pendingTopics = null
  tab.pendingTopicsCount = 0
  tab.categories = resolvedCategoryId
    ? directSubcategories(allCategories, resolvedCategoryId, currentCategory)
    : []

  if (data?.users) {
    tab.activeUsers = data.users
    data.users.forEach((user: DiscourseUser) => users.value.set(user.id, user))
  } else {
    tab.activeUsers = []
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
  if (tab.viewType !== 'home' && tab.viewType !== 'category' && tab.viewType !== 'tag') return

  isLoadingMore.value = true
  tab.topicsPage++

  try {
    let url: string
    if (tab.viewType === 'home') {
      url = buildTopicListApiUrl(
        baseUrl.value,
        tab.topicListType || 'latest',
        tab.topicListPeriod,
        tab.topicsPage
      )
    } else if (tab.viewType === 'tag') {
      const encoded = encodeURIComponent(tab.currentTagName || '')
      url = `${baseUrl.value}/tag/${encoded}.json?page=${tab.topicsPage}`
    } else {
      url = buildCategoryTopicListApiUrl(
        baseUrl.value,
        tab.currentCategorySlug,
        tab.currentCategoryId,
        tab.topicListType || 'latest',
        tab.topicsPage
      )
    }

    const result = await pageFetch<any>(url)
    const data = extractData(result)

    if (data?.topic_list?.topics && data.topic_list.topics.length > 0) {
      const existingIds = new Set(tab.topics.map(topic => topic.id))
      const newTopics = data.topic_list.topics.filter(
        (topic: DiscourseTopic) => !existingIds.has(topic.id)
      )
      tab.topics = [...tab.topics, ...newTopics]
      tab.hasMoreTopics = Boolean(data.topic_list.more_topics_url)
    } else {
      tab.hasMoreTopics = false
    }

    if (data?.users) {
      data.users.forEach((user: DiscourseUser) => users.value.set(user.id, user))
    }
  } catch (error) {
    console.error('[DiscourseBrowser] loadMoreTopics error:', error)
    tab.hasMoreTopics = false
  } finally {
    isLoadingMore.value = false
  }
}
