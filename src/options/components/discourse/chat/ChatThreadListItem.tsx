import { defineComponent } from 'vue'

import type { ChatThread, DiscourseUser } from '../types'
import { stripHtml } from '../tagVisuals'
import { formatTime, getAvatarUrl } from '../utils'
import '../css/chat/ChatThreadList.css'

export const getChatThreadNotificationLevel = (value: number | string | undefined) => {
  if (typeof value === 'number') return value
  const normalized = String(value || '').toLowerCase()
  if (normalized === 'watching') return 3
  if (normalized === 'tracking') return 2
  if (normalized === 'normal' || normalized === 'regular') return 1
  return Number(value) || 1
}

export const getChatThreadUnreadCount = (thread: ChatThread) => {
  const tracking = thread.tracking
  return Math.max(
    Number(tracking?.unread_count || 0),
    Number(tracking?.mention_count || 0),
    Number(tracking?.watched_threads_unread_count || 0),
    Number(thread.current_user_membership?.unread_count || 0)
  )
}

export const isChatThreadUrgent = (thread: ChatThread) =>
  Number(thread.tracking?.watched_threads_unread_count || 0) > 0 ||
  (getChatThreadNotificationLevel(thread.current_user_membership?.notification_level) === 3 &&
    getChatThreadUnreadCount(thread) > 0)

export const sortChatThreadsForDisplay = (threads: ChatThread[]) =>
  [...threads].sort((left, right) => {
    const urgentDifference = Number(isChatThreadUrgent(right)) - Number(isChatThreadUrgent(left))
    if (urgentDifference !== 0) return urgentDifference
    const unreadDifference =
      Number(getChatThreadUnreadCount(right) > 0) - Number(getChatThreadUnreadCount(left) > 0)
    if (unreadDifference !== 0) return unreadDifference
    const leftTime = new Date(left.preview?.last_reply_created_at || 0).getTime()
    const rightTime = new Date(right.preview?.last_reply_created_at || 0).getTime()
    return rightTime - leftTime
  })

export default defineComponent({
  name: 'ChatThreadListItem',
  props: {
    thread: { type: Object as () => ChatThread, required: true },
    baseUrl: { type: String, required: true },
    active: { type: Boolean, default: false },
    showChannel: { type: Boolean, default: true }
  },
  emits: ['select'],
  setup(props, { emit }) {
    const getThreadTitle = () =>
      props.thread.title?.trim() ||
      stripHtml(props.thread.original_message?.message || props.thread.original_message?.cooked) ||
      '消息串'

    const getChannelTitle = () => {
      const channel = props.thread.channel
      return (
        channel?.title ||
        channel?.unicode_title ||
        channel?.chatable?.name ||
        (props.thread.channel_id ? `频道 #${props.thread.channel_id}` : '聊天')
      )
    }

    const getThreadUrl = () => {
      const channelId = props.thread.channel_id || props.thread.channel?.id || 0
      const slug = props.thread.channel?.slug ? encodeURIComponent(props.thread.channel.slug) : '-'
      return `${props.baseUrl}/chat/c/${slug}/${channelId}/t/${props.thread.id}`
    }

    const getParticipants = () => {
      const candidates = [
        ...(props.thread.preview?.participant_users || []),
        props.thread.preview?.last_reply_user,
        props.thread.original_message?.user
      ].filter((user): user is DiscourseUser => Boolean(user?.id && user?.username))
      const unique = new Map<number, DiscourseUser>()
      candidates.forEach(user => unique.set(user.id, user))
      return [...unique.values()].slice(0, 3)
    }

    const handleClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return
      }
      event.preventDefault()
      emit('select', props.thread)
    }

    return () => {
      const unreadCount = getChatThreadUnreadCount(props.thread)
      const participants = getParticipants()
      const href = getThreadUrl()
      return (
        <a
          class={[
            'chat-thread-list__item',
            props.active ? 'active' : '',
            unreadCount > 0 ? 'has-unread' : '',
            isChatThreadUrgent(props.thread) ? 'is-urgent' : ''
          ]}
          href={href}
          data-discourse-url={href}
          onClick={handleClick}
        >
          <div class="chat-thread-list__item-heading">
            <strong>{getThreadTitle()}</strong>
            {unreadCount > 0 && (
              <span class="chat-thread-list__item-unread" aria-label={`${unreadCount} 条未读`}>
                {unreadCount}
              </span>
            )}
          </div>
          {props.showChannel && <div class="chat-thread-list__channel">{getChannelTitle()}</div>}
          <div class="chat-thread-list__preview">
            <div class="chat-thread-list__avatars" aria-label={`${participants.length} 位参与者`}>
              {participants.map(user => (
                <img
                  key={user.id}
                  src={getAvatarUrl(user.avatar_template, props.baseUrl, 24)}
                  alt={user.name || user.username}
                  title={user.name || user.username}
                  data-user-card={user.username}
                />
              ))}
            </div>
            <span class="chat-thread-list__excerpt">
              {stripHtml(props.thread.preview?.last_reply_excerpt) || '暂无回复摘要'}
            </span>
          </div>
          <div class="chat-thread-list__meta">
            <span>
              {Number(props.thread.reply_count || props.thread.preview?.reply_count || 0)} 条回复
            </span>
            {props.thread.preview?.last_reply_created_at && (
              <time datetime={props.thread.preview.last_reply_created_at}>
                {formatTime(props.thread.preview.last_reply_created_at)}
              </time>
            )}
          </div>
        </a>
      )
    }
  }
})
