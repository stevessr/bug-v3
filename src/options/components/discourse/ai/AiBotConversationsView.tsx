import { computed, defineComponent, onMounted, ref } from 'vue'
import { MessageOutlined, ReloadOutlined, RobotOutlined, SendOutlined } from '@ant-design/icons-vue'

import { extractData, formatTime, getAvatarUrl, pageFetch } from '../utils'
import '../css/AiBotConversationsView.css'

type AiConversation = {
  id: number
  topic_id?: number
  slug?: string
  title: string
  excerpt?: string
  last_posted_at?: string
  created_at?: string
  user?: {
    username?: string
    name?: string
    avatar_template?: string
  }
}

const normalizeConversation = (value: any): AiConversation | null => {
  const topic = value?.topic && typeof value.topic === 'object' ? value.topic : value
  const topicId = Number(value?.topic_id ?? topic?.topic_id ?? topic?.id ?? value?.id)
  if (!Number.isFinite(topicId) || topicId <= 0) return null
  return {
    id: Number(value?.id ?? topic?.id ?? topicId),
    topic_id: topicId,
    slug: String(value?.slug || topic?.slug || '').trim() || undefined,
    title:
      String(value?.title || topic?.title || value?.fancy_title || 'AI 对话').trim() || 'AI 对话',
    excerpt: String(
      value?.excerpt || value?.blurb || value?.last_post_excerpt || topic?.excerpt || ''
    ).trim(),
    last_posted_at:
      value?.last_posted_at || topic?.last_posted_at || value?.bumped_at || value?.updated_at,
    created_at: value?.created_at || topic?.created_at,
    user: value?.user || topic?.user || value?.last_poster
  }
}

const conversationPath = (conversation: AiConversation) => {
  const id = conversation.topic_id || conversation.id
  const slug = conversation.slug ? `/${encodeURIComponent(conversation.slug)}` : ''
  return `/t${slug}/${id}`
}

