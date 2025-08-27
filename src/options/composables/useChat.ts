import { ref, nextTick, type Ref } from 'vue'
import { message } from 'ant-design-vue'
import type { OpenRouterService, OpenRouterMessage } from '../../services/openrouter'
import type { ChatMessage } from '../types'

interface UseChatDeps {
  openRouterService: OpenRouterService
  apiKeys: Ref<string[]>
  fileList: Ref<any[]>
}

export function useChat({ openRouterService, apiKeys, fileList }: UseChatDeps) {
  const messages = ref<ChatMessage[]>([])
  const inputMessage = ref('')
  const isLoading = ref(false)
  const selectedModel = ref('google/gemini-2.5-flash-image-preview:free')
  const enableImageGeneration = ref(false)
  const enableStreaming = ref(true)
  const chatContainer = ref<HTMLElement>()

  const scrollToBottom = () => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  }

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

  const sendMessage = async () => {
    if (!inputMessage.value.trim() || isLoading.value || apiKeys.value.length === 0) {
      if (apiKeys.value.length === 0) {
        message.error('请先配置 API Keys')
      }
      return
    }

    const userMessage = inputMessage.value.trim()
    inputMessage.value = ''

    const userImages = fileList.value.length
      ? fileList.value.map((f) => ({ type: 'image_url', image_url: { url: f.url || f.preview } }))
      : undefined
    addMessage('user', userMessage, userImages)
    fileList.value = []

    isLoading.value = true

    try {
      const chatMessages: OpenRouterMessage[] = messages.value.map((m) => ({
        role: m.role,
        content: m.content,
        images: m.images as any,
      }))

      if (enableStreaming.value) {
        let assistantContent = ''
        let assistantImages: any[] = []
        const stream = enableImageGeneration.value
          ? openRouterService.streamImage(userMessage, selectedModel.value)
          : openRouterService.streamText(chatMessages, selectedModel.value)

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
              const url = raw.startsWith('data:') || raw.startsWith('http') ? raw : `data:image/png;base64,${raw}`
              return { ...img, image_url: { url } }
            })
            assistantImages.push(...newImages)
            messages.value[messageIndex].images = assistantImages
          }
        }
      } else {
        const response = enableImageGeneration.value
          ? await openRouterService.generateImage(userMessage, selectedModel.value)
          : await openRouterService.generateText(chatMessages, selectedModel.value)

        const assistantMessage = response.choices[0]?.message
        if (assistantMessage) {
          let images = assistantMessage.images
          if (images && images.length) {
            images = images.map((img: any) => {
              const raw = img.image_url?.url || ''
              const url = raw.startsWith('data:') || raw.startsWith('http') ? raw : `data:image/png;base64,${raw}`
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

  const retryMessage = async (messageIndex: number) => {
    if (isLoading.value || messageIndex <= 0) return
    
    const userMessage = messages.value[messageIndex - 1]
    if (userMessage.role !== 'user') return

    messages.value.splice(messageIndex, 1)
    
    const userContent = userMessage.content
    
    isLoading.value = true

    try {
      const chatMessages: OpenRouterMessage[] = messages.value.map((m) => ({
        role: m.role,
        content: m.content,
        images: m.images as any,
      }))

      if (enableStreaming.value) {
        let assistantContent = ''
        let assistantImages: any[] = []
        const stream = enableImageGeneration.value
          ? openRouterService.streamImage(userContent, selectedModel.value)
          : openRouterService.streamText(chatMessages, selectedModel.value)

        addMessage('assistant', '')
        const newMessageIndex = messages.value.length - 1

        for await (const chunk of stream) {
          if (chunk.choices[0]?.delta?.content) {
            assistantContent += chunk.choices[0].delta.content
            messages.value[newMessageIndex].content = assistantContent
          }
          if (chunk.choices[0]?.delta?.images) {
            const newImages = chunk.choices[0].delta.images.map((img: any) => {
              if (img.image_url?.url) return { type: 'image_url', image_url: { url: img.image_url.url } }
              let raw = img.url || (typeof img === 'string' ? img : '')
              let url = (raw && !raw.startsWith('data:') && !raw.startsWith('http')) ? `data:image/png;base64,${raw}` : raw
              return { type: 'image_url', image_url: { url } }
            })
            assistantImages = [...newImages]
            messages.value[newMessageIndex].images = assistantImages
          }
        }
      } else {
        const response = enableImageGeneration.value
          ? await openRouterService.generateImage(userContent, selectedModel.value)
          : await openRouterService.generateText(chatMessages, selectedModel.value)

        const assistantMessage = response.choices[0]?.message
        if (assistantMessage) {
          let images = assistantMessage.images
          if (images && images.length) {
            images = images.map((img: any) => {
              const raw = img.image_url?.url || ''
              const url = raw.startsWith('data:') || raw.startsWith('http') ? raw : `data:image/png;base64,${raw}`
              return { ...img, image_url: { url } }
            })
          }
          addMessage('assistant', assistantMessage.content || '', images)
        }
      }
    } catch (error) {
      console.error('OpenRouter API error:', error)
      const errorMsg = error instanceof Error ? error.message : '未知错误'
      addMessage('assistant', `错误: ${errorMsg}`)
      message.error(`重试失败: ${errorMsg}`)
    } finally {
      isLoading.value = false
    }
  }

  const deleteMessage = (messageIndex: number) => {
    messages.value.splice(messageIndex, 1)
    message.success('消息已删除')
  }

  const clearChat = () => {
    messages.value = []
    message.success('对话已清空')
  }

  const handleEnter = (e: KeyboardEvent) => {
    if (e.shiftKey) return
    e.preventDefault()
    sendMessage()
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
    return content
      .replace(/\n/g, '<br>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
  }

  const formatTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  return {
    messages,
    inputMessage,
    isLoading,
    selectedModel,
    enableImageGeneration,
    enableStreaming,
    chatContainer,
    addMessage,
    sendMessage,
    retryMessage,
    deleteMessage,
    clearChat,
    handleEnter,
    insertTemplate,
    formatContent,
    formatTime,
    scrollToBottom,
  }
}
