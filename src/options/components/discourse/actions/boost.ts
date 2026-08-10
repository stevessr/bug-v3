import { pageFetch, extractData } from '../utils'

export async function createBoost(baseUrl: string, postId: number, raw: string) {
  const result = await pageFetch<any>(`${baseUrl}/discourse-boosts/posts/${postId}/boosts`, {
    method: 'POST',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/json',
      'Discourse-Logged-In': 'true'
    },
    body: JSON.stringify({ raw })
  })
  const data = extractData(result)
  if (result.ok === false) {
    const message = data?.errors?.join(', ') || data?.error || '添加 Boost 失败'
    throw new Error(message)
  }
  return data?.boost || data
}

export async function deleteBoost(baseUrl: string, boostId: number) {
  const result = await pageFetch<any>(`${baseUrl}/discourse-boosts/boosts/${boostId}`, {
    method: 'DELETE',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/json',
      'Discourse-Logged-In': 'true'
    }
  })
  if (result.ok === false) {
    const data = extractData(result)
    const message = data?.errors?.join(', ') || data?.error || '删除 Boost 失败'
    throw new Error(message)
  }
  return result
}

export async function flagBoost(
  baseUrl: string,
  boostId: number,
  payload: {
    flagTypeId: number
    message?: string
    takeAction?: boolean
    queueForReview?: boolean
  }
) {
  const result = await pageFetch<any>(`${baseUrl}/discourse-boosts/boosts/${boostId}/flags`, {
    method: 'POST',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Discourse-Logged-In': 'true'
    },
    body: new URLSearchParams({
      flag_type_id: String(payload.flagTypeId),
      message: payload.message || '',
      take_action: String(payload.takeAction ?? false),
      queue_for_review: String(payload.queueForReview ?? false)
    }).toString()
  })
  const data = extractData(result)
  if (result.ok === false) {
    const message = data?.errors?.join(', ') || data?.error || '举报 Boost 失败'
    throw new Error(message)
  }
  return data
}
