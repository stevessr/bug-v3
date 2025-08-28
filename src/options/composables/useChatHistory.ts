import { ref, nextTick, watch, onBeforeUnmount, readonly, type Ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  saveChatHistory,
  loadChatHistory,
  clearChatHistory,
  type ChatHistoryData,
  type ChatMessage as StoredChatMessage,
} from '../../data/update/storage'
import { v4 as uuidv4 } from 'uuid'

import type { ChatMessage } from '../types'

interface ChatHistoryDeps {
  messages: Ref<ChatMessage[]>
  selectedModel: Ref<string>
  modelOptions: Ref<{ label: string; value: string }[]>
  scrollToBottom: () => void
}

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

export function useChatHistory({
  messages,
  selectedModel,
  modelOptions,
  scrollToBottom,
}: ChatHistoryDeps) {
  const showImportModal = ref(false)
  const importChatData = ref('')
  const importError = ref('')
  const replaceExistingChat = ref(false)

  // 新增：自动保存相关状态
  const sessionId = ref(uuidv4()) // 会话ID
  const sessionCreatedTime = ref(new Date()) // 会话创建时间
  const autoSaveTimer = ref<number | null>(null) // 自动保存定时器

  // 防抖保存函数
  const debouncedSave = (() => {
    let timeoutId: number | null = null
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      timeoutId = window.setTimeout(() => {
        saveCurrentHistory()
      }, 1000) // 1秒防抖
    }
  })()

  // 转换函数：将ChatMessage转换为StoredChatMessage
  const convertToStoredMessage = (msg: ChatMessage): StoredChatMessage => ({
    role: msg.role as 'user' | 'assistant', // 类型断言，确保兼容性
    content: msg.content,
    timestamp: msg.timestamp,
    images: msg.images,
  })

  // 转换函数：将StoredChatMessage转换为ChatMessage
  const convertFromStoredMessage = (msg: StoredChatMessage): ChatMessage => ({
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp),
    images: msg.images,
  })

  // 保存当前对话历史
  const saveCurrentHistory = async () => {
    try {
      if (messages.value.length === 0) {
        return // 空对话不保存
      }

      const historyData: ChatHistoryData = {
        sessionId: sessionId.value,
        lastModified: new Date(),
        selectedModel: selectedModel.value,
        messages: messages.value.map(convertToStoredMessage),
        metadata: {
          totalMessages: messages.value.length,
          createdAt: sessionCreatedTime.value,
        },
      }

      await saveChatHistory(historyData)
      console.log('[ChatHistory] Auto-saved chat history with', messages.value.length, 'messages')
    } catch (error) {
      console.warn('[ChatHistory] Failed to save chat history:', error)
    }
  }

  // 手动触发保存
  const manualSave = async () => {
    await saveCurrentHistory()
  }

  // 恢复对话历史
  const restoreHistory = async () => {
    try {
      const savedHistory = await loadChatHistory()
      if (!savedHistory || !savedHistory.messages || savedHistory.messages.length === 0) {
        console.log('[ChatHistory] No saved history found')
        return false
      }

      // 检查是否是最近的会话（小于24小时）
      const lastModified = new Date(savedHistory.lastModified)
      const hoursSinceLastModified = (Date.now() - lastModified.getTime()) / (1000 * 60 * 60)

      if (hoursSinceLastModified > 24) {
        console.log('[ChatHistory] Saved history is too old, skipping restore')
        return false
      }

      // 只在当前没有消息或者用户确认时才恢复
      let shouldRestore = false
      if (messages.value.length === 0) {
        shouldRestore = true
      } else {
        shouldRestore = await new Promise((resolve) => {
          const modal = Modal.confirm({
            title: '检测到历史对话记录',
            content: `发现了 ${savedHistory.messages.length} 条对话记录（上次修改：${lastModified.toLocaleString()}）。是否恢复？`,
            okText: '恢复',
            cancelText: '取消',
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
          })
        })
      }

      if (shouldRestore) {
        // 恢复消息
        const restoredMessages = savedHistory.messages.map(convertFromStoredMessage)
        messages.value = restoredMessages

        // 恢复模型选择
        if (savedHistory.selectedModel) {
          const modelExists = modelOptions.value.some(
            (opt) => opt.value === savedHistory.selectedModel,
          )
          if (modelExists) {
            selectedModel.value = savedHistory.selectedModel
          }
        }

        // 恢复会话ID和创建时间
        sessionId.value = savedHistory.sessionId || uuidv4()
        sessionCreatedTime.value = new Date(savedHistory.metadata.createdAt)

        // 滚动到底部
        nextTick(() => {
          scrollToBottom()
        })

        message.success(`已恢复 ${restoredMessages.length} 条对话记录`)
        console.log('[ChatHistory] Restored chat history:', restoredMessages.length, 'messages')
        return true
      }
    } catch (error) {
      console.warn('[ChatHistory] Failed to restore chat history:', error)
      message.error('恢复对话历史失败')
    }
    return false
  }

  // 清除对话历史的增强版本
  const clearChatHistoryEnhanced = async () => {
    try {
      await clearChatHistory()
      // 重置会话ID和创建时间
      sessionId.value = uuidv4()
      sessionCreatedTime.value = new Date()
      message.success('对话历史已清除')
      console.log('[ChatHistory] Cleared chat history')
    } catch (error) {
      console.warn('[ChatHistory] Failed to clear chat history:', error)
      message.error('清除对话历史失败')
    }
  }

  // 设置监听器
  const setupWatchers = () => {
    // 监听消息和模型变化，自动保存
    const stopWatching = watch(
      [messages, selectedModel],
      () => {
        debouncedSave()
      },
      { deep: true },
    )

    // 定时保存（每30秒）
    const intervalId = setInterval(() => {
      if (messages.value.length > 0) {
        saveCurrentHistory()
      }
    }, 30000)

    // 清理函数
    const cleanup = () => {
      stopWatching()
      clearInterval(intervalId)
      if (autoSaveTimer.value) {
        clearTimeout(autoSaveTimer.value)
      }
    }

    onBeforeUnmount(cleanup)

    return cleanup
  }

  // 初始化监听器
  setupWatchers()

  const exportChat = () => {
    const chatData = {
      timestamp: new Date().toISOString(),
      model: selectedModel.value,
      messages: messages.value.map((msg) => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
        images: msg.images,
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
        const modelExists = modelOptions.value.some((opt) => opt.value === typedData.model)
        if (modelExists) {
          selectedModel.value = typedData.model
        }
      }

      showImportModal.value = false
      importChatData.value = ''
      importError.value = ''
      replaceExistingChat.value = false

      nextTick(() => {
        scrollToBottom()
      })
    } catch (error) {
      importError.value =
        '解析 JSON 数据失败：' + (error instanceof Error ? error.message : '未知错误')
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
    // 新增的功能
    restoreHistory,
    manualSave,
    clearChatHistoryEnhanced,
    sessionId: readonly(sessionId),
    sessionCreatedTime: readonly(sessionCreatedTime),
  }
}
