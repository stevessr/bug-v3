<script setup lang="ts">
import { shallowRef } from 'vue'

const props = defineProps<{
  disabled: boolean
}>()

const emit = defineEmits<{
  (e: 'send', message: string): void
}>()

const message = shallowRef('')

const handleSend = () => {
  const trimmed = message.value.trim()
  if (!trimmed) return
  emit('send', trimmed)
  message.value = ''
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSend()
  }
}
</script>

<template>
  <div class="chat-composer">
    <textarea
      v-model="message"
      class="chat-composer-input"
      :disabled="disabled"
      placeholder="输入消息，回车发送"
      rows="2"
      @keydown="handleKeydown"
    />
    <button class="chat-composer-send" :disabled="disabled || !message.trim()" @click="handleSend">
      发送
    </button>
  </div>
</template>

<style scoped src="../css/chat/ChatComposer.css"></style>
