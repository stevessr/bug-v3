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
            <a-col :span="16">
              <a-textarea
                v-model:value="inputMessage"
                placeholder="输入消息..."
                :auto-size="{ minRows: 2, maxRows: 6 }"
                @press-enter="handleEnter"
              />
            </a-col>
            <a-col :span="8">
              <div style="display: flex; gap: 8px">
                <a-input
                  v-model:value="imageUrlInput"
                  placeholder="粘贴图片 URL 并点击添加"
                  @keyup.enter="addImageUrl"
                />
                <a-button @click="addImageUrl">添加</a-button>
              </div>
            </a-col>
          </a-row>
        </div>

        <div style="margin-bottom: 8px; display: flex; gap: 8px; align-items: center">
          <input type="file" accept="image/*" multiple @change="handleFileUpload" />
          <span style="color: #888; font-size: 12px"
            >已选择图片可以预览并删除，发送后会作为 message.content 的 image_url</span
          >
        </div>

        <div
          v-if="pendingImages.length"
          class="pending-images"
          style="margin-bottom: 8px; display: flex; gap: 8px; flex-wrap: wrap"
        >
          <div v-for="(img, idx) in pendingImages" :key="idx" style="position: relative">
            <img
              :src="img.image_url.url"
              class="pending-thumb"
              @click="previewImage(img.image_url.url)"
            />
            <a-button
              size="small"
              type="text"
              danger
              style="position: absolute; top: 4px; right: 4px"
              @click="removePendingImage(idx)"
              >删除</a-button
            >
          </div>
        </div>

        <a-row :gutter="8">
          <a-col :span="20">
            <!-- empty column to align -->
          </a-col>
          <a-col :span="4">
            <a-button
              type="primary"
              @click="sendMessage"
              :loading="isLoading"
              :disabled="
                (!inputMessage.trim() && pendingImages.length === 0) || apiKeys.length === 0
              "
              style="width: 100%; height: 100%"
            >
              发送
            </a-button>
          </a-col>
        </a-row>
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
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, nextTick, onMounted, h } from 'vue'
import { message } from 'ant-design-vue'
import { OpenRouterService } from '../../services/openrouter'
import type { OpenRouterMessage } from '../../services/openrouter'
import {
  DownOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  DeleteOutlined,
  PlusOutlined,
} from '@ant-design/icons-vue'

interface ChatMessage extends OpenRouterMessage {
  timestamp: Date
  images?: {
    type: 'image_url'
    image_url: {
      url: string
    }
  }[]
}

