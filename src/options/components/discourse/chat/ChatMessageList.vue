<script setup lang="ts">
import { computed } from 'vue'

import type { ChatMessage, ParsedContent } from '../types'
import { parsePostContent } from '../utils'

import ChatMessageItem from './ChatMessageItem.vue'

const props = defineProps<{
  messages: ChatMessage[]
  baseUrl: string
  currentUsername: string | null
  loading: boolean
  hasMore: boolean
}>()

const emit = defineEmits<{
  (e: 'loadMore'): void
  (e: 'navigate', url: string): void
}>()

const parsedCache = new Map<number, ParsedContent>()

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;')

const getParsedMessage = (message: ChatMessage) => {
  const cached = parsedCache.get(message.id)
  if (cached) return cached
  const html = message.cooked || `<p>${escapeHtml(message.message || '')}</p>`
  const parsed = parsePostContent(html, props.baseUrl)
  parsedCache.set(message.id, parsed)
  return parsed
}

const orderedMessages = computed(() => [...props.messages].sort((a, b) => a.id - b.id))

const handleLoadMore = () => {
  emit('loadMore')
}

const handleNavigate = (url: string) => {
  emit('navigate', url)
}
</script>

<template>
  <div class="chat-message-list">
    <button v-if="hasMore" class="chat-load-more" @click="handleLoadMore" :disabled="loading">
      {{ loading ? '加载中...' : '加载更早消息' }}
    </button>
    <ChatMessageItem
      v-for="message in orderedMessages"
      :key="message.id"
      :message="message"
      :parsed="getParsedMessage(message)"
      :baseUrl="baseUrl"
      :isOwn="(message.user?.username || message.username) === currentUsername"
      @navigate="handleNavigate"
    />
  </div>
</template>

<style scoped src="../css/chat/ChatMessageList.css"></style>
