import { defineComponent, computed, onMounted, onUnmounted, ref } from 'vue'

import type { ChatMessage, ParsedContent } from '../types'
import { parsePostContent } from '../utils'

import ChatMessageItem from './ChatMessageItem'
import '../css/chat/ChatMessageList.css'

export default defineComponent({
  name: 'ChatMessageList',
  props: {
    messages: { type: Array as () => ChatMessage[], required: true },
    baseUrl: { type: String, required: true },
    currentUsername: { type: String, default: null },
    loading: { type: Boolean, required: true },
    hasMore: { type: Boolean, required: true }
  },
  emits: ['loadMore', 'navigate'],
  setup(props, { emit }) {
    const listRef = ref<HTMLDivElement | null>(null)
    const parsedCache = new Map<number, ParsedContent>()

    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')

    const getParsedMessage = (message: ChatMessage) => {
      const cached = parsedCache.get(message.id)
      if (cached) return cached
      const html = message.cooked || `<p>${escapeHtml(message.message || '')}</p>`
      const parsed = parsePostContent(html, props.baseUrl)
      parsedCache.set(message.id, parsed)
      return parsed
    }

    const orderedMessages = computed(() => [...props.messages].sort((a, b) => a.id - b.id))

    const handleLoadMore = () => {
      emit('loadMore')
    }

    const handleNavigate = (url: string) => {
      emit('navigate', url)
    }

    const handleScroll = () => {
      if (props.loading || !props.hasMore) return
      const el = listRef.value
      if (!el) return
      if (el.scrollTop <= 20) {
        emit('loadMore')
      }
    }

    onMounted(() => {
      listRef.value?.addEventListener('scroll', handleScroll, { passive: true })
    })

    onUnmounted(() => {
      listRef.value?.removeEventListener('scroll', handleScroll)
    })

    return () => (
      <div ref={listRef} class="chat-message-list">
        {props.hasMore && (
          <button class="chat-load-more" onClick={handleLoadMore} disabled={props.loading}>
            {props.loading ? '加载中...' : '加载更早消息'}
          </button>
        )}
        {orderedMessages.value.map(message => (
          <ChatMessageItem
            key={message.id}
            message={message}
            parsed={getParsedMessage(message)}
            baseUrl={props.baseUrl}
            isOwn={(message.user?.username || message.username) === props.currentUsername}
            onNavigate={handleNavigate}
          />
        ))}
      </div>
    )
  }
})