export default defineComponent({
  name: 'OpenRouterChat',
  components: {
    DownOutlined,
    EyeOutlined,
    EyeInvisibleOutlined,
    DeleteOutlined,
    PlusOutlined,
  },
  setup() {
    const openRouterService = new OpenRouterService()

    // UI State
    const messages = ref<ChatMessage[]>([])
    const inputMessage = ref('')
    const isLoading = ref(false)
    const selectedModel = ref('google/gemini-2.5-flash-image-preview:free')
    const enableImageGeneration = ref(false)
    const enableStreaming = ref(true)
    const chatContainer = ref<HTMLElement>()

    // API Key Management
    const showApiKeyModal = ref(false)
    const apiKeys = ref<string[]>([])
    const tempApiKeys = ref<string[]>([''])
    const showKeys = ref<boolean[]>([false])

    // Image Preview
    const showImagePreview = ref(false)
    const previewImageUrl = ref('')
    const imageUrlInput = ref('')
    const pendingImages = ref<any[]>([])

    // Model Options
    const modelOptions = ref([
      { value: 'openai/gpt-oss-20b:free', label: 'GPT OSS 20B (Free)' },
      { value: 'z-ai/glm-4.5-air:free', label: 'GLM 4.5 Air (Free)' },
      { value: 'qwen/qwen3-coder:free', label: 'Qwen 3 (Coder)' },
      { value: 'tngtech/deepseek-r1t2-chimera:free', label: 'DeepSeek R1T2 Chimera (Free)' },
      { label: 'Gemini 2.5 Flash (Image)', value: 'google/gemini-2.5-flash-image-preview:free' },
    ])

    // Load saved API keys from localStorage
    const loadApiKeys = () => {
      try {
        const saved = localStorage.getItem('openrouter-api-keys')
        if (saved) {
          const keys = JSON.parse(saved)
          apiKeys.value = keys
          openRouterService.setApiKeys(keys)
        }
      } catch (e) {
        console.error('Failed to load API keys:', e)
      }
    }

    // Save API keys to localStorage
    const saveApiKeysToStorage = () => {
      try {
        localStorage.setItem('openrouter-api-keys', JSON.stringify(apiKeys.value))
      } catch (e) {
        console.error('Failed to save API keys:', e)
      }
    }

    // API Key Management Functions
    const addApiKey = () => {
      tempApiKeys.value.push('')
      showKeys.value.push(false)
    }

    const removeApiKey = (index: number) => {
      tempApiKeys.value.splice(index, 1)
      showKeys.value.splice(index, 1)
    }

    const toggleKeyVisibility = (index: number) => {
      showKeys.value[index] = !showKeys.value[index]
    }

    const saveApiKeys = () => {
      const validKeys = tempApiKeys.value.filter((k) => k.trim())
      apiKeys.value = validKeys
      openRouterService.setApiKeys(validKeys)
      saveApiKeysToStorage()
      showApiKeyModal.value = false
      message.success(`已保存 ${validKeys.length} 个 API Key`)
    }

    const cancelApiKeys = () => {
      tempApiKeys.value = [...apiKeys.value, '']
      showKeys.value = new Array(tempApiKeys.value.length).fill(false)
      showApiKeyModal.value = false
    }

    // Chat Functions
    const addMessage = (role: 'user' | 'assistant', content: string, images?: any[]) => {
      const newMessage: ChatMessage = {
        role,
        content,
        timestamp: new Date(),
        images,
      }
      messages.value.push(newMessage)
      nextTick(() => {
        scrollToBottom()
      })
    }

    const scrollToBottom = () => {
      if (chatContainer.value) {
        chatContainer.value.scrollTop = chatContainer.value.scrollHeight
      }
    }

    const sendMessage = async () => {
      if (!inputMessage.value.trim() || isLoading.value || apiKeys.value.length === 0) {
        return
      }

      const userMessage = inputMessage.value.trim()
      inputMessage.value = ''

      // Add user message (include any pending images)
      const userImages = pendingImages.value.length ? [...pendingImages.value] : undefined
      addMessage('user', userMessage, userImages)
      // clear pending images immediately after queuing
      pendingImages.value = []

      isLoading.value = true

      try {
        const chatMessages: OpenRouterMessage[] = messages.value.map((m) => ({
          role: m.role,
          content: m.content,
          images: m.images as any,
        }))

        if (enableStreaming.value) {
          // Streaming response
          let assistantContent = ''
          let assistantImages: any[] = []

          const stream = enableImageGeneration.value
            ? openRouterService.streamImage(userMessage, selectedModel.value)
            : openRouterService.streamText(chatMessages, selectedModel.value)

          // Add empty assistant message that we'll update
          addMessage('assistant', '')
          const messageIndex = messages.value.length - 1

          for await (const chunk of stream) {
            if (chunk.choices[0]?.delta?.content) {
              assistantContent += chunk.choices[0].delta.content
              messages.value[messageIndex].content = assistantContent
            }

            if (chunk.choices[0]?.delta?.images) {
              const newImages = chunk.choices[0].delta.images.map((img: any) => {
                const raw = img.image_url?.url || ''
                const url =
                  raw.startsWith('data:') || raw.startsWith('http')
                    ? raw
                    : `data:image/png;base64,${raw}`
                return { ...img, image_url: { url } }
              })
              assistantImages.push(...newImages)
              messages.value[messageIndex].images = assistantImages
            }
          }
        } else {
          // Non-streaming response
          const response = enableImageGeneration.value
            ? await openRouterService.generateImage(userMessage, selectedModel.value)
            : await openRouterService.generateText(chatMessages, selectedModel.value)

          const assistantMessage = response.choices[0]?.message
          if (assistantMessage) {
            let images = assistantMessage.images
            if (images && images.length) {
              images = images.map((img: any) => {
                const raw = img.image_url?.url || ''
                const url =
                  raw.startsWith('data:') || raw.startsWith('http')
                    ? raw
                    : `data:image/png;base64,${raw}`
                return { ...img, image_url: { url } }
              })
            }
            addMessage('assistant', assistantMessage.content || '', images)
          }
        }
      } catch (error) {
        console.error('OpenRouter API error:', error)
        addMessage('assistant', `错误: ${error instanceof Error ? error.message : '未知错误'}`)
        message.error('发送消息失败')
      } finally {
        isLoading.value = false
      }
    }

    const handleEnter = (e: KeyboardEvent) => {
      if (e.shiftKey) {
        return // Allow line break with Shift+Enter
      }
      e.preventDefault()
      sendMessage()
    }

    const clearChat = () => {
      messages.value = []
      message.success('对话已清空')
    }

    const exportChat = () => {
      const chatData = {
        timestamp: new Date().toISOString(),
        model: selectedModel.value,
        messages: messages.value,
      }
      const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `openrouter-chat-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
      message.success('对话已导出')
    }

    const insertTemplate = ({ key }: { key: string }) => {
      const templates = {
        'image-prompt': '请为我生成一张图片：',
        'code-review': '请帮我审查以下代码，指出问题和改进建议：\n\n```\n\n```',
        translation: '请将以下内容翻译成中文：\n\n',
        summary: '请总结以下内容的要点：\n\n',
      }
      inputMessage.value = templates[key as keyof typeof templates] || ''
    }

    const formatContent = (content: string) => {
      // Simple markdown-like formatting
      return content
        .replace(/\n/g, '<br>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    }

    const formatTime = (timestamp: Date) => {
      return timestamp.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    }

    const previewImage = (url: string) => {
      previewImageUrl.value = url
      showImagePreview.value = true
    }

    const addImageUrl = () => {
      const raw = imageUrlInput.value.trim()
      if (!raw) return
      const url =
        raw.startsWith('data:') || raw.startsWith('http') ? raw : `data:image/png;base64,${raw}`
      pendingImages.value.push({ type: 'image_url', image_url: { url } })
      imageUrlInput.value = ''
    }

    const handleFileUpload = async (e: Event) => {
      const input = e.target as HTMLInputElement
      if (!input.files) return
      const files = Array.from(input.files)
      for (const file of files) {
        const dataUrl = await fileToDataUrl(file)
        pendingImages.value.push({ type: 'image_url', image_url: { url: dataUrl } })
      }
      // clear input
      input.value = ''
    }

    const removePendingImage = (index: number) => {
      pendingImages.value.splice(index, 1)
    }

    const fileToDataUrl = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
    }

    const downloadImage = () => {
      const a = document.createElement('a')
      a.href = previewImageUrl.value
      a.download = `openrouter-image-${Date.now()}.png`
      a.click()
    }

    // Watch for model changes to set appropriate options
    const updateModelOptions = () => {
      if (selectedModel.value.includes('image') || selectedModel.value.includes('gemini')) {
        enableImageGeneration.value = true
      }
    }

    onMounted(() => {
      loadApiKeys()
      tempApiKeys.value = [...apiKeys.value, '']
      showKeys.value = new Array(tempApiKeys.value.length).fill(false)

      // Add welcome message
      addMessage(
        'assistant',
        '👋 欢迎使用 OpenRouter 对话工具！\n\n我可以帮你：\n• 进行对话交流\n• 生成图像\n• 翻译文本\n• 审查代码\n• 总结内容\n\n请先在右上角配置你的 API Keys，然后开始对话吧！',
      )
    })

    return {
      // UI State
      messages,
      inputMessage,
      isLoading,
      selectedModel,
      enableImageGeneration,
      enableStreaming,
      chatContainer,

      // API Key Management
      showApiKeyModal,
      apiKeys,
      tempApiKeys,
      showKeys,
      addApiKey,
      removeApiKey,
      toggleKeyVisibility,
      saveApiKeys,
      cancelApiKeys,

      // Chat Functions
      sendMessage,
      handleEnter,
      clearChat,
      exportChat,
      insertTemplate,
      formatContent,
      formatTime,

      // Image Functions
      showImagePreview,
      previewImageUrl,
      previewImage,
      downloadImage,
      // Image input helpers
      imageUrlInput,
      pendingImages,
      addImageUrl,
      handleFileUpload,
      removePendingImage,

      // Options
      modelOptions,
      updateModelOptions,

      // Icons for template
      h,
      DownOutlined,
      EyeOutlined,
      EyeInvisibleOutlined,
      DeleteOutlined,
      PlusOutlined,
    }
  },
})
</script>

<style scoped>
.tools-container {
  padding: 0;
}

.chat-container {
  height: 400px;
  overflow-y: auto;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 16px;
  background: #fafafa;
}

.message-item {
  margin-bottom: 16px;
  padding: 12px;
  border-radius: 8px;
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.user-message {
  margin-left: 20%;
  background: #e6f7ff;
}

.assistant-message {
  margin-right: 20%;
  background: #f6ffed;
}

.message-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
  color: #666;
}

.message-content {
  word-wrap: break-word;
}

.message-images {
  margin-top: 8px;
}

.generated-image {
  max-width: 100%;
  max-height: 200px;
  border-radius: 4px;
  cursor: pointer;
  transition: transform 0.2s;
}

.generated-image:hover {
  transform: scale(1.02);
}

.loading-message {
  text-align: center;
  color: #666;
  font-style: italic;
}

.input-area {
  margin-bottom: 0;
}

.quick-actions {
  border-top: 1px solid #f0f0f0;
  padding-top: 16px;
}

.api-key-manager {
  max-height: 400px;
  overflow-y: auto;
}

.api-key-item {
  margin-bottom: 8px;
}
</style>
