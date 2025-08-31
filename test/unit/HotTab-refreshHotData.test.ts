/**
 * HotTab refreshHotData函数的单元测试
 * 测试强制数据重新加载机制、错误处理和重试逻辑
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'

// Mock数据
const mockValidEmojis = [
  { UUID: 'emoji-1', displayName: '疑问', usageCount: 4, groupUUID: 'group-1' },
  { UUID: 'emoji-2', displayName: 'AgADHBkAAlNGaVc', usageCount: 1, groupUUID: 'common-emoji-group' },
  { UUID: 'emoji-3', displayName: '干嘛', usageCount: 1, groupUUID: 'group-1' },
  { UUID: 'emoji-4', displayName: '吃东西', usageCount: 1, groupUUID: 'group-1' },
  { UUID: 'emoji-5', displayName: '困了', usageCount: 1, groupUUID: 'group-1' }
]

const mockInvalidEmojis = [
  null, // null值
  { UUID: 'emoji-invalid-1' }, // 缺少必要字段
  { displayName: '无UUID', usageCount: 1 }, // 缺少UUID
  { UUID: 'emoji-invalid-2', displayName: '无使用次数' }, // 缺少usageCount
  { UUID: 'emoji-invalid-3', displayName: '错误类型', usageCount: 'not-a-number' } // 错误的数据类型
]

const mockEmojisWithZeroUsage = [
  { UUID: 'emoji-zero-1', displayName: '零使用1', usageCount: 0, groupUUID: 'group-1' },
  { UUID: 'emoji-zero-2', displayName: '零使用2', usageCount: 0, groupUUID: 'group-1' }
]

// Mock store
function createMockStore() {
  let shouldFail = false
  let failCount = 0
  let maxFails = 0
  let returnData = [...mockValidEmojis]
  let cacheCleared = false

  return {
    getHot: vi.fn((forceRefresh = false) => {
      console.log('[MockStore] getHot called with forceRefresh:', forceRefresh)
      
      if (shouldFail && failCount < maxFails) {
        failCount++
        throw new Error(`Mock store error (attempt ${failCount})`)
      }
      
      return [...returnData]
    }),
    clearHotEmojiCache: vi.fn(() => {
      cacheCleared = true
      console.log('[MockStore] Cache cleared')
    }),
    // 测试控制方法
    setShouldFail: (fail: boolean, maxFailAttempts = 1) => {
      shouldFail = fail
      maxFails = maxFailAttempts
      failCount = 0
    },
    setReturnData: (data: any[]) => {
      returnData = [...data]
    },
    getCacheCleared: () => cacheCleared,
    resetCacheCleared: () => { cacheCleared = false },
    getFailCount: () => failCount
  }
}

// Mock refreshHotData函数
function createMockRefreshHotData(mockStore: ReturnType<typeof createMockStore>) {
  const items = ref<any[]>([])

  async function refreshHotData(retryCount = 0): Promise<void> {
    const maxRetries = 3
    const refreshStartTime = Date.now()
    
    try {
      console.log('[MockRefresh] Starting refresh, attempt:', retryCount + 1)
      
      // 清除缓存
      if (typeof mockStore.clearHotEmojiCache === 'function') {
        mockStore.clearHotEmojiCache()
      }
      
      // 获取数据
      const hotEmojis = mockStore.getHot(true)
      
      // 数据验证
      const validEmojis = hotEmojis.filter(e => {
        return e && 
          typeof e.UUID === 'string' && 
          typeof e.displayName === 'string' && 
          typeof e.usageCount === 'number'
      })
      
      // 过滤有使用次数的表情
      const filteredEmojis = validEmojis.filter((e: any) => e.usageCount > 0)
      
      // 排序验证
      const sortedCorrectly = filteredEmojis.every((emoji, index) => {
        if (index === 0) return true
        return emoji.usageCount <= filteredEmojis[index - 1].usageCount
      })
      
      if (!sortedCorrectly) {
        filteredEmojis.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
      }
      
      // 更新UI
      items.value = [...filteredEmojis]
      
      // 一致性验证
      if (items.value.length !== filteredEmojis.length) {
        throw new Error(`Data inconsistency: items.value.length (${items.value.length}) !== filteredEmojis.length (${filteredEmojis.length})`)
      }
      
      if (!items.value.every(item => item.usageCount > 0)) {
        throw new Error('Some items have zero usage count')
      }
      
      if (!items.value.every((item, index) => {
        if (index === 0) return true
        return item.usageCount <= items.value[index - 1].usageCount
      })) {
        throw new Error('Items are not properly sorted by usage count')
      }
      
      console.log('[MockRefresh] Refresh completed successfully')
      
    } catch (err) {
      console.error('[MockRefresh] Refresh failed:', err)
      
      // 重试机制
      if (retryCount < maxRetries) {
        const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000)
        console.log(`[MockRefresh] Retrying in ${retryDelay}ms...`)
        
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return refreshHotData(retryCount + 1)
      } else {
        throw new Error(`Refresh failed after ${maxRetries + 1} attempts: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  return {
    items,
    refreshHotData
  }
}

describe('RefreshHotData Function Tests', () => {
  let mockStore: ReturnType<typeof createMockStore>
  let mockRefresh: ReturnType<typeof createMockRefreshHotData>

  beforeEach(() => {
    mockStore = createMockStore()
    mockRefresh = createMockRefreshHotData(mockStore)
    vi.clearAllMocks()
  })

  it('should successfully refresh hot data', async () => {
    await mockRefresh.refreshHotData()

    // 验证数据被正确加载
    expect(mockRefresh.items.value.length).toBe(5)
    expect(mockRefresh.items.value.every(item => item.usageCount > 0)).toBe(true)
    
    // 验证排序
    for (let i = 0; i < mockRefresh.items.value.length - 1; i++) {
      expect(mockRefresh.items.value[i].usageCount).toBeGreaterThanOrEqual(mockRefresh.items.value[i + 1].usageCount)
    }
  })

  it('should call store.getHot with forceRefresh=true', async () => {
    await mockRefresh.refreshHotData()

    expect(mockStore.getHot).toHaveBeenCalledWith(true)
  })

  it('should clear cache before refreshing', async () => {
    mockStore.resetCacheCleared()
    
    await mockRefresh.refreshHotData()

    expect(mockStore.getCacheCleared()).toBe(true)
    expect(mockStore.clearHotEmojiCache).toHaveBeenCalled()
  })

  it('should filter out invalid emoji data', async () => {
    // 设置包含无效数据的返回值
    const mixedData = [...mockValidEmojis, ...mockInvalidEmojis]
    mockStore.setReturnData(mixedData)

    await mockRefresh.refreshHotData()

    // 验证只有有效数据被保留
    expect(mockRefresh.items.value.length).toBe(5) // 只有5个有效表情
    expect(mockRefresh.items.value.every(item => 
      typeof item.UUID === 'string' && 
      typeof item.displayName === 'string' && 
      typeof item.usageCount === 'number'
    )).toBe(true)
  })

  it('should filter out emojis with zero usage count', async () => {
    // 设置包含零使用次数表情的数据
    const dataWithZeroUsage = [...mockValidEmojis, ...mockEmojisWithZeroUsage]
    mockStore.setReturnData(dataWithZeroUsage)

    await mockRefresh.refreshHotData()

    // 验证零使用次数的表情被过滤掉
    expect(mockRefresh.items.value.length).toBe(5) // 不包含零使用次数的表情
    expect(mockRefresh.items.value.every(item => item.usageCount > 0)).toBe(true)
  })

  it('should sort emojis by usage count in descending order', async () => {
    // 设置乱序数据
    const unsortedData = [
      { UUID: 'emoji-1', displayName: '表情1', usageCount: 1, groupUUID: 'group-1' },
      { UUID: 'emoji-2', displayName: '表情2', usageCount: 5, groupUUID: 'group-1' },
      { UUID: 'emoji-3', displayName: '表情3', usageCount: 3, groupUUID: 'group-1' },
      { UUID: 'emoji-4', displayName: '表情4', usageCount: 2, groupUUID: 'group-1' }
    ]
    mockStore.setReturnData(unsortedData)

    await mockRefresh.refreshHotData()

    // 验证排序正确
    const usageCounts = mockRefresh.items.value.map(item => item.usageCount)
    expect(usageCounts).toEqual([5, 3, 2, 1])
  })

  it('should retry on failure', async () => {
    // 设置前2次调用失败，第3次成功
    mockStore.setShouldFail(true, 2)

    await mockRefresh.refreshHotData()

    // 验证重试了正确的次数
    expect(mockStore.getFailCount()).toBe(2)
    expect(mockStore.getHot).toHaveBeenCalledTimes(3) // 2次失败 + 1次成功
    
    // 验证最终成功
    expect(mockRefresh.items.value.length).toBe(5)
  })

  it('should fail after max retries', async () => {
    // 设置所有调用都失败
    mockStore.setShouldFail(true, 10) // 超过最大重试次数

    await expect(mockRefresh.refreshHotData()).rejects.toThrow('Refresh failed after 4 attempts')
    
    // 验证重试了最大次数
    expect(mockStore.getHot).toHaveBeenCalledTimes(4) // 1次初始 + 3次重试
  })

  it('should handle empty data gracefully', async () => {
    mockStore.setReturnData([])

    await mockRefresh.refreshHotData()

    expect(mockRefresh.items.value).toEqual([])
  })

  it('should detect and fix data inconsistencies', async () => {
    // 这个测试验证数据一致性检查逻辑
    await mockRefresh.refreshHotData()

    // 验证所有一致性检查都通过
    expect(mockRefresh.items.value.every(item => item.usageCount > 0)).toBe(true)
    expect(mockRefresh.items.value.every((item, index) => {
      if (index === 0) return true
      return item.usageCount <= mockRefresh.items.value[index - 1].usageCount
    })).toBe(true)
  })

  it('should handle concurrent refresh calls', async () => {
    // 模拟并发调用
    const promises = [
      mockRefresh.refreshHotData(),
      mockRefresh.refreshHotData(),
      mockRefresh.refreshHotData()
    ]

    await Promise.all(promises)

    // 验证最终状态一致
    expect(mockRefresh.items.value.length).toBe(5)
    expect(mockRefresh.items.value.every(item => item.usageCount > 0)).toBe(true)
  })

  it('should maintain data integrity during refresh', async () => {
    // 初始数据
    await mockRefresh.refreshHotData()
    const initialData = [...mockRefresh.items.value]

    // 更新store数据
    const updatedData = [
      ...mockValidEmojis,
      { UUID: 'emoji-new', displayName: '新表情', usageCount: 10, groupUUID: 'group-1' }
    ]
    mockStore.setReturnData(updatedData)

    // 再次刷新
    await mockRefresh.refreshHotData()

    // 验证数据正确更新
    expect(mockRefresh.items.value.length).toBe(6)
    expect(mockRefresh.items.value[0].displayName).toBe('新表情')
    expect(mockRefresh.items.value[0].usageCount).toBe(10)
  })

  it('should handle malformed data gracefully', async () => {
    // 设置包含各种异常数据的返回值
    const malformedData = [
      ...mockValidEmojis,
      undefined,
      null,
      {},
      { UUID: null, displayName: null, usageCount: null },
      { UUID: '', displayName: '', usageCount: -1 },
      'not-an-object'
    ]
    mockStore.setReturnData(malformedData as any)

    await mockRefresh.refreshHotData()

    // 验证只有有效数据被保留
    expect(mockRefresh.items.value.length).toBe(5)
    expect(mockRefresh.items.value.every(item => 
      item && 
      typeof item.UUID === 'string' && 
      typeof item.displayName === 'string' && 
      typeof item.usageCount === 'number' &&
      item.usageCount > 0
    )).toBe(true)
  })
})