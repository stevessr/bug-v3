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

/**
 * 忽略 / 取消忽略（或静音）一个用户。
 * 对应 Discourse `PUT /u/:username/notification_level.json`。
 * - notification_level === "ignore"：忽略用户（其内容在论坛浏览器内不再显示）
 * - notification_level === "mute"：静音用户
 * - notification_level === "normal"：取消忽略/静音
 * Discourse 该接口要求使用 `application/x-www-form-urlencoded` 请求体。
 */
export async function setUserNotificationLevel(
  baseUrl: string,
  username: string,
  level: 'ignore' | 'mute' | 'normal',
  expiringAt?: string
) {
  const body = new URLSearchParams({ notification_level: level })
  if (level === 'ignore' && expiringAt) {
    body.set('expiring_at', expiringAt)
  }

  const result = await pageFetch<any>(
    `${baseUrl}/u/${encodeURIComponent(username)}/notification_level.json`,
    {
      method: 'PUT',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Discourse-Logged-In': 'true'
      },
      body: body.toString()
    }
  )
  const data = extractData(result)
  if (result.ok === false) {
    throw new Error(data?.errors?.join(', ') || data?.error || '操作失败')
  }
  return data
}
