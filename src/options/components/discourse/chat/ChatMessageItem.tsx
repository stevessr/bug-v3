import { computed, defineComponent, onBeforeUnmount, ref, watch } from 'vue'
import {
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
  FlagOutlined,
  ForwardOutlined,
  CommentOutlined
} from '@ant-design/icons-vue'

import type { ChatMessage, ParsedContent } from '../types'
import { formatTime, getAvatarUrl } from '../utils'
import PostContent from '../topic/PostContent'

import ChatEmojiPicker from './ChatEmojiPicker'
import '../css/chat/ChatMessageItem.css'

export default defineComponent({
  name: 'ChatMessageItem',
  props: {
    message: { type: Object as () => ChatMessage, required: true },
    parsed: { type: Object as () => ParsedContent, required: true },
    baseUrl: { type: String, required: true },
    channelId: { type: Number, default: undefined },
    isOwn: { type: Boolean, required: true },
    highlighted: { type: Boolean, default: false },
    threadingEnabled: { type: Boolean, default: false },
    inThread: { type: Boolean, default: false }
  },
  emits: ['navigate', 'react', 'interact', 'reply', 'openThread', 'edit', 'delete', 'flag'],
  setup(props, { emit }) {
    const showActions = ref(false)
    const showEmojiPicker = ref(false)
    const floatingControlsRef = ref<HTMLDivElement | null>(null)
    const reactionButtonRef = ref<HTMLButtonElement | null>(null)

    const getDisplayName = () => {
      const user = props.message.user
      return user?.name || props.message.name || user?.username || props.message.username || '匿名'
    }

    const getUsername = () => props.message.user?.username || props.message.username || ''

    const getAvatarTemplate = () => {
      return (
        props.message.user?.avatar_template || props.message.avatar_template || '/images/avatar.png'
      )
    }

    const reactionItems = computed(() =>
      Array.isArray(props.message.reactions) ? props.message.reactions : []
    )

    const threadReplyCount = computed(() =>
      Math.max(
        0,
        Number(props.message.thread?.reply_count || props.message.thread?.preview?.reply_count || 0)
      )
    )

    const threadParticipants = computed(() =>
      (props.message.thread?.preview?.participant_users || []).slice(0, 3)
    )

    const hasThreadAction = computed(
      () =>
        !props.inThread &&
        Boolean(props.threadingEnabled || props.message.thread?.force || props.message.thread?.id)
    )

    const blockButtons = computed(() => {
      if (!Array.isArray(props.message.blocks)) return []
      const buttons: Array<{ actionId: string; label: string; style?: string }> = []
      props.message.blocks.forEach(block => {
        if (Array.isArray(block.elements)) {
          block.elements.forEach(element => {
            if (element.action_id && element.text?.text) {
              buttons.push({
                actionId: element.action_id,
                label: element.text.text,
                style: element.style
              })
            }
          })
        }
      })
      return buttons
    })

    const formatReactionLabel = (emoji: string) => {
      if (/^:[a-zA-Z0-9_+-]+:$/.test(emoji)) {
        return emoji.replace(/:/g, '')
      }
      return emoji
    }

    const normalizeReactionValue = (emoji: string) => emoji.trim().replace(/^:([^:]+):$/, '$1')

    const handleReact = (emoji: string, reacted?: boolean) => {
      emit('react', { messageId: props.message.id, emoji, reacted })
      showEmojiPicker.value = false
    }

    const handleAddReaction = () => {
      showEmojiPicker.value = !showEmojiPicker.value
      showActions.value = false
    }

    const handleEmojiSelect = (emoji: string) => {
      const normalized = normalizeReactionValue(emoji)
      const existing = reactionItems.value.find(
        reaction => normalizeReactionValue(reaction.emoji) === normalized
      )
      handleReact(emoji, existing?.reacted || false)
    }

    const handleInteract = (actionId: string) => {
      emit('interact', { messageId: props.message.id, actionId })
    }

    const toggleActions = () => {
      showActions.value = !showActions.value
      showEmojiPicker.value = false
    }

    const closeFloatingControls = () => {
      showActions.value = false
      showEmojiPicker.value = false
    }

    const handleMouseleave = (event: MouseEvent) => {
      const relatedTarget = event.relatedTarget
      if (relatedTarget instanceof Node && floatingControlsRef.value?.contains(relatedTarget)) {
        return
      }
      closeFloatingControls()
    }

    const handleDocumentPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('.discourse-emoji-picker')) return
      if (target instanceof Node && !floatingControlsRef.value?.contains(target)) {
        closeFloatingControls()
      }
    }

    const handleDocumentKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeFloatingControls()
      }
    }

    const handleControlsFocusout = (event: FocusEvent) => {
      const nextTarget = event.relatedTarget
      if (nextTarget instanceof Node && floatingControlsRef.value?.contains(nextTarget)) return
      closeFloatingControls()
    }

    const removeDismissListeners = () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
      document.removeEventListener('keydown', handleDocumentKeydown)
    }

    watch(
      () => showActions.value || showEmojiPicker.value,
      open => {
        removeDismissListeners()
        if (open) {
          document.addEventListener('pointerdown', handleDocumentPointerDown, true)
          document.addEventListener('keydown', handleDocumentKeydown)
        }
      },
      { flush: 'sync' }
    )

    onBeforeUnmount(removeDismissListeners)

    const handleReply = () => {
      if (hasThreadAction.value) {
        emit('openThread', props.message)
      } else {
        emit('reply', props.message)
      }
      showActions.value = false
    }

    const handleOpenThread = () => {
      emit('openThread', props.message)
      closeFloatingControls()
    }

    const handleEdit = () => {
      emit('edit', props.message)
      showActions.value = false
    }

    const handleDelete = () => {
      emit('delete', props.message)
      showActions.value = false
    }

    const handleFlag = () => {
      emit('flag', props.message)
      showActions.value = false
    }

    // If deleted, render placeholder
    if (props.message.deleted) {
      return (
        <div
          class={[
            'chat-message-item',
            props.isOwn ? 'chat-message-own' : '',
            'is-deleted',
            props.highlighted ? 'is-search-target' : ''
          ]}
          data-chat-message-id={props.message.id}
        >
          <div class="chat-message-content">
            <div class="chat-message-meta">
              <span class="chat-message-name">{getDisplayName()}</span>
              <span class="chat-message-time">{formatTime(props.message.created_at)}</span>
            </div>
            <div class="chat-message-deleted-text">该消息已被删除</div>
          </div>
        </div>
      )
    }

    return () => (
      <div
        class={[
          'chat-message-item',
          props.isOwn ? 'chat-message-own' : '',
          props.highlighted ? 'is-search-target' : '',
          showActions.value || showEmojiPicker.value ? 'has-floating-controls' : ''
        ]}
        data-chat-message-id={props.message.id}
        onMouseleave={handleMouseleave}
      >
        <img
          class="chat-message-avatar"
          data-user-card={getUsername() || undefined}
          src={getAvatarUrl(getAvatarTemplate(), props.baseUrl, 32)}
          alt={getDisplayName()}
        />
        <div class="chat-message-content">
          <div class="chat-message-meta">
            <span class="chat-message-name">{getDisplayName()}</span>
            <span class="chat-message-time">{formatTime(props.message.created_at)}</span>
            {props.message.edited && <span class="chat-message-edited">已编辑</span>}
          </div>

          {props.message.cooked || props.message.message ? (
            <PostContent
              segments={props.parsed.segments}
              baseUrl={props.baseUrl}
              onNavigate={(url: string) => emit('navigate', url)}
            />
          ) : null}

          {!props.inThread && props.message.thread?.id && threadReplyCount.value > 0 && (
            <a
              class="chat-message-thread-indicator"
              href={`${props.baseUrl}/chat/c/-/${props.channelId || props.message.chat_channel_id}/t/${props.message.thread.id}`}
              aria-label={`打开消息串，共 ${threadReplyCount.value} 条回复`}
              title="打开消息串"
              onClick={(event: MouseEvent) => {
                if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
                event.preventDefault()
                handleOpenThread()
              }}
            >
              <span class="chat-message-thread-indicator__icon" aria-hidden="true">
                <CommentOutlined />
              </span>
              {threadParticipants.value.length > 0 && (
                <span class="chat-message-thread-indicator__participants" aria-hidden="true">
                  {threadParticipants.value.map(user => (
                    <img
                      key={user.id}
                      src={getAvatarUrl(user.avatar_template, props.baseUrl, 20)}
                      alt=""
                    />
                  ))}
                </span>
              )}
              <span class="chat-message-thread-indicator__count">
                {threadReplyCount.value} 条回复
              </span>
              {props.message.thread.preview?.last_reply_excerpt && (
                <span class="chat-message-thread-indicator__excerpt">
                  {props.message.thread.preview.last_reply_excerpt.replace(/<[^>]*>/g, '')}
                </span>
              )}
            </a>
          )}

          <div class="chat-message-footer">
            {reactionItems.value.map(reaction => (
              <button
                type="button"
                key={`${props.message.id}-${reaction.emoji}`}
                class={['chat-message-reaction', reaction.reacted ? 'active' : '']}
                onClick={() => handleReact(reaction.emoji, reaction.reacted)}
                title={reaction.emoji}
              >
                <span class="chat-message-reaction-emoji">
                  {formatReactionLabel(reaction.emoji)}
                </span>
                <span class="chat-message-reaction-count">{reaction.count}</span>
              </button>
            ))}
            <div
              ref={floatingControlsRef}
              class="chat-message-reaction-actions"
              onFocusout={handleControlsFocusout}
            >
              <button
                ref={reactionButtonRef}
                type="button"
                class="chat-message-reaction-add"
                title="添加反应"
                onClick={handleAddReaction}
                aria-label="添加消息反应"
                aria-expanded={showEmojiPicker.value}
              >
                +
              </button>
              <button
                type="button"
                class="chat-message-actions-toggle"
                title="更多操作"
                onClick={toggleActions}
                aria-label="更多消息操作"
                aria-haspopup="menu"
                aria-expanded={showActions.value}
              >
                <MoreOutlined />
              </button>
              <ChatEmojiPicker
                visible={showEmojiPicker.value}
                baseUrl={props.baseUrl}
                anchorEl={reactionButtonRef.value}
                onSelect={handleEmojiSelect}
                onClose={() => {
                  showEmojiPicker.value = false
                }}
              />
              {showActions.value && (
                <div class="chat-message-actions-menu" role="menu" aria-label="消息操作">
                  <button
                    type="button"
                    class="chat-message-actions-item"
                    role="menuitem"
                    onClick={handleReply}
                  >
                    {hasThreadAction.value ? <CommentOutlined /> : <ForwardOutlined />}
                    {hasThreadAction.value
                      ? props.message.thread?.id
                        ? '打开消息串'
                        : '在消息串中回复'
                      : '回复'}
                  </button>
                  {props.isOwn && (
                    <button
                      type="button"
                      class="chat-message-actions-item"
                      role="menuitem"
                      onClick={handleEdit}
                    >
                      <EditOutlined /> 编辑
                    </button>
                  )}
                  {props.isOwn && (
                    <button
                      type="button"
                      class="chat-message-actions-item is-danger"
                      role="menuitem"
                      onClick={handleDelete}
                    >
                      <DeleteOutlined /> 删除
                    </button>
                  )}
                  {!props.isOwn && (
                    <button
                      type="button"
                      class="chat-message-actions-item is-danger"
                      role="menuitem"
                      onClick={handleFlag}
                    >
                      <FlagOutlined /> 举报
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {blockButtons.value.length > 0 && (
            <div class="chat-message-blocks">
              {blockButtons.value.map((button, index) => (
                <button
                  type="button"
                  key={`${button.actionId}-${index}`}
                  class={['chat-message-block-button', button.style ? `is-${button.style}` : '']}
                  onClick={() => handleInteract(button.actionId)}
                >
                  {button.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }
})
