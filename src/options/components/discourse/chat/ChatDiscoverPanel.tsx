import { computed, defineComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { CloseOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons-vue'

import type { ChatChannel } from '../types'

import '../css/chat/ChatDiscoverPanel.css'

export default defineComponent({
  name: 'ChatDiscoverPanel',
  props: {
    channels: { type: Array as () => ChatChannel[], default: () => [] },
    loading: { type: Boolean, default: false },
    errorMessage: { type: String, default: '' },
    joiningChannelIds: { type: Object as () => Record<number, boolean>, default: () => ({}) },
    baseUrl: { type: String, required: true }
  },
  emits: ['close', 'load', 'join'],
  setup(props, { emit }) {
    const query = ref('')
    let inputRef: HTMLInputElement | null = null

    const setInputRef = (element: Element | ComponentPublicInstance | null) => {
      inputRef = element instanceof HTMLInputElement ? element : null
    }

    const filteredChannels = computed(() => {
      const trimmed = query.value.trim().toLowerCase()
      if (!trimmed) return props.channels
      return props.channels.filter(channel => {
        const title = (
          channel.title ||
          channel.unicode_title ||
          channel.chatable?.name ||
          ''
        ).toLowerCase()
        const description = (channel.description || '').toLowerCase()
        return title.includes(trimmed) || description.includes(trimmed)
      })
    })

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') emit('close')
    }

    watch(
      () => props.loading,
      loading => {
        if (!loading && inputRef) {
          inputRef.focus()
        }
      }
    )

    onBeforeUnmount(() => {
      document.removeEventListener('keydown', handleKeydown)
    })

    const handleOpen = () => {
      document.addEventListener('keydown', handleKeydown)
      emit('load')
    }

    onMounted(handleOpen)

    const renderChannel = (channel: ChatChannel) => {
      const members = channel.memberships_count
      const joined = !!channel.current_user_membership?.following
      const joining = !!props.joiningChannelIds[channel.id]
      const title =
        channel.title || channel.unicode_title || channel.chatable?.name || `频道 #${channel.id}`
      const description = channel.description || ''

      return (
        <div key={channel.id} class="chat-discover-item">
          <div class="chat-discover-item__info">
            <div class="chat-discover-item__title">
              <span class="chat-discover-item__name">{title}</span>
              {channel.status === 'closed' && (
                <span class="chat-discover-item__closed">已关闭</span>
              )}
            </div>
            {description && <div class="chat-discover-item__desc">{description}</div>}
            <div class="chat-discover-item__meta">
              {typeof members === 'number' && members > 0 && <span>{members} 名成员</span>}
              {channel.threading_enabled && <span>支持消息串</span>}
            </div>
          </div>
          <button
            type="button"
            class={['chat-discover-item__join', joined ? 'joined' : '']}
            disabled={joined || joining}
            aria-label={joined ? `已加入 ${title}` : `加入 ${title}`}
            onClick={() => emit('join', channel.id)}
          >
            {joining ? (
              <span class="chat-discover-item__spinner" aria-hidden="true" />
            ) : joined ? (
              '已加入'
            ) : (
              <PlusOutlined />
            )}
            {!joining && <span>{joined ? '已加入' : '加入'}</span>}
          </button>
        </div>
      )
    }

    return () => (
      <section class="chat-discover-panel" role="region" aria-label="发现频道">
        <header class="chat-discover-panel__header">
          <div>
            <strong>发现频道</strong>
            <span>浏览站点的公开频道并加入</span>
          </div>
          <button
            type="button"
            aria-label="关闭发现频道"
            title="关闭"
            onClick={() => emit('close')}
          >
            <CloseOutlined />
          </button>
        </header>

        <div class="chat-discover-panel__controls">
          <label class="chat-discover-panel__query">
            <SearchOutlined />
            <input
              ref={setInputRef}
              type="search"
              value={query.value}
              placeholder="搜索频道名称或描述…"
              aria-label="搜索频道"
              onInput={(event: Event) => (query.value = (event.target as HTMLInputElement).value)}
            />
          </label>
          <span class="chat-discover-panel__count">{filteredChannels.value.length} 个频道</span>
        </div>

        <div class="chat-discover-panel__body" aria-live="polite">
          {props.loading && (
            <div class="chat-discover-panel__state" role="status">
              <span class="chat-discover-panel__spinner" aria-hidden="true" />
              正在加载频道…
            </div>
          )}
          {!props.loading && props.errorMessage && (
            <div class="chat-discover-panel__state is-error" role="alert">
              {props.errorMessage}
            </div>
          )}
          {!props.loading && !props.errorMessage && filteredChannels.value.length === 0 && (
            <div class="chat-discover-panel__state">
              {query.value.trim()
                ? '没有找到匹配的频道'
                : '暂无可发现的公开频道，可以创建一个新频道。'}
            </div>
          )}
          {!props.loading && filteredChannels.value.length > 0 && (
            <div class="chat-discover-panel__list">{filteredChannels.value.map(renderChannel)}</div>
          )}
        </div>
      </section>
    )
  }
})
