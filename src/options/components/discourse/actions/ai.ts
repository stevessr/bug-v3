import { pageFetch, extractData } from '../utils'

export type AiTopicSummary = {
  summarized_text?: string
  algorithm?: string
  outdated?: boolean
  can_regenerate?: boolean
  new_posts_since_summary?: number
  updated_at?: string
}

export async function fetchAiTopicSummary(baseUrl: string, topicId: number) {
  const url = `${baseUrl}/discourse-ai/summarization/t/${topicId}?stream=true`
  const result = await pageFetch<any>(url, {
    headers: {
      'X-Requested-With': 'XMLHttpRequest'
    }
  })
  const data = extractData(result)
  return {
    status: result.status,
    ok: result.ok,
    summary: (data?.ai_topic_summary || null) as AiTopicSummary | null
  }
}
