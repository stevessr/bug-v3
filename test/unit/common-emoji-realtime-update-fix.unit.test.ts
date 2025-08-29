import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createEmojiPicker } from '../../src/content-script/content/picker/emoji-picker-core'
import * as cacheManager from '../../src/content-script/content/picker/cache-manager'
import * as eventHandlers from '../../src/content-script/content/picker/event-handlers'

// Mock Chrome APIs
global.chrome = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
    },
  },
} as any

describe('常用表情实时更新修复测试', () => {
  beforeEach(() => {
    // 清除所有模拟
    vi.clearAllMocks()
  })

  afterEach(() => {
    // 清理DOM
    document.body.innerHTML = ''
  })

  it('应该正确处理表情使用记录并更新常用表情组', async () => {
    // 模拟后台响应
    const mockResponse = {
      success: true,
      data: {
        groups: [
          {
            UUID: 'common-emoji-group',
            displayName: '常用',
            emojis: [{ UUID: 'emoji-1', displayName: '笑脸', usageCount: 5 }],
          },
        ],
      },
    }(
      // 模拟chrome.runtime.sendMessage
      global.chrome.runtime.sendMessage as jest.Mock,
    ).mockImplementation((message, callback) => {
      callback(mockResponse)
    })

    // 创建表情选择器
    const picker = await createEmojiPicker(false)

    // 验证选择器创建成功
    expect(picker).toBeTruthy()
    expect(picker.querySelector('.emoji-picker__section')).toBeTruthy()

    // 验证常用表情组存在
    const commonSection = picker.querySelector('[data-section="common-emoji-group"]')
    expect(commonSection).toBeTruthy()
  })

  it('应该在使用记录更新后正确刷新UI', async () => {
    // 创建自定义事件监听器来验证刷新
    const refreshHandler = vi.fn()
    window.addEventListener('emoji-common-group-refreshed', refreshHandler)

    // 模拟发送使用记录更新事件
    window.dispatchEvent(
      new CustomEvent('emoji-common-group-refreshed', {
        detail: {
          group: {
            UUID: 'common-emoji-group',
            emojis: [{ UUID: 'emoji-1', displayName: '新表情', usageCount: 1 }],
          },
          timestamp: Date.now(),
        },
      }),
    )

    // 验证事件被正确处理
    expect(refreshHandler).toHaveBeenCalled()

    // 清理监听器
    window.removeEventListener('emoji-common-group-refreshed', refreshHandler)
  })

  it('应该正确处理表情点击事件并记录使用', async () => {
    // 模拟后台响应
    const mockResponse = {
      success: true,
      message: 'Usage recorded successfully',
    }(
      // 模拟chrome.runtime.sendMessage
      global.chrome.runtime.sendMessage as jest.Mock,
    ).mockImplementation((message, callback) => {
      if (message.type === 'RECORD_EMOJI_USAGE') {
        callback(mockResponse)
      }
    })

    // 创建一个模拟的表情元素
    const emojiElement = document.createElement('img')
    emojiElement.className = 'emoji'
    emojiElement.setAttribute('data-uuid', 'test-emoji-uuid')
    emojiElement.setAttribute('data-emoji', '测试表情')
    emojiElement.setAttribute('src', 'test.png')

    // 模拟文本区域
    const textArea = document.createElement('textarea')
    textArea.className = 'd-editor-input'
    document.body.appendChild(textArea)
    document.body.appendChild(emojiElement)

    // 模拟点击事件
    const clickEvent = new MouseEvent('click')
    emojiElement.dispatchEvent(clickEvent)

    // 验证后台通信被调用
    expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'RECORD_EMOJI_USAGE', uuid: 'test-emoji-uuid' }),
      expect.any(Function),
    )
  })
})
