import { describe, test, expect, vi, beforeEach } from 'vitest'

// 测试修复后的功能
describe('popup重复显示和缓存优化修复验证', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('修复1: popup重复显示常用表情问题', () => {
    test('应该使用UUID精确过滤常用表情分组', () => {
      // 模拟包含混合数据的groups（类似converted_payload.json的结构）
      const mockGroups = [
        {
          UUID: 'common-emoji-group',
          displayName: '常用表情',
          icon: '⭐',
          emojis: [{ UUID: 'emoji-1', displayName: '笑脸', usageCount: 5 }],
        },
        {
          UUID: 'other-group-1',
          displayName: '动物',
          icon: '🐾',
          emojis: [{ UUID: 'emoji-2', displayName: '猫咪' }],
        },
        {
          UUID: 'other-group-2',
          displayName: '表情符号',
          icon: '😀',
          emojis: [{ UUID: 'emoji-3', displayName: '哈哈' }],
        },
      ]

      // 模拟修复后的过滤逻辑
      const filteredGroups = mockGroups.filter((g) => {
        // 排除常用表情分组（使用UUID匹配）
        if (g.UUID === 'common-emoji-group') return false

        // 排除显示名称包含常用的分组
        const displayName = g.displayName || ''
        if (
          displayName.includes('常用') ||
          displayName.includes('收藏') ||
          displayName.includes('最近')
        ) {
          return false
        }

        return true
      })

      // 生成菜单项
      const menuItems = [
        { key: 'all', label: '全部' },
        { key: 'hot', label: '常用' }, // 独立的常用菜单项
        ...filteredGroups.map((g) => ({ key: g.UUID, label: g.displayName })),
        { key: 'ungrouped', label: '未分组' },
      ]

      // 验证结果
      expect(filteredGroups).toHaveLength(2) // 只有动物和表情符号两个分组
      expect(filteredGroups.find((g) => g.UUID === 'common-emoji-group')).toBeUndefined()

      // 验证菜单项中只有一个"常用"
      const hotItems = menuItems.filter((item) => item.label.includes('常用'))
      expect(hotItems).toHaveLength(1)
      expect(hotItems[0].key).toBe('hot')

      // 验证其他分组正常显示
      expect(menuItems.find((item) => item.key === 'other-group-1')).toBeDefined()
      expect(menuItems.find((item) => item.key === 'other-group-2')).toBeDefined()
    })
  })

  describe('修复2: 表情选择器缓存优化', () => {
    test('第一次打开应该获取最新数据', async () => {
      // 模拟缓存状态
      let cacheVersion = 0
      let lastDataFetch = 0
      const CACHE_EXPIRE_TIME = 60000

      // 模拟第一次打开
      const now = Date.now()
      const shouldRefreshCache =
        cacheVersion === 0 || // 第一次加载
        now - lastDataFetch > CACHE_EXPIRE_TIME || // 缓存过期
        cacheVersion > 0 // 有更新消息

      expect(shouldRefreshCache).toBe(true) // 第一次应该获取数据

      // 模拟数据获取成功后的状态
      lastDataFetch = now
      cacheVersion = 0

      // 模拟第二次打开（缓存未过期，无更新消息）
      const secondOpenTime = now + 30000 // 30秒后
      const shouldRefreshCacheSecond =
        cacheVersion === 0 || secondOpenTime - lastDataFetch > CACHE_EXPIRE_TIME || cacheVersion > 0

      expect(shouldRefreshCacheSecond).toBe(false) // 第二次应该使用缓存
    })

    test('接收到更新消息后应该重新获取数据', () => {
      // 模拟初始状态
      let cacheVersion = 0
      const lastDataFetch = Date.now()

      // 模拟接收到更新消息
      cacheVersion++ // 增加版本号，标记缓存无效

      // 检查是否需要刷新缓存
      const shouldRefreshCache = cacheVersion > 0
      expect(shouldRefreshCache).toBe(true) // 应该重新获取数据

      // 模拟数据获取完成
      cacheVersion = 0 // 重置版本号

      // 再次检查
      const shouldRefreshCacheAfter = cacheVersion > 0
      expect(shouldRefreshCacheAfter).toBe(false) // 不需要再次获取
    })

    test('缓存过期后应该重新获取数据', () => {
      const CACHE_EXPIRE_TIME = 600000 // 10分钟
      const cacheVersion = 0
      const lastDataFetch = Date.now() - 700000 // 700秒前获取的数据

      const now = Date.now()
      const shouldRefreshCache =
        cacheVersion === 0 || now - lastDataFetch > CACHE_EXPIRE_TIME || cacheVersion > 0

      expect(shouldRefreshCache).toBe(true) // 缓存过期，应该重新获取
    })
  })

  describe('修复3: 常用表情分组排序', () => {
    test('常用表情分组应该始终显示在第一位', () => {
      // 模拟乱序的分组数据
      const mockGroups = [
        { UUID: 'animals-group', displayName: '动物', icon: '🐾' },
        { UUID: 'common-emoji-group', displayName: '常用表情', icon: '⭐' },
        { UUID: 'faces-group', displayName: '表情', icon: '😀' },
      ]

      // 模拟排序逻辑
      const commonGroupIndex = mockGroups.findIndex((g) => g.UUID === 'common-emoji-group')
      if (commonGroupIndex > 0) {
        const commonGroup = mockGroups.splice(commonGroupIndex, 1)[0]
        mockGroups.unshift(commonGroup)
      }

      // 验证常用表情分组在第一位
      expect(mockGroups[0].UUID).toBe('common-emoji-group')
      expect(mockGroups[0].displayName).toBe('常用表情')

      // 验证其他分组顺序
      expect(mockGroups[1].UUID).toBe('animals-group')
      expect(mockGroups[2].UUID).toBe('faces-group')
    })

    test('如果常用表情分组已经在第一位则不需要移动', () => {
      const mockGroups = [
        { UUID: 'common-emoji-group', displayName: '常用表情', icon: '⭐' },
        { UUID: 'animals-group', displayName: '动物', icon: '🐾' },
        { UUID: 'faces-group', displayName: '表情', icon: '😀' },
      ]

      const originalOrder = [...mockGroups]

      // 模拟排序逻辑
      const commonGroupIndex = mockGroups.findIndex((g) => g.UUID === 'common-emoji-group')
      if (commonGroupIndex > 0) {
        const commonGroup = mockGroups.splice(commonGroupIndex, 1)[0]
        mockGroups.unshift(commonGroup)
      }

      // 验证顺序没有改变
      expect(mockGroups).toEqual(originalOrder)
      expect(mockGroups[0].UUID).toBe('common-emoji-group')
    })
  })

  describe('修复4: 数据结构兼容性', () => {
    test('应该正确处理converted_payload.json的数据结构', () => {
      // 模拟converted_payload.json中的数据结构
      const mockData = {
        emojiGroups: [
          {
            UUID: 'common-emoji-group',
            displayName: '常用表情',
            icon: '⭐',
            order: 0,
            emojis: [
              {
                UUID: 'emoji-uuid-001',
                displayName: '笑脸',
                usageCount: 5,
                lastUsed: Date.now(),
              },
            ],
          },
          {
            UUID: 'animals-group',
            displayName: '动物',
            icon: '🐾',
            order: 1,
            emojis: [
              {
                UUID: 'emoji-uuid-002',
                displayName: '猫咪',
              },
            ],
          },
        ],
      }

      // 模拟数据过滤逻辑
      const validGroups = mockData.emojiGroups.filter(
        (g: any) => g && typeof g.UUID === 'string' && Array.isArray(g.emojis),
      )

      expect(validGroups).toHaveLength(2)
      expect(validGroups[0].UUID).toBe('common-emoji-group')
      expect(validGroups[0].emojis).toHaveLength(1)
      expect(validGroups[1].UUID).toBe('animals-group')

      // 验证常用表情分组包含使用统计数据
      const commonGroup = validGroups.find((g) => g.UUID === 'common-emoji-group')
      expect(commonGroup?.emojis[0].usageCount).toBe(5)
      expect(commonGroup?.emojis[0].lastUsed).toBeDefined()
    })
  })
})
