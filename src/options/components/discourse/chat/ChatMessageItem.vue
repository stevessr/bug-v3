<script setup lang="ts">
import type { ChatMessage, ParsedContent } from '../types'
import { formatTime, getAvatarUrl } from '../utils'
import PostContent from '../topic/PostContent.vue'

const props = defineProps<{
  message: ChatMessage
  parsed: ParsedContent
  baseUrl: string
  isOwn: boolean
}>()

const emit = defineEmits<{
  (e: 'navigate', url: string): void
}>()

const getDisplayName = () => {
  const user = props.message.user
  return user?.name || props.message.name || user?.username || props.message.username || '匿名'
}

const getAvatarTemplate = () => {
  const user = props.message.user
  return user?.avatar_template || props.message.avatar_template || ''
}
</script>

<template>
  <div class="chat-message-item" :class="{ 'chat-message-own': isOwn }">
    <img
      class="chat-message-avatar"
      :src="getAvatarUrl(getAvatarTemplate(), baseUrl, 32)"
      :alt="getDisplayName()"
    />
    <div class="chat-message-content">
      <div class="chat-message-meta">
        <span class="chat-message-name">{{ getDisplayName() }}</span>
        <span class="chat-message-time">{{ formatTime(message.created_at) }}</span>
      </div>
      <PostContent
        :segments="parsed.segments"
        :baseUrl="baseUrl"
        @navigate="emit('navigate', $event)"
      />
    </div>
  </div>
</template>

<style scoped src="../css/chat/ChatMessageItem.css"></style>
