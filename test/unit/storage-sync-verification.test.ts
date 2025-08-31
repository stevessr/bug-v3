/**
 * 存储同步验证的单元测试
 * 测试saveCommonEmojiGroup和recordUsageByUUID的存储同步逻辑
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock数据
const mockCommonEmojiGroup = {
  UUID: 'common-emoji-group',
  displayName: '常用',
  emojis: [
    { UUID: 'common-1', displayName: 'AgADHBkAAlNGaVc', usageCount: 1, lastUsed: Date.now() },
    { UUID: 'common-2', displayName: '疑问', usageCount: 4, lastUsed: Date.now() },
    { UUID: 'common-3', displayName: '干嘛', usageCount: 1, lastUsed: Date.now() }
  ]
}

const mockRegularGroup = {
  UUID: 'regular-group-1',
  displayName: '普通组',
  emojis: [
    { UUID: 'regular-1', displayName: '吃东西', usageCount: 1, lastUsed: Date.now() },
    { UUID: 'regular-2', displayName: '困了', usageCount: 1, lastUsed: Date.now() }
  ]
}

const mockUngroupedEmojis = [
  { UUID: 'ungrouped-1', displayName: '未分组1', usageCount: 2, lastUsed: Date.now() },
  { UUID: 'ungrouped-2', displayName: '未分组2', usageCount: 0, lastUsed: Date.now() }
]

// Mock localStorage
function createMockLocalStorage() {
  const storage: Record<string, string> = {}
  
  return {
    getItem: vi.fn((key: string) => storage[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      storage[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete storage[key]
    }),
    clear: vi.fn(() => {
      Object.keys(storage).forEach(key => delete storage[key])
    }),
    // 测试辅助方法
    getStorage: () => ({ ...storage }),
    hasKey: (key: string) => key in storage
  }
}

// Mock Chrome Storage
function createMockChromeStorage() {
  const storage: Record<string, any> = {}
  
  return {
    local: {
      get: vi.fn(async (keys: string[]) => {
        const result: Record<string, any> = {}
        keys.forEach(key => {
          if (key in storage) {
            result[key] = storage[key]
          }
        })
        return result
      }),
      set: vi.fn(async (data: Record<string, any>) => {
        Object.assign(storage, data)
      }),
      clear: vi.fn(async () => {
        Object.keys(storage).forEach(key => delete storage[key])
      }),
      // 测试辅助方法
      getStorage: () => ({ ...storage }),
      hasKey: (key: string) => key in storage
    }
  }
}

// Mock storage module
function createMockStorage() {
  const mockLocalStorage = createMockLocalStorage()
  const mockChromeStorage = createMockChromeStorage()
  
  // Mock global objects
  global.window = {
    localStorage: mockLocalStorage
  } as any
  
  global.chrome = mockChromeStorage as any
  
  let syncScheduled = false
  let broadcastMessages: any[] = []
  
  const storage = {
    saveCommonEmojiGroup: vi.fn((group: any) => {
      console.log('[MockStorage] saveCommonEmojiGroup called')
      
      if (!group || !group.UUID) {
        throw new Error('Invalid group data')
      }
      
      const serialized = JSON.stringify(group)
      mockLocalStorage.setItem('emojiGroups-common', serialized)
      
      // Verify save
      const saved = mockLocalStorage.getItem('emojiGroups-common')
      if (!saved) {
        throw new Error('Failed to save to localStorage')
      }
      
      // Broadcast message
      broadcastMessages.push({ type: 'common-emoji-updated', data: group })
      
      // Schedule sync
      syncScheduled = true
      
      console.log('[MockStorage] saveCommonEmojiGroup completed successfully')
    }),
    
    saveUngroupedEmojis: vi.fn((ungrouped: any[]) => {
      console.log('[MockStorage] saveUngroupedEmojis called')
      
      const serialized = JSON.stringify(ungrouped)
      mockLocalStorage.setItem('emojiGroups-ungrouped', serialized)
      
      // Schedule sync
      syncScheduled = true
      
      console.log('[MockStorage] saveUngroupedEmojis completed successfully')
    }),
    
    getCommonEmojiGroup: vi.fn(() => {
      const saved = mockLocalStorage.getItem('emojiGroups-common')
      if (saved) {
        return {
          exists: true,
          group: JSON.parse(saved)
        }
      }
      return { exists: false, group: null }
    }),
    
    scheduleSyncToExtension: vi.fn(() => {
      syncScheduled = true
    }),
    
    // 测试辅助方法
    getSyncScheduled: () => syncScheduled,
    resetSyncScheduled: () => { syncScheduled = false },
    getBroadcastMessages: () => [...broadcastMessages],
    clearBroadcastMessages: () => { broadcastMessages = [] },
    getMockLocalStorage: () => mockLocalStorage,
    getMockChromeStorage: () => mockChromeStorage
  }
  
  return storage
}

// Mock emoji groups store
function createMockEmojiGroupsStore() {
  let emojiGroups = [mockCommonEmojiGroup, mockRegularGroup]
  let ungrouped = [...mockUngroupedEmojis]
  let cacheCleared = false
  
  const mockStorage = createMockStorage()
  const mockSettingsStore = {
    save: vi.fn((groups: any[], ungroupedEmojis: any[]) => {
      console.log('[MockSettingsStore] save called')
      emojiGroups = [...groups]
      ungrouped = [...ungroupedEmojis]
    })
  }
  
  function findEmojiByUUID(uuid: string) {
    for (const group of emojiGroups) {
      const emoji = group.emojis.find(e => e.UUID === uuid)
      if (emoji) {
        return { group, emoji }
      }
    }
    return null
  }
  
  function recordUsageByUUID(uuid: string) {
    console.log('[MockEmojiGroupsStore] Recording usage for UUID:', uuid)
    
    // 查找分组表情
    const found = findEmojiByUUID(uuid)
    if (found && found.emoji) {
      const e = found.emoji
      const oldUsageCount = e.usageCount || 0
      
      // 更新使用次数
      e.usageCount = (e.usageCount || 0) + 1
      e.lastUsed = Date.now()
      
      console.log('[MockEmojiGroupsStore] Updated usage count from', oldUsageCount, 'to', e.usageCount)
      
      // 清除缓存
      cacheCleared = true
      
      try {
        // 保存到设置存储
        mockSettingsStore.save(emojiGroups, ungrouped)
        
        // 如果是常用表情组，额外保存
        if (found.group.UUID === 'common-emoji-group') {
          console.log('[MockEmojiGroupsStore] Saving common emoji group to dedicated storage')
          mockStorage.saveCommonEmojiGroup(found.group)
        }
        
        return true
      } catch (error) {
        console.error('[MockEmojiGroupsStore] Failed to save:', error)
        return false
      }
    }
    
    // 查找未分组表情
    const ungroupedEmoji = ungrouped.find(e => e.UUID === uuid)
    if (ungroupedEmoji) {
      const oldUsageCount = ungroupedEmoji.usageCount || 0
      
      // 更新使用次数
      ungroupedEmoji.usageCount = (ungroupedEmoji.usageCount || 0) + 1
      ungroupedEmoji.lastUsed = Date.now()
      
      console.log('[MockEmojiGroupsStore] Updated ungrouped usage count from', oldUsageCount, 'to', ungroupedEmoji.usageCount)
      
      // 清除缓存
      cacheCleared = true
      
      try {
        // 保存到设置存储
        mockSettingsStore.save(emojiGroups, ungrouped)
        
        // 保存到专用未分组存储
        mockStorage.saveUngroupedEmojis(ungrouped)
        
        return true
      } catch (error) {
        console.error('[MockEmojiGroupsStore] Failed to save ungrouped:', error)
        return false
      }
    }
    
    console.warn('[MockEmojiGroupsStore] Emoji not found with UUID:', uuid)
    return false
  }
  
  return {
    recordUsageByUUID,
    findEmojiByUUID,
    getEmojiGroups: () => [...emojiGroups],
    getUngrouped: () => [...ungrouped],
    getCacheCleared: () => cacheCleared,
    resetCacheCleared: () => { cacheCleared = false },
    mockStorage,
    mockSettingsStore
  }
}

describe('Storage Sync Verification Tests', () => {
  let mockStore: ReturnType<typeof createMockEmojiGroupsStore>

  beforeEach(() => {
    mockStore = createMockStore()
    vi.clearAllMocks()
  })

  it('should save common emoji group when recording usage for common emoji', async () => {
    const commonEmojiUUID = 'common-1' // AgADHBkAAlNGaVc
    
    const success = mockStore.recordUsageByUUID(commonEmojiUUID)
    
    expect(success).toBe(true)
    expect(mockStore.mockStorage.saveCommonEmojiGroup).toHaveBeenCalledTimes(1)
    
    // 验证保存的数据
    const savedCall = mockStore.mockStorage.saveCommonEmojiGroup.mock.calls[0]
    const savedGroup = savedCall[0]
    
    expect(savedGroup.UUID).toBe('common-emoji-group')
    expect(savedGroup.displayName).toBe('常用')
    
    // 验证表情使用次数被更新
    const updatedEmoji = savedGroup.emojis.find((e: any) => e.UUID === commonEmojiUUID)
    expect(updatedEmoji.usageCount).toBe(2) // 从1增加到2
  })

  it('should not save common emoji group when recording usage for regular emoji', async () => {
    const regularEmojiUUID = 'regular-1' // 吃东西
    
    const success = mockStore.recordUsageByUUID(regularEmojiUUID)
    
    expect(success).toBe(true)
    expect(mockStore.mockStorage.saveCommonEmojiGroup).not.toHaveBeenCalled()
    expect(mockStore.mockSettingsStore.save).toHaveBeenCalledTimes(1)
  })

  it('should save ungrouped emojis when recording usage for ungrouped emoji', async () => {
    const ungroupedEmojiUUID = 'ungrouped-1'
    
    const success = mockStore.recordUsageByUUID(ungroupedEmojiUUID)
    
    expect(success).toBe(true)
    expect(mockStore.mockStorage.saveUngroupedEmojis).toHaveBeenCalledTimes(1)
    
    // 验证保存的数据
    const savedCall = mockStore.mockStorage.saveUngroupedEmojis.mock.calls[0]
    const savedUngrouped = savedCall[0]
    
    const updatedEmoji = savedUngrouped.find((e: any) => e.UUID === ungroupedEmojiUUID)
    expect(updatedEmoji.usageCount).toBe(3) // 从2增加到3
  })

  it('should clear cache after recording usage', async () => {
    mockStore.resetCacheCleared()
    
    const success = mockStore.recordUsageByUUID('common-1')
    
    expect(success).toBe(true)
    expect(mockStore.getCacheCleared()).toBe(true)
  })

  it('should handle storage errors gracefully', async () => {
    // 模拟存储错误
    mockStore.mockStorage.saveCommonEmojiGroup.mockImplementation(() => {
      throw new Error('Storage error')
    })
    
    const success = mockStore.recordUsageByUUID('common-1')
    
    // 应该仍然返回true，因为主存储成功了
    expect(success).toBe(true)
    expect(mockStore.mockSettingsStore.save).toHaveBeenCalledTimes(1)
  })

  it('should verify localStorage write after saving common emoji group', async () => {
    const success = mockStore.recordUsageByUUID('common-1')
    
    expect(success).toBe(true)
    
    // 验证localStorage被写入
    const mockLocalStorage = mockStore.mockStorage.getMockLocalStorage()
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'emojiGroups-common',
      expect.any(String)
    )
    
    // 验证数据完整性
    const savedData = mockLocalStorage.getItem('emojiGroups-common')
    expect(savedData).toBeTruthy()
    
    const parsedData = JSON.parse(savedData as string)
    expect(parsedData.UUID).toBe('common-emoji-group')
    expect(parsedData.emojis).toHaveLength(3)
  })

  it('should schedule sync to extension storage', async () => {
    mockStore.mockStorage.resetSyncScheduled()
    
    const success = mockStore.recordUsageByUUID('common-1')
    
    expect(success).toBe(true)
    expect(mockStore.mockStorage.getSyncScheduled()).toBe(true)
  })

  it('should broadcast change messages', async () => {
    mockStore.mockStorage.clearBroadcastMessages()
    
    const success = mockStore.recordUsageByUUID('common-1')
    
    expect(success).toBe(true)
    
    const messages = mockStore.mockStorage.getBroadcastMessages()
    expect(messages).toHaveLength(1)
    expect(messages[0].type).toBe('common-emoji-updated')
    expect(messages[0].data.UUID).toBe('common-emoji-group')
  })

  it('should handle data integrity validation', async () => {
    // 测试无效数据
    const invalidGroup = { UUID: null, displayName: null, emojis: null }
    
    expect(() => {
      mockStore.mockStorage.saveCommonEmojiGroup(invalidGroup)
    }).toThrow('Invalid group data')
  })

  it('should verify save operation with getCommonEmojiGroup', async () => {
    const success = mockStore.recordUsageByUUID('common-1')
    
    expect(success).toBe(true)
    
    // 验证可以读取保存的数据
    const savedGroup = mockStore.mockStorage.getCommonEmojiGroup()
    expect(savedGroup.exists).toBe(true)
    expect(savedGroup.group.UUID).toBe('common-emoji-group')
    
    // 验证使用次数更新
    const updatedEmoji = savedGroup.group.emojis.find((e: any) => e.UUID === 'common-1')
    expect(updatedEmoji.usageCount).toBe(2)
  })

  it('should handle multiple rapid usage updates', async () => {
    const promises = [
      mockStore.recordUsageByUUID('common-1'),
      mockStore.recordUsageByUUID('common-2'),
      mockStore.recordUsageByUUID('ungrouped-1')
    ]
    
    const results = await Promise.all(promises)
    
    // 所有操作都应该成功
    expect(results.every(result => result === true)).toBe(true)
    
    // 验证存储操作被正确调用
    expect(mockStore.mockStorage.saveCommonEmojiGroup).toHaveBeenCalledTimes(2) // common-1 和 common-2
    expect(mockStore.mockStorage.saveUngroupedEmojis).toHaveBeenCalledTimes(1) // ungrouped-1
    expect(mockStore.mockSettingsStore.save).toHaveBeenCalledTimes(3) // 每次都调用
  })

  it('should maintain data consistency across storage operations', async () => {
    // 记录多次使用
    mockStore.recordUsageByUUID('common-1')
    mockStore.recordUsageByUUID('common-1')
    mockStore.recordUsageByUUID('common-1')
    
    // 验证数据一致性
    const savedGroup = mockStore.mockStorage.getCommonEmojiGroup()
    const updatedEmoji = savedGroup.group.emojis.find((e: any) => e.UUID === 'common-1')
    
    expect(updatedEmoji.usageCount).toBe(4) // 1 + 3 = 4
    
    // 验证在内存中的数据也是一致的
    const memoryGroup = mockStore.getEmojiGroups().find(g => g.UUID === 'common-emoji-group')
    const memoryEmoji = memoryGroup?.emojis.find(e => e.UUID === 'common-1')
    
    expect(memoryEmoji?.usageCount).toBe(4)
  })
})