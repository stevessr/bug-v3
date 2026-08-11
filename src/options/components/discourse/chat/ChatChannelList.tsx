import { computed, defineComponent, ref, watch } from 'vue'

import type { ChatChannel } from '../types'
import { formatTime, getAvatarUrl } from '../utils'
import '../css/chat/ChatChannelList.css'

export type ChatChannelListFilter = 'all' | 'public' | 'direct' | 'starred'

const isDirectChannel = (channel: ChatChannel) =>
  channel.channelType === 'direct' ||
  channel.chatable_type === 'DirectMessage' ||
  !!channel.chatable?.users?.length

export default defineComponent({
  name: 'ChatChannelList',
  props: {
    channels: { type: Array as () => ChatChannel[], required: true },
    activeChannelId: { type: Number as () => number | null, default: null },
    baseUrl: { type: String, required: true },
    currentUsername: { type: String, default: undefined },
    loading: { type: Boolean, default: false },
    filter: { type: String as () => ChatChannelListFilter, default: 'all' }
  },
  emits: ['select'],
  setup(props, { emit }) {
    type SectionId = 'starred' | 'public' | 'direct'
    const collapsedSections = ref<Set<SectionId>>(new Set())

    /**
     * Chat channel payloads contain a handful of timestamps.  `last_viewed_at`
     * (and, on some Discourse versions, a pending/typing timestamp) is not
     * activity and must never move a channel to the top of the list.  Only use
     * timestamps that describe an actual message.  Prefer the timestamp on
     * `last_message` itself: some deployments expose a sent/pending timestamp
     * while a message is still being delivered, which must not reorder chats.
     */
    const getChannelActivity = (channel: ChatChannel) => {
      const lastMessage = channel.last_message
      const lastMessageId = Number(channel.last_message_id || lastMessage?.id || 0)
      const messagePayloadExists = Boolean(
        lastMessage &&
        (lastMessageId > 0 || lastMessage.created_at || lastMessage.message || lastMessage.cooked)
      )
      const rawTime = lastMessage?.created_at || channel.last_message_sent_at
      const timestamp = rawTime ? new Date(rawTime).getTime() : 0
      const hasValidMessageTime = Number.isFinite(timestamp) && timestamp > 0

      // A valid `last_message_sent_at` is the compact form sent by some
      // Discourse versions, where the full `last_message` serializer is not
      // included. It is still real message activity. Never use membership,
      // viewed, typing, or waiting timestamps as a substitute.
      return {
        hasMessage: messagePayloadExists || hasValidMessageTime,
        timestamp: hasValidMessageTime ? timestamp : 0,
        messageId: Number.isFinite(lastMessageId) && lastMessageId > 0 ? lastMessageId : 0
      }
    }

    const sortChannels = (channels: ChatChannel[]) =>
      [...channels].sort((a, b) => {
        const aActivity = getChannelActivity(a)
        const bActivity = getChannelActivity(b)

        // Empty channels must always be at the bottom of their current
        // section. This is deliberately independent of unread/viewed/waiting
        // state so opening a silent channel cannot make it jump above chats
        // with messages.
        if (aActivity.hasMessage !== bActivity.hasMessage) {
          return aActivity.hasMessage ? -1 : 1
        }
        if (aActivity.timestamp !== bActivity.timestamp) {
          return bActivity.timestamp - aActivity.timestamp
        }
        if (aActivity.messageId !== bActivity.messageId) {
          return bActivity.messageId - aActivity.messageId
        }
        return 0
      })

    const groupedChannels = computed(() => {
      const starred: ChatChannel[] = []
      const publicChannels: ChatChannel[] = []
      const directChannels: ChatChannel[] = []

      props.channels.forEach(channel => {
        const isStarred = !!channel.current_user_membership?.starred
        const isDirect = isDirectChannel(channel)

        if (isStarred) {
          starred.push(channel)
        } else if (isDirect) {
          directChannels.push(channel)
        } else {
          publicChannels.push(channel)
        }
      })

      const { starred: starredPublic, direct: starredDirect } = {
        starred: starred.filter(channel => !isDirectChannel(channel)),
        direct: starred.filter(isDirectChannel)
      }

      switch (props.filter) {
        case 'public':
          return {
            starred: sortChannels(starredPublic),
            public: sortChannels(publicChannels),
            direct: []
          }
        case 'direct':
          return {
            starred: sortChannels(starredDirect),
            public: [],
            direct: sortChannels(directChannels)
          }
        case 'starred':
          return {
            starred: sortChannels(starred),
            public: [],
            direct: []
          }
        default:
          return {
            starred: sortChannels(starred),
            public: sortChannels(publicChannels),
            direct: sortChannels(directChannels)
          }
      }
    })

    const getChannelUsers = (channel: ChatChannel) => {
      const users = [...(channel.chatable?.users || []), ...(channel.direct_message_users || [])]
      const unique = new Map<string, (typeof users)[number]>()
      users.forEach(user => {
        if (!user?.username) return
        unique.set(user.username.toLowerCase(), user)
      })
      return [...unique.values()]
    }

    const getDirectPeers = (channel: ChatChannel) => {
      const current = props.currentUsername?.trim().toLowerCase()
      return getChannelUsers(channel).filter(user => user.username.toLowerCase() !== current)
    }

    const getChannelTitle = (channel: ChatChannel) => {
      if (channel.title) return channel.title
      if (channel.unicode_title) return channel.unicode_title
      if (isDirectChannel(channel)) {
        const peers = getDirectPeers(channel)
        if (peers.length) return peers.map(user => user.name || user.username).join(', ')
      }
      if (channel.chatable?.name) return channel.chatable.name
      return `频道 #${channel.id}`
    }

    const getChannelUser = (channel: ChatChannel) => getDirectPeers(channel)[0] || null

    const getChannelAvatar = (channel: ChatChannel) => {
      const user = getChannelUser(channel)
      if (!user?.avatar_template) return ''
      return getAvatarUrl(user.avatar_template, props.baseUrl, 32)
    }

    // 是否为单人私信（显示头像），否则为多人/公开频道
    const getChannelMemberCount = (channel: ChatChannel) => {
      const count = channel.memberships_count
      if (typeof count === 'number' && count > 0) return count
      const memberCount =
        channel.chatable?.users?.length || channel.direct_message_users?.length || 0
      return memberCount > 0 ? memberCount : 0
    }

    const getChannelTimeLabel = (channel: ChatChannel) => {
      const raw = channel.last_message?.created_at || channel.last_message_sent_at
      return raw ? formatTime(raw) : '暂无消息'
    }

    const getUnreadCount = (channel: ChatChannel) => {
      const count = channel.current_user_membership?.unread_count
      return typeof count === 'number' && count > 0 ? count : 0
    }

    const getChannelUrl = (channel: ChatChannel) => {
      const slug = channel.slug ? encodeURIComponent(channel.slug) : '-'
      return `${props.baseUrl}/chat/c/${slug}/${channel.id}`
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

    const renderChannel = (channel: ChatChannel, keyPrefix: string) => {
      const memberCount = getChannelMemberCount(channel)
      const directPeers = getDirectPeers(channel)
      const singleAvatar =
        isDirectChannel(channel) &&
        !channel.chatable?.group &&
        directPeers.length === 1 &&
        (memberCount === 0 || memberCount <= 2)
      const directUser = singleAvatar ? directPeers[0] : null
      return (
        <button
          type="button"
          key={`${keyPrefix}-${channel.id}`}
          class={[
            'chat-channel-item',
            channel.id === props.activeChannelId ? 'active' : '',
            directUser ? 'has-direct-avatar' : ''
          ]}
          data-discourse-url={getChannelUrl(channel)}
          onClick={() => emit('select', channel)}
        >
          {directUser && getChannelAvatar(channel) && (
            <div class="chat-channel-avatar">
              <img
                src={getChannelAvatar(channel)}
                alt={getChannelTitle(channel)}
                data-user-card={directUser.username}
              />
            </div>
          )}
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
    }

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

    const hasAny = computed(
      () =>
        groupedChannels.value.starred.length > 0 ||
        groupedChannels.value.public.length > 0 ||
        groupedChannels.value.direct.length > 0
    )
    const filterEmptyText = computed(() => {
      switch (props.filter) {
        case 'direct':
          return '暂无私信，点击右上角发起聊天'
        case 'starred':
          return '暂无收藏，在频道菜单中可收藏频道'
        default:
          return '暂无公开频道，试试发现频道'
      }
    })

    return () => (
      <div class="chat-channel-list">
        {props.loading && <div class="chat-channel-loading">加载频道中...</div>}

        {renderSection('starred', '收藏', groupedChannels.value.starred)}
        {renderSection('public', '频道', groupedChannels.value.public)}
        {renderSection('direct', '直接消息', groupedChannels.value.direct)}
        {!props.loading && !hasAny.value && (
          <div class="chat-channel-empty">{filterEmptyText.value}</div>
        )}
      </div>
    )
  }
})