export default defineComponent({
  name: 'AiBotConversationsView',
  props: {
    baseUrl: { type: String, required: true }
  },
  emits: ['navigate'],
  setup(props, { emit }) {
    const conversations = ref<AiConversation[]>([])
    const loading = ref(false)
    const loadingMore = ref(false)
    const sending = ref(false)
    const errorMessage = ref('')
    const page = ref(0)
    const hasMore = ref(false)
    const messageText = ref('')
    const targetUsername = ref('')
    const personaId = ref('')

    const hasMessage = computed(() => messageText.value.trim().length > 0)

    const conversationListFrom = (payload: any): any[] => {
      if (Array.isArray(payload)) return payload
      if (Array.isArray(payload?.conversations)) return payload.conversations
      if (Array.isArray(payload?.topics)) return payload.topics
      if (Array.isArray(payload?.data?.conversations)) return payload.data.conversations
      return []
    }

    const loadConversations = async (nextPage = 0) => {
      if (!props.baseUrl || (nextPage > 0 && (loadingMore.value || !hasMore.value))) return
      if (nextPage === 0) loading.value = true
      else loadingMore.value = true
      errorMessage.value = ''
      try {
        const params = new URLSearchParams({ page: String(nextPage), per_page: '40' })
        const result = await pageFetch<any>(
          `${props.baseUrl.replace(/\/+$/, '')}/discourse-ai/ai-bot/conversations.json?${params}`
        )
        const payload = extractData(result) || {}
        const normalized = conversationListFrom(payload)
          .map(normalizeConversation)
          .filter((item): item is AiConversation => !!item)
        conversations.value = nextPage === 0 ? normalized : [...conversations.value, ...normalized]
        page.value = nextPage
        hasMore.value = Boolean(
          payload?.meta?.has_more ?? payload?.has_more ?? normalized.length >= 40
        )
      } catch (error) {
        errorMessage.value = error instanceof Error ? error.message : '加载 AI 对话失败'
      } finally {
        loading.value = false
        loadingMore.value = false
      }
    }

    const startConversation = async () => {
      const raw = messageText.value.trim()
      if (!raw || sending.value) return
      sending.value = true
      errorMessage.value = ''
      try {
        const body = new URLSearchParams({
          raw,
          title: raw.slice(0, 80),
          archetype: 'private_message'
        })
        const recipient = targetUsername.value.trim().replace(/^@/, '')
        if (recipient) body.set('target_recipients', recipient)
        if (personaId.value.trim()) {
          // Match Discourse's composer form serialization (`meta_data[id]`),
          // which PostCreator reads as a nested params hash.
          body.set('meta_data[ai_persona_id]', personaId.value.trim())
        }
        const result = await pageFetch<any>(`${props.baseUrl.replace(/\/+$/, '')}/posts.json`, {
          method: 'POST',
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Discourse-Logged-In': 'true'
          },
          body: body.toString()
        })
        const payload = extractData(result)
        if (!result.ok) {
          const detail = payload?.errors?.join?.(', ') || payload?.error || '创建 AI 对话失败'
          throw new Error(detail)
        }
        messageText.value = ''
        await loadConversations(0)
        const topicId = Number(payload?.topic_id ?? payload?.post?.topic_id ?? payload?.topic?.id)
        if (Number.isFinite(topicId) && topicId > 0) {
          emit('navigate', `${props.baseUrl.replace(/\/+$/, '')}/t/${topicId}`)
        }
      } catch (error) {
        errorMessage.value = error instanceof Error ? error.message : '创建 AI 对话失败'
      } finally {
        sending.value = false
      }
    }

    const openConversation = (conversation: AiConversation) => {
      emit('navigate', `${props.baseUrl.replace(/\/+$/, '')}${conversationPath(conversation)}`)
    }

    onMounted(() => {
      void loadConversations()
    })

    return () => (
      <section class="ai-bot-conversations" aria-label="AI Bot 对话">
        <header class="ai-bot-conversations__header">
          <div class="ai-bot-conversations__title">
            <span class="ai-bot-conversations__icon" aria-hidden="true">
              <RobotOutlined />
            </span>
            <div>
              <h1>AI Bot 对话</h1>
              <p>与论坛中的 AI 助手开始私信对话。</p>
            </div>
          </div>
          <button
            type="button"
            class="ai-bot-conversations__refresh"
            title="刷新对话"
            aria-label="刷新对话"
            disabled={loading.value}
            onClick={() => void loadConversations(0)}
          >
            <ReloadOutlined spin={loading.value} />
          </button>
        </header>

        <div class="ai-bot-conversations__layout">
          <div class="ai-bot-conversations__list-panel">
            {loading.value && conversations.value.length === 0 ? (
              <div class="ai-bot-conversations__state">正在加载对话…</div>
            ) : conversations.value.length === 0 ? (
              <div class="ai-bot-conversations__state ai-bot-conversations__state--empty">
                <MessageOutlined />
                <strong>还没有 AI 对话</strong>
                <span>从右侧输入一条消息，开始第一次交流。</span>
              </div>
            ) : (
              <div class="ai-bot-conversations__list" role="list">
                {conversations.value.map(conversation => (
                  <button
                    key={`${conversation.id}-${conversation.topic_id}`}
                    type="button"
                    class="ai-bot-conversation-card"
                    role="listitem"
                    onClick={() => openConversation(conversation)}
                  >
                    <span class="ai-bot-conversation-card__avatar" aria-hidden="true">
                      {conversation.user?.avatar_template ? (
                        <img
                          src={getAvatarUrl(conversation.user.avatar_template, props.baseUrl, 48)}
                          alt=""
                        />
                      ) : (
                        <RobotOutlined />
                      )}
                    </span>
                    <span class="ai-bot-conversation-card__body">
                      <strong>{conversation.title}</strong>
                      {conversation.excerpt ? <span>{conversation.excerpt}</span> : null}
                      <small>
                        {conversation.last_posted_at || conversation.created_at
                          ? formatTime(conversation.last_posted_at || conversation.created_at || '')
                          : '刚刚'}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {errorMessage.value ? (
              <div class="ai-bot-conversations__error" role="alert">
                {errorMessage.value}
              </div>
            ) : null}
            {hasMore.value ? (
              <button
                type="button"
                class="ai-bot-conversations__load-more"
                disabled={loadingMore.value}
                onClick={() => void loadConversations(page.value + 1)}
              >
                {loadingMore.value ? '正在加载…' : '加载更多'}
              </button>
            ) : null}
          </div>

          <form
            class="ai-bot-conversations__composer"
            onSubmit={event => {
              event.preventDefault()
              void startConversation()
            }}
          >
            <div class="ai-bot-conversations__composer-heading">
              <strong>发起新对话</strong>
              <span>消息会以私信主题发送给 AI Bot。</span>
            </div>
            <label>
              <span>AI 用户名（可选）</span>
              <input
                value={targetUsername.value}
                placeholder="例如 ai-bot"
                autocomplete="off"
                onInput={event => (targetUsername.value = (event.target as HTMLInputElement).value)}
              />
            </label>
            <label>
              <span>Persona ID（可选）</span>
              <input
                value={personaId.value}
                placeholder="例如 1"
                autocomplete="off"
                onInput={event => (personaId.value = (event.target as HTMLInputElement).value)}
              />
            </label>
            <label>
              <span>消息</span>
              <textarea
                value={messageText.value}
                rows={7}
                placeholder="输入要发送给 AI Bot 的内容…"
                onInput={event => (messageText.value = (event.target as HTMLTextAreaElement).value)}
              />
            </label>
            <button
              type="submit"
              class="ai-bot-conversations__send"
              disabled={!hasMessage.value || sending.value}
            >
              <SendOutlined />
              <span>{sending.value ? '发送中…' : '开始对话'}</span>
            </button>
          </form>
        </div>
      </section>
    )
  }
})
