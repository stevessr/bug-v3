import { defineComponent, onMounted, h, watch, ref } from 'vue'
import {
  DownOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  DeleteOutlined,
  PlusOutlined,
} from '@ant-design/icons-vue'

import { OpenRouterService } from '../../services/openrouter'
import { useApiKeys } from '../composables/useApiKeys'
import { useImgBed } from '../composables/useImgBed'
import { useFileUpload } from '../composables/useFileUpload'
import { useChatHistory } from '../composables/useChatHistory'
import { useChat } from '../composables/useChat'
import { useResizableContainer } from '../composables/useResizableContainer'

import ImgBedConfig from './ImgBedConfig.vue'

export default defineComponent({
  name: 'OpenRouterChat',
  components: {
    DownOutlined,
    EyeOutlined,
    EyeInvisibleOutlined,
    DeleteOutlined,
    PlusOutlined,
    ImgBedConfig,
  },
  setup() {
    const openRouterService = new OpenRouterService()

    // 容器引用
    const chatContainerRef = ref<HTMLElement>()

    // Model Options
    const modelOptions = ref([
      { value: 'openai/gpt-oss-20b:free', label: 'GPT OSS 20B (Free)' },
      { value: 'z-ai/glm-4.5-air:free', label: 'GLM 4.5 Air (Free)' },
      { value: 'qwen/qwen3-coder:free', label: 'Qwen 3 (Coder)' },
      { value: 'tngtech/deepseek-r1t2-chimera:free', label: 'DeepSeek R1T2 Chimera (Free)' },
      { label: 'Gemini 2.5 Flash (Image)', value: 'google/gemini-2.5-flash-image-preview:free' },
    ])

    // Composables
    const apiKeysManager = useApiKeys(openRouterService)
    const imgBedManager = useImgBed()
    const fileUploadManager = useFileUpload()
    
    // 可调整大小容器
    const resizableContainer = useResizableContainer(chatContainerRef)

    const chatManager = useChat({
      openRouterService,
      apiKeys: apiKeysManager.apiKeys,
      fileList: fileUploadManager.fileList,
      pendingImages: fileUploadManager.pendingImages,
    })

    const historyManager = useChatHistory({
      messages: chatManager.messages,
      selectedModel: chatManager.selectedModel,
      modelOptions: modelOptions,
      scrollToBottom: chatManager.scrollToBottom,
    })

    // imgBedManager holds all ImgBed-related refs; template uses the manager directly

    // Watch for model changes to set appropriate options
    watch(chatManager.selectedModel, (newModel) => {
      if (newModel.includes('image') || newModel.includes('gemini')) {
        chatManager.enableImageGeneration.value = true
      } else {
        chatManager.enableImageGeneration.value = false
      }
    })

    onMounted(() => {
      apiKeysManager.loadApiKeys()
      imgBedManager.loadImgBedConfig()

      // 尝试恢复对话历史
      historyManager.restoreHistory()

      // Add welcome message only if no history was restored
      setTimeout(() => {
        if (chatManager.messages.value.length === 0) {
          chatManager.addMessage(
            'assistant',
            '👋 欢迎使用 OpenRouter 对话工具！\n\n我可以帮你：\n• 进行对话交流\n• 生成图像\n• 翻译文本\n• 审查代码\n• 总结内容\n\n请先在右上角配置你的 API Keys，然后开始对话吧！',
          )
        }
      }, 100) // 给恢复历史一些时间
    })

    // Handler for cancel action in popconfirm (no-op but must be defined to avoid Vue warning)
    const cancelDelete = () => {
      // Intentionally empty: UI only needs a defined handler to suppress warning.
    }

    return {
      // Model Options
      modelOptions,

      // from useChat
      ...chatManager,

      // from useApiKeys
      ...apiKeysManager,

      // from useImgBed
      ...imgBedManager,

      // from useFileUpload
      ...fileUploadManager,

      // from useChatHistory
      ...historyManager,
      
      // from useResizableContainer
      ...resizableContainer,
      chatContainerRef,

      // Icons and h for render functions
      h,
      DownOutlined,
      EyeOutlined,
      EyeInvisibleOutlined,
      DeleteOutlined,
      PlusOutlined,
      cancelDelete,
      // expose manager so template can pass it directly to ImgBedConfig
      imgBedManager: imgBedManager,
    }
  },
})
