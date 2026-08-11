import { computed, defineComponent, onMounted, ref, useId } from 'vue'
import { ReloadOutlined } from '@ant-design/icons-vue'

import type { ChatThread } from '../types'

import ChatThreadListItem, { getChatThreadUnreadCount } from './ChatThreadListItem'
import '../css/chat/ChatThreadList.css'

export default defineComponent({
  name: 'ChatThreadList',
  props: {
    threads: { type: Array as () => ChatThread[], required: true },
    activeThreadId: { type: Number as () => number | null, default: null },
    baseUrl: { type: String, required: true },
    loaded: { type: Boolean, required: true },
    loading: { type: Boolean, required: true },
    loadingMore: { type: Boolean, required: true },
    loadMoreUrl: { type: String as () => string | null, default: null },
    errorMessage: { type: String, default: '' }
  },
  emits: ['load', 'loadMore', 'select'],
  setup(props, { emit }) {
    const collapsed = ref(false)
    const contentId = `chat-my-threads-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`

    const totalUnread = computed(() =>
      props.threads.reduce((total, thread) => total + getChatThreadUnreadCount(thread), 0)
    )

    onMounted(() => {
      if (!props.loaded && !props.loading) emit('load')
    })

    return () => (
      <section class="chat-thread-list" data-chat-sidebar-section="my-threads">
        <div class="chat-thread-list__header">
          <button
            type="button"
            class="chat-thread-list__toggle"
            aria-expanded={!collapsed.value}
            aria-controls={contentId}
            onClick={() => (collapsed.value = !collapsed.value)}
          >
            <span class="chat-thread-list__chevron" aria-hidden="true">
              {collapsed.value ? '▶' : '▼'}
            </span>
            <span>消息串</span>
            {props.loaded && <span class="chat-thread-list__count">{props.threads.length}</span>}
            {totalUnread.value > 0 && (
              <span class="chat-thread-list__unread">{totalUnread.value}</span>
            )}
          </button>
          <button
            type="button"
            class="chat-thread-list__refresh"
            aria-label="刷新消息串"
            title="刷新消息串"
            disabled={props.loading || props.loadingMore}
            onClick={() => emit('load')}
          >
            <ReloadOutlined />
          </button>
        </div>

        {!collapsed.value && (
          <div id={contentId} class="chat-thread-list__content">
            {props.loading && props.threads.length === 0 && (
              <div class="chat-thread-list__state" role="status">
                正在加载消息串…
              </div>
            )}

            {props.errorMessage && (
              <div class="chat-thread-list__state is-error" role="alert">
                <span>{props.errorMessage}</span>
                <button type="button" onClick={() => emit('load')}>
                  重试
                </button>
              </div>
            )}

            {props.loaded &&
              !props.loading &&
              !props.errorMessage &&
              props.threads.length === 0 && (
                <div class="chat-thread-list__state">你参与的消息串会显示在这里</div>
              )}

            {props.threads.map(thread => (
              <ChatThreadListItem
                key={thread.id}
                thread={thread}
                baseUrl={props.baseUrl}
                active={props.activeThreadId === thread.id}
                onSelect={(selected: ChatThread) => emit('select', selected)}
              />
            ))}

            {props.loadMoreUrl && props.threads.length > 0 && (
              <button
                type="button"
                class="chat-thread-list__load-more"
                disabled={props.loadingMore}
                onClick={() => emit('loadMore')}
              >
                {props.loadingMore ? '正在加载…' : '加载更多消息串'}
              </button>
            )}
          </div>
        )}
      </section>
    )
  }
})
