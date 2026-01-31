import type { ComputedRef, Ref } from 'vue'

import type { BrowserTab, DiscoursePost, DiscourseTopicDetail } from '../types'
import { pageFetch, extractData } from '../utils'

export async function loadTopic(
  tab: BrowserTab,
  topicId: number,
  baseUrl: Ref<string>,
  targetPostNumber?: number | null
) {
  const result = await pageFetch<any>(`${baseUrl.value}/t/${topicId}.json`)
  const data = extractData(result)

  if (data) {
    tab.currentTopic = data as DiscourseTopicDetail
    tab.loadedPostIds = new Set(data.post_stream?.posts?.map((p: DiscoursePost) => p.id) || [])
    tab.hasMorePosts =
      (data.post_stream?.stream?.length || 0) > (data.post_stream?.posts?.length || 0)
    if (data.title) {
      tab.title = data.title
    }
    if (targetPostNumber && tab.currentTopic) {
      await ensurePostByNumberLoaded(tab, topicId, targetPostNumber, baseUrl)
    }
  } else {
    tab.currentTopic = null
    tab.loadedPostIds = new Set()
    tab.hasMorePosts = false
  }
}

async function ensurePostByNumberLoaded(
  tab: BrowserTab,
  topicId: number,
  postNumber: number,
  baseUrl: Ref<string>
) {
  try {
    const result = await pageFetch<any>(
      `${baseUrl.value}/posts/by_number/${topicId}/${postNumber}.json`
    )
    const data = extractData(result)
    const postId = data?.id
    if (!postId || tab.loadedPostIds.has(postId)) return

    const postResult = await pageFetch<any>(
      `${baseUrl.value}/t/${topicId}/posts.json?post_ids[]=${postId}`
    )
    const postData = extractData(postResult)
    const posts = postData?.post_stream?.posts || []
    if (tab.currentTopic && posts.length > 0) {
      tab.currentTopic.post_stream.posts = [...tab.currentTopic.post_stream.posts, ...posts].sort(
        (a: DiscoursePost, b: DiscoursePost) => a.post_number - b.post_number
      )
      posts.forEach((p: DiscoursePost) => tab.loadedPostIds.add(p.id))
    }
  } catch (e) {
    console.warn('[DiscourseBrowser] ensurePostByNumberLoaded error:', e)
  }
}

export async function loadMorePosts(
  activeTab: ComputedRef<BrowserTab | undefined>,
  baseUrl: Ref<string>,
  isLoadingMore: Ref<boolean>
) {
  const tab = activeTab.value
  if (!tab || !tab.currentTopic || isLoadingMore.value || !tab.hasMorePosts) return

  const stream = tab.currentTopic.post_stream?.stream || []
  const unloadedIds = stream.filter((id: number) => !tab.loadedPostIds.has(id))

  if (unloadedIds.length === 0) {
    tab.hasMorePosts = false
    return
  }

  const nextBatch = unloadedIds.slice(0, 20)
  isLoadingMore.value = true

  try {
    const topicId = tab.currentTopic.id
    const idsParam = nextBatch.map((id: number) => `post_ids[]=${id}`).join('&')
    const url = `${baseUrl.value}/t/${topicId}/posts.json?${idsParam}`

    const result = await pageFetch<any>(url)
    const data = extractData(result)

    if (data?.post_stream?.posts && tab.currentTopic) {
      const newPosts = data.post_stream.posts as DiscoursePost[]
      tab.currentTopic.post_stream.posts = [...tab.currentTopic.post_stream.posts, ...newPosts]
      newPosts.forEach((p: DiscoursePost) => tab.loadedPostIds.add(p.id))
      tab.hasMorePosts = stream.some((id: number) => !tab.loadedPostIds.has(id))
    }
  } catch (e) {
    console.error('[DiscourseBrowser] loadMorePosts error:', e)
  } finally {
    isLoadingMore.value = false
  }
}
