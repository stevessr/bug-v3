import { computed, defineComponent, onMounted } from 'vue'
import { CloseOutlined, CommentOutlined, ReloadOutlined } from '@ant-design/icons-vue'

import type { ChatChannel, ChatThread } from '../types'

import ChatThreadListItem, {
  getChatThreadUnreadCount,
  sortChatThreadsForDisplay
} from './ChatThreadListItem'
import '../css/chat/ChatChannelThreadsPanel.css'

export default defineComponent({
  name: 'ChatChannelThreadsPanel',
  props: {
    channel: { type: Object as () => ChatChannel, required: true },
    threads: { type: Array as () => ChatThread[], required: true },
    activeThreadId: { type: Number as () => number | null, default: null },
    baseUrl: { type: String, required: true },
    loaded: { type: Boolean, required: true },
    loading: { type: Boolean, required: true },
    loadingMore: { type: Boolean, required: true },
    loadMoreUrl: { type: String as () => string | null, default: null },
    errorMessage: { type: String, default: '' }
  },
  emits: ['close', 'load', 'loadMore', 'select'],
  setup(props, { emit }) {
    const channelTitle = computed(
      () =>
        props.channel.title ||
        props.channel.unicode_title ||
        props.channel.chatable?.name ||
        `频道 #${props.channel.id}`
    )
    const sortedThreads = computed(() => sortChatThreadsForDisplay(props.threads))
    const unreadCount = computed(() =>
      props.threads.reduce((total, thread) => total + getChatThreadUnreadCount(thread), 0)
    )

    onMounted(() => {
      if (!props.loaded && !props.loading) emit('load', props.channel.id)
    })

    return () => (
      <aside
        class="chat-channel-threads-panel"
        role="region"
        aria-label={`频道消息串：${channelTitle.value}`}
      >
        <header class="chat-channel-threads-panel__header">
          <span class="chat-channel-threads-panel__icon" aria-hidden="true">
            <CommentOutlined />
          </span>
          <div class="chat-channel-threads-panel__heading">
            <strong>频道消息串</strong>
            <span>
              {channelTitle.value}
              {unreadCount.value > 0 ? ` · ${unreadCount.value} 条未读` : ''}
            </span>
          </div>
          <div class="chat-channel-threads-panel__actions">
            <button
              type="button"
              aria-label="刷新频道消息串"
              title="刷新频道消息串"
              disabled={props.loading || props.loadingMore}
              onClick={() => emit('load', props.channel.id)}
            >
              <ReloadOutlined />
            </button>
            <button
              type="button"
              aria-label="关闭频道消息串"
              title="关闭频道消息串"
              onClick={() => emit('close')}
            >
              <CloseOutlined />
            </button>
          </div>
        </header>

        <div class="chat-channel-threads-panel__body">
          {props.loading && props.threads.length === 0 && (
            <div class="chat-channel-threads-panel__state" role="status">
              正在加载频道消息串…
            </div>
          )}
          {props.errorMessage && (
            <div class="chat-channel-threads-panel__state is-error" role="alert">
              <span>{props.errorMessage}</span>
              <button type="button" onClick={() => emit('load', props.channel.id)}>
                重试
              </button>
            </div>
          )}
          {props.loaded && !props.loading && !props.errorMessage && props.threads.length === 0 && (
            <div class="chat-channel-threads-panel__state">当前频道还没有带回复的消息串</div>
          )}

          {sortedThreads.value.map(thread => (
            <ChatThreadListItem
              key={thread.id}
              thread={thread}
              baseUrl={props.baseUrl}
              active={props.activeThreadId === thread.id}
              showChannel={false}
              onSelect={(selected: ChatThread) => emit('select', selected)}
            />
          ))}

          {props.loadMoreUrl && props.threads.length > 0 && (
            <button
              type="button"
              class="chat-channel-threads-panel__load-more"
              disabled={props.loadingMore}
              onClick={() => emit('loadMore', props.channel.id)}
            >
              {props.loadingMore ? '正在加载…' : '加载更多频道消息串'}
            </button>
          )}
        </div>
      </aside>
    )
  }
})
