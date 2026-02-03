import { defineComponent } from 'vue'

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
  emits: ['navigate'],
  setup(props, { emit }) {
    const getDisplayName = () => {
      const user = props.message.user
      return user?.name || props.message.name || user?.username || props.message.username || '匿名'
    }

    const getAvatarTemplate = () => {
      const user = props.message.user
      return user?.avatar_template || props.message.avatar_template || ''
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
        </div>
      </div>
    )
  }
})
