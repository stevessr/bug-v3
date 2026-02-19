import type { Ref } from 'vue'

import type { BrowserTab, DiscourseNotification, DiscourseNotificationFilter } from '../types'
import { pageFetch, extractData } from '../utils'

const NOTIFICATION_AVATAR_HYDRATION_LIMIT = 20
const avatarTemplateCache = new Map<string, string>()

function parseNotificationData(raw: any): Record<string, any> {
  if (!raw) return {}
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }
  return raw
}

function normalizeUsername(raw: any): string {
  if (typeof raw !== 'string') return ''
  return raw.trim()
}

function resolveActingUsername(item: any, data: Record<string, any>): string {
  // Prefer machine username fields first (ASCII login name),
  // display_username is often localized display name and not usable for /u/{username}.json.
  return normalizeUsername(
    data.acting_username ||
      data.username ||
      data.original_username ||
      item?.username ||
      data.display_username ||
      ''
  )
}

function resolveAvatarTemplate(
  item: any,
  data: Record<string, any>,
  actingUsername: string,
  avatarMap: Map<string, string>
): string {
  return (
    avatarMap.get(actingUsername) ||
    item?.acting_avatar_template ||
    item?.avatar_template ||
    data.acting_avatar_template ||
    data.avatar_template ||
    data.original_user_avatar_template ||
    ''
  )
}

async function fetchAvatarTemplateForUser(baseUrl: Ref<string>, username: string): Promise<string> {
  if (!username) return ''
  const cached = avatarTemplateCache.get(username)
  if (cached) return cached

  try {
    const result = await pageFetch<any>(`${baseUrl.value}/u/${encodeURIComponent(username)}.json`)
    const payload = extractData(result)
    const template = payload?.user?.avatar_template || payload?.user?.user_avatar_template || ''
    if (template) {
      avatarTemplateCache.set(username, template)
      return template
    }
  } catch {
    // ignore network/user lookup errors
  }

  return ''
}

async function hydrateMissingAvatars(
  notifications: DiscourseNotification[],
  baseUrl: Ref<string>
): Promise<void> {
  const missingUsernames = Array.from(
    new Set(
      notifications
        .filter(n => !n.acting_user_avatar_template && n.acting_user_name)
        .map(n => normalizeUsername(n.acting_user_name))
        .filter(Boolean)
    )
  )

  if (missingUsernames.length === 0) return

  const usernamesToFetch = missingUsernames
    .filter(username => !avatarTemplateCache.has(username))
    .slice(0, NOTIFICATION_AVATAR_HYDRATION_LIMIT)

  if (usernamesToFetch.length > 0) {
    await Promise.allSettled(
      usernamesToFetch.map(username => fetchAvatarTemplateForUser(baseUrl, username))
    )
  }

  for (const notification of notifications) {
    if (notification.acting_user_avatar_template) continue
    const username = normalizeUsername(notification.acting_user_name)
    if (!username) continue
    const template = avatarTemplateCache.get(username)
    if (template) {
      notification.acting_user_avatar_template = template
    }
  }
}

export function normalizeNotificationsFromResponse(data: any): DiscourseNotification[] {
  const rawList = data?.notifications || data?.notification_list?.notifications || []
  if (!Array.isArray(rawList)) return []

  // Build username → avatar_template map from the top-level users array (if present)
  const usersArray: any[] = data?.users || []
  const avatarMap = new Map<string, string>()
  for (const u of usersArray) {
    const username = normalizeUsername(u?.username)
    const avatarTemplate = u?.avatar_template || u?.user_avatar_template || ''
    if (username && avatarTemplate) {
      avatarMap.set(username, avatarTemplate)
    }
  }

  return rawList
    .map((item: any) => {
      const d = parseNotificationData(item?.data)
      const actingUsername = resolveActingUsername(item, d)
      const avatarTemplate = resolveAvatarTemplate(item, d, actingUsername, avatarMap)

      return {
        id: Number(item?.id) || 0,
        notification_type: Number(item?.notification_type) || 0,
        read: Boolean(item?.read),
        created_at: item?.created_at || '',
        slug: item?.slug,
        topic_id: item?.topic_id,
        post_number: item?.post_number,
        data: d,
        fancy_title: item?.fancy_title || d.topic_title || '',
        acting_user_avatar_template: avatarTemplate,
        acting_user_name: actingUsername
      }
    })
    .filter(item => item.id)
}

export async function loadNotifications(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  filter: DiscourseNotificationFilter = 'all'
) {
  const params = new URLSearchParams()
  if (filter === 'unread') {
    params.set('filter', 'unread')
  }
  const query = params.toString() ? `?${params.toString()}` : ''
  const result = await pageFetch<any>(`${baseUrl.value}/notifications.json${query}`)
  const data = extractData(result)

  const notifications = normalizeNotificationsFromResponse(data)
  await hydrateMissingAvatars(notifications, baseUrl)

  tab.notifications = notifications
  tab.notificationsFilter = filter
}
