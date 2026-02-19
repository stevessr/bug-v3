import { defineComponent, computed } from 'vue'
import { Spin } from 'ant-design-vue'

import type { DiscourseNotification, DiscourseNotificationFilter } from '../types'
import { getAvatarUrl, formatTime } from '../utils'
import '../css/NotificationsView.css'

// Notification type → icon SVG path + color
const typeIconMap: Record<number, { path: string; color: string; bg: string }> = {
  1: { // mentioned
    path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2a7.2 7.2 0 01-6-3.22c.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08a7.2 7.2 0 01-6 3.22z',
    color: '#3b82f6', bg: '#dbeafe'
  },
  2: { // replied
    path: 'M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z',
    color: '#3b82f6', bg: '#dbeafe'
  },
  3: { // quoted
    path: 'M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z',
    color: '#8b5cf6', bg: '#ede9fe'
  },
  5: { // linked / mentioned
    path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2a7.2 7.2 0 01-6-3.22c.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08a7.2 7.2 0 01-6 3.22z',
    color: '#3b82f6', bg: '#dbeafe'
  },
  6: { // liked
    path: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
    color: '#ef4444', bg: '#fee2e2'
  },
  7: { // liked post
    path: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
    color: '#ef4444', bg: '#fee2e2'
  },
  8: { // liked topic
    path: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
    color: '#ef4444', bg: '#fee2e2'
  },
  9: { // private message
    path: 'M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z',
    color: '#10b981', bg: '#d1fae5'
  },
  12: { // badge
    path: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
    color: '#f59e0b', bg: '#fef3c7'
  },
  14: { // new topic (watching)
    path: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z',
    color: '#6366f1', bg: '#e0e7ff'
  },
  15: { // new post (watching)
    path: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z',
    color: '#6366f1', bg: '#e0e7ff'
  }
}

const defaultTypeIcon = {
  path: 'M12 22c1.1 0 2-.9 2-2h-4a2 2 0 002 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
  color: '#6b7280', bg: '#f3f4f6'
}

