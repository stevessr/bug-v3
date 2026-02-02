import type { Ref } from 'vue'

import type { BrowserTab, DiscourseNotification, DiscourseNotificationFilter } from '../types'
import { pageFetch, extractData } from '../utils'

export function normalizeNotificationsFromResponse(data: any): DiscourseNotification[] {
  const rawList = data?.notifications || data?.notification_list?.notifications || []
  if (!Array.isArray(rawList)) return []
  return rawList
    .map((item: any) => ({
      id: Number(item?.id) || 0,
      notification_type: Number(item?.notification_type) || 0,
      read: Boolean(item?.read),
      created_at: item?.created_at || '',
      slug: item?.slug,
      topic_id: item?.topic_id,
      post_number: item?.post_number,
      data: item?.data || {},
      fancy_title: item?.fancy_title || item?.data?.topic_title || ''
    }))
    .filter(item => item.id)
}

export async function loadNotifications(
  tab: BrowserTab,
  baseUrl: Ref<string>,
  filter: DiscourseNotificationFilter = 'all'
) {
  const result = await pageFetch<any>(`${baseUrl.value}/notifications.json`)
  const data = extractData(result)
  tab.notifications = normalizeNotificationsFromResponse(data)
  tab.notificationsFilter = filter
}
