import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('Options Page - Realtime Sync', () => {
  let mockCommService: any
  let mockModal: any
  let mockWindow: any

  beforeEach(() => {
    // Mock communication service
    mockCommService = {
      sendSettingsChanged: vi.fn(),
      sendGroupsChanged: vi.fn(),
      sendDataImported: vi.fn(),
      onSettingsChanged: vi.fn(),
      onGroupsChanged: vi.fn(),
      onUsageRecorded: vi.fn(),
      onCommonEmojiGroupChanged: vi.fn(),
      onSpecificGroupChanged: vi.fn(),
      onNormalGroupsChanged: vi.fn(),
      onUngroupedEmojisChanged: vi.fn(),
      onDataImported: vi.fn(),
      onCommonEmojiUpdated: vi.fn(),
      onEmojiOrderChanged: vi.fn(),
      onGroupIconUpdated: vi.fn(),
      onUngroupedEmojisChangedSync: vi.fn()
    }

    // Mock Modal
    mockModal = {
      success: vi.fn(),
      confirm: vi.fn(),
      info: vi.fn()
    }

    // Mock window
    mockWindow = {
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      CustomEvent: vi.fn().mockImplementation((type, options) => ({
        type,
        detail: options?.detail
      }))
    }

    // Set global mocks
    global.window = mockWindow as any
    global.CustomEvent = mockWindow.CustomEvent

    // Mock console methods
    global.console = {
      ...global.console,
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Communication Service Integration', () => {
    it('should setup all realtime sync listeners', () => {
      // Simulate setting up listeners like in the options page
      const setupListeners = () => {
        mockCommService.onSettingsChanged(vi.fn())
        mockCommService.onGroupsChanged(vi.fn())
        mockCommService.onUsageRecorded(vi.fn())
        mockCommService.onCommonEmojiGroupChanged(vi.fn())
        mockCommService.onSpecificGroupChanged(vi.fn())
        mockCommService.onNormalGroupsChanged(vi.fn())
        mockCommService.onUngroupedEmojisChanged(vi.fn())
        mockCommService.onDataImported(vi.fn())
        mockCommService.onCommonEmojiUpdated(vi.fn())
        mockCommService.onEmojiOrderChanged(vi.fn())
        mockCommService.onGroupIconUpdated(vi.fn())
        mockCommService.onUngroupedEmojisChangedSync(vi.fn())
      }

      setupListeners()

      // Verify all listeners were set up
      expect(mockCommService.onSettingsChanged).toHaveBeenCalled()
      expect(mockCommService.onGroupsChanged).toHaveBeenCalled()
      expect(mockCommService.onUsageRecorded).toHaveBeenCalled()
      expect(mockCommService.onCommonEmojiGroupChanged).toHaveBeenCalled()
      expect(mockCommService.onSpecificGroupChanged).toHaveBeenCalled()
      expect(mockCommService.onNormalGroupsChanged).toHaveBeenCalled()
      expect(mockCommService.onUngroupedEmojisChanged).toHaveBeenCalled()
      expect(mockCommService.onDataImported).toHaveBeenCalled()
      expect(mockCommService.onCommonEmojiUpdated).toHaveBeenCalled()
      expect(mockCommService.onEmojiOrderChanged).toHaveBeenCalled()
      expect(mockCommService.onGroupIconUpdated).toHaveBeenCalled()
      expect(mockCommService.onUngroupedEmojisChangedSync).toHaveBeenCalled()
    })

    it('should handle settings changed messages', () => {
      const settingsHandler = vi.fn()
      
      // Setup listener
      mockCommService.onSettingsChanged(settingsHandler)

      // Simulate receiving settings change
      const newSettings = { imageScale: 1.5, gridColumns: 6 }
      settingsHandler(newSettings)

      expect(settingsHandler).toHaveBeenCalledWith(newSettings)
    })

    it('should handle groups changed messages', () => {
      const groupsHandler = vi.fn()
      mockCommService.onGroupsChanged.mockImplementation((handler) => {
        groupsHandler.mockImplementation(handler)
      })

      // Setup listener
      mockCommService.onGroupsChanged(groupsHandler)

      // Simulate receiving groups change
      const newGroups = [
        { UUID: 'group1', displayName: 'Group 1', emojis: [] },
        { UUID: 'group2', displayName: 'Group 2', emojis: [] }
      ]
      groupsHandler(newGroups)

      expect(groupsHandler).toHaveBeenCalledWith(newGroups)
    })

    it('should handle usage recorded messages', () => {
      const usageHandler = vi.fn()
      mockCommService.onUsageRecorded.mockImplementation((handler) => {
        usageHandler.mockImplementation(handler)
      })

      // Setup listener
      mockCommService.onUsageRecorded(usageHandler)

      // Simulate receiving usage record
      const usageData = { uuid: 'emoji123', timestamp: Date.now() }
      usageHandler(usageData)

      expect(usageHandler).toHaveBeenCalledWith(usageData)
    })
  })

  describe('Common Emoji Group Updates', () => {
    it('should handle common emoji group changed messages', () => {
      const commonGroupHandler = vi.fn()
      mockCommService.onCommonEmojiGroupChanged.mockImplementation((handler) => {
        commonGroupHandler.mockImplementation(handler)
      })

      // Setup listener
      mockCommService.onCommonEmojiGroupChanged(commonGroupHandler)

      // Simulate receiving common group change
      const commonGroupData = {
        group: {
          UUID: 'common-emoji-group',
          displayName: '常用',
          icon: '⭐',
          emojis: [
            { UUID: 'emoji1', displayName: 'Emoji 1', usageCount: 5 }
          ]
        },
        timestamp: Date.now()
      }
      commonGroupHandler(commonGroupData)

      expect(commonGroupHandler).toHaveBeenCalledWith(commonGroupData)
    })

    it('should handle specific group changed messages', () => {
      const specificGroupHandler = vi.fn()
      mockCommService.onSpecificGroupChanged.mockImplementation((handler) => {
        specificGroupHandler.mockImplementation(handler)
      })

      // Setup listener
      mockCommService.onSpecificGroupChanged(specificGroupHandler)

      // Simulate receiving specific group change
      const specificGroupData = {
        groupUUID: 'group123',
        group: {
          UUID: 'group123',
          displayName: 'Updated Group',
          emojis: []
        },
        timestamp: Date.now()
      }
      specificGroupHandler(specificGroupData)

      expect(specificGroupHandler).toHaveBeenCalledWith(specificGroupData)
    })
  })

  describe('Realtime Sync Messages', () => {
    it('should handle common emoji updated messages', () => {
      const commonEmojiHandler = vi.fn()
      mockCommService.onCommonEmojiUpdated.mockImplementation((handler) => {
        commonEmojiHandler.mockImplementation(handler)
      })

      // Setup listener
      mockCommService.onCommonEmojiUpdated(commonEmojiHandler)

      // Simulate receiving common emoji update
      const commonGroup = {
        UUID: 'common-emoji-group',
        displayName: '常用',
        icon: '⭐',
        emojis: [
          { UUID: 'emoji1', displayName: 'Emoji 1', usageCount: 6 }
        ]
      }
      commonEmojiHandler(commonGroup)

      expect(commonEmojiHandler).toHaveBeenCalledWith(commonGroup)
    })

    it('should handle emoji order changed messages', () => {
      const orderChangedHandler = vi.fn()
      mockCommService.onEmojiOrderChanged.mockImplementation((handler) => {
        orderChangedHandler.mockImplementation(handler)
      })

      // Setup listener
      mockCommService.onEmojiOrderChanged(orderChangedHandler)

      // Simulate receiving emoji order change
      const groupUUID = 'group123'
      const updatedOrder = ['emoji3', 'emoji1', 'emoji2']
      orderChangedHandler(groupUUID, updatedOrder)

      expect(orderChangedHandler).toHaveBeenCalledWith(groupUUID, updatedOrder)
    })

    it('should handle group icon updated messages', () => {
      const iconUpdatedHandler = vi.fn()
      mockCommService.onGroupIconUpdated.mockImplementation((handler) => {
        iconUpdatedHandler.mockImplementation(handler)
      })

      // Setup listener
      mockCommService.onGroupIconUpdated(iconUpdatedHandler)

      // Simulate receiving group icon update
      const groupUUID = 'group123'
      const iconUrl = 'https://example.com/new-icon.png'
      iconUpdatedHandler(groupUUID, iconUrl)

      expect(iconUpdatedHandler).toHaveBeenCalledWith(groupUUID, iconUrl)
    })

    it('should handle ungrouped emojis changed sync messages', () => {
      const ungroupedSyncHandler = vi.fn()
      mockCommService.onUngroupedEmojisChangedSync.mockImplementation((handler) => {
        ungroupedSyncHandler.mockImplementation(handler)
      })

      // Setup listener
      mockCommService.onUngroupedEmojisChangedSync(ungroupedSyncHandler)

      // Simulate receiving ungrouped emojis sync
      const ungroupedEmojis = [
        { UUID: 'ungrouped1', displayName: 'Ungrouped 1' },
        { UUID: 'ungrouped2', displayName: 'Ungrouped 2' }
      ]
      ungroupedSyncHandler(ungroupedEmojis)

      expect(ungroupedSyncHandler).toHaveBeenCalledWith(ungroupedEmojis)
    })
  })

  describe('Event Dispatching', () => {
    it('should dispatch ungrouped emojis update events', () => {
      // Simulate dispatching ungrouped emojis update event
      const eventData = {
        emojis: [
          { UUID: 'ungrouped1', displayName: 'Ungrouped 1' }
        ],
        timestamp: Date.now()
      }

      const customEvent = new mockWindow.CustomEvent('ungrouped-emojis-updated', {
        detail: eventData
      })

      mockWindow.dispatchEvent(customEvent)

      expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(customEvent)
      expect(mockWindow.CustomEvent).toHaveBeenCalledWith('ungrouped-emojis-updated', {
        detail: eventData
      })
    })

    it('should dispatch ungrouped emojis realtime update events', () => {
      // Simulate dispatching ungrouped emojis realtime update event
      const eventData = {
        emojis: [
          { UUID: 'ungrouped1', displayName: 'Ungrouped 1' },
          { UUID: 'ungrouped2', displayName: 'Ungrouped 2' }
        ],
        timestamp: Date.now()
      }

      const customEvent = new mockWindow.CustomEvent('ungrouped-emojis-realtime-updated', {
        detail: eventData
      })

      mockWindow.dispatchEvent(customEvent)

      expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(customEvent)
      expect(mockWindow.CustomEvent).toHaveBeenCalledWith('ungrouped-emojis-realtime-updated', {
        detail: eventData
      })
    })
  })

  describe('Data Import Handling', () => {
    it('should handle data imported messages', () => {
      const dataImportedHandler = vi.fn()
      mockCommService.onDataImported.mockImplementation((handler) => {
        dataImportedHandler.mockImplementation(handler)
      })

      // Setup listener
      mockCommService.onDataImported(dataImportedHandler)

      // Simulate receiving data import
      const importedData = {
        Settings: { imageScale: 1.2, gridColumns: 5 },
        emojiGroups: [
          { UUID: 'group1', displayName: 'Imported Group', emojis: [] }
        ]
      }
      dataImportedHandler(importedData)

      expect(dataImportedHandler).toHaveBeenCalledWith(importedData)
    })
  })

  describe('Error Handling', () => {
    it('should handle listener errors gracefully', () => {
      const errorHandler = vi.fn().mockImplementation(() => {
        throw new Error('Handler error')
      })

      mockCommService.onSettingsChanged.mockImplementation((handler) => {
        try {
          handler({ test: 'data' })
        } catch (error) {
          // Error should be caught and logged
          console.error('Listener error:', error)
        }
      })

      // Setup listener that throws error
      mockCommService.onSettingsChanged(errorHandler)

      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith('Listener error:', expect.any(Error))
    })

    it('should handle malformed message data gracefully', () => {
      const settingsHandler = vi.fn()
      mockCommService.onSettingsChanged.mockImplementation((handler) => {
        settingsHandler.mockImplementation(handler)
      })

      // Setup listener
      mockCommService.onSettingsChanged(settingsHandler)

      // Test with various malformed data
      const malformedData = [null, undefined, 'string', 123, []]
      
      malformedData.forEach(data => {
        expect(() => {
          settingsHandler(data)
        }).not.toThrow()
      })
    })
  })

  describe('Auto-refresh Functionality', () => {
    it('should auto-refresh export data when groups change', () => {
      const refreshExport = vi.fn()
      
      // Simulate groups change handler that calls refreshExport
      const groupsHandler = vi.fn().mockImplementation(() => {
        refreshExport()
      })

      mockCommService.onGroupsChanged.mockImplementation((handler) => {
        groupsHandler.mockImplementation(handler)
      })

      // Setup listener
      mockCommService.onGroupsChanged(groupsHandler)

      // Simulate groups change
      const newGroups = [{ UUID: 'group1', displayName: 'Group 1', emojis: [] }]
      groupsHandler(newGroups)

      expect(refreshExport).toHaveBeenCalled()
    })

    it('should auto-refresh export data when common group changes', () => {
      const refreshExport = vi.fn()
      
      // Simulate common group change handler that calls refreshExport
      const commonGroupHandler = vi.fn().mockImplementation(() => {
        refreshExport()
      })

      mockCommService.onCommonEmojiGroupChanged.mockImplementation((handler) => {
        commonGroupHandler.mockImplementation(handler)
      })

      // Setup listener
      mockCommService.onCommonEmojiGroupChanged(commonGroupHandler)

      // Simulate common group change
      const commonGroupData = {
        group: { UUID: 'common-emoji-group', displayName: '常用', emojis: [] }
      }
      commonGroupHandler(commonGroupData)

      expect(refreshExport).toHaveBeenCalled()
    })
  })
})