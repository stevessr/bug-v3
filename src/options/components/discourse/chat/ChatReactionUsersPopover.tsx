import { computed, defineComponent, nextTick, ref, watch, type PropType } from 'vue'
import { Spin } from 'ant-design-vue'

import type { ChatMessage, DiscourseUser } from '../types'
import { getAvatarUrl } from '../utils'
import { fetchChatMessageReactionUsers } from '../routes/chat'

import '../css/chat/ChatReactionUsersPopover.css'

const PAGE_SIZE = 50

const normalizeReaction = (reaction?: string | null) =>
  String(reaction || '')
    .replace(/^:([^:]+):$/, '$1')
    .trim()

export default defineComponent({
  name: 'ChatReactionUsersPopover',
  props: {
    open: { type: Boolean, required: true },
    message: { type: Object as PropType<ChatMessage | null>, default: null },
    channelId: { type: Number, default: undefined },
    reaction: { type: String as PropType<string | null>, default: null },
    baseUrl: { type: String, required: true },
    anchorEl: { type: Object as PropType<HTMLElement | null>, default: null },
    reactionEmojiMap: {
      type: Object as PropType<Record<string, { url?: string; unicode?: string }>>,
      default: () => ({})
    }
  },
  emits: ['close', 'keepOpen', 'navigate'],
  setup(props, { emit }) {
    const users = ref<DiscourseUser[]>([])
    const total = ref(0)
    const loading = ref(false)
    const errorMessage = ref('')
    const panelStyle = ref<Record<string, string>>({})
    let loadSequence = 0

    const reactionId = computed(() => normalizeReaction(props.reaction))
    const effectiveChannelId = computed(() => {
      const id = Number(props.channelId || props.message?.chat_channel_id || 0)
      return Number.isFinite(id) && id > 0 ? id : null
    })
    const title = computed(() => (reactionId.value ? `:${reactionId.value}:` : '消息反应'))

    const load = async () => {
      const messageId = Number(props.message?.id || 0)
      const channelId = effectiveChannelId.value
      const emoji = reactionId.value
      if (!messageId || !channelId || !emoji) {
        errorMessage.value = '无法确定这条消息的反应信息'
        return
      }

      const sequence = ++loadSequence
      loading.value = true
      errorMessage.value = ''
      try {
        const result = await fetchChatMessageReactionUsers(
          props.baseUrl,
          channelId,
          messageId,
          emoji,
          0,
          PAGE_SIZE
        )
        if (sequence !== loadSequence) return
        users.value = result.users
        total.value = result.totalRows
      } catch (error) {
        if (sequence !== loadSequence) return
        errorMessage.value = error instanceof Error ? error.message : '获取聊天反应用户失败'
      } finally {
        if (sequence === loadSequence) loading.value = false
      }
    }

    const updatePosition = () => {
      if (typeof window === 'undefined') return
      const padding = 12
      const gap = 8
      const preferredHeight = 220
      const width = Math.min(336, Math.max(260, window.innerWidth - padding * 2))
      const anchor = props.anchorEl?.getBoundingClientRect()

      let left = padding
      let top = padding
      if (anchor) {
        left = Math.max(
          padding,
          Math.min(anchor.left + anchor.width / 2 - width / 2, window.innerWidth - width - padding)
        )
        const roomAbove = anchor.top - padding - gap
        const roomBelow = window.innerHeight - anchor.bottom - padding - gap
        if (roomAbove >= preferredHeight || roomAbove >= roomBelow) {
          top = Math.max(padding, anchor.top - preferredHeight - gap)
        } else {
          top = Math.min(window.innerHeight - preferredHeight - padding, anchor.bottom + gap)
        }
      }

      panelStyle.value = {
        left: `${Math.round(left)}px`,
        top: `${Math.round(top)}px`,
        width: `${Math.round(width)}px`
      }
    }

    watch(
      () =>
        [
          props.open,
          props.message?.id,
          effectiveChannelId.value,
          props.reaction,
          props.anchorEl
        ] as const,
      ([open]) => {
        if (!open) return
        users.value = []
        total.value = 0
        errorMessage.value = ''
        void load()
        void nextTick(updatePosition)
      },
      { immediate: true }
    )

    const renderReactionEmoji = () => {
      const emoji = props.reactionEmojiMap[reactionId.value]
      if (emoji?.url) {
        return (
          <img
            class="chat-reaction-users-popover__emoji"
            src={emoji.url}
            alt={reactionId.value}
            loading="lazy"
          />
        )
      }
      if (emoji?.unicode) {
        return <span class="chat-reaction-users-popover__emoji">{emoji.unicode}</span>
      }
      return <code>:{reactionId.value}:</code>
    }

    const navigateToUser = (user: DiscourseUser) => {
      emit('navigate', `${props.baseUrl}/u/${encodeURIComponent(user.username)}`)
    }

    return () =>
      props.open ? (
        <div
          class="chat-reaction-users-popover"
          style={panelStyle.value}
          role="dialog"
          aria-label={`${title.value} 反应详情`}
          onPointerenter={() => emit('keepOpen')}
          onPointerleave={() => emit('close')}
        >
          <button
            type="button"
            class="chat-reaction-users-popover__close"
            aria-label="关闭反应详情"
            title="关闭"
            onClick={() => emit('close')}
          >
            ×
          </button>
          <div class="chat-reaction-users-popover__summary">
            <div class="chat-reaction-users-popover__title">
              {renderReactionEmoji()}
              <strong>{title.value}</strong>
            </div>
            <span>共 {total.value || users.value.length} 人</span>
          </div>

          {loading.value && (
            <div class="chat-reaction-users-popover__state" role="status">
              <Spin size="small" /> 正在加载…
            </div>
          )}
          {!loading.value && errorMessage.value && (
            <div class="chat-reaction-users-popover__state is-error" role="alert">
              {errorMessage.value}
            </div>
          )}
          {!loading.value && !errorMessage.value && users.value.length === 0 && (
            <div class="chat-reaction-users-popover__state">暂无可显示的反应用户</div>
          )}

          {users.value.length > 0 && (
            <div class="chat-reaction-users-popover__list">
              {users.value.map(user => (
                <button
                  type="button"
                  key={user.id || user.username}
                  class="chat-reaction-users-popover__user"
                  data-user-card={user.username}
                  data-discourse-url={`${props.baseUrl}/u/${encodeURIComponent(user.username)}`}
                  onClick={() => navigateToUser(user)}
                >
                  <img
                    src={getAvatarUrl(user.avatar_template, props.baseUrl, 40)}
                    alt=""
                    loading="lazy"
                  />
                  <span class="chat-reaction-users-popover__identity">
                    <strong>{user.name || user.username}</strong>
                    <small>@{user.username}</small>
                  </span>
                </button>
              ))}
            </div>
          )}

          {!loading.value && total.value > users.value.length && (
            <div class="chat-reaction-users-popover__more">
              已显示前 {users.value.length} 人，另有 {total.value - users.value.length} 人…
            </div>
          )}
        </div>
      ) : null
  }
})
