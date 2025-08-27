<template>
  <div class="tools-container">
    <a-card title="OpenRouter 对话工具" style="margin-bottom: 16px">
      <template #extra>
        <a-button type="link" @click="showApiKeyModal = true">配置 API Keys</a-button>
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

      <!-- Chat Area -->
      <div class="chat-container" ref="chatContainer">
        <div
          v-for="(message, index) in messages"
          :key="index"
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
                @click="previewImage(image.image_url.url)"
                class="generated-image"
                alt="Generated image"
              />
            </div>
          </div>
        </div>

        <div v-if="isLoading" class="loading-message"><a-spin size="small" /> AI 正在思考...</div>
      </div>

      <!-- Input Area -->
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

        <div style="margin-bottom: 8px; display: flex; gap: 8px; align-items: center">
          <a-upload
            v-model:file-list="fileList"
            list-type="picture-card"
            :before-upload="uploadBefore"
            :on-preview="handleUploadPreview"
            :on-remove="handleRemove"
          >
            <div v-if="fileList.length < 8">
              <PlusOutlined />
              <div style="margin-top: 8px">添加图片</div>
            </div>
          </a-upload>
        </div>

        <!-- Paste URL input moved below upload to avoid duplicate add behavior -->
        <div style="margin-bottom: 8px; display: flex; gap: 8px; align-items: center">
          <a-input
            v-model:value="imageUrlInput"
            placeholder="粘贴图片 URL 并点击添加"
            @keyup.enter="addImageUrl"
          />
          <a-button @click="addImageUrl">添加</a-button>
        </div>

        <!-- ImgBed configuration moved to a modal to reduce clutter -->
        <div style="margin-bottom: 8px; display: flex; gap: 8px; align-items: center">
          <a-checkbox v-model:checked="useImgBed">使用 CloudFlare-ImgBed 上传</a-checkbox>
          <a-button size="small" @click="showImgBedModal = true">配置 ImgBed</a-button>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions" style="margin-top: 16px">
        <a-space wrap>
          <a-button size="small" @click="clearChat">清空对话</a-button>
          <a-button size="small" @click="exportChat">导出对话</a-button>
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
      </div>
    </a-card>

    <!-- API Key Management Modal -->
    <a-modal
      v-model:open="showApiKeyModal"
      title="配置 OpenRouter API Keys"
      @ok="saveApiKeys"
      @cancel="cancelApiKeys"
      width="600px"
    >
      <div class="api-key-manager">
        <p>添加多个 API Key 以实现负载均衡和容错：</p>

        <div v-for="(key, index) in tempApiKeys" :key="index" class="api-key-item">
          <a-row :gutter="8">
            <a-col :span="20">
              <a-input
                v-model:value="tempApiKeys[index]"
                :type="showKeys[index] ? 'text' : 'password'"
                placeholder="sk-or-..."
              />
            </a-col>
            <a-col :span="2">
              <a-button
                type="link"
                @click="toggleKeyVisibility(index)"
                :icon="showKeys[index] ? h(EyeInvisibleOutlined) : h(EyeOutlined)"
              />
            </a-col>
            <a-col :span="2">
              <a-button type="link" danger @click="removeApiKey(index)" :icon="h(DeleteOutlined)" />
            </a-col>
          </a-row>
        </div>

        <a-button @click="addApiKey" type="dashed" style="width: 100%; margin-top: 8px">
          <PlusOutlined /> 添加 API Key
        </a-button>

        <a-alert
          v-if="tempApiKeys.filter((k) => k.trim()).length === 0"
          message="请至少添加一个有效的 API Key"
          type="warning"
          style="margin-top: 16px"
        />
      </div>
    </a-modal>

    <!-- Image Preview Modal -->
    <a-modal
      v-model:open="showImagePreview"
      title="图像预览"
      footer=""
      width="80%"
      style="max-width: 1000px"
    >
      <img
        :src="previewImageUrl"
        style="width: 100%; height: auto; max-height: 70vh; object-fit: contain"
        alt="Image preview"
      />
      <div style="text-align: center; margin-top: 16px">
        <a-button @click="downloadImage">下载图像</a-button>
      </div>
    </a-modal>

    <!-- ImgBed Config Modal -->
    <a-modal
      v-model:open="showImgBedModal"
      title="ImgBed 配置"
      @ok="saveImgBedConfig"
      @cancel="closeImgBedModal"
      width="640px"
    >
      <div style="display: flex; flex-direction: column; gap: 8px">
        <a-input
          v-model:value="imgBedEndpoint"
          placeholder="ImgBed endpoint (例如 https://your.domain/upload)"
        />
        <a-input v-model:value="imgBedAuthCode" placeholder="authCode (可选)" />
        <a-select v-model:value="imgBedUploadChannel" style="width: 200px">
          <a-select-option value="telegram">telegram</a-select-option>
          <a-select-option value="cfr2">cfr2</a-select-option>
          <a-select-option value="s3">s3</a-select-option>
        </a-select>
        <a-checkbox v-model:checked="imgBedServerCompress">启用服务器压缩</a-checkbox>
        <a-checkbox v-model:checked="imgBedAutoRetry">失败自动重试</a-checkbox>
      </div>
    </a-modal>
  </div>
</template>

<script lang="ts" src="./OpenRouterChat.ts"></script>

<style scoped>
@import './OpenRouterChat.css';
</style>
