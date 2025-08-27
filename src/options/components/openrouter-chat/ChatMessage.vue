<template>
  <div
    class="message-item"
    :class="{
      'user-message': message.role === 'user',
      'assistant-message': message.role === 'assistant',
    }"
  >
    <div class="message-header">
      <strong>{{ message.role === 'user' ? '用户' : 'AI' }}</strong>
      <span class="message-time">{{ formatTime(message.timestamp) }}</span>
    </div>
    <div class="message-content">
      <div v-if="message.content" v-html="formatContent(message.content)"></div>
      <div v-if="message.images && message.images.length" class="message-images">
        <img
          v-for="(image, imgIndex) in message.images"
          :key="imgIndex"
          :src="image.image_url.url"
          @click="onPreviewImage(image.image_url.url)"
          class="generated-image"
          alt="Generated image"
        />
      </div>
      <div v-if="!isLoading && message.role === 'assistant'" class="message-actions" style="margin-top: 8px;">
        <a-button size="small" @click="onRetry">重试</a-button>
        <a-popconfirm
          title="确定要删除这条消息吗？"
          ok-text="确定"
          cancel-text="取消"
          @confirm="onDelete"
        >
          <a-button size="small" danger>删除</a-button>
        </a-popconfirm>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';
import type { ChatMessage as ChatMessageType } from '../../../types';
import { useChat } from '../../composables/useChat';

const props = defineProps<{
  message: ChatMessageType;
  index: number;
}>();

const emit = defineEmits(['preview-image', 'retry', 'delete']);

const { formatTime, formatContent, isLoading } = useChat();

const onPreviewImage = (url: string) => {
  emit('preview-image', url);
};

const onRetry = () => {
  emit('retry', props.index);
};

const onDelete = () => {
  emit('delete', props.index);
};
</script>

<style scoped>
/* Scoped styles from OpenRouterChat.css that are relevant to a single message */
.message-item {
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
}

.user-message {
  align-items: flex-end;
}

.assistant-message {
  align-items: flex-start;
}

.message-header {
  font-size: 12px;
  color: #888;
  margin-bottom: 4px;
}

.user-message .message-header {
  text-align: right;
}

.message-content {
  background-color: #f0f2f5;
  border-radius: 8px;
  padding: 10px 12px;
  max-width: 80%;
  word-wrap: break-word;
}

.user-message .message-content {
  background-color: #1890ff;
  color: white;
}

.message-time {
  margin-left: 8px;
}

.message-images {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.generated-image {
  max-width: 150px;
  max-height: 150px;
  border-radius: 4px;
  cursor: pointer;
  transition: transform 0.2s;
}

.generated-image:hover {
  transform: scale(1.05);
}

.message-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
</style>
