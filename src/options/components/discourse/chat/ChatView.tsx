import { defineComponent, computed } from 'vue'

import type { ChatChannel, ChatState } from '../types'

import ChatChannelList from './ChatChannelList'
import ChatMessageList from './ChatMessageList'
import ChatComposer from './ChatComposer'
import '../css/chat/ChatView.css'

export default defineComponent({
  name: 'ChatView',
  props: {
    chatState: { type: Object as () => ChatState, required: true },
    baseUrl: { type: String, required: true },
    currentUsername: { type: String, default: undefined }
  },
  emits: [
    'selectChannel',
    'loadMore',
    'sendMessage',
    'navigate',
    'react',
    'editChannel',
    'interact'
  ],
  setup(props, { emit }) {
    const activeChannel = computed(
      () =>
        props.chatState.channels.find(channel => channel.id === props.chatState.activeChannelId) ||
        null
    )

    const activeChannelTitle = computed(() => {
      const channel = activeChannel.value
      if (!channel) return '选择频道'
      if (channel.title) return channel.title
      if (channel.unicode_title) return channel.unicode_title
      if (channel.chatable?.users?.length) {
        return channel.chatable.users.map(user => user.name || user.username).join(', ')
      }
      if (channel.direct_message_users?.length) {
        return channel.direct_message_users.map(user => user.name || user.username).join(', ')
      }
      if (channel.chatable?.name) return channel.chatable.name
      return `频道 #${channel.id}`
    })

    const activeMessages = computed(() => {
      const channelId = props.chatState.activeChannelId
      if (!channelId) return []
      return props.chatState.messagesByChannel[channelId] || []
    })

    const hasMore = computed(() => {
      const channelId = props.chatState.activeChannelId
      if (!channelId) return false
      return props.chatState.hasMoreByChannel[channelId] !== false
    })

    const canEditActiveChannel = computed(() => {
      const channel = activeChannel.value
      if (!channel) return false
      const isDirect =
        channel.channelType === 'direct' ||
        channel.chatable_type === 'DirectMessage' ||
        !!channel.direct_message_users?.length
      return !isDirect && channel.meta?.can_moderate !== false
    })

    const handleSelectChannel = (channel: ChatChannel) => {
      emit('selectChannel', channel)
    }

    const handleLoadMore = () => {
      if (!props.chatState.activeChannelId) return
      emit('loadMore', props.chatState.activeChannelId)
    }

    const handleSend = (message: string) => {
      if (!props.chatState.activeChannelId) return
      emit('sendMessage', { channelId: props.chatState.activeChannelId, message })
    }

    const handleNavigate = (url: string) => {
      emit('navigate', url)
    }

    const handleEditChannel = () => {
      const channel = activeChannel.value
      if (!channel) return

      const currentName = channel.title || channel.unicode_title || channel.chatable?.name || ''
      const nameInput = window.prompt('频道名称', currentName)
      if (nameInput === null) return
      const name = nameInput.trim()
      if (!name) return

      const descriptionInput = window.prompt('频道描述（可留空）', channel.description || '')
      if (descriptionInput === null) return

      emit('editChannel', {
        channelId: channel.id,
        updates: {
          name,
          description: descriptionInput.trim()
        }
      })
    }

    const handleReact = (payload: { messageId: number; emoji: string; reacted?: boolean }) => {
      const channelId = props.chatState.activeChannelId
      if (!channelId) return
      emit('react', { channelId, ...payload })
    }

    const handleInteract = (payload: { messageId: number; actionId: string }) => {
      const channelId = props.chatState.activeChannelId
      if (!channelId) return
      emit('interact', { channelId, ...payload })
    }

    return () => (
      <div class="chat-view">
        <div class="chat-sidebar">
          <div class="chat-sidebar-header">聊天</div>
          {props.chatState.errorMessage && (
            <div class="chat-error">{props.chatState.errorMessage}</div>
          )}
          <ChatChannelList
            channels={props.chatState.channels}
            activeChannelId={props.chatState.activeChannelId}
            baseUrl={props.baseUrl}
            loading={props.chatState.loadingChannels}
            onSelect={handleSelectChannel}
          />
        </div>

        <div class="chat-main">
          <div class="chat-main-header">
            <div class="chat-main-title">{activeChannelTitle.value}</div>
            {canEditActiveChannel.value && (
              <button class="chat-main-action-btn" onClick={handleEditChannel}>
                编辑频道
              </button>
            )}
          </div>

          {activeChannel.value ? (
            <ChatMessageList
              messages={activeMessages.value}
              baseUrl={props.baseUrl}
              currentUsername={props.currentUsername}
              loading={props.chatState.loadingMessages}
              hasMore={hasMore.value}
              onLoadMore={handleLoadMore}
              onNavigate={handleNavigate}
              onReact={handleReact}
              onInteract={handleInteract}
            />
          ) : (
            <div class="chat-empty">请选择一个频道开始聊天</div>
          )}

          <ChatComposer
            disabled={!activeChannel.value || props.chatState.sendingMessage}
            onSend={handleSend}
          />
        </div>
      </div>
    )
  }
})