// Filter icon SVGs for the right sidebar
const filterIcons: Array<{ key: DiscourseNotificationFilter; label: string; icon: string }> = [
  { key: 'all', label: '全部',
    icon: 'M12 22c1.1 0 2-.9 2-2h-4a2 2 0 002 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z' },
  { key: 'replies', label: '回复',
    icon: 'M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z' },
  { key: 'likes', label: '点赞',
    icon: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' },
  { key: 'messages', label: '私信',
    icon: 'M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z' },
  { key: 'mentions', label: '提及',
    icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2a7.2 7.2 0 01-6-3.22c.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08a7.2 7.2 0 01-6 3.22z' },
  { key: 'badges', label: '徽章',
    icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' },
  { key: 'unread', label: '未读',
    icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z' }
]

// Generate a stable pastel background color from a username string
function usernameColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = ((hash % 360) + 360) % 360
  return `hsl(${hue}, 55%, 62%)`
}

export default defineComponent({
  name: 'NotificationsView',
  props: {
    notifications: { type: Array as () => DiscourseNotification[], required: true },
    filter: { type: String as () => DiscourseNotificationFilter, required: true },
    loading: { type: Boolean, default: false },
    baseUrl: { type: String, default: '' }
  },
  emits: ['changeFilter', 'open'],
  setup(props, { emit }) {
    const typeLabelMap: Record<number, DiscourseNotificationFilter> = {
      1: 'mentions', 2: 'replies', 3: 'mentions', 5: 'mentions',
      6: 'likes', 7: 'likes', 8: 'likes',
      9: 'messages', 12: 'badges'
    }

    const formatFilter = (n: DiscourseNotification) => typeLabelMap[n.notification_type] || 'other'

    const filteredNotifications = computed(() => {
      if (props.filter === 'all') return props.notifications
      if (props.filter === 'unread') return props.notifications.filter(item => !item.read)
      return props.notifications.filter(n => formatFilter(n) === props.filter)
    })

    const formatTitle = (n: DiscourseNotification) =>
      n.fancy_title || n.data?.topic_title || n.data?.title || ''

    const formatActor = (n: DiscourseNotification) =>
      n.data?.display_username || n.data?.username || n.data?.original_username || ''

    const isBadgeNotification = (n: DiscourseNotification) =>
      n.notification_type === 12 || !!n.data?.badge_id

    const buildPath = (n: DiscourseNotification) => {
      if (isBadgeNotification(n)) {
        const badgeId = n.data?.badge_id || n.data?.badgeId
        if (!badgeId) return ''
        const slug = n.data?.badge_slug || n.data?.badge_name || 'badge'
        return `/badges/${badgeId}/${encodeURIComponent(String(slug))}`
      }
      const topicId = n.topic_id || n.data?.topic_id
      const slug = n.slug || n.data?.slug || 'topic'
      const postNumber = n.post_number || n.data?.post_number
      if (topicId && postNumber) return `/t/${slug}/${topicId}/${postNumber}`
      if (topicId) return `/t/${slug}/${topicId}`
      return ''
    }

    const formatTypeText = (n: DiscourseNotification) => {
      const mapping: Record<number, string> = {
        1: '提及了你', 2: '回复了你', 3: '引用了你', 5: '提到你',
        6: '赞了', 7: '赞了', 8: '赞了',
        9: '私信', 12: '获得徽章', 14: '新话题', 15: '新回复'
      }
      return mapping[n.notification_type] || '通知'
    }

    const getTypeIcon = (type: number) => typeIconMap[type] || defaultTypeIcon

    const getAvatarInfo = (n: DiscourseNotification) => {
      const username = formatActor(n)
      // Try to build avatar URL from the notification data
      if (n.data?.original_user_avatar_template && props.baseUrl) {
        return { url: getAvatarUrl(n.data.original_user_avatar_template, props.baseUrl, 90), username }
      }
      // Fallback: letter avatar
      return { url: '', username }
    }

    const handleOpen = (n: DiscourseNotification) => {
      const path = buildPath(n)
      if (path) emit('open', path)
    }

    return () => (
      <div class="ntf-root">
        {/* Notification list */}
        <div class="ntf-list">
          {props.loading ? (
            <div class="ntf-loading">
              <Spin size="small" />
              <span>正在加载通知...</span>
            </div>
          ) : filteredNotifications.value.length === 0 ? (
            <div class="ntf-empty">暂无通知</div>
          ) : (
            filteredNotifications.value.map(item => {
              const actor = formatActor(item)
              const title = formatTitle(item)
              const typeIcon = getTypeIcon(item.notification_type)
              const avatar = getAvatarInfo(item)
              const typeText = formatTypeText(item)

              return (
                <div
                  key={item.id}
                  class={['ntf-item', { unread: !item.read }]}
                  onClick={() => handleOpen(item)}
                >
                  {/* Avatar + type badge */}
                  <div class="ntf-avatar-wrap">
                    {avatar.url ? (
                      <img
                        src={avatar.url}
                        alt={avatar.username}
                        class="ntf-avatar"
                      />
                    ) : (
                      <div
                        class="ntf-avatar ntf-avatar-letter"
                        style={{ backgroundColor: usernameColor(avatar.username || 'U') }}
                      >
                        {(avatar.username || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    <span
                      class="ntf-type-badge"
                      style={{ backgroundColor: typeIcon.bg }}
                    >
                      <svg viewBox="0 0 24 24" width="12" height="12">
                        <path d={typeIcon.path} fill={typeIcon.color} />
                      </svg>
                    </span>
                  </div>

                  {/* Content */}
                  <div class="ntf-content">
                    <div class="ntf-actor-line">
                      {actor && <span class="ntf-actor">{actor}</span>}
                      <span class="ntf-type-text">{typeText}</span>
                    </div>
                    {isBadgeNotification(item) ? (
                      <div class="ntf-title">
                        {item.data?.badge_name || '徽章'}
                        {item.data?.badge_description && (
                          <span class="ntf-badge-desc"> · {item.data.badge_description}</span>
                        )}
                      </div>
                    ) : title ? (
                      <div class="ntf-title" innerHTML={title} />
                    ) : null}
                    <span class="ntf-time">{formatTime(item.created_at)}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Right filter sidebar */}
        <div class="ntf-filter-bar">
          {filterIcons.map(f => (
            <button
              key={f.key}
              class={['ntf-filter-btn', { active: props.filter === f.key }]}
              title={f.label}
              onClick={() => emit('changeFilter', f.key)}
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path d={f.icon} fill="currentColor" />
              </svg>
            </button>
          ))}
        </div>
      </div>
    )
  }
})
