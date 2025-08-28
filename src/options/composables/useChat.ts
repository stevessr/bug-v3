import { ref, nextTick, type Ref } from 'vue'
import { message } from 'ant-design-vue'

import type { OpenRouterService, OpenRouterMessage } from '../../services/openrouter'
import type { ChatMessage } from '../types'

interface UseChatDeps {
  openRouterService: OpenRouterService
  apiKeys: Ref<string[]>
  fileList: Ref<any[]>
  pendingImages: Ref<any[]>
}

export function useChat({ openRouterService, apiKeys, fileList, pendingImages }: UseChatDeps) {
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

  const formatMessagesForApi = (chatMessages: ChatMessage[]): OpenRouterMessage[] => {
    return chatMessages
      .map((m) => {
        if (m.role === 'user') {
          const contentParts: any[] = []
          if (m.content && m.content.trim()) {
            contentParts.push({ type: 'text', text: m.content })
          }
          if (m.images && m.images.length > 0) {
            m.images.forEach((img) => {
              if (img.image_url && img.image_url.url) {
                contentParts.push({ type: 'image_url', image_url: { url: img.image_url.url } })
              }
            })
          }

          if (contentParts.length > 0) {
            return { role: 'user', content: contentParts }
          }
          return null // Will be filtered out
        }
        // Assistant messages
        if (m.role === 'assistant' && m.content) {
          return { role: m.role, content: m.content }
        }
        return null // Filter out empty/invalid assistant messages
      })
      .filter(Boolean) as OpenRouterMessage[]
  }

  const sendMessage = async () => {
    const trimmedMessage = inputMessage.value.trim()
    if ((!trimmedMessage && pendingImages.value.length === 0) || isLoading.value) {
      return
    }
    if (apiKeys.value.length === 0) {
      message.error('请先配置 API Keys')
      return
    }

    const userMessage = trimmedMessage
    inputMessage.value = ''

    const userImages = pendingImages.value.length
      ? pendingImages.value.map((p) => ({ type: 'image_url', image_url: { url: p.image_url.url } }))
      : undefined
    addMessage('user', userMessage, userImages)
    fileList.value = []
    pendingImages.value = []

    isLoading.value = true

    try {
      const apiMessages = formatMessagesForApi(messages.value)

      if (enableStreaming.value) {
        let assistantContent = ''
        const assistantImages: any[] = []
        const stream = enableImageGeneration.value
          ? openRouterService.streamImage(userMessage, selectedModel.value)
          : openRouterService.streamText(apiMessages, selectedModel.value)

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
        const response = enableImageGeneration.value
          ? await openRouterService.generateImage(userMessage, selectedModel.value)
          : await openRouterService.generateText(apiMessages, selectedModel.value)

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

  const retryMessage = async (messageIndex: number) => {
    if (isLoading.value || messageIndex <= 0) return

    const userMessage = messages.value[messageIndex - 1]
    if (userMessage.role !== 'user') return

    // Remove the failed assistant response
    messages.value.splice(messageIndex, 1)

    // We need to resend the history up to the point of the user message
    const historyForRetry = messages.value.slice(0, messageIndex)

    isLoading.value = true

    try {
      const apiMessages = formatMessagesForApi(historyForRetry)
      const lastUserMessage = apiMessages[apiMessages.length - 1]

      if (enableStreaming.value) {
        let assistantContent = ''
        let assistantImages: any[] = []
        const stream = enableImageGeneration.value
          ? openRouterService.streamImage(lastUserMessage.content as string, selectedModel.value)
          : openRouterService.streamText(apiMessages, selectedModel.value)

        addMessage('assistant', '')
        const newMessageIndex = messages.value.length - 1

        for await (const chunk of stream) {
          if (chunk.choices[0]?.delta?.content) {
            assistantContent += chunk.choices[0].delta.content
            messages.value[newMessageIndex].content = assistantContent
          }
          if (chunk.choices[0]?.delta?.images) {
            const newImages = chunk.choices[0].delta.images.map((img: any) => {
              if (img.image_url?.url)
                return { type: 'image_url', image_url: { url: img.image_url.url } }
              const raw = img.url || (typeof img === 'string' ? img : '')
              const url =
                raw && !raw.startsWith('data:') && !raw.startsWith('http')
                  ? `data:image/png;base64,${raw}`
                  : raw
              return { type: 'image_url', image_url: { url } }
            })
            assistantImages = [...newImages]
            messages.value[newMessageIndex].images = assistantImages
          }
        }
      } else {
        const response = enableImageGeneration.value
          ? await openRouterService.generateImage(
              lastUserMessage.content as string,
              selectedModel.value,
            )
          : await openRouterService.generateText(apiMessages, selectedModel.value)

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
