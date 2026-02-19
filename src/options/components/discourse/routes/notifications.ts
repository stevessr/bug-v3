import type { Ref } from 'vue'

import type { BrowserTab, DiscourseNotification, DiscourseNotificationFilter } from '../types'
import { pageFetch, extractData } from '../utils'

export function normalizeNotificationsFromResponse(data: any): DiscourseNotification[] {
  const rawList = data?.notifications || data?.notification_list?.notifications || []
  if (!Array.isArray(rawList)) return []

  // Build username → avatar_template map from the top-level users array
  const usersArray: any[] = data?.users || []
  const avatarMap = new Map<string, string>()
  for (const u of usersArray) {
    if (u?.username && u?.avatar_template) {
      avatarMap.set(u.username, u.avatar_template)
    }
  }

  return rawList
    .map((item: any) => {
      const d = item?.data || {}
      // Resolve avatar: try the users array by acting username, then data field
      const actingUsername = d.display_username || d.username || d.original_username || ''
      const avatarTemplate =
        avatarMap.get(actingUsername) ||
        d.original_user_avatar_template ||
        ''

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
        acting_user_avatar_template: avatarTemplate
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
  tab.notifications = normalizeNotificationsFromResponse(data)
  tab.notificationsFilter = filter
}
