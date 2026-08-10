import {
  computed,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  watch
} from 'vue'
import { CloseOutlined, SearchOutlined } from '@ant-design/icons-vue'

import type { ChatChannel, ChatMessage, ChatSearchSort, ChatSearchState } from '../types'
import { stripHtml } from '../tagVisuals'
import { formatTime, getAvatarUrl } from '../utils'

import '../css/chat/ChatSearchPanel.css'

const SEARCH_DELAY_MS = 300

export default defineComponent({
  name: 'ChatSearchPanel',
  props: {
    searchState: { type: Object as () => ChatSearchState, required: true },
    channels: { type: Array as () => ChatChannel[], required: true },
    baseUrl: { type: String, required: true },
    initialChannelId: { type: Number, default: null }
  },
  emits: ['close', 'search', 'loadMore', 'navigate'],
  setup(props, { emit }) {
    const initialScope = props.initialChannelId || null
    const canReuseState = props.searchState.channelId === initialScope
    const query = shallowRef(canReuseState ? props.searchState.query : '')
    const channelId = shallowRef<number | null>(initialScope)
    const sort = shallowRef<ChatSearchSort>(canReuseState ? props.searchState.sort : 'relevance')
    const inputRef = shallowRef<HTMLInputElement | null>(null)
    let searchTimer: ReturnType<typeof globalThis.setTimeout> | null = null

    const currentSearchMatches = computed(
      () =>
        props.searchState.query === query.value.trim() &&
        props.searchState.channelId === channelId.value &&
        props.searchState.sort === sort.value
    )
    const visibleResults = computed(() =>
      currentSearchMatches.value ? props.searchState.results : []
    )
    const isLoading = computed(() => currentSearchMatches.value && props.searchState.loading)
    const isLoadingMore = computed(
      () => currentSearchMatches.value && props.searchState.loadingMore
    )
    const errorMessage = computed(() =>
      currentSearchMatches.value ? props.searchState.errorMessage : ''
    )
    const hasSearched = computed(
      () => Boolean(query.value.trim()) && currentSearchMatches.value && !isLoading.value
    )

    const clearTimer = () => {
      if (searchTimer === null) return
      globalThis.clearTimeout(searchTimer)
      searchTimer = null
    }

    const runSearch = () => {
      clearTimer()
      emit('search', {
        query: query.value,
        channelId: channelId.value,
        sort: sort.value
      })
    }

    const scheduleSearch = () => {
      clearTimer()
      if (!query.value.trim()) {
        runSearch()
        return
      }
      searchTimer = globalThis.setTimeout(runSearch, SEARCH_DELAY_MS)
    }

    const handleQueryInput = (event: Event) => {
      query.value = (event.currentTarget as HTMLInputElement).value
      scheduleSearch()
    }

    const handleQueryKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !event.isComposing) {
        event.preventDefault()
        runSearch()
      } else if (event.key === 'Escape') {
        event.preventDefault()
        emit('close')
      }
    }

    const handleScopeChange = (event: Event) => {
      const value = (event.currentTarget as HTMLSelectElement).value
      channelId.value = value === 'all' ? null : Number(value)
      if (query.value.trim()) runSearch()
    }

    const handleSortChange = (event: Event) => {
      sort.value =
        (event.currentTarget as HTMLSelectElement).value === 'latest' ? 'latest' : 'relevance'
      if (query.value.trim()) runSearch()
    }

    const channelForMessage = (message: ChatMessage) =>
      message.channel ||
      props.channels.find(channel => channel.id === Number(message.chat_channel_id || 0)) ||
      null

    const channelTitle = (message: ChatMessage) => {
      const channel = channelForMessage(message)
      return (
        channel?.title ||
        channel?.unicode_title ||
        channel?.chatable?.name ||
        (message.chat_channel_id ? `频道 #${message.chat_channel_id}` : '聊天')
      )
    }

    const messageUrl = (message: ChatMessage) => {
      const channel = channelForMessage(message)
      const resolvedChannelId = Number(message.chat_channel_id || channel?.id || 0)
      const slug = channel?.slug ? encodeURIComponent(channel.slug) : '-'
      const threadId = Number(message.thread_id || message.thread?.id || 0)
      const threadPath = threadId > 0 ? `/t/${threadId}` : ''
      return `${props.baseUrl}/chat/c/${slug}/${resolvedChannelId}${threadPath}/${message.id}`
    }

    const displayName = (message: ChatMessage) =>
      message.user?.name ||
      message.name ||
      message.user?.username ||
      message.username ||
      '已删除用户'

    const username = (message: ChatMessage) => message.user?.username || message.username || ''

    const avatarTemplate = (message: ChatMessage) =>
      message.user?.avatar_template || message.avatar_template || '/images/avatar.png'

    const excerpt = (message: ChatMessage) =>
      stripHtml(message.cooked || message.message) ||
      (message.deleted ? '该消息已被删除' : '空消息')

    const handleResultClick = (event: MouseEvent, message: ChatMessage) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return
      }
      event.preventDefault()
      emit('close')
      emit('navigate', messageUrl(message))
    }

    const loadMore = () => {
      if (!currentSearchMatches.value || !props.searchState.hasMore || isLoadingMore.value) return
      emit('loadMore')
    }

    watch(
      () => props.initialChannelId,
      value => {
        channelId.value = value || null
      }
    )

    onMounted(() => {
      void nextTick(() => inputRef.value?.focus())
    })
    onBeforeUnmount(clearTimer)

    return () => (
      <section class="chat-search-panel" role="region" aria-label="聊天消息搜索">
        <header class="chat-search-panel__header">
          <div>
            <strong>搜索聊天消息</strong>
            <span>支持全部聊天或当前频道，结果来自站点官方搜索</span>
          </div>
          <button
            type="button"
            aria-label="关闭聊天搜索"
            title="关闭"
            onClick={() => emit('close')}
          >
            <CloseOutlined />
          </button>
        </header>

        <div class="chat-search-panel__controls">
          <label class="chat-search-panel__query">
            <SearchOutlined aria-hidden="true" />
            <input
              ref={inputRef}
              value={query.value}
              type="search"
              aria-label="搜索聊天消息"
              placeholder="输入关键词搜索消息…"
              onInput={handleQueryInput}
              onKeydown={handleQueryKeydown}
            />
            <button type="button" onClick={runSearch} disabled={!query.value.trim()}>
              搜索
            </button>
          </label>
          <label>
            <span>范围</span>
            <select
              aria-label="聊天搜索范围"
              value={channelId.value || 'all'}
              onChange={handleScopeChange}
            >
              <option value="all">全部聊天</option>
              {props.channels.map(channel => (
                <option key={channel.id} value={channel.id}>
                  {channel.title ||
                    channel.unicode_title ||
                    channel.chatable?.name ||
                    `频道 #${channel.id}`}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>排序</span>
            <select aria-label="聊天搜索排序" value={sort.value} onChange={handleSortChange}>
              <option value="relevance">相关度</option>
              <option value="latest">最新优先</option>
            </select>
          </label>
        </div>

        <div class="chat-search-panel__body" aria-live="polite">
          {!query.value.trim() && (
            <div class="chat-search-panel__state">
              <SearchOutlined />
              <span>输入关键词，查找频道和消息串中的历史消息</span>
            </div>
          )}
          {isLoading.value && (
            <div class="chat-search-panel__state" role="status">
              <span class="chat-search-panel__spinner" aria-hidden="true" />
              <span>正在搜索…</span>
            </div>
          )}
          {errorMessage.value && !isLoading.value && (
            <div class="chat-search-panel__state is-error" role="alert">
              <span>{errorMessage.value}</span>
              <button type="button" onClick={runSearch}>
                重试
              </button>
            </div>
          )}
          {hasSearched.value && !errorMessage.value && visibleResults.value.length === 0 && (
            <div class="chat-search-panel__state">没有找到匹配的聊天消息</div>
          )}
          {visibleResults.value.length > 0 && (
            <div class="chat-search-panel__results" role="listbox" aria-label="聊天搜索结果">
              {visibleResults.value.map(message => {
                const href = messageUrl(message)
                const messageUsername = username(message)
                return (
                  <a
                    key={message.id}
                    class="chat-search-result"
                    role="option"
                    href={href}
                    data-discourse-url={href}
                    aria-label={`${displayName(message)}：${excerpt(message)}`}
                    onClick={(event: MouseEvent) => handleResultClick(event, message)}
                  >
                    <div class="chat-search-result__context">
                      <strong>{channelTitle(message)}</strong>
                      {message.thread_title && <span>消息串：{message.thread_title}</span>}
                    </div>
                    <div class="chat-search-result__message">
                      <img
                        src={getAvatarUrl(avatarTemplate(message), props.baseUrl, 32)}
                        alt={displayName(message)}
                        data-user-card={messageUsername || undefined}
                      />
                      <div>
                        <div class="chat-search-result__meta">
                          <strong>{displayName(message)}</strong>
                          <time datetime={message.created_at}>
                            {formatTime(message.created_at)}
                          </time>
                        </div>
                        <p>{excerpt(message)}</p>
                      </div>
                    </div>
                  </a>
                )
              })}
            </div>
          )}
          {currentSearchMatches.value && props.searchState.hasMore && (
            <button
              type="button"
              class="chat-search-panel__load-more"
              disabled={isLoadingMore.value}
              aria-busy={isLoadingMore.value}
              onClick={loadMore}
            >
              {isLoadingMore.value ? '正在加载…' : '加载更多结果'}
            </button>
          )}
        </div>
      </section>
    )
  }
})
