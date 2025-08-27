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

    // Model Options（只定义一次） - 重命名为 openRouterModelOptions，避免与 ...chatManager 冲突
    const openRouterModelOptions = ref([
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

    // 仅传入 openRouterService，避免传入 useChat 不接受的属性（如 apiKeys）
    const chatManager = useChat({
      openRouterService,
    })

    // useChatHistory 不接受参数，改为无参调用
    const historyManager = useChatHistory()

    // Watch for model changes to set appropriate options
    watch(chatManager.selectedModel, (newModel) => {
      if (!newModel) {
        chatManager.enableImageGeneration.value = false
        return
      }
      if (newModel.includes('image') || newModel.includes('gemini')) {
        chatManager.enableImageGeneration.value = true
      } else {
        chatManager.enableImageGeneration.value = false
      }
    })

    onMounted(() => {
      apiKeysManager.loadApiKeys()
      imgBedManager.loadImgBedConfig()

      // Add welcome message
      chatManager.addMessage(
        'assistant',
        '👋 欢迎使用 OpenRouter 对话工具！\n\n我可以帮你：\n• 进行对话交流\n• 生成图像\n• 翻译文本\n• 审查代码\n• 总结内容\n\n请先在右上角配置你的 API Keys，然后开始对话吧！',
      )
    })

    return {
      // Model Options（使用重命名后的键）
      openRouterModelOptions,

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

      // Icons and h for render functions
      h,
      DownOutlined,
      EyeOutlined,
      EyeInvisibleOutlined,
      DeleteOutlined,
      PlusOutlined,
    }
  },
})
