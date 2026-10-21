import { computed, defineComponent, onMounted, ref, watch, type PropType } from 'vue'
import { Spin } from 'ant-design-vue'

import FaIcon from '../layout/FaIcon'

import type { DiscourseNotification, DiscourseNotificationFilter } from '../types'
import { replaceEmojiShortcodesInHtml } from '../bbcode/emojiShortcode'
import { ensureEmojiShortcodesLoaded } from '../linux.do/emojis'
import { shouldFilterBlockedContent } from '../blocked'
import { getAvatarUrl, formatTime } from '../utils'
import { sanitizeDiscourseHtml } from '../sanitizeHtml'
import '../css/NotificationsView.css'

// Built-in notification icons use Font Awesome rather than duplicated SVG path data.
// Site-controlled icons (categories, themes, plugins) still come from iconSprite.ts.
type NotificationIcon = { icon: string; color: string; bg: string }
const typeIconMap: Record<number, NotificationIcon> = {
  1: { icon: 'at', color: '#3b82f6', bg: '#dbeafe' }, // mentioned
  2: { icon: 'reply', color: '#3b82f6', bg: '#dbeafe' },
  3: { icon: 'quote-right', color: '#8b5cf6', bg: '#ede9fe' },
  4: { icon: 'pen', color: '#6b7280', bg: '#f3f4f6' },
  5: { icon: 'heart', color: '#ef4444', bg: '#fee2e2' },
  6: { icon: 'envelope', color: '#10b981', bg: '#d1fae5' },
  7: { icon: 'envelope', color: '#10b981', bg: '#d1fae5' },
  8: { icon: 'user-check', color: '#10b981', bg: '#d1fae5' },
  9: { icon: 'comment', color: '#6366f1', bg: '#e0e7ff' },
  10: { icon: 'arrows-left-right', color: '#6b7280', bg: '#f3f4f6' },
  11: { icon: 'link', color: '#3b82f6', bg: '#dbeafe' },
  12: { icon: 'star', color: '#f59e0b', bg: '#fef3c7' },
  13: { icon: 'user-plus', color: '#8b5cf6', bg: '#ede9fe' },
  14: { icon: 'bell', color: '#6b7280', bg: '#f3f4f6' },
  15: { icon: 'users', color: '#3b82f6', bg: '#dbeafe' },
  16: { icon: 'comments', color: '#6366f1', bg: '#e0e7ff' },
  17: { icon: 'comment', color: '#6366f1', bg: '#e0e7ff' },
  18: { icon: 'clock', color: '#f59e0b', bg: '#fef3c7' },
  19: { icon: 'heart', color: '#ef4444', bg: '#fee2e2' },
  24: { icon: 'bookmark', color: '#f59e0b', bg: '#fef3c7' },
  25: { icon: 'face-smile', color: '#f59e0b', bg: '#fef3c7' }
}

const defaultTypeIcon: NotificationIcon = {
  icon: 'bell',
  color: '#6b7280',
  bg: '#f3f4f6'
}

