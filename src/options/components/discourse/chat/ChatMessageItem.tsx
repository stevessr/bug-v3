import { computed, defineComponent, ref } from 'vue'
import { MoreOutlined, EditOutlined, DeleteOutlined, FlagOutlined, ForwardOutlined } from '@ant-design/icons-vue'

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
    isOwn: { type: Boolean, required: true }
  },
  emits: ['navigate', 'react', 'interact', 'reply', 'edit', 'delete', 'flag'],
  setup(props, { emit }) {
    const showActions = ref(false)
    const showEmojiPicker = ref(false)
    const actionsRef = ref<HTMLDivElement | null>(null)

    const getDisplayName = () => {
      const user = props.message.user
      return user?.name || props.message.name || user?.username || props.message.username || '匿名'
    }

    const getAvatarTemplate = () => {
      return (
        props.message.user?.avatar_template ||
        props.message.avatar_template ||
        '/images/avatar.png'
      )
    }

    const reactionItems = computed(() =>
      Array.isArray(props.message.reactions) ? props.message.reactions : []
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

    const handleReact = (emoji: string, reacted?: boolean) => {
      emit('react', { messageId: props.message.id, emoji, reacted })
      showEmojiPicker.value = false
    }

    const handleAddReaction = () => {
      showEmojiPicker.value = !showEmojiPicker.value
      showActions.value = false
    }

    const handleEmojiSelect = (emoji: string) => {
      const existing = reactionItems.value.find(r => r.emoji === emoji)
      handleReact(emoji, existing?.reacted || false)
    }

    const handleInteract = (actionId: string) => {
      emit('interact', { messageId: props.message.id, actionId })
    }

    const toggleActions = () => {
      showActions.value = !showActions.value
      showEmojiPicker.value = false
    }

    const handleReply = () => {
      emit('reply', props.message)
      showActions.value = false
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
        <div class={['chat-message-item', props.isOwn ? 'chat-message-own' : '', 'is-deleted']}>
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
        class={['chat-message-item', props.isOwn ? 'chat-message-own' : '']}
        onMouseenter={() => { if (!showActions.value) showActions.value = true }}
        onMouseleave={() => { if (!showActions.value) showActions.value = false }}
      >
        <img
          class="chat-message-avatar"
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

          <div class="chat-message-footer">
            {reactionItems.value.map(reaction => (
              <button
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
            <div class="chat-message-reaction-actions">
              <button
                class="chat-message-reaction-add"
                title="添加反应"
                onClick={handleAddReaction}
              >
                +
              </button>
              <button
                class="chat-message-actions-toggle"
                title="更多操作"
                onClick={toggleActions}
              >
                <MoreOutlined />
              </button>
              <ChatEmojiPicker
                visible={showEmojiPicker.value}
                onSelect={handleEmojiSelect}
                onClose={() => { showEmojiPicker.value = false }}
              />
              {showActions.value && (
                <div ref={actionsRef} class="chat-message-actions-menu">
                  <button class="chat-message-actions-item" onClick={handleReply}>
                    <ForwardOutlined /> 回复
                  </button>
                  {props.isOwn && (
                    <button class="chat-message-actions-item" onClick={handleEdit}>
                      <EditOutlined /> 编辑
                    </button>
                  )}
                  {props.isOwn && (
                    <button class="chat-message-actions-item is-danger" onClick={handleDelete}>
                      <DeleteOutlined /> 删除
                    </button>
                  )}
                  {!props.isOwn && (
                    <button class="chat-message-actions-item is-danger" onClick={handleFlag}>
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
