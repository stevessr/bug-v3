<template>
  <div class="tools-container">
    <a-card title="OpenRouter 对话工具" style="margin-bottom: 16px">
      <template #extra>
        <a-button type="link" @click="showSettingsModal = true">配置</a-button>
      </template>

      <!-- Model Selection -->
      <div style="margin-bottom: 16px">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-select
              v-model:value="selectedModel"
              placeholder="选择模型"
              style="width: 100%"
              :options="modelOptions"
            />
          </a-col>
          <a-col :span="6">
            <a-checkbox v-model:checked="enableImageGeneration"> 生成图像 </a-checkbox>
          </a-col>
          <a-col :span="6">
            <a-checkbox v-model:checked="enableStreaming"> 流式响应 </a-checkbox>
          </a-col>
        </a-row>
      </div>

      <ChatWindow />
      <ChatInput />
      <ChatActions />
    </a-card>

    <SettingsModal v-model:open="showSettingsModal" />
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue';
import { OpenRouterService } from '../../services/openrouter';

// Composables
import { useApiKeys } from '../composables/useApiKeys';
import { useImgBed } from '../composables/useImgBed';
import { useChat } from '../composables/useChat';
import { useFileUpload } from '../composables/useFileUpload';
import { useChatHistory } from '../composables/useChatHistory';

// Components
import ChatWindow from './openrouter-chat/ChatWindow.vue';
import ChatInput from './openrouter-chat/ChatInput.vue';
import ChatActions from './openrouter-chat/ChatActions.vue';
import SettingsModal from './openrouter-chat/SettingsModal.vue';

export default defineComponent({
  name: 'OpenRouterChat',
  components: {
    ChatWindow,
    ChatInput,
    ChatActions,
    SettingsModal,
  },
  setup() {
    const showSettingsModal = ref(false);

    // Initialize service and stateful composables
    const openRouterService = new OpenRouterService();
    const chatManager = useChat({ openRouterService });
    const apiKeysManager = useApiKeys(openRouterService);
    const imgBedManager = useImgBed();
    useFileUpload(); // Initializes and gets its dependencies from other composables
    useChatHistory(); // Initializes and gets its dependencies from other composables

    onMounted(() => {
      apiKeysManager.loadApiKeys();
      imgBedManager.loadImgBedConfig();
      chatManager.addMessage(
        'assistant',
        '👋 欢迎使用 OpenRouter 对话工具！\n\n我可以帮你：\n• 进行对话交流\n• 生成图像\n• 翻译文本\n• 审查代码\n• 总结内容\n\n请先在右上角配置你的 API Keys，然后开始对话吧！',
      );
    });

    const {
      selectedModel,
      modelOptions,
      enableImageGeneration,
      enableStreaming,
    } = chatManager;

    return {
      showSettingsModal,
      selectedModel,
      modelOptions,
      enableImageGeneration,
      enableStreaming,
    };
  },
});
</script>

<style scoped>
@import './OpenRouterChat.css';
</style>