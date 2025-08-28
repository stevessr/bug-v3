import { describe, it, expect, beforeEach, vi } from 'vitest'

// 模拟emojiGroupsStore的数据
const mockEmojiGroups = [
  {
    UUID: 'common-emoji-group',
    displayName: '常用表情',
    icon: '⭐',
    order: 0,
    emojis: [{ UUID: 'e1', displayName: '笑脸', displayUrl: 'smile.png', usageCount: 10 }],
  },
  {
    UUID: 'normal-group-1',
    displayName: '动物',
    icon: '🐱',
    order: 1,
    emojis: [{ UUID: 'e2', displayName: '猫', displayUrl: 'cat.png', usageCount: 5 }],
  },
  {
    UUID: 'normal-group-2',
    displayName: '食物',
    icon: '🍎',
    order: 2,
    emojis: [{ UUID: 'e3', displayName: '苹果', displayUrl: 'apple.png', usageCount: 3 }],
  },
  {
    UUID: 'favorites-group',
    displayName: '收藏的表情',
    icon: '❤️',
    order: 3,
    emojis: [{ UUID: 'e4', displayName: '心', displayUrl: 'heart.png', usageCount: 8 }],
  },
]

const mockUngrouped = [
  { UUID: 'u1', displayName: '未分组表情1', displayUrl: 'ungrouped1.png', usageCount: 2 },
]

// 模拟 emojiGroupsStore
vi.mock('../src/data/update/emojiGroupsStore', () => ({
  default: {
    getEmojiGroups: vi.fn(() => mockEmojiGroups.map((g) => ({ ...g, emojis: [...g.emojis] }))),
    getNormalGroups: vi.fn(() =>
      mockEmojiGroups
        .filter((g) => {
          if (g.UUID === 'common-emoji-group') return false
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
        .map((g) => ({ ...g, emojis: [...g.emojis] })),
    ),
    getCommonEmojiGroup: vi.fn(() => {
      const common = mockEmojiGroups.find((g) => g.UUID === 'common-emoji-group')
      return common ? { ...common, emojis: [...common.emojis] } : null
    }),
    getHotEmojis: vi.fn(() => {
      const all = []
      for (const g of mockEmojiGroups) {
        all.push(...g.emojis.map((e) => ({ ...e, groupUUID: g.UUID })))
      }
      all.push(...mockUngrouped.map((e) => ({ ...e, groupUUID: 'ungrouped' })))

      const withUsage = all.filter((e) => typeof e.usageCount === 'number' && e.usageCount > 0)
      withUsage.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
      return withUsage.slice(0, 50)
    }),
    getUngrouped: vi.fn(() => mockUngrouped.map((e) => ({ ...e }))),
  },
}))

describe('数据分离重构验证', () => {
  let store: any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should separate normal groups correctly', async () => {
    // 动态导入以确保mock生效
    const { default: mainStore } = await import('../src/data/store/main')
    store = mainStore

    const normalGroups = store.getNormalGroups()

    // 验证结果
    expect(Array.isArray(normalGroups)).toBe(true)
    expect(normalGroups.length).toBe(2) // 只有动物和食物分组

    // 验证不包含常用表情分组
    const hasCommonGroup = normalGroups.some((g: any) => g.UUID === 'common-emoji-group')
    expect(hasCommonGroup).toBe(false)

    // 验证不包含收藏分组
    const hasFavoriteGroup = normalGroups.some((g: any) => g.displayName.includes('收藏'))
    expect(hasFavoriteGroup).toBe(false)

    // 验证包含正常分组
    expect(normalGroups[0].displayName).toBe('动物')
    expect(normalGroups[1].displayName).toBe('食物')
  })

  it('should get common emoji group correctly', async () => {
    const { default: mainStore } = await import('../src/data/store/main')
    store = mainStore

    const commonGroup = store.getCommonEmojiGroup()

    // 验证结果
    expect(commonGroup).not.toBeNull()
    expect(commonGroup.UUID).toBe('common-emoji-group')
    expect(commonGroup.displayName).toBe('常用表情')
    expect(commonGroup.emojis).toHaveLength(1)
    expect(commonGroup.emojis[0].displayName).toBe('笑脸')
  })

  it('should get hot emojis correctly sorted by usage', async () => {
    const { default: mainStore } = await import('../src/data/store/main')
    store = mainStore

    const hotEmojis = store.getHot()

    // 验证结果
    expect(Array.isArray(hotEmojis)).toBe(true)
    expect(hotEmojis.length).toBeGreaterThan(0)

    // 验证按使用次数排序（降序）
    expect(hotEmojis[0].usageCount).toBe(10) // 笑脸，使用次数最高
    expect(hotEmojis[0].displayName).toBe('笑脸')

    expect(hotEmojis[1].usageCount).toBe(8) // 心，使用次数第二
    expect(hotEmojis[1].displayName).toBe('心')

    // 验证包含分组信息
    expect(hotEmojis[0].groupUUID).toBe('common-emoji-group')
  })

  it('should maintain data independence', async () => {
    const { default: mainStore } = await import('../src/data/store/main')
    store = mainStore

    // 获取不同类型的数据
    const allGroups = store.getGroups()
    const normalGroups = store.getNormalGroups()
    const commonGroup = store.getCommonEmojiGroup()
    const hotEmojis = store.getHot()
    const ungrouped = store.getUngrouped()

    // 验证数据独立性
    expect(allGroups.length).toBe(4) // 包含所有分组
    expect(normalGroups.length).toBe(2) // 只包含普通分组
    expect(commonGroup).not.toBeNull() // 常用分组存在
    expect(hotEmojis.length).toBeGreaterThan(0) // 热门表情存在
    expect(ungrouped.length).toBe(1) // 未分组表情存在

    // 验证数据不重复
    const normalGroupUUIDs = normalGroups.map((g: any) => g.UUID)
    expect(normalGroupUUIDs).not.toContain('common-emoji-group')
    expect(normalGroupUUIDs).not.toContain('favorites-group')
  })

  it('should handle empty or missing data gracefully', async () => {
    // 模拟空数据情况
    vi.doMock('../src/data/update/emojiGroupsStore', () => ({
      default: {
        getEmojiGroups: vi.fn(() => []),
        getNormalGroups: vi.fn(() => []),
        getCommonEmojiGroup: vi.fn(() => null),
        getHotEmojis: vi.fn(() => []),
        getUngrouped: vi.fn(() => []),
      },
    }))

    const { default: mainStore } = await import('../src/data/store/main')
    store = mainStore

    // 验证空数据处理
    expect(store.getGroups()).toEqual([])
    expect(store.getNormalGroups()).toEqual([])
    expect(store.getCommonEmojiGroup()).toBeNull()
    expect(store.getHot()).toEqual([])
    expect(store.getUngrouped()).toEqual([])
  })
})

