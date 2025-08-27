<template>
  <div class="input-area">
    <div style="margin-bottom: 8px">
      <a-row :gutter="8">
        <a-col :span="22">
          <a-textarea
            v-model:value="inputMessage"
            placeholder="输入消息..."
            :auto-size="{ minRows: 2, maxRows: 60 }"
            @press-enter="handleEnter"
          />
        </a-col>
        <a-col :span="2">
          <a-button
            type="primary"
            @click="sendMessage"
            :loading="isLoading"
            :disabled="(!inputMessage.trim() && fileList.length === 0) || apiKeys.length === 0"
            style="width: 100%; height: 100%"
          >
            发送
          </a-button>
        </a-col>
      </a-row>
    </div>
    <ImageUploader />
  </div>
</template>

<script setup lang="ts">
import ImageUploader from './ImageUploader.vue';
import { useChat } from '../../composables/useChat';
import { useFileUpload } from '../../composables/useFileUpload';
import { useApiKeys } from '../../composables/useApiKeys';

const { inputMessage, handleEnter, sendMessage, isLoading } = useChat();
const { fileList } = useFileUpload();
const { apiKeys } = useApiKeys();
</script>

<style scoped>
.input-area {
  margin-top: 16px;
}
</style>
