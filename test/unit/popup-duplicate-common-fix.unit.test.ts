import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import PopupApp from '../../src/popup/PopupApp.vue'

// Mock dependencies
vi.mock('../../src/data/store/main', () => ({
  default: {
    getSettings: vi.fn(() => ({
      gridColumns: 4,
      imageScale: 50,
      MobileMode: false,
    })),
    getGroups: vi.fn(() => [
      {
        UUID: 'common-emoji-group',
        displayName: '常用表情',
        emojis: [{ UUID: 'e1', displayUrl: 'test1.png', realUrl: 'test1.png' }],
      },
      {
        UUID: 'normal-group-1',
        displayName: '正常分组1',
        emojis: [{ UUID: 'e2', displayUrl: 'test2.png', realUrl: 'test2.png' }],
      },
      {
        UUID: 'normal-group-2',
        displayName: '正常分组2',
        emojis: [{ UUID: 'e3', displayUrl: 'test3.png', realUrl: 'test3.png' }],
      },
    ]),
    getUngrouped: vi.fn(() => []),
    getHot: vi.fn(() => [{ UUID: 'e1', displayUrl: 'test1.png', realUrl: 'test1.png' }]),
    saveSettings: vi.fn(),
  },
  recordUsage: vi.fn(),
}))

vi.mock('../../src/services/communication', () => ({
  createPopupCommService: vi.fn(() => ({
    sendSettingsChanged: vi.fn(),
    sendUsageRecorded: vi.fn(),
    onSettingsChanged: vi.fn(),
    onGroupsChanged: vi.fn(),
    onUsageRecorded: vi.fn(),
  })),
}))

// Mock ant-design-vue components
vi.mock('ant-design-vue', () => ({
  message: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('PopupApp - 修复常用表情重复显示', () => {
  let wrapper: any

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Mock global chrome object
    global.chrome = {
      runtime: {
        openOptionsPage: vi.fn(),
        getURL: vi.fn(() => '/options.html'),
      },
    }

    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  it('应该在filteredGroups中排除常用表情分组', async () => {
    wrapper = mount(PopupApp, {
      global: {
        stubs: {
          'a-menu': { template: '<div class="mock-menu"><slot /></div>' },
          'a-button': { template: '<button class="mock-button"><slot /></button>' },
          'a-input': { template: '<input class="mock-input" />' },
          'a-slider': { template: '<input type="range" class="mock-slider" />' },
          'setting-outlined': { template: '<span>⚙</span>' },
          'search-outlined': { template: '<span>🔍</span>' },
        },
      },
    })

    await wrapper.vm.$nextTick()

    // 获取filteredGroups计算属性
    const filteredGroups = wrapper.vm.filteredGroups

    // 验证常用表情分组被排除
    expect(filteredGroups).toBeDefined()
    expect(Array.isArray(filteredGroups)).toBe(true)

    // 检查是否包含常用表情分组
    const hasCommonGroup = filteredGroups.some(
      (group: any) =>
        group.UUID === 'common-emoji-group' ||
        (group.displayName && group.displayName.includes('常用')),
    )

    expect(hasCommonGroup).toBe(false)

    // 验证只包含正常分组
    expect(filteredGroups.length).toBe(2)
    expect(filteredGroups[0].UUID).toBe('normal-group-1')
    expect(filteredGroups[1].UUID).toBe('normal-group-2')
  })

  it('应该在模板中只显示一次常用表情（通过filteredHot）', async () => {
    wrapper = mount(PopupApp, {
      global: {
        stubs: {
          'a-menu': { template: '<div class="mock-menu"><slot /></div>' },
          'a-button': { template: '<button class="mock-button"><slot /></button>' },
          'a-input': { template: '<input class="mock-input" />' },
          'a-slider': { template: '<input type="range" class="mock-slider" />' },
          'setting-outlined': { template: '<span>⚙</span>' },
          'search-outlined': { template: '<span>🔍</span>' },
        },
      },
    })

    await wrapper.vm.$nextTick()

    // 查找所有包含"常用"文本的group-title元素
    const groupTitles = wrapper.findAll('.group-title')
    const commonTitles = groupTitles.filter((title: any) => title.text().includes('常用'))

    // 应该只有一个"常用"标题（来自硬编码的常用部分）
    expect(commonTitles.length).toBe(1)
    expect(commonTitles[0].text()).toBe('常用')
  })

  it('搜索时应该正确过滤，不包含常用表情分组', async () => {
    wrapper = mount(PopupApp, {
      global: {
        stubs: {
          'a-menu': { template: '<div class="mock-menu"><slot /></div>' },
          'a-button': { template: '<button class="mock-button"><slot /></button>' },
          'a-input': { template: '<input class="mock-input" />' },
          'a-slider': { template: '<input type="range" class="mock-slider" />' },
          'setting-outlined': { template: '<span>⚙</span>' },
          'search-outlined': { template: '<span>🔍</span>' },
        },
      },
    })

    await wrapper.vm.$nextTick()

    // 设置搜索查询
    wrapper.vm.searchQuery = '正常'
    await wrapper.vm.$nextTick()

    const filteredGroups = wrapper.vm.filteredGroups

    // 验证搜索结果不包含常用表情分组
    const hasCommonGroup = filteredGroups.some((group: any) => group.UUID === 'common-emoji-group')

    expect(hasCommonGroup).toBe(false)

    // 验证包含匹配搜索条件的分组
    expect(filteredGroups.length).toBeGreaterThan(0)
    filteredGroups.forEach((group: any) => {
      expect(group.displayName).toContain('正常')
    })
  })

  it('菜单项中应该不包含常用表情分组', async () => {
    wrapper = mount(PopupApp, {
      global: {
        stubs: {
          'a-menu': { template: '<div class="mock-menu"><slot /></div>' },
          'a-button': { template: '<button class="mock-button"><slot /></button>' },
          'a-input': { template: '<input class="mock-input" />' },
          'a-slider': { template: '<input type="range" class="mock-slider" />' },
          'setting-outlined': { template: '<span>⚙</span>' },
          'search-outlined': { template: '<span>🔍</span>' },
        },
      },
    })

    await wrapper.vm.$nextTick()

    const menuItems = wrapper.vm.menuItems

    // 检查菜单项中是否包含常用表情分组
    const hasCommonGroupInMenu = menuItems.some(
      (item: any) =>
        item.key === 'common-emoji-group' || (item.label && item.label.includes('常用表情')),
    )

    expect(hasCommonGroupInMenu).toBe(false)

    // 验证应该有"全部"、"常用"和"未分组"项目
    const menuLabels = menuItems.map((item: any) => item.label)
    expect(menuLabels).toContain('全部')
    expect(menuLabels).toContain('常用') // 这是独立的菜单项，不是分组
    expect(menuLabels).toContain('未分组')

    // 验证包含正常分组
    expect(menuLabels).toContain('正常分组1')
    expect(menuLabels).toContain('正常分组2')
  })
})
