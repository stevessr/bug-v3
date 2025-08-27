<template>
  <div class="quick-actions" style="margin-top: 16px">
    <a-space wrap>
      <a-button size="small" @click="clearChat">清空对话</a-button>
      <a-button size="small" @click="exportChat">导出对话</a-button>
      <a-button size="small" @click="showImportModal = true">导入对话</a-button>
      <a-dropdown>
        <template #overlay>
          <a-menu @click="insertTemplate">
            <a-menu-item key="image-prompt">图像生成提示</a-menu-item>
            <a-menu-item key="code-review">代码审查</a-menu-item>
            <a-menu-item key="translation">翻译</a-menu-item>
            <a-menu-item key="summary">内容总结</a-menu-item>
          </a-menu>
        </template>
        <a-button size="small"> 模板 <DownOutlined /> </a-button>
      </a-dropdown>
    </a-space>

    <!-- Import Chat Modal -->
    <a-modal
      v-model:open="showImportModal"
      title="导入对话记录"
      @ok="importChat"
      @cancel="cancelImport"
      width="700px"
      :ok-button-props="{ disabled: !importChatData.trim() }"
    >
      <div style="display: flex; flex-direction: column; gap: 16px">
        <div>
          <label style="display: block; margin-bottom: 8px; font-weight: 500">选择文件或粘贴 JSON 数据：</label>
          <input
            type="file"
            accept=".json"
            @change="handleChatFileUpload"
            style="margin-bottom: 8px"
          />
        </div>

        <div>
          <a-textarea
            v-model:value="importChatData"
            placeholder="粘贴导出的对话 JSON 数据..."
            :auto-size="{ minRows: 8, maxRows: 20 }"
          />
        </div>

        <div>
          <a-checkbox v-model:checked="replaceExistingChat">
            替换现有对话（否则为追加到当前对话）
          </a-checkbox>
        </div>

        <div v-if="importError" style="color: #ff4d4f; font-size: 14px">
          {{ importError }}
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { useChat } from '../../composables/useChat';
import { useChatHistory } from '../../composables/useChatHistory';
import { DownOutlined } from '@ant-design/icons-vue';

const { clearChat, insertTemplate } = useChat();
const {
  showImportModal,
  importChatData,
  importError,
  replaceExistingChat,
  exportChat,
  importChat,
  cancelImport,
  handleChatFileUpload,
} = useChatHistory();
</script>
