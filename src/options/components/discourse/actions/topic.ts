import { pageFetch, extractData } from '../utils'

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

export async function setTopicNotificationLevel(baseUrl: string, topicId: number, level: number) {
  const params = new URLSearchParams()
  params.append('notification_level', String(level))

  const result = await pageFetch<any>(`${baseUrl}/t/${topicId}/notifications`, {
    method: 'POST',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Discourse-Logged-In': 'true'
    },
    body: params.toString()
  })
  const data = extractData(result)
  if (result.ok === false) {
    const message = data?.errors?.join(', ') || data?.error || '设置通知级别失败'
    throw new Error(message)
  }
  return data
}
