import type { BrowserTab, DiscoursePost } from '../types'
import { pageFetch } from '../utils'

const MIN_INTERVAL_MS = 1000
const MAX_TOPIC_TIME_MS = 59000

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export async function sendReadTimings(
  tab: BrowserTab,
  topicId: number,
  baseUrl: string,
  posts: DiscoursePost[]
) {
  const postNumbers = Array.from(
    new Set(
      posts
        .map(post => post.post_number)
        .filter(postNumber => Number.isFinite(postNumber) && postNumber > 0)
    )
  )

  if (postNumbers.length === 0) return

  const now = Date.now()
  let elapsed = MIN_INTERVAL_MS
  if (tab.lastTimingTopicId === topicId && tab.lastTimingSentAt) {
    elapsed = clamp(now - tab.lastTimingSentAt, MIN_INTERVAL_MS, MAX_TOPIC_TIME_MS)
  }

  tab.lastTimingTopicId = topicId
  tab.lastTimingSentAt = now

  let perPost = Math.max(1, Math.floor(elapsed / postNumbers.length))
  let total = perPost * postNumbers.length

  if (total > MAX_TOPIC_TIME_MS) {
    const factor = MAX_TOPIC_TIME_MS / total
    perPost = Math.max(1, Math.floor(perPost * factor))
    total = perPost * postNumbers.length
  }

  const params = new URLSearchParams()
  for (const postNumber of postNumbers) {
    params.append(`timings[${postNumber}]`, String(perPost))
  }
  params.append('topic_time', String(total))
  params.append('topic_id', String(topicId))

  try {
    await pageFetch(`${baseUrl}/topics/timings`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
      },
      body: params.toString()
    })
  } catch (error) {
    console.warn('[DiscourseBrowser] sendReadTimings failed:', error)
  }
}
