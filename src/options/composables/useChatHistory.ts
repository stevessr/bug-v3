import { ref, nextTick } from 'vue'
import { message } from 'ant-design-vue'
import type { ChatMessage } from '../types'
import { useChat } from './useChat'

// State is defined outside the function
const showImportModal = ref(false)
const importChatData = ref('')
const importError = ref('')
const replaceExistingChat = ref(false)

interface ImportedChatData {
  messages: {
    role: 'user' | 'assistant'
    content: string
    timestamp?: string | number | Date
    images?: {
      type: 'image_url'
      image_url: {
        url: string
      }
    }[]
  }[]
  model?: string
  timestamp?: string
}

export function useChatHistory() {
  const { messages, selectedModel, modelOptions, scrollToBottom } = useChat()

  const exportChat = () => {
    const chatData = {
      timestamp: new Date().toISOString(),
      model: selectedModel.value,
      messages: messages.value.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
        images: msg.images
      })),
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

  const importChat = () => {
    if (!importChatData.value.trim()) {
      importError.value = '请输入对话数据'
      return
    }

    try {
      const data: unknown = JSON.parse(importChatData.value.trim())
      
      if (!data || typeof data !== 'object') {
        importError.value = '无效的数据格式：必须是对象'
        return
      }

      const typedData = data as Partial<ImportedChatData>

      if (!typedData.messages || !Array.isArray(typedData.messages)) {
        importError.value = '无效的对话数据格式：缺少 messages 数组'
        return
      }

      for (let i = 0; i < typedData.messages.length; i++) {
        const msg = typedData.messages[i]
        if (!msg || typeof msg !== 'object') {
          importError.value = `无效的消息格式：第 ${i + 1} 条消息不是对象`
          return
        }
        if (!msg.role || !['user', 'assistant'].includes(msg.role)) {
          importError.value = `无效的消息格式：第 ${i + 1} 条消息的 role 必须是 user 或 assistant`
          return
        }
        if (typeof msg.content !== 'string') {
          importError.value = `无效的消息格式：第 ${i + 1} 条消息的 content 必须是字符串`
          return
        }
        if (msg.images && !Array.isArray(msg.images)) {
          importError.value = `无效的消息格式：第 ${i + 1} 条消息的 images 必须是数组`
          return
        }
      }

      const importedMessages: ChatMessage[] = typedData.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
        images: msg.images && Array.isArray(msg.images) ? msg.images : undefined,
      }))

      if (replaceExistingChat.value) {
        messages.value = importedMessages
        message.success(`已导入 ${importedMessages.length} 条消息（替换模式）`)
      } else {
        messages.value.push(...importedMessages)
        message.success(`已导入 ${importedMessages.length} 条消息（追加模式）`)
      }

      if (typedData.model && typeof typedData.model === 'string') {
        const modelExists = modelOptions.value.some(opt => opt.value === typedData.model)
        if (modelExists) {
          selectedModel.value = typedData.model
        }
      }

      showImportModal.value = false
      importChatData.value = ''
      importError.value = ''
      replaceExistingChat.value = false
      
      nextTick(scrollToBottom)
      
    } catch (error) {
      importError.value = '解析 JSON 数据失败：' + (error instanceof Error ? error.message : '未知错误')
    }
  }

  const cancelImport = () => {
    showImportModal.value = false
    importChatData.value = ''
    importError.value = ''
    replaceExistingChat.value = false
  }

  const handleChatFileUpload = (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    
    if (!file) return
    
    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      importError.value = '请选择 JSON 格式的文件'
      return
    }
    
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      if (content) {
        importChatData.value = content
        importError.value = ''
      }
    }
    reader.onerror = () => {
      importError.value = '读取文件失败'
    }
    reader.readAsText(file)
  }

  return {
    showImportModal,
    importChatData,
    importError,
    replaceExistingChat,
    exportChat,
    importChat,
    cancelImport,
    handleChatFileUpload,
  }
}
