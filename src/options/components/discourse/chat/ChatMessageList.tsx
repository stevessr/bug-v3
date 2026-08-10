import { computed, defineComponent, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import type { ChatMessage, ParsedContent } from '../types'
import { parsePostContent } from '../parser/parsePostContent'

import ChatMessageItem from './ChatMessageItem'
import '../css/chat/ChatMessageList.css'

export default defineComponent({
  name: 'ChatMessageList',
  props: {
    messages: { type: Array as () => ChatMessage[], required: true },
    channelId: { type: Number, default: null },
    baseUrl: { type: String, required: true },
    currentUsername: { type: String, default: undefined },
    loading: { type: Boolean, required: true },
    hasMore: { type: Boolean, required: true },
    targetMessageId: { type: Number, default: null },
    threadingEnabled: { type: Boolean, default: false },
    inThread: { type: Boolean, default: false }
  },
  emits: [
    'loadMore',
    'navigate',
    'react',
    'interact',
    'reply',
    'openThread',
    'edit',
    'delete',
    'flag'
  ],
  setup(props, { emit }) {
    const listRef = ref<HTMLDivElement | null>(null)
    const parsedCache = new Map<number, ParsedContent>()
    const hasInitialisedScroll = ref(false)
    const stickToBottom = ref(true)
    const loadRequested = ref(false)
    const pendingPrependAnchor = ref<{ scrollHeight: number; scrollTop: number } | null>(null)
    const scrolledTargetKey = ref('')

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

    const isNearBottom = (element: HTMLElement) =>
      element.scrollHeight - element.clientHeight - element.scrollTop <= 36

    const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
      const element = listRef.value
      if (!element) return
      element.scrollTo({ top: element.scrollHeight, behavior })
    }

    const scrollToTarget = () => {
      const element = listRef.value
      const targetMessageId = props.targetMessageId
      if (!element || !targetMessageId) return false
      const key = `${props.channelId || 0}:${targetMessageId}`
      if (scrolledTargetKey.value === key) return false
      const target = element.querySelector<HTMLElement>(
        `[data-chat-message-id="${targetMessageId}"]`
      )
      if (!target) return false
      element.scrollTo({
        top: Math.max(0, target.offsetTop - (element.clientHeight - target.offsetHeight) / 2),
        behavior: 'auto'
      })
      scrolledTargetKey.value = key
      stickToBottom.value = false
      hasInitialisedScroll.value = true
      return true
    }

    const restorePrependAnchor = () => {
      const element = listRef.value
      const anchor = pendingPrependAnchor.value
      if (!element || !anchor) return false
      const heightDelta = element.scrollHeight - anchor.scrollHeight
      element.scrollTop = anchor.scrollTop + Math.max(0, heightDelta)
      pendingPrependAnchor.value = null
      return true
    }

    const handleLoadMore = () => {
      const element = listRef.value
      if (props.loading || !props.hasMore || loadRequested.value || !element) return
      pendingPrependAnchor.value = {
        scrollHeight: element.scrollHeight,
        scrollTop: element.scrollTop
      }
      loadRequested.value = true
      emit('loadMore')
    }

    const handleNavigate = (url: string) => {
      emit('navigate', url)
    }

    const handleReact = (payload: { messageId: number; emoji: string; reacted?: boolean }) => {
      emit('react', payload)
    }

    const handleInteract = (payload: { messageId: number; actionId: string }) => {
      emit('interact', payload)
    }

    const handleReply = (message: ChatMessage) => {
      emit('reply', message)
    }

    const handleOpenThread = (message: ChatMessage) => {
      emit('openThread', message)
    }

    const handleEdit = (message: ChatMessage) => {
      emit('edit', message)
    }

    const handleDelete = (message: ChatMessage) => {
      emit('delete', message)
    }

    const handleFlag = (message: ChatMessage) => {
      emit('flag', message)
    }

    const handleScroll = () => {
      const el = listRef.value
      if (!el) return
      stickToBottom.value = isNearBottom(el)
      if (el.scrollTop <= 28) handleLoadMore()
    }

    watch(
      () => props.channelId,
      async () => {
        hasInitialisedScroll.value = false
        stickToBottom.value = true
        loadRequested.value = false
        pendingPrependAnchor.value = null
        scrolledTargetKey.value = ''
        await nextTick()
        if (!props.loading) {
          if (!scrollToTarget()) scrollToBottom()
          hasInitialisedScroll.value = true
        }
      }
    )

    watch(
      () => props.targetMessageId,
      async () => {
        scrolledTargetKey.value = ''
        await nextTick()
        scrollToTarget()
      }
    )

    watch(
      () => [
        props.messages.length,
        props.messages[0]?.id || 0,
        props.messages[props.messages.length - 1]?.id || 0,
        props.targetMessageId || 0
      ],
      async () => {
        await nextTick()
        if (scrollToTarget()) return
        if (restorePrependAnchor()) {
          hasInitialisedScroll.value = true
          return
        }
        if (!hasInitialisedScroll.value && !props.loading) {
          if (!scrollToTarget()) scrollToBottom()
          hasInitialisedScroll.value = true
          return
        }
        if (stickToBottom.value) scrollToBottom()
      },
      { flush: 'post' }
    )

    watch(
      () => props.loading,
      async loading => {
        if (loading) return
        loadRequested.value = false
        await nextTick()
        if (scrollToTarget()) return
        if (pendingPrependAnchor.value) {
          restorePrependAnchor()
          return
        }
        if (!hasInitialisedScroll.value) {
          scrollToBottom()
          hasInitialisedScroll.value = true
        }
      }
    )

    onMounted(() => {
      listRef.value?.addEventListener('scroll', handleScroll, { passive: true })
      void nextTick(() => {
        if (!props.loading && !hasInitialisedScroll.value) {
          if (!scrollToTarget()) scrollToBottom()
          hasInitialisedScroll.value = true
        }
      })
    })

    onUnmounted(() => {
      listRef.value?.removeEventListener('scroll', handleScroll)
    })

    return () => (
      <div ref={listRef} class="chat-message-list">
        {props.hasMore && (
          <button
            type="button"
            class="chat-load-more"
            onClick={handleLoadMore}
            disabled={props.loading || loadRequested.value}
            aria-busy={props.loading}
          >
            {props.loading ? '加载中...' : '加载更早消息'}
          </button>
        )}
        {orderedMessages.value.length === 0 && !props.loading && (
          <div class="chat-message-list-empty">
            {props.inThread ? '暂无消息串回复' : '暂无消息，发送第一条消息吧'}
          </div>
        )}
        {orderedMessages.value.map(message => (
          <ChatMessageItem
            key={message.id}
            message={message}
            parsed={getParsedMessage(message)}
            baseUrl={props.baseUrl}
            channelId={props.channelId ?? message.chat_channel_id}
            isOwn={(message.user?.username || message.username) === props.currentUsername}
            highlighted={message.id === props.targetMessageId}
            threadingEnabled={props.threadingEnabled}
            inThread={props.inThread}
            onNavigate={handleNavigate}
            onReact={handleReact}
            onInteract={handleInteract}
            onReply={handleReply}
            onOpenThread={handleOpenThread}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onFlag={handleFlag}
          />
        ))}
      </div>
    )
  }
})
