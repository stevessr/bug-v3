import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { useChatHistory } from '../../src/options/composables/useChatHistory'
import { 
  saveChatHistory, 
  loadChatHistory, 
  clearChatHistory,
  type ChatHistoryData 
} from '../../src/data/update/storage'

// Mock the storage functions
vi.mock('../../src/data/update/storage', () => ({
  saveChatHistory: vi.fn(),
  loadChatHistory: vi.fn(),
  clearChatHistory: vi.fn(),
}))

// Mock ant-design-vue
vi.mock('ant-design-vue', () => ({
  message: {
    success: vi.fn(),
    error: vi.fn(),
  },
  Modal: {
    confirm: vi.fn(),
  },
}))

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-1234'),
}))

describe('useChatHistory - 对话历史保存和恢复功能测试', () => {
  let messages: any
  let selectedModel: any
  let modelOptions: any
  let scrollToBottom: any
  let chatHistory: any

  beforeEach(() => {
    // 重置模拟函数
    vi.clearAllMocks()

    // 创建测试用的响应式数据
    messages = ref([])
    selectedModel = ref('openai/gpt-4')
    modelOptions = ref([
      { value: 'openai/gpt-4', label: 'GPT-4' },
      { value: 'openai/gpt-3.5-turbo', label: 'GPT-3.5' },
    ])
    scrollToBottom = vi.fn()

    // 初始化 useChatHistory
    chatHistory = useChatHistory({
      messages,
      selectedModel,
      modelOptions,
      scrollToBottom,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('自动保存功能', () => {
    it('应该在消息变化时触发防抖保存', async () => {
      // 添加消息
      messages.value = [
        {
          role: 'user',
          content: '测试消息',
          timestamp: new Date(),
        },
      ]

      // 等待防抖
      await new Promise(resolve => setTimeout(resolve, 1100))

      // 验证保存函数被调用
      expect(saveChatHistory).toHaveBeenCalled()
    })

    it('应该在模型变化时触发保存', async () => {
      messages.value = [
        {
          role: 'user',
          content: '测试消息',
          timestamp: new Date(),
        },
      ]

      // 改变模型
      selectedModel.value = 'openai/gpt-3.5-turbo'

      // 等待防抖
      await new Promise(resolve => setTimeout(resolve, 1100))

      expect(saveChatHistory).toHaveBeenCalled()
    })

    it('空对话不应该触发保存', async () => {
      // 清空消息
      messages.value = []

      // 等待防抖
      await new Promise(resolve => setTimeout(resolve, 1100))

      expect(saveChatHistory).not.toHaveBeenCalled()
    })
  })

  describe('手动保存功能', () => {
    it('应该能够手动保存对话历史', () => {
      messages.value = [
        {
          role: 'user',
          content: '测试消息',
          timestamp: new Date(),
        },
      ]

      // 手动保存
      chatHistory.manualSave()

      // 验证保存函数被调用
      expect(saveChatHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'mock-uuid-1234',
          selectedModel: 'openai/gpt-4',
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: '测试消息',
            }),
          ]),
          metadata: expect.objectContaining({
            totalMessages: 1,
          }),
        })
      )
    })
  })

  describe('历史恢复功能', () => {
    it('应该能够恢复保存的对话历史', async () => {
      const mockHistory: ChatHistoryData = {
        sessionId: 'test-session',
        lastModified: new Date(),
        selectedModel: 'openai/gpt-4',
        messages: [
          {
            role: 'user',
            content: '恢复的消息',
            timestamp: new Date(),
          },
        ],
        metadata: {
          totalMessages: 1,
          createdAt: new Date(),
        },
      }

      // Mock loadChatHistory 返回测试数据
      vi.mocked(loadChatHistory).mockReturnValue(mockHistory)

      // 调用恢复功能
      const result = await chatHistory.restoreHistory()

      // 验证恢复成功
      expect(result).toBe(true)
      expect(messages.value).toHaveLength(1)
      expect(messages.value[0].content).toBe('恢复的消息')
      expect(selectedModel.value).toBe('openai/gpt-4')
      expect(scrollToBottom).toHaveBeenCalled()
    })

    it('没有保存历史时应该返回false', async () => {
      // Mock loadChatHistory 返回null
      vi.mocked(loadChatHistory).mockReturnValue(null)

      const result = await chatHistory.restoreHistory()

      expect(result).toBe(false)
      expect(messages.value).toHaveLength(0)
    })

    it('历史过旧时应该跳过恢复', async () => {
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 2) // 2天前

      const mockHistory: ChatHistoryData = {
        sessionId: 'test-session',
        lastModified: oldDate,
        selectedModel: 'openai/gpt-4',
        messages: [
          {
            role: 'user',
            content: '过旧的消息',
            timestamp: new Date(),
          },
        ],
        metadata: {
          totalMessages: 1,
          createdAt: new Date(),
        },
      }

      vi.mocked(loadChatHistory).mockReturnValue(mockHistory)

      const result = await chatHistory.restoreHistory()

      expect(result).toBe(false)
      expect(messages.value).toHaveLength(0)
    })
  })

  describe('清除历史功能', () => {
    it('应该能够清除对话历史', () => {
      // 设置一些初始数据
      messages.value = [
        {
          role: 'user',
          content: '要被清除的消息',
          timestamp: new Date(),
        },
      ]

      // 清除历史
      chatHistory.clearChatHistoryEnhanced()

      // 验证清除函数被调用
      expect(clearChatHistory).toHaveBeenCalled()
    })
  })

  describe('导出导入功能', () => {
    it('应该能够导出对话历史', () => {
      messages.value = [
        {
          role: 'user',
          content: '要导出的消息',
          timestamp: new Date('2024-01-01'),
        },
      ]

      // Mock DOM方法
      const mockClick = vi.fn()
      const mockCreateElement = vi.spyOn(document, 'createElement').mockReturnValue({
        click: mockClick,
        href: '',
        download: '',
      } as any)

      const mockCreateObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url')
      const mockRevokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

      // 导出对话
      chatHistory.exportChat()

      // 验证导出流程
      expect(mockCreateElement).toHaveBeenCalledWith('a')
      expect(mockCreateObjectURL).toHaveBeenCalled()
      expect(mockClick).toHaveBeenCalled()
      expect(mockRevokeObjectURL).toHaveBeenCalled()

      // 恢复mock
      mockCreateElement.mockRestore()
      mockCreateObjectURL.mockRestore()
      mockRevokeObjectURL.mockRestore()
    })

    it('应该能够导入有效的对话数据', () => {
      const importData = {
        timestamp: '2024-01-01T00:00:00.000Z',
        model: 'openai/gpt-4',
        messages: [
          {
            role: 'user',
            content: '导入的消息',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
        ],
      }

      // 设置导入数据
      chatHistory.importChatData.value = JSON.stringify(importData)
      chatHistory.replaceExistingChat.value = true

      // 执行导入
      chatHistory.importChat()

      // 验证导入结果
      expect(messages.value).toHaveLength(1)
      expect(messages.value[0].content).toBe('导入的消息')
      expect(selectedModel.value).toBe('openai/gpt-4')
    })

    it('应该拒绝无效的导入数据', () => {
      // 设置无效数据
      chatHistory.importChatData.value = '{ invalid json'

      // 执行导入
      chatHistory.importChat()

      // 验证错误处理
      expect(chatHistory.importError.value).toContain('解析 JSON 数据失败')
      expect(messages.value).toHaveLength(0)
    })
  })

  describe('会话管理', () => {
    it('应该生成唯一的会话ID', () => {
      expect(chatHistory.sessionId.value).toBe('mock-uuid-1234')
    })

    it('应该记录会话创建时间', () => {
      expect(chatHistory.sessionCreatedTime.value).toBeInstanceOf(Date)
    })
  })
})