import { defineComponent, computed, ref, watch } from 'vue'

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
    type SectionId = 'starred' | 'public' | 'direct'
    const collapsedSections = ref<Set<SectionId>>(new Set())

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

    const getChannelUrl = (channel: ChatChannel) => {
      const slug = channel.slug ? `/${encodeURIComponent(channel.slug)}` : ''
      return `${props.baseUrl}/chat/channel${slug}/${channel.id}`
    }

    const toggleSection = (section: SectionId) => {
      const next = new Set(collapsedSections.value)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      collapsedSections.value = next
    }

    watch(
      () => props.activeChannelId,
      channelId => {
        if (!channelId) return
        const groups = groupedChannels.value
        const section = (Object.keys(groups) as SectionId[]).find(key =>
          groups[key].some(channel => channel.id === channelId)
        )
        if (!section || !collapsedSections.value.has(section)) return
        const next = new Set(collapsedSections.value)
        next.delete(section)
        collapsedSections.value = next
      }
    )

    const renderChannel = (channel: ChatChannel, keyPrefix: string) => (
      <button
        type="button"
        key={`${keyPrefix}-${channel.id}`}
        class={['chat-channel-item', channel.id === props.activeChannelId ? 'active' : '']}
        data-discourse-url={getChannelUrl(channel)}
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

    const renderSection = (id: SectionId, label: string, channels: ChatChannel[]) => {
      if (channels.length === 0) return null
      const collapsed = collapsedSections.value.has(id)
      const unread = channels.reduce((total, channel) => total + getUnreadCount(channel), 0)
      return (
        <section class="chat-channel-group" data-chat-channel-group={id}>
          <button
            type="button"
            class="chat-channel-section"
            aria-expanded={!collapsed}
            aria-controls={`chat-channel-section-${id}`}
            onClick={() => toggleSection(id)}
          >
            <span class="chat-channel-section__chevron" aria-hidden="true">
              {collapsed ? '▶' : '▼'}
            </span>
            <span>{label}</span>
            <span class="chat-channel-section__count">{channels.length}</span>
            {unread > 0 && <span class="chat-channel-section__unread">{unread}</span>}
          </button>
          {!collapsed && (
            <div id={`chat-channel-section-${id}`} class="chat-channel-group__items">
              {channels.map(channel => renderChannel(channel, id))}
            </div>
          )}
        </section>
      )
    }

    return () => (
      <div class="chat-channel-list">
        {props.loading && <div class="chat-channel-loading">加载频道中...</div>}

        {renderSection('starred', '收藏', groupedChannels.value.starred)}
        {renderSection('public', '频道', groupedChannels.value.public)}
        {renderSection('direct', '直接消息', groupedChannels.value.direct)}
      </div>
    )
  }
})
