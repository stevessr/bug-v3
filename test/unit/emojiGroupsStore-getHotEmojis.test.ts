/**
 * getHotEmojis函数的单元测试
 * 测试强制刷新功能和缓存机制
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock数据
const mockEmojiGroups = [
  {
    UUID: 'group-1',
    displayName: '测试组1',
    emojis: [
      { UUID: 'emoji-1', displayName: '疑问', usageCount: 4 },
      { UUID: 'emoji-2', displayName: '干嘛', usageCount: 1 },
      { UUID: 'emoji-3', displayName: '吃东西', usageCount: 1 },
      { UUID: 'emoji-4', displayName: '困了', usageCount: 1 },
      { UUID: 'emoji-5', displayName: '盯着', usageCount: 0 } // 无使用记录
    ]
  },
  {
    UUID: 'common-emoji-group',
    displayName: '常用',
    emojis: [
      { UUID: 'common-1', displayName: 'AgADHBkAAlNGaVc', usageCount: 1 }
    ]
  }
]

const mockUngrouped = [
  { UUID: 'ungrouped-1', displayName: '未分组1', usageCount: 2 },
  { UUID: 'ungrouped-2', displayName: '未分组2', usageCount: 0 }
]

// Mock store实现
function createMockStore() {
  let emojiGroups = [...mockEmojiGroups]
  let ungrouped = [...mockUngrouped]
  
  const cachedHotEmojis = {
    data: null as any[] | null,
    timestamp: 0,
  }

  function getHotEmojis(forceRefresh = false) {
    const startTime = Date.now()
    console.log('[MockStore] Getting hot emojis, forceRefresh:', forceRefresh)
    
    // 缓存检查
    if (!forceRefresh) {
      const now = Date.now()
      const cacheAge = cachedHotEmojis.timestamp ? now - cachedHotEmojis.timestamp : Infinity
      const cacheValid = cachedHotEmojis.data && cachedHotEmojis.timestamp && cacheAge < 60000
      
      if (cacheValid) {
        console.log('[MockStore] Using cached data')
        return [...cachedHotEmojis.data]
      }
    }

    console.log('[MockStore] Recalculating hot emojis')
    
    // 收集所有表情
    const all: any[] = []
    for (const g of emojiGroups) {
      if (Array.isArray(g.emojis)) {
        const groupEmojis = g.emojis.map((e: any) => ({ ...e, groupUUID: g.UUID }))
        all.push(...groupEmojis)
      }
    }
    
    // 添加未分组表情
    const ungroupedEmojis = ungrouped.map((e: any) => ({ ...e, groupUUID: 'ungrouped' }))
    all.push(...ungroupedEmojis)
    
    // 过滤有使用统计的表情
    const withUsage = all.filter((e) => typeof e.usageCount === 'number' && e.usageCount > 0)
    
    // 排序
    withUsage.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
    
    // 更新缓存
    cachedHotEmojis.data = withUsage.slice(0, 50)
    cachedHotEmojis.timestamp = Date.now()
    
    return [...cachedHotEmojis.data]
  }

  function recordUsageByUUID(uuid: string) {
    console.log('[MockStore] Recording usage for UUID:', uuid)
    
    // 查找并更新表情
    for (const group of emojiGroups) {
      const emoji = group.emojis.find((e: any) => e.UUID === uuid)
      if (emoji) {
        emoji.usageCount = (emoji.usageCount || 0) + 1
        // 清除缓存
        cachedHotEmojis.data = null
        cachedHotEmojis.timestamp = 0
        console.log('[MockStore] Updated emoji and cleared cache')
        return true
      }
    }
    
    // 检查未分组表情
    const ungroupedEmoji = ungrouped.find((e: any) => e.UUID === uuid)
    if (ungroupedEmoji) {
      ungroupedEmoji.usageCount = (ungroupedEmoji.usageCount || 0) + 1
      // 清除缓存
      cachedHotEmojis.data = null
      cachedHotEmojis.timestamp = 0
      console.log('[MockStore] Updated ungrouped emoji and cleared cache')
      return true
    }
    
    return false
  }

  return {
    getHotEmojis,
    recordUsageByUUID,
    getCacheState: () => ({ ...cachedHotEmojis }),
    getEmojiGroups: () => emojiGroups,
    getUngrouped: () => ungrouped
  }
}

describe('getHotEmojis Function Tests', () => {
  let mockStore: ReturnType<typeof createMockStore>

  beforeEach(() => {
    mockStore = createMockStore()
    vi.clearAllMocks()
  })

  it('should return hot emojis sorted by usage count', () => {
    const hotEmojis = mockStore.getHotEmojis(true)
    
    // 验证返回的表情按使用次数排序
    expect(hotEmojis.length).toBeGreaterThan(0)
    
    // 验证排序正确性
    for (let i = 0; i < hotEmojis.length - 1; i++) {
      expect(hotEmojis[i].usageCount).toBeGreaterThanOrEqual(hotEmojis[i + 1].usageCount)
    }
    
    // 验证最热门的表情
    expect(hotEmojis[0].displayName).toBe('疑问')
    expect(hotEmojis[0].usageCount).toBe(4)
  })

  it('should only include emojis with usage count > 0', () => {
    const hotEmojis = mockStore.getHotEmojis(true)
    
    // 验证所有返回的表情都有使用记录
    hotEmojis.forEach(emoji => {
      expect(emoji.usageCount).toBeGreaterThan(0)
    })
    
    // 验证没有使用记录的表情不在列表中
    const dingzheEmoji = hotEmojis.find(e => e.displayName === '盯着')
    expect(dingzheEmoji).toBeUndefined()
  })

  it('should use cache when forceRefresh is false', () => {
    // 第一次调用，创建缓存
    const hotEmojis1 = mockStore.getHotEmojis(false)
    const cacheState1 = mockStore.getCacheState()
    
    expect(cacheState1.data).not.toBeNull()
    expect(cacheState1.timestamp).toBeGreaterThan(0)
    
    // 第二次调用，应该使用缓存
    const hotEmojis2 = mockStore.getHotEmojis(false)
    const cacheState2 = mockStore.getCacheState()
    
    // 缓存时间戳应该相同
    expect(cacheState2.timestamp).toBe(cacheState1.timestamp)
    
    // 数据应该相同
    expect(hotEmojis2).toEqual(hotEmojis1)
  })

  it('should ignore cache when forceRefresh is true', () => {
    // 创建缓存
    const hotEmojis1 = mockStore.getHotEmojis(false)
    const cacheState1 = mockStore.getCacheState()
    
    // 等待一小段时间确保时间戳不同
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
    
    return delay(10).then(() => {
      // 强制刷新
      const hotEmojis2 = mockStore.getHotEmojis(true)
      const cacheState2 = mockStore.getCacheState()
      
      // 缓存时间戳应该更新
      expect(cacheState2.timestamp).toBeGreaterThan(cacheState1.timestamp)
      
      // 数据内容应该相同（因为底层数据没变）
      expect(hotEmojis2.map(e => e.UUID)).toEqual(hotEmojis1.map(e => e.UUID))
    })
  })

  it('should clear cache when emoji usage is recorded', () => {
    // 创建缓存
    const hotEmojis1 = mockStore.getHotEmojis(false)
    const cacheState1 = mockStore.getCacheState()
    
    expect(cacheState1.data).not.toBeNull()
    expect(cacheState1.timestamp).toBeGreaterThan(0)
    
    // 记录表情使用
    const success = mockStore.recordUsageByUUID('emoji-5') // '盯着'
    expect(success).toBe(true)
    
    // 验证缓存被清除
    const cacheStateAfterRecord = mockStore.getCacheState()
    expect(cacheStateAfterRecord.data).toBeNull()
    expect(cacheStateAfterRecord.timestamp).toBe(0)
    
    // 下次获取应该包含新使用的表情
    const hotEmojis2 = mockStore.getHotEmojis(false)
    const dingzheEmoji = hotEmojis2.find(e => e.displayName === '盯着')
    
    expect(dingzheEmoji).toBeDefined()
    expect(dingzheEmoji?.usageCount).toBe(1)
  })

  it('should handle cache expiration correctly', () => {
    // 创建缓存
    const hotEmojis1 = mockStore.getHotEmojis(false)
    const cacheState1 = mockStore.getCacheState()
    
    // 手动设置过期的时间戳（超过1分钟）
    cacheState1.timestamp = Date.now() - 70000 // 70秒前
    
    // 再次获取，应该重新计算
    const hotEmojis2 = mockStore.getHotEmojis(false)
    const cacheState2 = mockStore.getCacheState()
    
    // 缓存应该被更新
    expect(cacheState2.timestamp).toBeGreaterThan(cacheState1.timestamp)
  })

  it('should include emojis from all groups and ungrouped', () => {
    const hotEmojis = mockStore.getHotEmojis(true)
    
    // 验证包含来自不同组的表情
    const groupUUIDs = [...new Set(hotEmojis.map(e => e.groupUUID))]
    
    expect(groupUUIDs).toContain('group-1')
    expect(groupUUIDs).toContain('common-emoji-group')
    expect(groupUUIDs).toContain('ungrouped')
    
    // 验证具体表情
    const emojiNames = hotEmojis.map(e => e.displayName)
    expect(emojiNames).toContain('疑问') // 来自group-1
    expect(emojiNames).toContain('AgADHBkAAlNGaVc') // 来自common-emoji-group
    expect(emojiNames).toContain('未分组1') // 来自ungrouped
  })

  it('should handle empty emoji groups gracefully', () => {
    // 创建空数据的store
    const emptyStore = createMockStore()
    
    // 清空所有数据
    emptyStore.getEmojiGroups().length = 0
    emptyStore.getUngrouped().length = 0
    
    const hotEmojis = emptyStore.getHotEmojis(true)
    
    expect(hotEmojis).toEqual([])
    expect(emptyStore.getCacheState().data).toEqual([])
  })

  it('should limit cache size to 50 emojis', () => {
    // 创建大量表情数据
    const largeEmojiGroup = {
      UUID: 'large-group',
      displayName: '大组',
      emojis: Array.from({ length: 100 }, (_, i) => ({
        UUID: `large-emoji-${i}`,
        displayName: `表情${i}`,
        usageCount: 100 - i // 递减的使用次数
      }))
    }
    
    mockStore.getEmojiGroups().push(largeEmojiGroup)
    
    const hotEmojis = mockStore.getHotEmojis(true)
    const cacheState = mockStore.getCacheState()
    
    // 验证缓存大小限制
    expect(cacheState.data?.length).toBeLessThanOrEqual(50)
    expect(hotEmojis.length).toBeLessThanOrEqual(50)
  })
})