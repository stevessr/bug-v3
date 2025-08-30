import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { 
  handleEmojiUsageChrome, 
  handleEmojiUsageFirefox, 
  updateEmojiUsageInData 
} from '../../src/background/handlers/emoji-handlers'

// Mock DataSyncManager
const mockDataSyncManager = {
  processImmediateUpdate: vi.fn().mockResolvedValue(true),
  syncStorages: vi.fn().mockResolvedValue(true),
  queueBatchUpdate: vi.fn(),
  watchStorageChanges: vi.fn()
}

// Mock the DataSyncManager module
vi.mock('../../src/services/DataSyncManager', () => ({
  DataSyncManager: vi.fn().mockImplementation(() => mockDataSyncManager)
}))

// Mock storage utils
vi.mock('../../src/background/utils/storage-utils', () => ({
  loadFromChromeStorage: vi.fn().mockResolvedValue({
    emojiGroups: [
      {
        UUID: 'common-emoji-group',
        emojis: [
          { UUID: 'test-emoji-uuid', usageCount: 5, lastUsed: Date.now() - 86400000 }
        ]
      }
    ]
  })
}))

describe('Enhanced Emoji Handlers', () => {
  let mockEmojiGroupsStore: any
  let mockCommService: any
  let mockChrome: any
  let mockBrowser: any

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Mock emoji groups store
    mockEmojiGroupsStore = {
      recordUsageByUUID: vi.fn().mockReturnValue(true),
      findEmojiByUUID: vi.fn().mockReturnValue({
        emoji: { 
          UUID: 'test-emoji-uuid',
          displayName: 'Test Emoji',
          usageCount: 5,
          lastUsed: Date.now() - 86400000 // 1 day ago
        },
        group: { 
          UUID: 'common-emoji-group',
          displayName: '常用'
        }
      }),
      getCommonEmojiGroup: vi.fn().mockReturnValue({
        UUID: 'common-emoji-group',
        displayName: '常用',
        emojis: [
          { UUID: 'test-emoji-uuid', displayName: 'Test Emoji', usageCount: 6 }
        ]
      }),
      setCache: vi.fn(),
      findGroupByUUID: vi.fn().mockReturnValue({
        UUID: 'test-group-uuid',
        displayName: 'Test Group'
      })
    }

    // Mock communication service
    mockCommService = {
      sendCommonEmojiUpdated: vi.fn(),
      sendCommonEmojiGroupChanged: vi.fn(),
      sendSpecificGroupChanged: vi.fn(),
      sendUsageRecorded: vi.fn()
    }

    // Mock Chrome API
    mockChrome = {
      storage: {
        local: {
          set: vi.fn((data, callback) => {
            setTimeout(() => callback(), 0)
          })
        }
      },
      runtime: {
        lastError: null
      }
    }

    // Mock Browser API
    mockBrowser = {
      storage: {
        local: {
          set: vi.fn().mockResolvedValue(undefined)
        }
      }
    }

    // Set global mocks
    global.chrome = mockChrome
    global.browser = mockBrowser

    // Mock console methods
    global.console = {
      ...global.console,
      log: vi.fn(),
      error: vi.fn()
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('handleEmojiUsageChrome', () => {
    it('should integrate DataSyncManager for real-time sync', async () => {
      const mockResponse = vi.fn()
      
      await handleEmojiUsageChrome(
        'test-emoji-uuid',
        mockResponse,
        mockEmojiGroupsStore,
        mockCommService,
        null
      )

      // Verify DataSyncManager integration
      expect(mockDataSyncManager.processImmediateUpdate).toHaveBeenCalledWith(
        'common-emoji',
        expect.objectContaining({
          group: expect.objectContaining({
            UUID: 'common-emoji-group'
          }),
          updatedEmoji: expect.objectContaining({
            uuid: 'test-emoji-uuid',
            name: 'Test Emoji'
          }),
          timestamp: expect.any(Number)
        })
      )

      expect(mockDataSyncManager.syncStorages).toHaveBeenCalled()
      expect(mockDataSyncManager.queueBatchUpdate).toHaveBeenCalledWith(
        'cache-invalidation',
        expect.objectContaining({
          keys: ['emoji-usage-cache', 'group-common-emoji-group'],
          reason: 'emoji-usage-updated'
        }),
        'high'
      )

      // Verify real-time sync message
      expect(mockCommService.sendCommonEmojiUpdated).toHaveBeenCalledWith(
        expect.objectContaining({
          UUID: 'common-emoji-group'
        })
      )
    })

    it('should handle DataSyncManager errors gracefully', async () => {
      const mockResponse = vi.fn()
      
      // Make DataSyncManager throw error
      mockDataSyncManager.processImmediateUpdate.mockRejectedValue(new Error('Sync failed'))
      
      await handleEmojiUsageChrome(
        'test-emoji-uuid',
        mockResponse,
        mockEmojiGroupsStore,
        mockCommService,
        null
      )

      // Should still complete successfully despite sync error
      expect(mockEmojiGroupsStore.recordUsageByUUID).toHaveBeenCalledWith('test-emoji-uuid')
      expect(mockCommService.sendCommonEmojiGroupChanged).toHaveBeenCalled()
      
      // Verify error was logged
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[background:emoji-handlers]'),
        'DataSyncManager update failed:',
        expect.any(Error)
      )
    })

    it('should sync storage after successful Chrome storage save', async () => {
      const mockResponse = vi.fn()
      
      // Make recordUsageByUUID fail to trigger storage fallback
      mockEmojiGroupsStore.recordUsageByUUID.mockReturnValue(false)

      await handleEmojiUsageChrome(
        'test-emoji-uuid',
        mockResponse,
        mockEmojiGroupsStore,
        mockCommService,
        null
      )

      // Wait for Chrome storage callback
      await new Promise(resolve => setTimeout(resolve, 50))

      // Verify Chrome storage was called
      expect(mockChrome.storage.local.set).toHaveBeenCalled()
      
      // The DataSyncManager calls should happen in the Chrome storage callback
      // Since we're mocking the Chrome API, we need to manually trigger the callback
      const setCall = mockChrome.storage.local.set.mock.calls[0]
      if (setCall && setCall[1]) {
        setCall[1]() // Trigger the callback
      }
      
      // Wait a bit more for async operations
      await new Promise(resolve => setTimeout(resolve, 10))
    })

    it('should handle non-common emoji group updates', async () => {
      const mockResponse = vi.fn()
      
      // Mock finding emoji in different group
      mockEmojiGroupsStore.findEmojiByUUID.mockReturnValue({
        emoji: { 
          UUID: 'test-emoji-uuid',
          displayName: 'Test Emoji',
          usageCount: 3
        },
        group: { 
          UUID: 'custom-group-uuid',
          displayName: 'Custom Group'
        }
      })
      
      // Mock findGroupByUUID to return the custom group
      mockEmojiGroupsStore.findGroupByUUID.mockReturnValue({
        UUID: 'custom-group-uuid',
        displayName: 'Custom Group'
      })
      
      await handleEmojiUsageChrome(
        'test-emoji-uuid',
        mockResponse,
        mockEmojiGroupsStore,
        mockCommService,
        null
      )

      // Should send specific group update for the custom group
      expect(mockCommService.sendSpecificGroupChanged).toHaveBeenCalledWith(
        'custom-group-uuid',
        expect.objectContaining({
          UUID: 'custom-group-uuid'
        })
      )
      
      // Should also send common group update since shouldNotifyCommonGroup is true
      expect(mockCommService.sendCommonEmojiGroupChanged).toHaveBeenCalled()
    })
  })

  describe('handleEmojiUsageFirefox', () => {
    it('should integrate DataSyncManager for real-time sync', async () => {
      const result = await handleEmojiUsageFirefox(
        'test-emoji-uuid',
        mockEmojiGroupsStore,
        mockCommService,
        null
      )

      expect(result.success).toBe(true)

      // Verify DataSyncManager integration
      expect(mockDataSyncManager.processImmediateUpdate).toHaveBeenCalledWith(
        'common-emoji',
        expect.objectContaining({
          group: expect.objectContaining({
            UUID: 'common-emoji-group'
          }),
          updatedEmoji: expect.objectContaining({
            uuid: 'test-emoji-uuid'
          }),
          timestamp: expect.any(Number)
        })
      )
      
      // Verify traditional notification messages
      expect(mockCommService.sendCommonEmojiGroupChanged).toHaveBeenCalled()
    })

    it('should handle DataSyncManager errors gracefully in Firefox', async () => {
      // Make DataSyncManager throw error
      mockDataSyncManager.processImmediateUpdate.mockRejectedValue(new Error('Firefox sync failed'))
      
      const result = await handleEmojiUsageFirefox(
        'test-emoji-uuid',
        mockEmojiGroupsStore,
        mockCommService,
        null
      )

      // Should still complete successfully despite sync error
      expect(result.success).toBe(true)
      expect(mockEmojiGroupsStore.recordUsageByUUID).toHaveBeenCalledWith('test-emoji-uuid')
      expect(mockCommService.sendCommonEmojiGroupChanged).toHaveBeenCalled()
      
      // Verify error was logged
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[background:emoji-handlers]'),
        'DataSyncManager update failed (Firefox):',
        expect.any(Error)
      )
    })

    it('should sync storage after successful browser storage save', async () => {
      // Make recordUsageByUUID fail to trigger storage fallback
      mockEmojiGroupsStore.recordUsageByUUID.mockReturnValue(false)

      const result = await handleEmojiUsageFirefox(
        'test-emoji-uuid',
        mockEmojiGroupsStore,
        mockCommService,
        null
      )

      expect(result.success).toBe(true)
      
      // Verify browser storage was called
      expect(mockBrowser.storage.local.set).toHaveBeenCalled()
    })
  })

  describe('updateEmojiUsageInData', () => {
    it('should update emoji usage count and timestamp', () => {
      const testData = {
        emojiGroups: [
          {
            UUID: 'test-group',
            emojis: [
              {
                UUID: 'test-emoji-uuid',
                usageCount: 5,
                lastUsed: Date.now() - (12 * 60 * 60 * 1000) // 12 hours ago (less than 1 day)
              }
            ]
          }
        ]
      }

      const result = updateEmojiUsageInData('test-emoji-uuid', testData)
      
      expect(result).toBe(true)
      
      const updatedEmoji = testData.emojiGroups[0].emojis[0]
      expect(updatedEmoji.usageCount).toBe(6) // Should be increased by 1 (no decay for < 1 day)
      expect(updatedEmoji.lastUsed).toBeGreaterThan(Date.now() - 1000) // Should be recent
    })

    it('should handle first-time emoji usage', () => {
      const testData = {
        emojiGroups: [
          {
            UUID: 'test-group',
            emojis: [
              {
                UUID: 'new-emoji-uuid'
                // No usageCount or lastUsed
              }
            ]
          }
        ]
      }

      const result = updateEmojiUsageInData('new-emoji-uuid', testData)
      
      expect(result).toBe(true)
      
      const updatedEmoji = testData.emojiGroups[0].emojis[0]
      expect(updatedEmoji.usageCount).toBe(1)
      expect(updatedEmoji.lastUsed).toBeGreaterThan(Date.now() - 1000)
    })

    it('should apply decay factor for old usage', () => {
      const oldTimestamp = Date.now() - (7 * 24 * 60 * 60 * 1000) // 7 days ago
      const testData = {
        emojiGroups: [
          {
            UUID: 'test-group',
            emojis: [
              {
                UUID: 'old-emoji-uuid',
                usageCount: 100,
                lastUsed: oldTimestamp
              }
            ]
          }
        ]
      }

      const result = updateEmojiUsageInData('old-emoji-uuid', testData)
      
      expect(result).toBe(true)
      
      const updatedEmoji = testData.emojiGroups[0].emojis[0]
      expect(updatedEmoji.usageCount).toBeLessThan(100) // Should be decayed
      expect(updatedEmoji.usageCount).toBeGreaterThan(1) // But still increased by 1
    })

    it('should return false for non-existent emoji', () => {
      const testData = {
        emojiGroups: [
          {
            UUID: 'test-group',
            emojis: [
              { UUID: 'different-emoji-uuid' }
            ]
          }
        ]
      }

      const result = updateEmojiUsageInData('non-existent-uuid', testData)
      
      expect(result).toBe(false)
    })

    it('should handle invalid data gracefully', () => {
      expect(updateEmojiUsageInData('test-uuid', null)).toBe(false)
      expect(updateEmojiUsageInData('test-uuid', {})).toBe(false)
      expect(updateEmojiUsageInData('test-uuid', { emojiGroups: null })).toBe(false)
    })
  })

  describe('Integration with DataSyncManager', () => {
    it('should handle immediate updates for common emoji group', async () => {
      const mockResponse = vi.fn()
      
      await handleEmojiUsageChrome(
        'test-emoji-uuid',
        mockResponse,
        mockEmojiGroupsStore,
        mockCommService,
        null
      )

      expect(mockDataSyncManager.processImmediateUpdate).toHaveBeenCalledWith(
        'common-emoji',
        expect.objectContaining({
          group: expect.any(Object),
          updatedEmoji: expect.objectContaining({
            uuid: 'test-emoji-uuid',
            name: 'Test Emoji'
          }),
          timestamp: expect.any(Number)
        })
      )
    })

    it('should send real-time sync messages', async () => {
      const mockResponse = vi.fn()
      
      await handleEmojiUsageChrome(
        'test-emoji-uuid',
        mockResponse,
        mockEmojiGroupsStore,
        mockCommService,
        null
      )

      // Verify traditional notification messages were sent
      expect(mockCommService.sendCommonEmojiGroupChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          UUID: 'common-emoji-group'
        })
      )
    })
  })
})