describe('PopupApp 使用分离数据验证', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock store
    vi.doMock('../src/data/store/main', () => ({
      default: {
        getSettings: vi.fn(() => ({ gridColumns: 4, imageScale: 50 })),
        getNormalGroups: vi.fn(() => [
          { UUID: 'normal-1', displayName: '动物', emojis: [] },
          { UUID: 'normal-2', displayName: '食物', emojis: [] },
        ]),
        getCommonEmojiGroup: vi.fn(() => ({
          UUID: 'common-emoji-group',
          displayName: '常用表情',
          emojis: [],
        })),
        getUngrouped: vi.fn(() => []),
        getHot: vi.fn(() => []),
        saveSettings: vi.fn(),
      },
      recordUsage: vi.fn(),
    }))

    // Mock communication service
    vi.doMock('../src/services/communication', () => ({
      createPopupCommService: vi.fn(() => ({
        sendSettingsChanged: vi.fn(),
        sendUsageRecorded: vi.fn(),
        onSettingsChanged: vi.fn(),
        onGroupsChanged: vi.fn(),
        onUsageRecorded: vi.fn(),
      })),
    }))
  })

  it('should use separated data interfaces without client-side filtering', async () => {
    const { mount } = await import('@vue/test-utils')
    const PopupApp = (await import('../src/popup/PopupApp.vue')).default

    const wrapper = mount(PopupApp, {
      global: {
        stubs: {
          'a-menu': { template: '<div class="mock-menu"><slot /></div>' },
          'a-button': { template: '<button class="mock-button"><slot /></button>' },
          'a-input': { template: '<input class="mock-input" />' },
          'a-slider': { template: '<input type="range" class="mock-slider" />' },
        },
      },
    })

    await wrapper.vm.$nextTick()

    // 验证组件使用分离的数据
    expect(wrapper.vm.normalGroups).toBeDefined()
    expect(wrapper.vm.commonEmojiGroup).toBeDefined()
    expect(wrapper.vm.filteredGroups).toBeDefined()

    // 验证菜单项生成正确
    const menuItems = wrapper.vm.menuItems
    expect(menuItems).toHaveLength(4) // 全部、常用、动物、食物、未分组
    expect(menuItems.map((item: any) => item.label)).toEqual([
      '全部',
      '常用',
      '动物',
      '食物',
      '未分组',
    ])
  })
})
