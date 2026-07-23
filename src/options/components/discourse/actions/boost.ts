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
  return data
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

export async function flagBoost(baseUrl: string, boostId: number, flagType: string) {
  const result = await pageFetch<any>(`${baseUrl}/discourse-boosts/boosts/${boostId}/flags`, {
    method: 'POST',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/json',
      'Discourse-Logged-In': 'true'
    },
    body: JSON.stringify({ flag_type: flagType })
  })
  const data = extractData(result)
  if (result.ok === false) {
    const message = data?.errors?.join(', ') || data?.error || '举报 Boost 失败'
    throw new Error(message)
  }
  return data
}
