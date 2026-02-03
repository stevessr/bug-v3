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
    currentUsername: { type: String, default: null }
  },
  emits: ['selectChannel', 'loadMore', 'sendMessage', 'navigate'],
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
