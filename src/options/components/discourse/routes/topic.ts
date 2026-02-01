import type { ComputedRef, Ref } from 'vue'

import type { BrowserTab, DiscoursePost, DiscourseTopicDetail } from '../types'
import { pageFetch, extractData } from '../utils'

export async function loadTopic(
  tab: BrowserTab,
  topicId: number,
  baseUrl: Ref<string>,
  targetPostNumber?: number | null
) {
  const hasTargetPost = typeof targetPostNumber === 'number' && targetPostNumber > 0
  const endpoint = hasTargetPost
    ? `${baseUrl.value}/t/${topicId}/${targetPostNumber}.json?track_visit=true&forceLoad=true`
    : `${baseUrl.value}/t/${topicId}.json`
  const result = await pageFetch<any>(endpoint)
  const data = extractData(result)

  if (data) {
    tab.currentTopic = data as DiscourseTopicDetail
    tab.topicExtras = {
      suggested_topics: tab.currentTopic.suggested_topics,
      related_topics: tab.currentTopic.related_topics
    }
    tab.loadedPostIds = new Set(data.post_stream?.posts?.map((p: DiscoursePost) => p.id) || [])
    tab.hasMorePosts =
      (data.post_stream?.stream?.length || 0) > (data.post_stream?.posts?.length || 0)
    if (data.title) {
      tab.title = data.title
    }
    const hasTargetPostLoaded =
      hasTargetPost &&
      tab.currentTopic?.post_stream?.posts?.some(
        (post: DiscoursePost) => post.post_number === targetPostNumber
      )
    if (hasTargetPost && tab.currentTopic && !hasTargetPostLoaded) {
      await ensurePostByNumberLoaded(tab, topicId, targetPostNumber, baseUrl)
    }

    if (!tab.topicExtras?.suggested_topics && !tab.topicExtras?.related_topics) {
      const lastPostNumber =
        tab.currentTopic?.highest_post_number || tab.currentTopic?.posts_count || null
      if (lastPostNumber) {
        try {
          const extrasResult = await pageFetch<any>(
            `${baseUrl.value}/t/${topicId}/${lastPostNumber}.json`
          )
          const extrasData = extractData(extrasResult)
          if (extrasData) {
            tab.topicExtras = {
              suggested_topics: extrasData.suggested_topics,
              related_topics: extrasData.related_topics
            }
            if (tab.currentTopic) {
              if (!tab.currentTopic.suggested_topics && extrasData.suggested_topics) {
                tab.currentTopic.suggested_topics = extrasData.suggested_topics
              }
              if (!tab.currentTopic.related_topics && extrasData.related_topics) {
                tab.currentTopic.related_topics = extrasData.related_topics
              }
            }
          }
        } catch (e) {
          console.warn('[DiscourseBrowser] load topic extras failed:', e)
        }
      }
    }
  } else {
    tab.currentTopic = null
    tab.loadedPostIds = new Set()
    tab.hasMorePosts = false
    tab.topicExtras = null
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
  isLoadingMore: Ref<boolean>,
  direction: 'up' | 'down' = 'down'
) {
  const tab = activeTab.value
  if (!tab || !tab.currentTopic || isLoadingMore.value || !tab.hasMorePosts) return

  const stream = tab.currentTopic.post_stream?.stream || []
  if (stream.length === 0) {
    tab.hasMorePosts = false
    return
  }

  const loadedIndices = stream
    .map((id: number, index: number) => (tab.loadedPostIds.has(id) ? index : -1))
    .filter(index => index >= 0)

  if (loadedIndices.length === 0) {
    tab.hasMorePosts = false
    return
  }

  let nextBatch: number[] = []
  if (direction === 'up') {
    const firstLoaded = Math.min(...loadedIndices)
    const candidates = stream
      .slice(0, firstLoaded)
      .filter((id: number) => !tab.loadedPostIds.has(id))
    nextBatch = candidates.slice(-20)
  } else {
    const lastLoaded = Math.max(...loadedIndices)
    const candidates = stream
      .slice(lastLoaded + 1)
      .filter((id: number) => !tab.loadedPostIds.has(id))
    nextBatch = candidates.slice(0, 20)
  }

  if (nextBatch.length === 0) {
    tab.hasMorePosts = stream.some((id: number) => !tab.loadedPostIds.has(id))
    return
  }
  isLoadingMore.value = true

  try {
    const topicId = tab.currentTopic.id
    const idsParam = nextBatch.map((id: number) => `post_ids[]=${id}`).join('&')
    const url = `${baseUrl.value}/t/${topicId}/posts.json?${idsParam}&include_suggested=false`

    const result = await pageFetch<any>(url)
    const data = extractData(result)

    if (data?.post_stream?.posts && tab.currentTopic) {
      const newPosts = data.post_stream.posts as DiscoursePost[]
      tab.currentTopic.post_stream.posts = [...tab.currentTopic.post_stream.posts, ...newPosts]
      newPosts.forEach((p: DiscoursePost) => tab.loadedPostIds.add(p.id))
      tab.currentTopic.post_stream.posts.sort(
        (a: DiscoursePost, b: DiscoursePost) => a.post_number - b.post_number
      )
      tab.hasMorePosts = stream.some((id: number) => !tab.loadedPostIds.has(id))
      if (tab.topicExtras) {
        if (!tab.currentTopic.suggested_topics && tab.topicExtras.suggested_topics) {
          tab.currentTopic.suggested_topics = tab.topicExtras.suggested_topics
        }
        if (!tab.currentTopic.related_topics && tab.topicExtras.related_topics) {
          tab.currentTopic.related_topics = tab.topicExtras.related_topics
        }
      }
    }
  } catch (e) {
    console.error('[DiscourseBrowser] loadMorePosts error:', e)
  } finally {
    isLoadingMore.value = false
  }
}
