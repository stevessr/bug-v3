import { computed, defineComponent } from 'vue'
import { CloseOutlined, PushpinOutlined, ReloadOutlined } from '@ant-design/icons-vue'

import type { ChatChannel, ChatPinnedMessage } from '../types'
import { formatTime, getAvatarUrl } from '../utils'

import '../css/chat/ChatPinnedMessagesPanel.css'

const stripHtml = (value: string) =>
  value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export default defineComponent({
  name: 'ChatPinnedMessagesPanel',
  props: {
    channel: { type: Object as () => ChatChannel, required: true },
    pins: { type: Array as () => ChatPinnedMessage[], default: () => [] },
    loading: { type: Boolean, default: false },
    errorMessage: { type: String, default: '' },
    baseUrl: { type: String, required: true }
  },
  emits: ['close', 'load', 'open'],
  setup(props, { emit }) {
    const channelTitle = computed(
      () =>
        props.channel.title ||
        props.channel.unicode_title ||
        props.channel.chatable?.name ||
        `频道 #${props.channel.id}`
    )
    const orderedPins = computed(() =>
      [...props.pins].sort((left, right) => {
        const leftAt = new Date(left.pinned_at || 0).getTime()
        const rightAt = new Date(right.pinned_at || 0).getTime()
        return rightAt - leftAt
      })
    )
    const getExcerpt = (pin: ChatPinnedMessage) => {
      const source = pin.excerpt || pin.message?.message || pin.message?.cooked || ''
      const text = stripHtml(source)
      return text || '此置顶消息没有可显示的文本内容'
    }
    const getMessageLabel = (pin: ChatPinnedMessage) =>
      pin.message?.user?.name ||
      pin.message?.name ||
      pin.message?.user?.username ||
      pin.message?.username ||
      pin.pinned_by?.name ||
      pin.pinned_by?.username ||
      '聊天成员'

    return () => (
      <aside
        class="chat-pinned-messages-panel"
        role="region"
        aria-label={`频道置顶消息：${channelTitle.value}`}
      >
        <header class="chat-pinned-messages-panel__header">
          <span class="chat-pinned-messages-panel__icon" aria-hidden="true">
            <PushpinOutlined />
          </span>
          <div class="chat-pinned-messages-panel__heading">
            <strong>置顶消息</strong>
            <span>{channelTitle.value}</span>
          </div>
          <div class="chat-pinned-messages-panel__actions">
            <button
              type="button"
              aria-label="刷新置顶消息"
              title="刷新置顶消息"
              disabled={props.loading}
              onClick={() => emit('load', props.channel.id)}
            >
              <ReloadOutlined />
            </button>
            <button
              type="button"
              aria-label="关闭置顶消息"
              title="关闭置顶消息"
              onClick={() => emit('close')}
            >
              <CloseOutlined />
            </button>
          </div>
        </header>

        <div class="chat-pinned-messages-panel__body">
          {props.loading && props.pins.length === 0 && (
            <div class="chat-pinned-messages-panel__state" role="status">
              正在加载置顶消息…
            </div>
          )}
          {props.errorMessage && (
            <div class="chat-pinned-messages-panel__state is-error" role="alert">
              <span>{props.errorMessage}</span>
              <button type="button" onClick={() => emit('load', props.channel.id)}>
                重试
              </button>
            </div>
          )}
          {!props.loading && !props.errorMessage && orderedPins.value.length === 0 && (
            <div class="chat-pinned-messages-panel__state">当前频道还没有置顶消息</div>
          )}
          {orderedPins.value.map(pin => {
            const message = pin.message
            const avatar = message?.user?.avatar_template || message?.avatar_template
            return (
              <button
                key={`${pin.id}:${pin.chat_message_id}`}
                type="button"
                class="chat-pinned-messages-panel__item"
                onClick={() => emit('open', pin.chat_message_id)}
              >
                {avatar ? (
                  <img src={getAvatarUrl(avatar, props.baseUrl, 36)} alt="" aria-hidden="true" />
                ) : (
                  <span class="chat-pinned-messages-panel__fallback-avatar" aria-hidden="true">
                    {getMessageLabel(pin).slice(0, 1)}
                  </span>
                )}
                <span class="chat-pinned-messages-panel__item-main">
                  <span class="chat-pinned-messages-panel__item-meta">
                    <strong>{getMessageLabel(pin)}</strong>
                    {pin.pinned_at && (
                      <time datetime={pin.pinned_at}>{formatTime(pin.pinned_at)}</time>
                    )}
                  </span>
                  <span class="chat-pinned-messages-panel__excerpt">{getExcerpt(pin)}</span>
                </span>
              </button>
            )
          })}
        </div>
      </aside>
    )
  }
})
