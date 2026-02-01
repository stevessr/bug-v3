<script setup lang="ts">
import { computed } from 'vue'

import type { ChatChannel } from '../types'
import { formatTime, getAvatarUrl } from '../utils'

const props = defineProps<{
  channels: ChatChannel[]
  activeChannelId: number | null
  baseUrl: string
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'select', channel: ChatChannel): void
}>()

const getChannelLastTime = (channel: ChatChannel) => {
  const fallback = channel.last_message?.created_at
  const raw = channel.last_message_sent_at || fallback
  return raw ? new Date(raw).getTime() : 0
}

const sortedChannels = computed(() => {
  return [...props.channels].sort((a, b) => {
    const aTime = getChannelLastTime(a)
    const bTime = getChannelLastTime(b)
    return bTime - aTime
  })
})

const getChannelTitle = (channel: ChatChannel) => {
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
}

const getChannelAvatar = (channel: ChatChannel) => {
  const user = channel.chatable?.users?.[0] || channel.direct_message_users?.[0]
  if (!user?.avatar_template) return ''
  return getAvatarUrl(user.avatar_template, props.baseUrl, 32)
}

const getChannelTimeLabel = (channel: ChatChannel) => {
  const raw = channel.last_message_sent_at || channel.last_message?.created_at
  return raw ? formatTime(raw) : '暂无消息'
}

const getUnreadCount = (channel: ChatChannel) => {
  const count = channel.current_user_membership?.unread_count
  return typeof count === 'number' && count > 0 ? count : 0
}

const handleSelect = (channel: ChatChannel) => {
  emit('select', channel)
}
</script>

<template>
  <div class="chat-channel-list">
    <div v-if="loading" class="chat-channel-loading">加载频道中...</div>
    <button
      v-for="channel in sortedChannels"
      :key="channel.id"
      class="chat-channel-item"
      :class="{ active: channel.id === activeChannelId }"
      @click="handleSelect(channel)"
    >
      <div class="chat-channel-avatar">
        <img
          v-if="getChannelAvatar(channel)"
          :src="getChannelAvatar(channel)"
          :alt="getChannelTitle(channel)"
        />
        <span v-else>#</span>
      </div>
      <div class="chat-channel-info">
        <div class="chat-channel-title">{{ getChannelTitle(channel) }}</div>
        <div class="chat-channel-meta">
          <span>{{ getChannelTimeLabel(channel) }}</span>
        </div>
      </div>
      <div v-if="getUnreadCount(channel)" class="chat-channel-unread">
        {{ getUnreadCount(channel) }}
      </div>
    </button>
  </div>
</template>

<style scoped src="../css/chat/ChatChannelList.css"></style>
