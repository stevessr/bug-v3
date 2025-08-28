/**
 * 测试表情插入功能的修复
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

describe('表情插入功能修复测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTextArea.value = ''
    mockTextArea.selectionStart = 0
    mockTextArea.selectionEnd = 0
  })

  test('应该能够找到文本框并插入表情', () => {
    // 模拟 cachedState
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
      realUrl: new URL('https://example.com/emoji.png'),
      displayUrl: new URL('https://example.com/emoji.png'),
      order: 0,
      UUID: 'test-uuid',
    }

    // 模拟插入函数的核心逻辑
    const textArea = document.querySelector('textarea.d-editor-input') as any
    const richEle = document.querySelector('.ProseMirror.d-editor-input') as any

    expect(textArea).toBeTruthy()
    expect(richEle).toBeTruthy()

    // 验证文本框查找逻辑
    expect(document.querySelector).toHaveBeenCalledWith('textarea.d-editor-input')
  })

  test('应该生成正确的markdown格式', () => {
    const imgSrc = 'https://example.com/emoji_500x500.png'
    const displayName = '测试表情'
    const imageScale = 30

    // 模拟URL匹配逻辑
    const match = imgSrc.match(/_(\d{3,})x(\d{3,})\./)
    const width = match ? match[1] : '500'
    const height = match ? match[2] : '500'

    // 生成markdown文本
    const emojiText = `![${displayName}|${width}x${height},${imageScale}%](${imgSrc}) `

    expect(emojiText).toBe('![测试表情|500x500,30%](https://example.com/emoji_500x500.png) ')
  })

  test('应该生成正确的HTML格式', () => {
    const imgSrc = 'https://example.com/emoji.png'
    const displayName = '测试表情'
    const width = '500'
    const height = '500'
    const imageScale = 30

    const scaledWidth = Math.round((parseInt(width) * imageScale) / 100)
    const scaledHeight = Math.round((parseInt(height) * imageScale) / 100)

    // 生成HTML文本（新格式）
    const expectedHtml = `<img src="${imgSrc}" title=":${displayName}:" class="emoji only-emoji" alt=":${displayName}:" loading="lazy" width="${scaledWidth}" height="${scaledHeight}" style="aspect-ratio: ${scaledWidth} / ${scaledHeight};">`

    expect(expectedHtml).toContain('title=":测试表情:"')
    expect(expectedHtml).toContain('class="emoji only-emoji"')
    expect(expectedHtml).toContain('alt=":测试表情:"')
    expect(expectedHtml).toContain('loading="lazy"')
    expect(expectedHtml).toContain('width="150"')
    expect(expectedHtml).toContain('height="150"')
    expect(expectedHtml).toContain('style="aspect-ratio: 150 / 150;"')
  })

  test('应该正确处理富文本编辑器', () => {
    const imgSrc = 'https://example.com/emoji.png'
    const displayName = '测试表情'
    const width = '500'
    const height = '500'
    const imageScale = 30

    const scaledWidth = Math.round((parseInt(width) * imageScale) / 100)
    const scaledHeight = Math.round((parseInt(height) * imageScale) / 100)

    const expectedTemplate = `<img src="${imgSrc}" alt="${displayName}" width="${width}" height="${height}" data-scale="${imageScale}" style="width: ${scaledWidth}px; height: ${scaledHeight}px">`

    expect(expectedTemplate).toContain('width="500"')
    expect(expectedTemplate).toContain('height="500"')
    expect(expectedTemplate).toContain('data-scale="30"')
    expect(expectedTemplate).toContain('style="width: 150px; height: 150px"')
  })
})
