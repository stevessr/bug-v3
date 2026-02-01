<script setup lang="ts">
import { computed } from 'vue'

import type { ChatChannel, ChatState } from '../types'

import ChatChannelList from './ChatChannelList.vue'
import ChatMessageList from './ChatMessageList.vue'
import ChatComposer from './ChatComposer.vue'

const props = defineProps<{
  chatState: ChatState
  baseUrl: string
  currentUsername: string | null
}>()

const emit = defineEmits<{
  (e: 'selectChannel', channel: ChatChannel): void
  (e: 'loadMore', channelId: number): void
  (e: 'sendMessage', payload: { channelId: number; message: string }): void
  (e: 'navigate', url: string): void
}>()

const activeChannel = computed(() =>
  props.chatState.channels.find(channel => channel.id === props.chatState.activeChannelId) || null
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
</script>

<template>
  <div class="chat-view">
    <div class="chat-sidebar">
      <div class="chat-sidebar-header">聊天</div>
      <div v-if="chatState.errorMessage" class="chat-error">
        {{ chatState.errorMessage }}
      </div>
      <ChatChannelList
        :channels="chatState.channels"
        :activeChannelId="chatState.activeChannelId"
        :baseUrl="baseUrl"
        :loading="chatState.loadingChannels"
        @select="handleSelectChannel"
      />
    </div>

    <div class="chat-main">
      <div class="chat-main-header">
        <div class="chat-main-title">
          {{ activeChannelTitle }}
        </div>
      </div>

      <ChatMessageList
        v-if="activeChannel"
        :messages="activeMessages"
        :baseUrl="baseUrl"
        :currentUsername="currentUsername"
        :loading="chatState.loadingMessages"
        :hasMore="hasMore"
        @loadMore="handleLoadMore"
        @navigate="handleNavigate"
      />
      <div v-else class="chat-empty">请选择一个频道开始聊天</div>

      <ChatComposer
        :disabled="!activeChannel || chatState.sendingMessage"
        @send="handleSend"
      />
    </div>
  </div>
</template>

<style scoped src="../css/chat/ChatView.css"></style>
