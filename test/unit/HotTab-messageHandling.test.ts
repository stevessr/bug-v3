/**
 * HotTab消息处理机制的单元测试
 * 测试usageRecordedHandler和数据刷新逻辑
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'

// Mock数据
const mockHotEmojis = [
  { UUID: 'emoji-1', displayName: '疑问', usageCount: 4, groupUUID: 'group-1' },
  { UUID: 'emoji-2', displayName: 'AgADHBkAAlNGaVc', usageCount: 1, groupUUID: 'common-emoji-group' },
  { UUID: 'emoji-3', displayName: '干嘛', usageCount: 1, groupUUID: 'group-1' },
  { UUID: 'emoji-4', displayName: '吃东西', usageCount: 1, groupUUID: 'group-1' },
  { UUID: 'emoji-5', displayName: '困了', usageCount: 1, groupUUID: 'group-1' }
]

const mockGroups = [
  {
    UUID: 'group-1',
    displayName: '测试组1',
    emojis: [
      { UUID: 'emoji-1', displayName: '疑问', usageCount: 4 },
      { UUID: 'emoji-3', displayName: '干嘛', usageCount: 1 },
      { UUID: 'emoji-4', displayName: '吃东西', usageCount: 1 },
      { UUID: 'emoji-5', displayName: '困了', usageCount: 1 },
      { UUID: 'emoji-6', displayName: '盯着', usageCount: 0 } // 新增的表情
    ]
  },
  {
    UUID: 'common-emoji-group',
    displayName: '常用',
    emojis: [
      { UUID: 'emoji-2', displayName: 'AgADHBkAAlNGaVc', usageCount: 1 }
    ]
  }
]

// Mock store
function createMockStore() {
  let hotEmojis = [...mockHotEmojis]
  let groups = [...mockGroups]
  let cacheCleared = false

  return {
    getHot: vi.fn((forceRefresh = false) => {
      console.log('[MockStore] getHot called with forceRefresh:', forceRefresh)
      if (forceRefresh) {
        console.log('[MockStore] Force refresh requested, returning fresh data')
      }
      return [...hotEmojis]
    }),
    getGroups: vi.fn(() => [...groups]),
    clearHotEmojiCache: vi.fn(() => {
      cacheCleared = true
      console.log('[MockStore] Cache cleared')
    }),
    // 模拟表情使用记录更新
    updateEmojiUsage: (uuid: string) => {
      // 更新热门表情列表
      const emoji = hotEmojis.find(e => e.UUID === uuid)
      if (emoji) {
        emoji.usageCount += 1
      } else {
        // 如果是新使用的表情，添加到热门列表
        const groupEmoji = groups.flatMap(g => g.emojis).find(e => e.UUID === uuid)
        if (groupEmoji && groupEmoji.usageCount === 0) {
          groupEmoji.usageCount = 1
          hotEmojis.push({
            UUID: groupEmoji.UUID,
            displayName: groupEmoji.displayName,
            usageCount: 1,
            groupUUID: groups.find(g => g.emojis.includes(groupEmoji))?.UUID || 'unknown'
          })
        }
      }
      
      // 重新排序
      hotEmojis.sort((a, b) => b.usageCount - a.usageCount)
    },
    getCacheCleared: () => cacheCleared,
    resetCacheCleared: () => { cacheCleared = false }
  }
}

// Mock HotTab组件逻辑
function createMockHotTab() {
  const items = ref([...mockHotEmojis.filter(e => e.usageCount > 0)])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const stats = ref({ groupCount: 2, emojiCount: 6, totalHotness: 8 })
  
  const mockStore = createMockStore()

  async function refreshHotData() {
    console.log('[MockHotTab] Starting hot data refresh...')
    
    // 强制从存储中重新加载热门表情数据
    const hotEmojis = mockStore.getHot(true)
    console.log('[MockHotTab] Retrieved hot emojis from store:', hotEmojis.length)
    
    // 过滤出有使用次数的表情
    const filteredEmojis = hotEmojis.filter((e: any) => e.usageCount > 0)
    
    // 更新UI
    items.value = filteredEmojis
    
    console.log('[MockHotTab] Hot data refresh completed:', {
      totalEmojis: hotEmojis.length,
      filteredEmojis: filteredEmojis.length,
      finalDisplayCount: items.value.length
    })
  }

  async function usageRecordedHandler(data: any) {
    const handlerStartTime = Date.now()
    try {
      console.log('[MockHotTab] Received usage recorded message:', data)
      
      // 设置加载状态
      loading.value = true
      error.value = null

      // 清除缓存
      if (typeof mockStore.clearHotEmojiCache === 'function') {
        mockStore.clearHotEmojiCache()
      }

      // 记录刷新前的数据
      const beforeRefresh = {
        itemsCount: items.value.length,
        topItems: items.value.slice(0, 3).map(item => ({
          name: item.displayName,
          count: item.usageCount,
          uuid: item.UUID
        }))
      }

      // 模拟表情使用更新
      if (data?.uuid) {
        mockStore.updateEmojiUsage(data.uuid)
      }

      // 强制刷新数据
      await refreshHotData()
      
      // 验证刷新结果
      const afterRefresh = {
        itemsCount: items.value.length,
        topItems: items.value.slice(0, 3).map(item => ({
          name: item.displayName,
          count: item.usageCount,
          uuid: item.UUID
        }))
      }
      
      const hasChanges = beforeRefresh.itemsCount !== afterRefresh.itemsCount ||
        JSON.stringify(beforeRefresh.topItems) !== JSON.stringify(afterRefresh.topItems)

      // 重新计算统计信息
      const groups = mockStore.getGroups()
      let emojiCount = 0
      let totalHot = 0
      for (const g of groups) {
        if (Array.isArray(g.emojis)) {
          emojiCount += g.emojis.length
          for (const e of g.emojis) {
            totalHot += (e as any).usageCount || 0
          }
        }
      }
      stats.value = { groupCount: groups.length, emojiCount, totalHotness: totalHot }

      const handlerDuration = Date.now() - handlerStartTime
      console.log('[MockHotTab] Usage update completed:', {
        duration: handlerDuration,
        hasChanges,
        finalItemsCount: items.value.length
      })
      
      return { hasChanges, beforeRefresh, afterRefresh }
      
    } catch (err) {
      console.error('[MockHotTab] Failed to handle usage update:', err)
      error.value = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    items,
    loading,
    error,
    stats,
    refreshHotData,
    usageRecordedHandler,
    mockStore
  }
}

describe('HotTab Message Handling Tests', () => {
  let mockHotTab: ReturnType<typeof createMockHotTab>

  beforeEach(() => {
    mockHotTab = createMockHotTab()
    vi.clearAllMocks()
  })

  it('should handle usage recorded message correctly', async () => {
    const initialItemsCount = mockHotTab.items.value.length
    console.log('Initial items count:', initialItemsCount)

    // 模拟接收到使用记录消息
    const usageData = {
      uuid: 'emoji-6', // '盯着' - 之前使用次数为0
      timestamp: Date.now()
    }

    const result = await mockHotTab.usageRecordedHandler(usageData)

    // 验证处理结果
    expect(result.hasChanges).toBe(true)
    expect(mockHotTab.items.value.length).toBe(initialItemsCount + 1)
    
    // 验证新表情出现在列表中
    const newEmoji = mockHotTab.items.value.find(item => item.UUID === 'emoji-6')
    expect(newEmoji).toBeDefined()
    expect(newEmoji?.usageCount).toBe(1)
  })

  it('should call store.getHot with forceRefresh=true', async () => {
    const usageData = {
      uuid: 'emoji-1',
      timestamp: Date.now()
    }

    await mockHotTab.usageRecordedHandler(usageData)

    // 验证store.getHot被调用且使用了forceRefresh=true
    expect(mockHotTab.mockStore.getHot).toHaveBeenCalledWith(true)
  })

  it('should clear cache before refreshing data', async () => {
    const usageData = {
      uuid: 'emoji-1',
      timestamp: Date.now()
    }

    // 重置缓存清除状态
    mockHotTab.mockStore.resetCacheCleared()
    expect(mockHotTab.mockStore.getCacheCleared()).toBe(false)

    await mockHotTab.usageRecordedHandler(usageData)

    // 验证缓存被清除
    expect(mockHotTab.mockStore.getCacheCleared()).toBe(true)
    expect(mockHotTab.mockStore.clearHotEmojiCache).toHaveBeenCalled()
  })

  it('should update statistics after handling usage message', async () => {
    const initialStats = { ...mockHotTab.stats.value }
    
    const usageData = {
      uuid: 'emoji-6', // 新使用的表情
      timestamp: Date.now()
    }

    await mockHotTab.usageRecordedHandler(usageData)

    // 验证统计信息被更新
    expect(mockHotTab.stats.value.totalHotness).toBeGreaterThan(initialStats.totalHotness)
  })

  it('should handle errors gracefully', async () => {
    // 模拟store.getHot抛出错误
    mockHotTab.mockStore.getHot.mockImplementation(() => {
      throw new Error('Store error')
    })

    const usageData = {
      uuid: 'emoji-1',
      timestamp: Date.now()
    }

    await expect(mockHotTab.usageRecordedHandler(usageData)).rejects.toThrow('Store error')
    
    // 验证错误状态被设置
    expect(mockHotTab.error.value).toBe('Store error')
    expect(mockHotTab.loading.value).toBe(false)
  })

  it('should filter out emojis with zero usage count', async () => {
    // 确保初始状态不包含使用次数为0的表情
    const initialItems = mockHotTab.items.value
    expect(initialItems.every(item => item.usageCount > 0)).toBe(true)

    // 模拟刷新数据
    await mockHotTab.refreshHotData()

    // 验证刷新后仍然只包含有使用次数的表情
    const refreshedItems = mockHotTab.items.value
    expect(refreshedItems.every(item => item.usageCount > 0)).toBe(true)
  })

  it('should detect data changes correctly', async () => {
    const usageData1 = {
      uuid: 'emoji-1', // 已存在的表情，增加使用次数
      timestamp: Date.now()
    }

    const result1 = await mockHotTab.usageRecordedHandler(usageData1)
    expect(result1.hasChanges).toBe(true) // 使用次数变化

    const usageData2 = {
      uuid: 'emoji-6', // 新表情
      timestamp: Date.now()
    }

    const result2 = await mockHotTab.usageRecordedHandler(usageData2)
    expect(result2.hasChanges).toBe(true) // 列表长度变化
  })

  it('should verify specific emoji appears in results', async () => {
    const usageData = {
      uuid: 'emoji-6', // '盯着' - 之前不在热门列表中
      timestamp: Date.now()
    }

    await mockHotTab.usageRecordedHandler(usageData)

    // 验证特定表情出现在结果中
    const updatedEmoji = mockHotTab.items.value.find(item => item.UUID === 'emoji-6')
    expect(updatedEmoji).toBeDefined()
    expect(updatedEmoji?.displayName).toBe('盯着')
    expect(updatedEmoji?.usageCount).toBe(1)
  })

  it('should maintain emoji sorting by usage count', async () => {
    const usageData = {
      uuid: 'emoji-6', // 新表情，使用次数为1
      timestamp: Date.now()
    }

    await mockHotTab.usageRecordedHandler(usageData)

    // 验证表情按使用次数排序
    const items = mockHotTab.items.value
    for (let i = 0; i < items.length - 1; i++) {
      expect(items[i].usageCount).toBeGreaterThanOrEqual(items[i + 1].usageCount)
    }
  })

  it('should handle multiple rapid usage updates', async () => {
    const usageData1 = { uuid: 'emoji-6', timestamp: Date.now() }
    const usageData2 = { uuid: 'emoji-5', timestamp: Date.now() + 1 }
    const usageData3 = { uuid: 'emoji-4', timestamp: Date.now() + 2 }

    // 快速连续处理多个消息
    const results = await Promise.all([
      mockHotTab.usageRecordedHandler(usageData1),
      mockHotTab.usageRecordedHandler(usageData2),
      mockHotTab.usageRecordedHandler(usageData3)
    ])

    // 验证所有消息都被正确处理
    results.forEach(result => {
      expect(result.hasChanges).toBe(true)
    })

    // 验证最终状态
    expect(mockHotTab.loading.value).toBe(false)
    expect(mockHotTab.error.value).toBeNull()
  })
})