import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock communication service
const mockCommService = {
  sendUngroupedEmojisChangedSync: vi.fn()
}

// Mock storage
const mockStorage = {
  saveUngroupedEmojis: vi.fn(),
  getUngroupedEmojis: vi.fn().mockReturnValue([])
}

// Mock settings store
const mockSettingsStore = {
  save: vi.fn()
}

// Mock the modules
vi.mock('../../src/services/communication', () => ({
  createBackgroundCommService: vi.fn(() => mockCommService)
}))

vi.mock('../../src/data/update/storage', () => ({
  default: mockStorage
}))

vi.mock('../../src/data/update/settingsStore', () => ({
  default: mockSettingsStore
}))

// Mock the emoji type
vi.mock('../../src/data/type/emoji/emoji', () => ({}))

describe('Ungrouped Emoji Sync', () => {
  let emojiGroupsStore: any

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks()

    // Mock console methods
    global.console = {
      ...global.console,
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }

    // Dynamically import the module after mocks are set up
    const module = await import('../../src/data/update/emojiGroupsStore')
    emojiGroupsStore = module.default
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('addUngrouped', () => {
    it('should add emoji to ungrouped and send sync message', () => {
      const testEmoji = {
        UUID: 'test-emoji-uuid',
        displayName: 'Test Emoji',
        url: 'test-url'
      }

      emojiGroupsStore.addUngrouped(testEmoji)

      // Verify storage save was called
      expect(mockSettingsStore.save).toHaveBeenCalled()

      // Verify sync message was sent
      expect(mockCommService.sendUngroupedEmojisChangedSync).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            UUID: 'test-emoji-uuid',
            displayName: 'Test Emoji'
          })
        ])
      )

      // Verify dedicated storage save was called
      expect(mockStorage.saveUngroupedEmojis).toHaveBeenCalled()

      // Verify logging
      expect(console.log).toHaveBeenCalledWith(
        '[EmojiGroupsStore] Adding ungrouped emoji:',
        'Test Emoji'
      )
    })

    it('should handle storage save errors gracefully', () => {
      const testEmoji = {
        UUID: 'test-emoji-uuid',
        displayName: 'Test Emoji'
      }

      // Make storage save fail
      mockSettingsStore.save.mockImplementation(() => {
        throw new Error('Storage save failed')
      })

      // Should not throw
      expect(() => {
        emojiGroupsStore.addUngrouped(testEmoji)
      }).not.toThrow()

      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith(
        '[EmojiGroupsStore] Failed to save ungrouped emojis:',
        expect.any(Error)
      )
    })

    it('should handle sync message errors gracefully', () => {
      const testEmoji = {
        UUID: 'test-emoji-uuid',
        displayName: 'Test Emoji'
      }

      // Make sync message fail
      mockCommService.sendUngroupedEmojisChangedSync.mockImplementation(() => {
        throw new Error('Sync message failed')
      })

      // Should not throw
      expect(() => {
        emojiGroupsStore.addUngrouped(testEmoji)
      }).not.toThrow()

      // Verify warning was logged
      expect(console.warn).toHaveBeenCalledWith(
        '[EmojiGroupsStore] Failed to send ungrouped sync message:',
        expect.any(Error)
      )
    })
  })

  describe('removeUngroupedByUUID', () => {
    beforeEach(() => {
      // Add some test emojis first
      const testEmojis = [
        { UUID: 'emoji1', displayName: 'Emoji 1' },
        { UUID: 'emoji2', displayName: 'Emoji 2' },
        { UUID: 'emoji3', displayName: 'Emoji 3' }
      ]
      
      testEmojis.forEach(emoji => {
        emojiGroupsStore.addUngrouped(emoji)
      })
      
      // Clear mocks after setup
      vi.clearAllMocks()
    })

    it('should remove emoji from ungrouped and send sync message', () => {
      const result = emojiGroupsStore.removeUngroupedByUUID('emoji2')

      expect(result).toBe(true)

      // Verify storage save was called
      expect(mockSettingsStore.save).toHaveBeenCalled()

      // Verify sync message was sent
      expect(mockCommService.sendUngroupedEmojisChangedSync).toHaveBeenCalled()

      // Verify dedicated storage save was called
      expect(mockStorage.saveUngroupedEmojis).toHaveBeenCalled()

      // Verify logging
      expect(console.log).toHaveBeenCalledWith(
        '[EmojiGroupsStore] Removing ungrouped emoji by UUID:',
        'emoji2'
      )
    })

    it('should return false for non-existent emoji', () => {
      const result = emojiGroupsStore.removeUngroupedByUUID('non-existent')

      expect(result).toBe(false)

      // Verify warning was logged
      expect(console.warn).toHaveBeenCalledWith(
        '[EmojiGroupsStore] Ungrouped emoji not found with UUID:',
        'non-existent'
      )

      // Verify no storage operations were called
      expect(mockSettingsStore.save).not.toHaveBeenCalled()
      expect(mockCommService.sendUngroupedEmojisChangedSync).not.toHaveBeenCalled()
    })

    it('should handle storage save errors gracefully', () => {
      // Make storage save fail
      mockSettingsStore.save.mockImplementation(() => {
        throw new Error('Storage save failed')
      })

      const result = emojiGroupsStore.removeUngroupedByUUID('emoji1')

      expect(result).toBe(false)

      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith(
        '[EmojiGroupsStore] Failed to save after removing ungrouped emoji:',
        expect.any(Error)
      )
    })
  })

  describe('setUngroupedEmojis', () => {
    it('should set ungrouped emojis and send sync message', () => {
      const newUngrouped = [
        { UUID: 'new1', displayName: 'New Emoji 1' },
        { UUID: 'new2', displayName: 'New Emoji 2' }
      ]

      const result = emojiGroupsStore.setUngroupedEmojis(newUngrouped)

      expect(result).toBe(true)

      // Verify storage save was called
      expect(mockSettingsStore.save).toHaveBeenCalled()

      // Verify sync message was sent with correct data
      expect(mockCommService.sendUngroupedEmojisChangedSync).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ UUID: 'new1' }),
          expect.objectContaining({ UUID: 'new2' })
        ])
      )

      // Verify dedicated storage save was called
      expect(mockStorage.saveUngroupedEmojis).toHaveBeenCalled()

      // Verify logging
      expect(console.log).toHaveBeenCalledWith(
        '[EmojiGroupsStore] Setting ungrouped emojis, count:',
        2
      )
    })

    it('should handle empty array', () => {
      const result = emojiGroupsStore.setUngroupedEmojis([])

      expect(result).toBe(true)

      // Verify sync message was sent with empty array
      expect(mockCommService.sendUngroupedEmojisChangedSync).toHaveBeenCalledWith([])
    })

    it('should handle storage save errors gracefully', () => {
      const newUngrouped = [{ UUID: 'test', displayName: 'Test' }]

      // Make storage save fail
      mockSettingsStore.save.mockImplementation(() => {
        throw new Error('Storage save failed')
      })

      const result = emojiGroupsStore.setUngroupedEmojis(newUngrouped)

      expect(result).toBe(false)

      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith(
        '[EmojiGroupsStore] Failed to save batch updated ungrouped emojis:',
        expect.any(Error)
      )
    })
  })

  describe('moveEmojiToUngrouped', () => {
    beforeEach(() => {
      // Reset mocks first
      vi.clearAllMocks()
      
      // Ensure storage save works for setup
      mockSettingsStore.save.mockImplementation(() => {})
      
      // Set up test groups with emojis
      const testGroups = [
        {
          UUID: 'group1',
          displayName: 'Group 1',
          emojis: [
            { UUID: 'emoji1', displayName: 'Emoji 1' },
            { UUID: 'emoji2', displayName: 'Emoji 2' }
          ]
        }
      ]
      
      emojiGroupsStore.setEmojiGroups(testGroups)
      vi.clearAllMocks()
    })

    it('should move emoji from group to ungrouped', () => {
      const result = emojiGroupsStore.moveEmojiToUngrouped('group1', 'emoji1')

      expect(result).toBe(true)

      // Verify storage save was called
      expect(mockSettingsStore.save).toHaveBeenCalled()

      // Verify sync message was sent
      expect(mockCommService.sendUngroupedEmojisChangedSync).toHaveBeenCalled()

      // Verify dedicated storage save was called
      expect(mockStorage.saveUngroupedEmojis).toHaveBeenCalled()

      // Verify logging
      expect(console.log).toHaveBeenCalledWith(
        '[EmojiGroupsStore] Moving emoji from group to ungrouped:',
        'group1',
        'emoji1'
      )
    })

    it('should return false for non-existent group', () => {
      const result = emojiGroupsStore.moveEmojiToUngrouped('non-existent', 'emoji1')

      expect(result).toBe(false)

      // Verify warning was logged
      expect(console.warn).toHaveBeenCalledWith(
        '[EmojiGroupsStore] Group not found:',
        'non-existent'
      )
    })

    it('should return false for non-existent emoji', () => {
      const result = emojiGroupsStore.moveEmojiToUngrouped('group1', 'non-existent')

      expect(result).toBe(false)

      // Verify warning was logged
      expect(console.warn).toHaveBeenCalledWith(
        '[EmojiGroupsStore] Emoji not found in group:',
        'non-existent'
      )
    })
  })

  describe('moveEmojiFromUngrouped', () => {
    beforeEach(() => {
      // Reset mocks first
      vi.clearAllMocks()
      
      // Ensure storage save works for setup
      mockSettingsStore.save.mockImplementation(() => {})
      
      // Set up test groups and ungrouped emojis
      const testGroups = [
        {
          UUID: 'group1',
          displayName: 'Group 1',
          emojis: []
        }
      ]
      
      emojiGroupsStore.setEmojiGroups(testGroups)
      emojiGroupsStore.addUngrouped({ UUID: 'emoji1', displayName: 'Emoji 1' })
      vi.clearAllMocks()
    })

    it('should move emoji from ungrouped to group', () => {
      const result = emojiGroupsStore.moveEmojiFromUngrouped('emoji1', 'group1')

      expect(result).toBe(true)

      // Verify storage save was called
      expect(mockSettingsStore.save).toHaveBeenCalled()

      // Verify sync message was sent
      expect(mockCommService.sendUngroupedEmojisChangedSync).toHaveBeenCalled()

      // Verify dedicated storage save was called
      expect(mockStorage.saveUngroupedEmojis).toHaveBeenCalled()

      // Verify logging
      expect(console.log).toHaveBeenCalledWith(
        '[EmojiGroupsStore] Moving emoji from ungrouped to group:',
        'emoji1',
        'group1'
      )
    })

    it('should move emoji to specific position', () => {
      // Add another emoji to the group first
      emojiGroupsStore.addEmojiToGroup('group1', { UUID: 'existing', displayName: 'Existing' })
      vi.clearAllMocks()

      const result = emojiGroupsStore.moveEmojiFromUngrouped('emoji1', 'group1', 0)

      expect(result).toBe(true)

      // Verify storage operations were called
      expect(mockSettingsStore.save).toHaveBeenCalled()
      expect(mockCommService.sendUngroupedEmojisChangedSync).toHaveBeenCalled()
    })

    it('should return false for non-existent emoji in ungrouped', () => {
      const result = emojiGroupsStore.moveEmojiFromUngrouped('non-existent', 'group1')

      expect(result).toBe(false)

      // Verify warning was logged
      expect(console.warn).toHaveBeenCalledWith(
        '[EmojiGroupsStore] Emoji not found in ungrouped:',
        'non-existent'
      )
    })

    it('should return false for non-existent target group', () => {
      const result = emojiGroupsStore.moveEmojiFromUngrouped('emoji1', 'non-existent')

      expect(result).toBe(false)

      // Verify warning was logged
      expect(console.warn).toHaveBeenCalledWith(
        '[EmojiGroupsStore] Target group not found:',
        'non-existent'
      )
    })
  })

  describe('Communication Service Integration', () => {
    it('should handle communication service creation failure', () => {
      // Mock communication service creation to fail
      vi.doMock('../../src/services/communication', () => ({
        createBackgroundCommService: vi.fn(() => {
          throw new Error('Communication service creation failed')
        })
      }))

      const testEmoji = { UUID: 'test', displayName: 'Test' }

      // Should not throw even if communication service fails
      expect(() => {
        emojiGroupsStore.addUngrouped(testEmoji)
      }).not.toThrow()

      // Verify warning was logged
      expect(console.warn).toHaveBeenCalledWith(
        '[EmojiGroupsStore] Failed to create communication service:',
        expect.any(Error)
      )
    })

    it('should handle null communication service gracefully', async () => {
      // Mock communication service to return null
      vi.doMock('../../src/services/communication', () => ({
        createBackgroundCommService: vi.fn(() => null)
      }))

      // Re-import the module with new mock
      const module = await import('../../src/data/update/emojiGroupsStore')
      const store = module.default

      const testEmoji = { UUID: 'test', displayName: 'Test' }

      // Should not throw even if communication service is null
      expect(() => {
        store.addUngrouped(testEmoji)
      }).not.toThrow()

      // Storage operations should still work
      expect(mockSettingsStore.save).toHaveBeenCalled()
    })
  })

  describe('Storage Integration', () => {
    it('should handle dedicated storage save errors gracefully', () => {
      const testEmoji = { UUID: 'test', displayName: 'Test' }

      // Make dedicated storage save fail
      mockStorage.saveUngroupedEmojis.mockImplementation(() => {
        throw new Error('Dedicated storage save failed')
      })

      // Should not throw
      expect(() => {
        emojiGroupsStore.addUngrouped(testEmoji)
      }).not.toThrow()

      // Verify warning was logged
      expect(console.warn).toHaveBeenCalledWith(
        '[EmojiGroupsStore] Failed to save to dedicated ungrouped key:',
        expect.any(Error)
      )

      // Main storage save should still have been called
      expect(mockSettingsStore.save).toHaveBeenCalled()
    })
  })
})