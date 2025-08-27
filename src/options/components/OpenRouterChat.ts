import { defineComponent, ref, nextTick, onMounted, h, watch } from 'vue'
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
    // ImgBed modal control (was missing -> caused TS error)
    const showImgBedModal = ref(false)
    const closeImgBedModal = () => {
      showImgBedModal.value = false
    }
    const apiKeys = ref<string[]>([])
    const tempApiKeys = ref<string[]>([''])
    const showKeys = ref<boolean[]>([false])

    // Image Preview / Upload
    const showImagePreview = ref(false)
    const previewImageUrl = ref('')
    const imageUrlInput = ref('')
    // AntD Upload file list (use data URLs for local files)
    const fileList = ref<Array<any>>([])
    // legacy pendingImages used by tests - keep in sync with fileList
    const pendingImages = ref<any[]>([])

    // Optional CloudFlare-ImgBed upload settings
    const useImgBed = ref(false)
    const imgBedEndpoint = ref('')
    const imgBedAuthCode = ref('')
    const imgBedUploadChannel = ref('telegram')
    const imgBedServerCompress = ref(true)
    const imgBedAutoRetry = ref(true)
    const imgBedUploadNameType = ref('default')
    const imgBedReturnFormat = ref('default')
    const imgBedUploadFolder = ref('')

    // persist ImgBed config
    const IMG_BED_KEY = 'openrouter-imgbed-config'

    const saveImgBedConfig = () => {
      try {
        const cfg = {
          useImgBed: useImgBed.value,
          imgBedEndpoint: imgBedEndpoint.value,
          imgBedAuthCode: imgBedAuthCode.value,
          imgBedUploadChannel: imgBedUploadChannel.value,
          imgBedServerCompress: imgBedServerCompress.value,
          imgBedAutoRetry: imgBedAutoRetry.value,
          imgBedUploadNameType: imgBedUploadNameType.value,
          imgBedReturnFormat: imgBedReturnFormat.value,
          imgBedUploadFolder: imgBedUploadFolder.value,
        }
        localStorage.setItem(IMG_BED_KEY, JSON.stringify(cfg))
      } catch (e) {
        console.error('保存 ImgBed 配置失败', e)
      }
    }

    const loadImgBedConfig = () => {
      try {
        const raw = localStorage.getItem(IMG_BED_KEY)
        if (!raw) return
        const cfg = JSON.parse(raw)
        if (typeof cfg.useImgBed === 'boolean') useImgBed.value = cfg.useImgBed
        if (typeof cfg.imgBedEndpoint === 'string') imgBedEndpoint.value = cfg.imgBedEndpoint
        if (typeof cfg.imgBedAuthCode === 'string') imgBedAuthCode.value = cfg.imgBedAuthCode
        if (typeof cfg.imgBedUploadChannel === 'string')
          imgBedUploadChannel.value = cfg.imgBedUploadChannel
        if (typeof cfg.imgBedServerCompress === 'boolean')
          imgBedServerCompress.value = cfg.imgBedServerCompress
        if (typeof cfg.imgBedAutoRetry === 'boolean') imgBedAutoRetry.value = cfg.imgBedAutoRetry
        if (typeof cfg.imgBedUploadNameType === 'string')
          imgBedUploadNameType.value = cfg.imgBedUploadNameType
        if (typeof cfg.imgBedReturnFormat === 'string')
          imgBedReturnFormat.value = cfg.imgBedReturnFormat
        if (typeof cfg.imgBedUploadFolder === 'string')
          imgBedUploadFolder.value = cfg.imgBedUploadFolder
      } catch (e) {
        console.error('加载 ImgBed 配置失败', e)
      }
    }

    // auto-save when any config changes
    watch(
      [
        useImgBed,
        imgBedEndpoint,
        imgBedAuthCode,
        imgBedUploadChannel,
        imgBedServerCompress,
        imgBedAutoRetry,
        imgBedUploadNameType,
        imgBedReturnFormat,
        imgBedUploadFolder,
      ],
      () => {
        saveImgBedConfig()
      },
    )

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

      // Add user message (include any selected images from fileList)
      const userImages = fileList.value.length
        ? fileList.value.map((f) => ({ type: 'image_url', image_url: { url: f.url || f.preview } }))
        : undefined
      addMessage('user', userMessage, userImages)
      // clear fileList immediately after queuing
      fileList.value = []

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
      // push to fileList as done status and mirror to pendingImages for tests
      const item = { uid: `${Date.now()}`, name: 'pasted.png', status: 'done', url }
      fileList.value.push(item)
      pendingImages.value.push({ type: 'image_url', image_url: { url } })
      imageUrlInput.value = ''
    }

    // helper: perform remote upload to ImgBed
    const remoteUpload = async (file: File) => {
      if (!imgBedEndpoint.value) throw new Error('ImgBed endpoint 未配置')
      const params = new URLSearchParams()
      if (imgBedAuthCode.value) params.set('authCode', imgBedAuthCode.value)
      params.set('serverCompress', String(imgBedServerCompress.value))
      params.set('uploadChannel', imgBedUploadChannel.value)
      params.set('autoRetry', String(imgBedAutoRetry.value))
      params.set('uploadNameType', imgBedUploadNameType.value)
      params.set('returnFormat', imgBedReturnFormat.value)
      if (imgBedUploadFolder.value) params.set('uploadFolder', imgBedUploadFolder.value)

      const uploadUrl =
        imgBedEndpoint.value + (imgBedEndpoint.value.includes('?') ? '&' : '?') + params.toString()

      const fd = new FormData()
      fd.append('file', file)

      const resp = await fetch(uploadUrl, {
        method: 'POST',
        body: fd,
      })
      if (!resp.ok) throw new Error(`上传失败: ${resp.status}`)
      const data = await resp.json()
      const src = Array.isArray(data) && data[0] && data[0].src ? data[0].src : null
      if (!src) throw new Error('返回格式不正确')
      try {
        const final = new URL(src, imgBedEndpoint.value).href
        return final
      } catch (e) {
        return imgBedEndpoint.value.replace(/\/upload\/?$/, '') + src
      }
    }

    // before upload: either send to ImgBed (if enabled) or convert file to data URL and add to fileList, prevent actual upload
    const uploadBefore = async (file: File) => {
      if (useImgBed.value && imgBedEndpoint.value) {
        const uid = `${Date.now()}-${file.name}`
        fileList.value.push({ uid, name: file.name, status: 'uploading' })
        try {
          const url = await remoteUpload(file)
          const idx = fileList.value.findIndex((f) => f.uid === uid)
          if (idx !== -1) {
            fileList.value[idx].status = 'done'
            fileList.value[idx].url = url
            fileList.value[idx].originFileObj = file
          }
          // add to pendingImages for backward-compat
          pendingImages.value.push({ type: 'image_url', image_url: { url } })
        } catch (err) {
          const idx = fileList.value.findIndex((f) => f.uid === uid)
          if (idx !== -1) {
            fileList.value[idx].status = 'error'
            fileList.value[idx].response = String(err instanceof Error ? err.message : err)
          }
        }
        return false
      }

      const dataUrl = await fileToDataUrl(file)
      const uid = `${Date.now()}-${file.name}`
      fileList.value.push({
        uid,
        name: file.name,
        status: 'done',
        url: dataUrl,
        originFileObj: file,
      })
      pendingImages.value.push({ type: 'image_url', image_url: { url: dataUrl } })
      return false
    }

    const handleUploadPreview = async (file: any) => {
      const url = file.url || file.preview
      if (!url && file.originFileObj) {
        file.preview = (await fileToDataUrl(file.originFileObj)) as string
      }
      previewImageUrl.value = file.url || file.preview
      showImagePreview.value = true
    }

    const handleRemove = (file: any) => {
      const idx = fileList.value.findIndex((f) => f.uid === file.uid)
      if (idx !== -1) fileList.value.splice(idx, 1)
      // remove from pendingImages by matching url
      const url = file.url || file.preview
      const pidx = pendingImages.value.findIndex((p) => p.image_url?.url === url)
      if (pidx !== -1) pendingImages.value.splice(pidx, 1)
    }

    const handleFileUpload = async (e: Event) => {
      const input = e.target as HTMLInputElement
      if (!input?.files) return
      const files = Array.from(input.files)
      for (const file of files) {
        const dataUrl = await fileToDataUrl(file)
        const uid = `${Date.now()}-${file.name}`
        const item = { uid, name: file.name, status: 'done', url: dataUrl, originFileObj: file }
        fileList.value.push(item)
        pendingImages.value.push({ type: 'image_url', image_url: { url: dataUrl } })
      }
      try {
        ;(input as HTMLInputElement).value = ''
      } catch (err) {}
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
      loadImgBedConfig()
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
      addImageUrl,
      fileList,
      uploadBefore,
      handleUploadPreview,
      handleRemove,
      pendingImages,
      handleFileUpload,

      // ImgBed options
      useImgBed,
      imgBedEndpoint,
      imgBedAuthCode,
      imgBedUploadChannel,
      imgBedServerCompress,
      imgBedAutoRetry,
      imgBedUploadNameType,
      imgBedReturnFormat,
      imgBedUploadFolder,
      // modal control
      showImgBedModal,
      closeImgBedModal,
      saveImgBedConfig,

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
