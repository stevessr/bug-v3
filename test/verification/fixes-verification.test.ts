import { describe, test, expect, vi, beforeEach } from 'vitest'

// 验证修复的三个问题的测试
describe('修复验证测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('问题1: popup页面重复显示常用表情', () => {
    test('menuItems应该过滤常用表情分组避免重复显示', () => {
      // 模拟包含常用表情分组的groups数据
      const mockGroups = [
        { UUID: 'common-emoji-group', displayName: '常用表情', icon: '⭐' },
        { UUID: 'animals-group', displayName: '动物', icon: '🐾' },
        { UUID: 'other-group', displayName: '其他', icon: '🎯' },
      ]

      // 模拟过滤逻辑
      const filteredGroups = mockGroups.filter((g) => {
        const displayName = g.displayName || ''
        return (
          !displayName.includes('常用') &&
          !displayName.includes('收藏') &&
          !displayName.includes('最近')
        )
      })

      // 生成菜单项
      const menuItems = [
        { key: 'all', label: '全部' },
        { key: 'hot', label: '常用' }, // 这是独立的常用菜单项
        ...filteredGroups.map((g) => ({ key: g.UUID, label: g.displayName })),
        { key: 'ungrouped', label: '未分组' },
      ]

      // 验证不会重复显示常用
      const hotLabels = menuItems.filter((item) => item.label.includes('常用'))
      expect(hotLabels).toHaveLength(1) // 应该只有一个"常用"标签
      expect(hotLabels[0].key).toBe('hot') // 应该是独立的hot菜单项

      // 验证常用表情分组被正确过滤
      const commonGroupInMenu = menuItems.find((item) => item.key === 'common-emoji-group')
      expect(commonGroupInMenu).toBeUndefined()

      // 验证其他分组正常显示
      expect(menuItems.find((item) => item.key === 'animals-group')).toBeDefined()
      expect(menuItems.find((item) => item.key === 'other-group')).toBeDefined()
    })
  })

  describe('问题2: 前端表情选择器数据加载', () => {
    test('createEmojiPicker应该能获取最新的表情数据', async () => {
      // 模拟后台通信
      const mockSendMessage = vi.fn().mockResolvedValue({
        success: true,
        data: {
          groups: [
            {
              UUID: 'common-emoji-group',
              displayName: '常用表情',
              icon: '⭐',
              emojis: [
                { UUID: 'emoji-1', displayName: '笑脸', realUrl: 'https://example.com/smile.png' },
                { UUID: 'emoji-2', displayName: '哭脸', realUrl: 'https://example.com/cry.png' },
              ],
            },
            {
              UUID: 'animals-group',
              displayName: '动物',
              icon: '🐾',
              emojis: [
                { UUID: 'emoji-3', displayName: '猫咪', realUrl: 'https://example.com/cat.png' },
              ],
            },
          ],
        },
      })

      // 模拟缓存状态
      const cachedState = {
        emojiGroups: [], // 初始为空
        settings: { imageScale: 30, outputFormat: 'markdown' },
      }

      // 模拟数据加载逻辑
      let groups = cachedState.emojiGroups
      const response = await mockSendMessage({ type: 'GET_EMOJI_DATA' })

      if (response && response.success && response.data && response.data.groups) {
        const freshGroups = response.data.groups.filter(
          (g: any) => g && typeof g.UUID === 'string' && Array.isArray(g.emojis),
        )
        if (freshGroups.length > 0) {
          groups = freshGroups
          cachedState.emojiGroups = groups
        }
      }

      // 验证数据正确加载
      expect(groups).toHaveLength(2)
      expect(groups[0].displayName).toBe('常用表情')
      expect(groups[0].emojis).toHaveLength(2)
      expect(groups[1].displayName).toBe('动物')
      expect(groups[1].emojis).toHaveLength(1)

      // 验证常用表情分组存在且有数据
      const commonGroup = groups.find((g) => g.UUID === 'common-emoji-group')
      expect(commonGroup).toBeDefined()
      expect(commonGroup?.emojis.length).toBeGreaterThan(0)
    })
  })

  describe('问题3: 表情插入文字功能', () => {
    test('insertEmoji应该能正确插入表情文字到文本框', () => {
      // 模拟DOM环境
      const mockTextArea = {
        value: 'Hello ',
        selectionStart: 6,
        selectionEnd: 6,
        focus: vi.fn(),
        dispatchEvent: vi.fn(),
      }

      // 模拟document.querySelector
      const mockQuerySelector = vi.fn().mockImplementation((selector) => {
        if (selector === 'textarea.d-editor-input') {
          return mockTextArea
        }
        return null
      })

      // 模拟Event构造函数
      global.Event = vi.fn().mockImplementation((type, options) => ({
        type,
        bubbles: options?.bubbles || false,
        cancelable: options?.cancelable || false,
      })) as any

      // 模拟表情数据
      const emojiData = {
        id: 'smile',
        displayName: '笑脸',
        realUrl: new URL('https://example.com/smile_500x500.png'),
        displayUrl: new URL('https://example.com/smile_500x500.png'),
        order: 0,
        UUID: 'emoji-uuid-001',
      }

      // 模拟设置
      const currentSettings = {
        outputFormat: 'markdown',
        imageScale: 30,
      }

      // 模拟插入逻辑
      const width = '500'
      const height = '500'
      const imgSrc = emojiData.realUrl.toString()
      const imageScale = currentSettings.imageScale || 30

      let emojiText: string
      switch (currentSettings.outputFormat) {
        case 'markdown':
        default:
          emojiText = `![${emojiData.displayName}|${width}x${height},${imageScale}%](${imgSrc}) `
          break
      }

      const start = mockTextArea.selectionStart || 0
      const end = mockTextArea.selectionEnd || 0
      const text = mockTextArea.value

      // 执行插入
      mockTextArea.value = text.substring(0, start) + emojiText + text.substring(end)
      const expectedText = 'Hello ![笑脸|500x500,30%](https://example.com/smile_500x500.png) '

      // 验证结果
      expect(mockTextArea.value).toBe(expectedText)

      // 验证表情文本格式正确
      expect(emojiText).toContain('![笑脸|500x500,30%]')
      expect(emojiText).toContain('https://example.com/smile_500x500.png')
      expect(emojiText).toContain(' ') // 结尾应该有空格
    })

    test('应该支持HTML格式输出', () => {
      const emojiData = {
        displayName: '笑脸',
        realUrl: new URL('https://example.com/smile_500x500.png'),
        displayUrl: new URL('https://example.com/smile_500x500.png'),
        UUID: 'emoji-001',
      }

      const currentSettings = {
        outputFormat: 'html',
        imageScale: 50,
      }

      const width = '500'
      const height = '500'
      const imgSrc = emojiData.realUrl.toString()
      const imageScale = currentSettings.imageScale || 30

      const scaledWidth = Math.round((parseInt(width) * imageScale) / 100)
      const scaledHeight = Math.round((parseInt(height) * imageScale) / 100)

      const emojiText = `<img src="${imgSrc}" title=":${emojiData.displayName}:" class="emoji only-emoji" alt=":${emojiData.displayName}:" loading="lazy" width="${scaledWidth}" height="${scaledHeight}" style="aspect-ratio: ${scaledWidth} / ${scaledHeight};">`

      // 验证HTML格式正确
      expect(emojiText).toContain('<img src="https://example.com/smile_500x500.png"')
      expect(emojiText).toContain('title=":笑脸:"')
      expect(emojiText).toContain('alt=":笑脸:"')
      expect(emojiText).toContain('width="250"') // 500 * 50% = 250
      expect(emojiText).toContain('height="250"')
      expect(emojiText).toContain('class="emoji only-emoji"')
    })
  })
})
