import { extractData, pageFetch } from '../utils'

export async function fetchUserCard(baseUrl: string, username: string) {
  const result = await pageFetch<any>(`${baseUrl}/u/${encodeURIComponent(username)}/card.json`, {
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'Discourse-Logged-In': 'true'
    }
  })
  const data = extractData(result)
  if (result.ok === false || !data?.user) {
    throw new Error(data?.errors?.join(', ') || data?.error || '加载用户卡片失败')
  }
  return data.user
}

export async function setUserFollowed(baseUrl: string, username: string, followed: boolean) {
  const result = await pageFetch<any>(`${baseUrl}/follow/${encodeURIComponent(username)}.json`, {
    method: followed ? 'PUT' : 'DELETE',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/json',
      'Discourse-Logged-In': 'true'
    }
  })
  const data = extractData(result)
  if (result.ok === false) {
    throw new Error(
      data?.errors?.join(', ') || data?.error || (followed ? '关注失败' : '取消关注失败')
    )
  }
  return data
}
