import { defineComponent, computed } from 'vue'

import type { ChatChannel, ChatMessage, ChatState } from '../types'

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
    'interact',
    'replyToMessage',
    'cancelReply',
    'editMessage',
    'cancelEdit',
    'deleteMessage',
    'flagMessage',
    'uploadStart',
    'uploadEnd'
  ],
  setup(props, { emit }) {
    const activeChannel = computed(
      () =>
        props.chatState.channels.find(channel => channel.id === props.chatState.activeChannelId) ||
        null
    )

    const activeChannelTitle = computed(() => {
      const channel = activeChannel.value
      if (!channel) return '聊天'
      if (channel.title) return channel.title
      if (channel.channelType === 'direct' && channel.direct_message_users) {
        return channel.direct_message_users
          .map(u => u.name || u.username)
          .filter(Boolean)
          .join(', ')
      }
      return channel.chatable?.name || `频道 ${channel.id}`
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
      return !!channel?.meta?.can_moderate
    })

    const activeTypingUsers = computed(() => {
      const channelId = props.chatState.activeChannelId
      if (!channelId) return []
      const typing = props.chatState.typingUsers[channelId]
      if (!typing || typing.length === 0) return []
      return typing.filter(u => u.username !== props.currentUsername)
    })

    const typingText = computed(() => {
      const users = activeTypingUsers.value
      if (users.length === 0) return ''
      const names = users.map(u => u.name || u.username)
      if (names.length === 1) return `${names[0]} 正在输入...`
      if (names.length === 2) return `${names[0]} 和 ${names[1]} 正在输入...`
      return `${names[0]} 和其他人正在输入...`
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
      emit('editChannel', { channelId: channel.id })
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

    const handleReplyToMessage = (message: ChatMessage) => {
      emit('replyToMessage', message)
    }

    const handleCancelReply = () => {
      emit('cancelReply')
    }

    const handleEditMessage = (message: ChatMessage) => {
      emit('editMessage', message)
    }

    const handleCancelEdit = () => {
      emit('cancelEdit')
    }

    const handleDeleteMessage = (message: ChatMessage) => {
      emit('deleteMessage', { channelId: props.chatState.activeChannelId, messageId: message.id })
    }

    const handleFlagMessage = (message: ChatMessage) => {
      emit('flagMessage', { channelId: props.chatState.activeChannelId, messageId: message.id })
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
              onReply={handleReplyToMessage}
              onEdit={handleEditMessage}
              onDelete={handleDeleteMessage}
              onFlag={handleFlagMessage}
            />
          ) : (
            <div class="chat-empty">请选择一个频道开始聊天</div>
          )}

          {typingText.value && (
            <div class="chat-typing-indicator">{typingText.value}</div>
          )}

          <ChatComposer
            disabled={!activeChannel.value || props.chatState.sendingMessage}
            replyTo={props.chatState.replyToMessage}
            editingMessage={props.chatState.editingMessage}
            baseUrl={props.baseUrl}
            channelId={props.chatState.activeChannelId || 0}
            onSend={handleSend}
            onCancelReply={handleCancelReply}
            onCancelEdit={handleCancelEdit}
            onUploadStart={() => emit('uploadStart')}
            onUploadEnd={() => emit('uploadEnd')}
          />
        </div>
      </div>
    )
  }
})
