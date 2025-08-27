<template>
  <div class="chat-container" ref="chatContainer">
    <ChatMessage
      v-for="(message, index) in messages"
      :key="index"
      :message="message"
      :index="index"
      @preview-image="onPreviewImage"
      @retry="onRetry"
      @delete="onDelete"
    />
    <div v-if="isLoading" class="loading-message">
      <a-spin size="small" /> AI 正在思考...
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import ChatMessage from './ChatMessage.vue';
import { useChat } from '../../composables/useChat';
import { useFileUpload } from '../../composables/useFileUpload';

const { messages, isLoading, chatContainer, retryMessage, deleteMessage } = useChat();
const { previewImage } = useFileUpload();

const onPreviewImage = (url: string) => {
  previewImage(url);
};

const onRetry = (index: number) => {
  retryMessage(index);
};

const onDelete = (index: number) => {
  deleteMessage(index);
};

// Auto-scroll to bottom
watch(messages, () => {
  chatContainer.value?.scrollTo({ top: chatContainer.value.scrollHeight, behavior: 'smooth' });
}, { deep: true });

</script>

<style scoped>
.chat-container {
  height: 500px;
  overflow-y: auto;
  padding: 16px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background-color: #fff;
  margin-bottom: 16px;
}

.loading-message {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #888;
  padding: 16px;
}
</style>
