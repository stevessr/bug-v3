import { computed, defineComponent, nextTick, ref, watch } from 'vue'
import {
  BellOutlined,
  CheckOutlined,
  CloseOutlined,
  CommentOutlined,
  DownOutlined,
  EditOutlined,
  LockOutlined
} from '@ant-design/icons-vue'

import type { ChatMessage, ChatThread } from '../types'
import EmojiTitle from '../layout/EmojiTitle'

import ChatComposer from './ChatComposer'
import ChatMessageList from './ChatMessageList'
import '../css/chat/ChatThreadPanel.css'

export default defineComponent({
  name: 'ChatThreadPanel',
  props: {
    thread: { type: Object as () => ChatThread, required: true },
    messages: { type: Array as () => ChatMessage[], required: true },
    channelId: { type: Number, required: true },
    baseUrl: { type: String, required: true },
    currentUsername: { type: String, default: undefined },
    currentUserStaff: { type: Boolean, default: false },
    loading: { type: Boolean, required: true },
    sending: { type: Boolean, required: true },
    hasMore: { type: Boolean, required: true },
    targetMessageId: { type: Number, default: null },
    errorMessage: { type: String, default: '' },
    notificationSaving: { type: Boolean, default: false },
    titleSaving: { type: Boolean, default: false },
    canManagePins: { type: Boolean, default: false },
    pinnedMessageIds: { type: Array as () => number[], default: () => [] },
    pinSavingByMessageId: { type: Object as () => Record<number, boolean>, default: () => ({}) },
    replyTo: { type: Object as () => ChatMessage | null, default: null },
    editingMessage: { type: Object as () => ChatMessage | null, default: null }
  },
  emits: [
    'close',
    'loadMore',
    'send',
    'navigate',
    'react',
    'interact',
    'reply',
    'cancelReply',
    'edit',
    'cancelEdit',
    'updateNotificationLevel',
    'updateTitle',
    'delete',
    'flag',
    'pin',
    'uploadStart',
    'uploadEnd'
  ],
  setup(props, { emit }) {
    const editingTitle = ref(false)
    const titleDraft = ref('')
    const titleInput = ref<HTMLInputElement | null>(null)
    const title = computed(() => props.thread.title?.trim() || '消息串')
    const replyCount = computed(() =>
      Math.max(0, Number(props.thread.reply_count || props.thread.preview?.reply_count || 0))
    )
    const isReadOnly = computed(() =>
      ['read_only', 'closed', 'archived'].includes(props.thread.status || '')
    )
    const statusText = computed(() => {
      if (props.thread.status === 'archived') return '此消息串已归档'
      if (props.thread.status === 'closed') return '此消息串已关闭'
      if (props.thread.status === 'read_only') return '此消息串为只读'
      return ''
    })
    const notificationLevel = computed(() => {
      const raw = props.thread.current_user_membership?.notification_level
      if (typeof raw === 'number' && [1, 2, 3].includes(raw)) return raw
      const normalized = String(raw || '').toLowerCase()
      if (normalized === 'watching') return 3
      if (normalized === 'tracking') return 2
      return 1
    })
    const canEditTitle = computed(() => {
      const originalAuthor =
        props.thread.original_message?.user?.username || props.thread.original_message?.username
      return Boolean(
        props.currentUserStaff ||
        (props.currentUsername && originalAuthor === props.currentUsername)
      )
    })
    const normalizedDraft = computed(() => titleDraft.value.trim())
    const titleChanged = computed(
      () => normalizedDraft.value !== String(props.thread.title || '').trim()
    )

    watch(
      () => props.thread.id,
      () => {
        editingTitle.value = false
        titleDraft.value = ''
      }
    )

    watch(
      () => props.thread.title,
      value => {
        if (editingTitle.value && String(value || '').trim() === normalizedDraft.value) {
          editingTitle.value = false
        }
      }
    )

    const beginTitleEdit = async () => {
      if (!canEditTitle.value || props.titleSaving) return
      titleDraft.value = props.thread.title || ''
      editingTitle.value = true
      await nextTick()
      titleInput.value?.focus()
      titleInput.value?.select()
    }

    const cancelTitleEdit = () => {
      if (props.titleSaving) return
      editingTitle.value = false
      titleDraft.value = ''
    }

    const saveTitle = () => {
      if (props.titleSaving || normalizedDraft.value.length > 100) return
      if (!titleChanged.value) {
        cancelTitleEdit()
        return
      }
      emit('updateTitle', normalizedDraft.value)
    }

    const handleTitleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        cancelTitleEdit()
      } else if (event.key === 'Enter' && !event.isComposing) {
        event.preventDefault()
        saveTitle()
      }
    }

    const handleNotificationLevelChange = (event: Event) => {
      const level = Number((event.currentTarget as HTMLSelectElement).value)
      if ([1, 2, 3].includes(level) && level !== notificationLevel.value) {
        emit('updateNotificationLevel', level)
      }
    }

    return () => (
      <aside class="chat-thread-panel" role="region" aria-label={`消息串：${title.value}`}>
        <header class="chat-thread-panel__header">
          <span class="chat-thread-panel__header-icon" aria-hidden="true">
            <CommentOutlined />
          </span>
          <div class="chat-thread-panel__heading">
            {editingTitle.value ? (
              <div class="chat-thread-panel__title-editor">
                <input
                  ref={titleInput}
                  value={titleDraft.value}
                  maxlength={100}
                  aria-label="消息串标题"
                  disabled={props.titleSaving}
                  onInput={(event: Event) =>
                    (titleDraft.value = (event.currentTarget as HTMLInputElement).value)
                  }
                  onKeydown={handleTitleKeydown}
                />
                <span aria-live="polite">{titleDraft.value.length}/100</span>
                <button
                  type="button"
                  aria-label="保存消息串标题"
                  title="保存"
                  disabled={props.titleSaving || normalizedDraft.value.length > 100}
                  onClick={saveTitle}
                >
                  <CheckOutlined />
                </button>
                <button
                  type="button"
                  aria-label="取消编辑消息串标题"
                  title="取消"
                  disabled={props.titleSaving}
                  onClick={cancelTitleEdit}
                >
                  <CloseOutlined />
                </button>
              </div>
            ) : (
              <div class="chat-thread-panel__title-row">
                <strong>
                  <EmojiTitle text={title.value} baseUrl={props.baseUrl} />
                </strong>
                {canEditTitle.value && (
                  <button
                    type="button"
                    aria-label="编辑消息串标题"
                    title="编辑消息串标题"
                    onClick={() => void beginTitleEdit()}
                  >
                    <EditOutlined />
                  </button>
                )}
              </div>
            )}
            <span>{replyCount.value} 条回复</span>
          </div>
          <div class="chat-thread-panel__header-actions">
            <label
              class={['chat-thread-panel__tracking', props.notificationSaving ? 'is-saving' : '']}
              title="设置此消息串的通知级别"
            >
              <BellOutlined aria-hidden="true" />
              <span class="chat-thread-panel__tracking-select-wrap">
                <select
                  aria-label="消息串通知级别"
                  value={notificationLevel.value}
                  disabled={props.notificationSaving}
                  onChange={handleNotificationLevelChange}
                >
                  <option value={3}>关注：所有新回复</option>
                  <option value={2}>跟踪：显示未读</option>
                  <option value={1}>常规：仅提及</option>
                </select>
                <DownOutlined aria-hidden="true" />
              </span>
            </label>
            <button
              type="button"
              class="chat-thread-panel__close"
              aria-label="关闭消息串"
              title="关闭消息串"
              onClick={() => emit('close')}
            >
              <CloseOutlined />
            </button>
          </div>
        </header>

        {props.errorMessage && (
          <div class="chat-thread-panel__error" role="alert">
            {props.errorMessage}
          </div>
        )}

        <ChatMessageList
          messages={props.messages}
          channelId={props.thread.id}
          baseUrl={props.baseUrl}
          currentUsername={props.currentUsername}
          loading={props.loading}
          hasMore={props.hasMore}
          targetMessageId={props.targetMessageId}
          inThread
          canManagePins={props.canManagePins}
          pinnedMessageIds={props.pinnedMessageIds}
          pinSavingByMessageId={props.pinSavingByMessageId}
          onLoadMore={() => emit('loadMore', props.thread.id)}
          onNavigate={(url: string) => emit('navigate', url)}
          onReact={(payload: { messageId: number; emoji: string; reacted?: boolean }) =>
            emit('react', payload)
          }
          onInteract={(payload: { messageId: number; actionId: string }) =>
            emit('interact', payload)
          }
          onReply={(message: ChatMessage) => emit('reply', message)}
          onEdit={(message: ChatMessage) => emit('edit', message)}
          onDelete={(message: ChatMessage) => emit('delete', message)}
          onFlag={(message: ChatMessage) => emit('flag', message)}
          onPin={(payload: { messageId: number; pinned: boolean }) => emit('pin', payload)}
        />

        {isReadOnly.value ? (
          <div class="chat-thread-panel__read-only">
            <LockOutlined />
            <span>{statusText.value}</span>
          </div>
        ) : (
          <ChatComposer
            disabled={props.sending}
            replyTo={props.replyTo}
            editingMessage={props.editingMessage}
            baseUrl={props.baseUrl}
            channelId={props.channelId}
            onSend={(message: string) => emit('send', message)}
            onCancelReply={() => emit('cancelReply')}
            onCancelEdit={() => emit('cancelEdit')}
            onUploadStart={() => emit('uploadStart')}
            onUploadEnd={() => emit('uploadEnd')}
          />
        )}
      </aside>
    )
  }
})
