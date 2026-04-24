import { computed, defineComponent } from 'vue'

import type { ChatMessage, ParsedContent } from '../types'
import { formatTime, getAvatarUrl } from '../utils'
import PostContent from '../topic/PostContent'
import '../css/chat/ChatMessageItem.css'

export default defineComponent({
  name: 'ChatMessageItem',
  props: {
    message: { type: Object as () => ChatMessage, required: true },
    parsed: { type: Object as () => ParsedContent, required: true },
    baseUrl: { type: String, required: true },
    isOwn: { type: Boolean, required: true }
  },
  emits: ['navigate', 'react', 'interact'],
  setup(props, { emit }) {
    const getDisplayName = () => {
      const user = props.message.user
      return user?.name || props.message.name || user?.username || props.message.username || '匿名'
    }

    const getAvatarTemplate = () => {
      const user = props.message.user
      return user?.avatar_template || props.message.avatar_template || ''
    }

    const reactionItems = computed(() =>
      Array.isArray(props.message.reactions) ? props.message.reactions : []
    )

    const blockButtons = computed(() => {
      const buttons: Array<{ actionId: string; label: string; style?: string }> = []
      const blocks = Array.isArray(props.message.blocks) ? props.message.blocks : []
      blocks.forEach(block => {
        const elements = Array.isArray(block.elements) ? block.elements : []
        elements.forEach(element => {
          if (element.type !== 'button' || !element.action_id) return
          buttons.push({
            actionId: element.action_id,
            label: element.text?.text || '回复邀请',
            style: element.style
          })
        })
      })
      return buttons
    })

    const formatReactionLabel = (emoji: string) => {
      const normalized = (emoji || '').trim()
      if (!normalized) return '🙂'
      if (/^[a-zA-Z0-9_+-]+$/.test(normalized)) {
        return `:${normalized}:`
      }
      return normalized
    }

    const handleReact = (emoji: string, reacted?: boolean) => {
      emit('react', {
        messageId: props.message.id,
        emoji,
        reacted
      })
    }

    const handleAddReaction = () => {
      // eslint-disable-next-line no-alert
      const input = window.prompt('输入表情短码（如 heart、+1）', 'heart')
      if (input === null) return
      const emoji = input.trim().replace(/^:/, '').replace(/:$/, '')
      if (!emoji) return
      handleReact(emoji, false)
    }

    const handleInteract = (actionId: string) => {
      emit('interact', {
        messageId: props.message.id,
        actionId
      })
    }

    return () => (
      <div class={['chat-message-item', props.isOwn ? 'chat-message-own' : '']}>
        <img
          class="chat-message-avatar"
          src={getAvatarUrl(getAvatarTemplate(), props.baseUrl, 32)}
          alt={getDisplayName()}
        />
        <div class="chat-message-content">
          <div class="chat-message-meta">
            <span class="chat-message-name">{getDisplayName()}</span>
            <span class="chat-message-time">{formatTime(props.message.created_at)}</span>
          </div>
          <PostContent
            segments={props.parsed.segments}
            baseUrl={props.baseUrl}
            onNavigate={(url: string) => emit('navigate', url)}
          />
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
            <button class="chat-message-reaction-add" title="添加反应" onClick={handleAddReaction}>
              +
            </button>
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
