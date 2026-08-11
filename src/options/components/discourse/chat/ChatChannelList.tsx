import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import { TeamOutlined } from '@ant-design/icons-vue'

import type { ChatChannel } from '../types'
import { formatTime, getAvatarUrl } from '../utils'
import { fetchDiscourseEmojiGroups } from '../linux.do/emojis'
import '../css/chat/ChatChannelList.css'

export type ChatChannelListFilter = 'all' | 'public' | 'direct' | 'starred'

const isDirectChannel = (channel: ChatChannel) =>
  channel.channelType === 'direct' ||
  channel.chatable_type === 'DirectMessage' ||
  !!channel.chatable?.users?.length

// 频道图标：多人/公开频道优先显示频道自带表情（短码或 unicode），否则显示人数
const getChannelIconValue = (channel: ChatChannel) => {
  const raw = channel.emoji || channel.chatable?.emoji || ''
  const trimmed = raw.replace(/^:+|:+$/g, '').trim()
  if (!trimmed) return ''
  if (/\p{Emoji_Presentation}/u.test(trimmed)) return trimmed
  if (/^[a-zA-Z0-9_\-+]+$/.test(trimmed)) return trimmed
  return ''
}

export default defineComponent({
  name: 'ChatChannelList',
  props: {
    channels: { type: Array as () => ChatChannel[], required: true },
    activeChannelId: { type: Number as () => number | null, default: null },
    baseUrl: { type: String, required: true },
    loading: { type: Boolean, default: false },
    filter: { type: String as () => ChatChannelListFilter, default: 'all' }
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

    const getChannelUser = (channel: ChatChannel) =>
      channel.chatable?.users?.[0] || channel.direct_message_users?.[0]

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

    // 站点表情图：把频道短码图标渲染为表情图片
    const shortcodeEmojiUrls = ref<Record<string, string>>({})
    const loadShortcodeEmojiUrls = async () => {
      try {
        const groups = await fetchDiscourseEmojiGroups(props.baseUrl)
        const map: Record<string, string> = {}
        groups.forEach(group => {
          group.emojis.forEach(emoji => {
            if (emoji.url) {
              map[emoji.name] = emoji.url
              map[emoji.id] = emoji.url
            }
          })
        })
        shortcodeEmojiUrls.value = map
      } catch {
        // 表情加载失败时回退为短码文本
      }
    }
    onMounted(loadShortcodeEmojiUrls)

    const getChannelTimeLabel = (channel: ChatChannel) => {
      const raw = channel.last_message_sent_at || channel.last_message?.created_at
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
      const iconValue = getChannelIconValue(channel)
      const shortcodeImage = iconValue ? shortcodeEmojiUrls.value[iconValue] || '' : ''
      const isUnicodeEmoji = iconValue && /\p{Emoji_Presentation}/u.test(iconValue)
      const memberCount = getChannelMemberCount(channel)
      const singleAvatar = isDirectChannel(channel) && !channel.chatable?.group && memberCount <= 1
      return (
        <button
          type="button"
          key={`${keyPrefix}-${channel.id}`}
          class={['chat-channel-item', channel.id === props.activeChannelId ? 'active' : '']}
          data-discourse-url={getChannelUrl(channel)}
          onClick={() => emit('select', channel)}
        >
          <div class="chat-channel-avatar">
            {singleAvatar && getChannelAvatar(channel) ? (
              <img
                src={getChannelAvatar(channel)}
                alt={getChannelTitle(channel)}
                data-user-card={getChannelUser(channel)?.username}
              />
            ) : shortcodeImage ? (
              <img
                class="chat-channel-emoji-image"
                src={shortcodeImage}
                alt={getChannelTitle(channel)}
              />
            ) : isUnicodeEmoji ? (
              <span class="chat-channel-emoji" role="img" aria-label={getChannelTitle(channel)}>
                {iconValue}
              </span>
            ) : memberCount > 0 ? (
              <span class="chat-channel-member-count" title={`${memberCount} 人在此频道`}>
                <TeamOutlined />
                {memberCount}
              </span>
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
