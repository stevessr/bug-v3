import { defineComponent, computed } from 'vue'

import type { ChatChannel } from '../types'
import { formatTime, getAvatarUrl } from '../utils'
import '../css/chat/ChatChannelList.css'

export default defineComponent({
  name: 'ChatChannelList',
  props: {
    channels: { type: Array as () => ChatChannel[], required: true },
    activeChannelId: { type: Number as () => number | null, default: null },
    baseUrl: { type: String, required: true },
    loading: { type: Boolean, default: false }
  },
  emits: ['select'],
  setup(props, { emit }) {
    const getChannelLastTime = (channel: ChatChannel) => {
      const fallback = channel.last_message?.created_at
      const raw = channel.last_message_sent_at || fallback
      return raw ? new Date(raw).getTime() : 0
    }

    const sortChannels = (channels: ChatChannel[]) =>
      [...channels].sort((a, b) => getChannelLastTime(b) - getChannelLastTime(a))

    const groupedChannels = computed(() => {
      const starred: ChatChannel[] = []
      const publicChannels: ChatChannel[] = []
      const directChannels: ChatChannel[] = []

      props.channels.forEach(channel => {
        const isStarred = !!channel.current_user_membership?.starred
        const isDirect =
          channel.channelType === 'direct' ||
          channel.chatable_type === 'DirectMessage' ||
          !!channel.chatable?.users?.length

        if (isStarred) {
          starred.push(channel)
        } else if (isDirect) {
          directChannels.push(channel)
        } else {
          publicChannels.push(channel)
        }
      })

      return {
        starred: sortChannels(starred),
        public: sortChannels(publicChannels),
        direct: sortChannels(directChannels)
      }
    })

    const getChannelTitle = (channel: ChatChannel) => {
      if (channel.title) return channel.title
      if (channel.unicode_title) return channel.unicode_title
      if (channel.chatable?.users?.length) {
        return channel.chatable.users.map(user => user.name || user.username).join(', ')
      }
      if (channel.direct_message_users?.length) {
        return channel.direct_message_users.map(user => user.name || user.username).join(', ')
      }
      if (channel.chatable?.name) return channel.chatable.name
      return `频道 #${channel.id}`
    }

    const getChannelAvatar = (channel: ChatChannel) => {
      const user = channel.chatable?.users?.[0] || channel.direct_message_users?.[0]
      if (!user?.avatar_template) return ''
      return getAvatarUrl(user.avatar_template, props.baseUrl, 32)
    }

    const getChannelTimeLabel = (channel: ChatChannel) => {
      const raw = channel.last_message_sent_at || channel.last_message?.created_at
      return raw ? formatTime(raw) : '暂无消息'
    }

    const getUnreadCount = (channel: ChatChannel) => {
      const count = channel.current_user_membership?.unread_count
      return typeof count === 'number' && count > 0 ? count : 0
    }

    const renderChannel = (channel: ChatChannel, keyPrefix: string) => (
      <button
        key={`${keyPrefix}-${channel.id}`}
        class={['chat-channel-item', channel.id === props.activeChannelId ? 'active' : '']}
        onClick={() => emit('select', channel)}
      >
        <div class="chat-channel-avatar">
          {getChannelAvatar(channel) ? (
            <img src={getChannelAvatar(channel)} alt={getChannelTitle(channel)} />
          ) : (
            <span>#</span>
          )}
        </div>
        <div class="chat-channel-info">
          <div class="chat-channel-title">{getChannelTitle(channel)}</div>
          <div class="chat-channel-meta">
            <span>{getChannelTimeLabel(channel)}</span>
          </div>
        </div>
        {getUnreadCount(channel) > 0 && (
          <div class="chat-channel-unread">{getUnreadCount(channel)}</div>
        )}
      </button>
    )

    return () => (
      <div class="chat-channel-list">
        {props.loading && <div class="chat-channel-loading">加载频道中...</div>}

        {groupedChannels.value.starred.length > 0 && (
          <>
            <div class="chat-channel-section">收藏</div>
            {groupedChannels.value.starred.map(c => renderChannel(c, 'starred'))}
          </>
        )}

        {groupedChannels.value.public.length > 0 && (
          <>
            <div class="chat-channel-section">频道</div>
            {groupedChannels.value.public.map(c => renderChannel(c, 'public'))}
          </>
        )}

        {groupedChannels.value.direct.length > 0 && (
          <>
            <div class="chat-channel-section">直接消息</div>
            {groupedChannels.value.direct.map(c => renderChannel(c, 'direct'))}
          </>
        )}
      </div>
    )
  }
})
