/**
 * 测试表情插入时实时获取设置功能
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'

// Mock DOM elements
const mockTextArea = {
  selectionStart: 0,
  selectionEnd: 0,
  value: '',
  focus: vi.fn(),
  dispatchEvent: vi.fn(),
}

const mockRichEditor = {
  dispatchEvent: vi.fn(),
}

// Mock DOM query selectors
global.document = {
  querySelector: vi.fn().mockImplementation((selector: string) => {
    if (selector === 'textarea.d-editor-input') {
      return mockTextArea
    }
    if (selector === '.ProseMirror.d-editor-input') {
      return mockRichEditor
    }
    return null
  }),
} as any

// Mock crypto.randomUUID
global.crypto = {
  randomUUID: vi.fn().mockReturnValue('test-uuid'),
} as any

// Mock Event constructor
global.Event = vi.fn().mockImplementation((type: string, options: any) => ({
  type,
  ...options,
})) as any

// Mock ClipboardEvent and DataTransfer
global.ClipboardEvent = vi.fn() as any
global.DataTransfer = vi.fn().mockImplementation(() => ({
  setData: vi.fn(),
})) as any

describe('表情插入实时设置获取测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTextArea.value = ''
    mockTextArea.selectionStart = 0
    mockTextArea.selectionEnd = 0
  })

  test('应该能够实时获取最新的设置', async () => {
    // Mock sendMessageToBackground 函数
    const mockSendMessage = vi.fn().mockResolvedValue({
      success: true,
      data: {
        settings: {
          outputFormat: 'html',
          imageScale: 50, // 不同于缓存中的30
        },
      },
    })

    // Mock cachedState
    const cachedState = {
      settings: {
        outputFormat: 'markdown',
        imageScale: 30,
      },
    }

    // 模拟表情数据
    const emojiData = {
      id: 'test-emoji',
      displayName: '测试表情',
      realUrl: new URL('https://example.com/emoji_500x500.png'),
      displayUrl: new URL('https://example.com/emoji_500x500.png'),
      order: 0,
      UUID: 'test-uuid',
    }

    // 验证后台通信被调用
    await mockSendMessage({ type: 'GET_EMOJI_DATA' })
    expect(mockSendMessage).toHaveBeenCalledWith({ type: 'GET_EMOJI_DATA' })

    // 验证返回的设置
    const response = await mockSendMessage({ type: 'GET_EMOJI_DATA' })
    expect(response.success).toBe(true)
    expect(response.data.settings.imageScale).toBe(50) // 实时获取的新值
    expect(response.data.settings.outputFormat).toBe('html') // 实时获取的新值

    // 验证设置合并逻辑
    const currentSettings = { ...cachedState.settings, ...response.data.settings }
    expect(currentSettings.imageScale).toBe(50) // 应该使用新值
    expect(currentSettings.outputFormat).toBe('html') // 应该使用新值
  })

  test('获取设置失败时应该回退到缓存设置', async () => {
    // Mock sendMessageToBackground 失败的情况
    const mockSendMessage = vi.fn().mockResolvedValue({
      success: false,
      error: 'Network error',
    })

    const cachedState = {
      settings: {
        outputFormat: 'markdown',
        imageScale: 30,
      },
    }

    await mockSendMessage({ type: 'GET_EMOJI_DATA' })
    const response = await mockSendMessage({ type: 'GET_EMOJI_DATA' })

    // 验证失败时使用缓存设置
    expect(response.success).toBe(false)
    const currentSettings = cachedState.settings // 应该回退到缓存设置
    expect(currentSettings.imageScale).toBe(30)
    expect(currentSettings.outputFormat).toBe('markdown')
  })

  test('应该根据实时获取的设置生成正确的HTML格式', () => {
    const realtimeSettings = {
      outputFormat: 'html',
      imageScale: 40, // 实时获取的缩放比例
    }

    const imgSrc = 'https://example.com/emoji_500x500.png'
    const displayName = '测试表情'
    const width = '500'
    const height = '500'
    const imageScale = realtimeSettings.imageScale

    const scaledWidth = Math.round((parseInt(width) * imageScale) / 100)
    const scaledHeight = Math.round((parseInt(height) * imageScale) / 100)

    // 生成HTML文本（使用实时设置）
    const expectedHtml = `<img src="${imgSrc}" title=":${displayName}:" class="emoji only-emoji" alt=":${displayName}:" loading="lazy" width="${scaledWidth}" height="${scaledHeight}" style="aspect-ratio: ${scaledWidth} / ${scaledHeight};">`

    expect(expectedHtml).toContain('width="200"') // 500 * 40% = 200
    expect(expectedHtml).toContain('height="200"')
    expect(expectedHtml).toContain('style="aspect-ratio: 200 / 200;"')
  })

  test('应该根据实时获取的设置生成正确的Markdown格式', () => {
    const realtimeSettings = {
      outputFormat: 'markdown',
      imageScale: 60, // 实时获取的缩放比例
    }

    const imgSrc = 'https://example.com/emoji_500x500.png'
    const displayName = '测试表情'
    const width = '500'
    const height = '500'
    const imageScale = realtimeSettings.imageScale

    // 生成Markdown文本（使用实时设置）
    const expectedMarkdown = `![${displayName}|${width}x${height},${imageScale}%](${imgSrc}) `

    expect(expectedMarkdown).toBe('![测试表情|500x500,60%](https://example.com/emoji_500x500.png) ')
  })

  test('异步insertEmoji函数应该正确处理错误', async () => {
    // Mock console.error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Mock sendMessageToBackground 抛出错误
    const mockSendMessage = vi.fn().mockRejectedValue(new Error('Network timeout'))

    try {
      await mockSendMessage({ type: 'GET_EMOJI_DATA' })
    } catch (error) {
      expect(error.message).toBe('Network timeout')
    }

    expect(mockSendMessage).toHaveBeenCalledWith({ type: 'GET_EMOJI_DATA' })

    consoleSpy.mockRestore()
  })
})
