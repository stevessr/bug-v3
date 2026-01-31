import { pageFetch, extractData } from './utils'

export interface CreateTopicPayload {
  title: string
  raw: string
  categoryId?: number | null
  tags?: string[]
}

export interface ReplyPayload {
  topicId: number
  raw: string
  replyToPostNumber?: number | null
}

export interface TagSearchResult {
  id: number
  text: string
  name: string
  description?: string | null
  count?: number
  pm_only?: boolean
  target_tag?: string | null
}

export async function createTopic(baseUrl: string, payload: CreateTopicPayload) {
  const params = new URLSearchParams()
  params.append('title', payload.title)
  params.append('raw', payload.raw)
  params.append('archetype', 'regular')
  if (payload.categoryId) params.append('category', String(payload.categoryId))
  if (payload.tags && payload.tags.length > 0) {
    payload.tags.forEach(tag => params.append('tags[]', tag))
  }

  const result = await pageFetch<any>(`${baseUrl}/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: params.toString()
  })
  const data = extractData(result)
  if (result.ok === false) {
    const message = data?.errors?.join(', ') || data?.error || '发布失败'
    throw new Error(message)
  }
  return data
}

export async function replyToTopic(baseUrl: string, payload: ReplyPayload) {
  const params = new URLSearchParams()
  params.append('raw', payload.raw)
  params.append('topic_id', String(payload.topicId))
  params.append('archetype', 'regular')
  params.append('nested_post', 'true')
  if (payload.replyToPostNumber) {
    params.append('reply_to_post_number', String(payload.replyToPostNumber))
  }

  const result = await pageFetch<any>(`${baseUrl}/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: params.toString()
  })
  const data = extractData(result)
  if (result.ok === false) {
    const message = data?.errors?.join(', ') || data?.error || '回复失败'
    throw new Error(message)
  }
  return data
}

export async function togglePostLike(baseUrl: string, postId: number, reactionId = 'heart') {
  const url = `${baseUrl}/discourse-reactions/posts/${postId}/custom-reactions/${reactionId}/toggle.json`
  const result = await pageFetch<any>(url, {
    method: 'PUT',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/json',
      'Discourse-Logged-In': 'true'
    }
  })
  const data = extractData(result)
  if (result.ok === false) {
    const message = data?.errors?.join(', ') || data?.error || '点赞失败'
    throw new Error(message)
  }
  return data
}

export async function searchTags(
  baseUrl: string,
  query: string,
  categoryId?: number | null,
  limit = 8
): Promise<TagSearchResult[]> {
  const params = new URLSearchParams()
  params.set('q', query || '')
  params.set('limit', String(limit))
  params.set('filterForInput', 'true')
  if (categoryId) params.set('categoryId', String(categoryId))

  const result = await pageFetch<any>(`${baseUrl}/tags/filter/search?${params.toString()}`)
  const data = extractData(result)
  if (result.ok === false) {
    return []
  }
  return (data?.results || []) as TagSearchResult[]
}