const filterIcons: Array<{ key: DiscourseNotificationFilter; label: string; icon: string }> = [
  { key: 'all', label: '全部', icon: 'bell' },
  { key: 'replies', label: '回复', icon: 'reply' },
  { key: 'likes', label: '点赞', icon: 'heart' },
  { key: 'messages', label: '私信', icon: 'envelope' },
  { key: 'mentions', label: '提及', icon: 'at' },
  { key: 'badges', label: '徽章', icon: 'star' },
  { key: 'unread', label: '未读', icon: 'circle-check' }
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

// Construct a Discourse avatar URL by username.
// This endpoint resolves to real uploaded avatar when available,
// and falls back to server-generated letter avatar automatically.
function discourseUserAvatarUrl(baseUrl: string, username: string, size: number): string {
  if (!username || !baseUrl) return ''
  return `${baseUrl}/u/${encodeURIComponent(username)}/avatar/${size}.png`
}

export default defineComponent({
  name: 'NotificationsView',
  props: {
    notifications: { type: Array as () => DiscourseNotification[], required: true },
    filter: { type: String as () => DiscourseNotificationFilter, required: true },
    loading: { type: Boolean, default: false },
    baseUrl: { type: String, default: '' },
    currentUsername: { type: String, default: '' },
    blockedUsernames: { type: Array as () => string[], default: () => [] },
    exemptUsername: { type: String as PropType<string | null>, default: null }
  },
  emits: ['changeFilter', 'open', 'markAll', 'markRead'],
  setup(props, { emit }) {
    // Notification titles are supplied as small pieces of cooked HTML.  They
    // can still contain site-specific `:shortcode:` values though, unlike a
    // post body which goes through PostContent.  Load the same per-origin
    // shortcode table used by posts, then re-render the title once it is ready.
    const emojiReadyToken = ref(0)

    const typeLabelMap: Record<number, DiscourseNotificationFilter> = {
      1: 'mentions',
      2: 'replies',
      3: 'replies',
      4: 'other',
      5: 'likes',
      19: 'likes',
      25: 'likes',
      6: 'messages',
      7: 'messages',
      16: 'messages',
      9: 'replies',
      11: 'replies',
      15: 'mentions',
      17: 'replies',
      12: 'badges',
      24: 'other'
    }

    const formatFilter = (n: DiscourseNotification) => typeLabelMap[n.notification_type] || 'other'

    const filteredNotifications = computed(() => {
      const visible = props.notifications.filter(
        notification =>
          !shouldFilterBlockedContent(
            props.blockedUsernames,
            formatActor(notification),
            props.exemptUsername
          )
      )
      if (props.filter === 'all') return visible
      if (props.filter === 'unread') return visible.filter(item => !item.read)
      return visible.filter(n => formatFilter(n) === props.filter)
    })

    const formatTitle = (n: DiscourseNotification) =>
      n.fancy_title || n.data?.topic_title || n.data?.title || ''

    const renderTitle = (title: string) => {
      // Read the token in render so changing it invalidates already-rendered
      // notification titles without having to refetch the notification list.
      emojiReadyToken.value
      const sanitized = sanitizeDiscourseHtml(title)
      return sanitizeDiscourseHtml(replaceEmojiShortcodesInHtml(sanitized))
    }

    const renderedTitles = computed(() => {
      // Keep title rendering tied to the async emoji-map token explicitly.
      emojiReadyToken.value
      const titles = new Map<number, string>()
      props.notifications.forEach(notification => {
        const title = formatTitle(notification)
        if (title) titles.set(notification.id, renderTitle(title))
      })
      return titles
    })

    const formatActor = (n: DiscourseNotification) =>
      n.data?.display_username || n.data?.username || n.data?.original_username || ''

    const isBadgeNotification = (n: DiscourseNotification) => n.notification_type === 12

    const buildPath = (n: DiscourseNotification) => {
      if (isBadgeNotification(n)) {
        const username = props.currentUsername.trim()
        if (username) return `/u/${encodeURIComponent(username)}/badges`
        const badgeId = n.data?.badge_id || n.data?.badgeId
        if (!badgeId) return ''
        const slug = n.data?.badge_slug || n.data?.badge_name || 'badge'
        return `/badges/${badgeId}/${encodeURIComponent(String(slug))}`
      }

      const topicId = n.topic_id || n.data?.topic_id || n.data?.topicId
      const slug = n.slug || n.data?.slug || n.data?.topic_slug || 'topic'
      const postNumber = n.post_number || n.data?.post_number || n.data?.postNumber
      if (topicId && postNumber) return `/t/${slug}/${topicId}/${postNumber}`
      if (topicId) return `/t/${slug}/${topicId}`

      // A private-message notification normally includes its topic/post ids.
      // Only use the inbox as a fallback, otherwise clicking it loses the
      // exact message the server notified us about.
      const username = props.currentUsername.trim()
      if (username) {
        if (n.notification_type === 24) {
          return `/u/${encodeURIComponent(username)}/user-menu-bookmarks`
        }
        if ([6, 7, 16].includes(n.notification_type)) {
          return `/u/${encodeURIComponent(username)}/user-menu-private-messages`
        }
      }
      return ''
    }

    const formatTypeText = (n: DiscourseNotification) => {
      const mapping: Record<number, string> = {
        1: '提及了你',
        2: '回复了你',
        3: '引用了你',
        4: '编辑了',
        5: '赞了你的帖子',
        6: '给你发了私信',
        7: '邀请你加入私信',
        8: '接受了你的邀请',
        9: '在关注的话题中发帖',
        10: '移动了帖子',
        11: '链接了你的帖子',
        12: '获得徽章',
        13: '邀请你加入话题',
        15: '群组提及了你',
        16: '群组消息',
        17: '关注的话题有新帖',
        18: '话题提醒',
        19: '赞了你的多个帖子',
        24: '书签提醒',
        25: '表情回应'
      }
      return mapping[n.notification_type] || '通知'
    }

    const getTypeIcon = (type: number) => typeIconMap[type] || defaultTypeIcon

    const getAvatarInfo = (n: DiscourseNotification) => {
      const username = n.acting_user_name || formatActor(n)
      // 1. Use avatar template if available (from users sideload or notification data)
      if (n.acting_user_avatar_template && props.baseUrl) {
        return { url: getAvatarUrl(n.acting_user_avatar_template, props.baseUrl, 90), username }
      }
      // 2. Construct Discourse user avatar URL by username
      if (username && props.baseUrl) {
        return { url: discourseUserAvatarUrl(props.baseUrl, username, 90), username }
      }
      // 3. Fallback: client-side letter avatar
      return { url: '', username }
    }

    const brokenAvatarKeys = ref(new Set<number>())

    const getAvatarKey = (n: DiscourseNotification) => n.id

    const handleAvatarError = (notificationId: number) => {
      if (brokenAvatarKeys.value.has(notificationId)) return
      brokenAvatarKeys.value = new Set(brokenAvatarKeys.value).add(notificationId)
    }

    const handleOpen = (n: DiscourseNotification) => {
      const path = buildPath(n)
      if (path) emit('open', path)
      // Opening an unread notification marks it read, mirroring Discourse.
      if (!n.read) emit('markRead', n.id)
    }

    const hasUnread = computed(() => props.notifications.some(item => !item.read))

    const getAccessibleLabel = (n: DiscourseNotification) => {
      const actor = formatActor(n)
      const title = formatTitle(n)
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      return [!n.read ? '未读' : '', actor, formatTypeText(n), title].filter(Boolean).join('，')
    }

    const loadEmojiShortcodes = async (origin: string) => {
      if (!origin) return
      try {
        const count = await ensureEmojiShortcodesLoaded(origin)
        if (count > 0) emojiReadyToken.value++
      } catch {
        // A failed emoji map request must not make notification navigation or
        // rendering unavailable.  The original title remains visible.
      }
    }

    onMounted(() => {
      void loadEmojiShortcodes(props.baseUrl)
    })

    watch(
      () => props.baseUrl,
      value => {
        void loadEmojiShortcodes(value)
      }
    )

    return () => (
      <section class="ntf-root" aria-label="通知列表">
        <div class="ntf-list" aria-live="polite" aria-busy={props.loading}>
          <div class="ntf-toolbar">
            <button
              type="button"
              class="ntf-mark-all"
              disabled={!hasUnread.value}
              title="将全部通知标记为已读"
              aria-label="将全部通知标记为已读"
              onClick={() => emit('markAll')}
            >
              全部已读
            </button>
          </div>
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
              const path = buildPath(item)

              return (
                <article
                  key={item.id}
                  class={['ntf-item', { unread: !item.read, clickable: Boolean(path) }]}
                  role={path ? 'link' : undefined}
                  data-discourse-url={path || undefined}
                  tabindex={path ? 0 : undefined}
                  aria-label={getAccessibleLabel(item)}
                  onClick={path ? () => handleOpen(item) : undefined}
                  onKeydown={
                    path
                      ? (event: KeyboardEvent) => {
                          if (event.key !== 'Enter') return
                          event.preventDefault()
                          handleOpen(item)
                        }
                      : undefined
                  }
                >
                  {!item.read && <span class="ntf-unread-indicator" aria-hidden="true" />}
                  {/* Avatar + type badge */}
                  <div class="ntf-avatar-wrap" data-user-card={avatar.username || undefined}>
                    {avatar.url && !brokenAvatarKeys.value.has(getAvatarKey(item)) ? (
                      <img
                        src={avatar.url}
                        alt=""
                        class="ntf-avatar"
                        onError={() => handleAvatarError(getAvatarKey(item))}
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
                      style={{ backgroundColor: typeIcon.bg, color: typeIcon.color }}
                      aria-hidden="true"
                    >
                      <FaIcon name={typeIcon.icon} className="ntf-type-icon" />
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
                      <div class="ntf-title" innerHTML={renderedTitles.value.get(item.id) || ''} />
                    ) : null}
                    <span class="ntf-time">{formatTime(item.created_at)}</span>
                  </div>
                </article>
              )
            })
          )}
        </div>

        {/* Right filter sidebar */}
        <div class="ntf-filter-bar" role="toolbar" aria-label="筛选通知">
          {filterIcons.map(f => (
            <button
              key={f.key}
              type="button"
              class={['ntf-filter-btn', { active: props.filter === f.key }]}
              title={f.label}
              aria-label={f.label}
              aria-pressed={props.filter === f.key}
              onClick={() => emit('changeFilter', f.key)}
            >
              <FaIcon name={f.icon} className="ntf-filter-icon" />
            </button>
          ))}
        </div>
      </section>
    )
  }
})
