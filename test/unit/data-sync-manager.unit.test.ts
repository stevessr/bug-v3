import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DataSyncManager, type StorageChange, type NotificationItem } from '../../src/services/DataSyncManager'

describe('DataSyncManager', () => {
  let dataSyncManager: DataSyncManager
  let mockChrome: any
  let mockLocalStorage: any

  beforeEach(() => {
    // Mock Chrome API
    mockChrome = {
      storage: {
        local: {
          get: vi.fn(),
          set: vi.fn(),
          onChanged: {
            addListener: vi.fn()
          }
        }
      },
      runtime: {
        lastError: null
      }
    }
    global.chrome = mockChrome

    // Mock localStorage
    mockLocalStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    }
    global.localStorage = mockLocalStorage

    // Mock window
    global.window = {
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    } as any

    // Mock setTimeout and clearTimeout
    vi.useFakeTimers()
  })

  afterEach(() => {
    if (dataSyncManager) {
      dataSyncManager.destroy()
    }
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      dataSyncManager = new DataSyncManager()
      
      expect(dataSyncManager).toBeInstanceOf(DataSyncManager)
      expect(mockChrome.storage.local.onChanged.addListener).toHaveBeenCalled()
    })

    it('should handle missing Chrome API gracefully', () => {
      global.chrome = undefined
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      dataSyncManager = new DataSyncManager()
      
      expect(dataSyncManager).toBeInstanceOf(DataSyncManager)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Chrome storage API not available')
      )
      
      consoleSpy.mockRestore()
    })
  })

  describe('Storage Watching', () => {
    beforeEach(() => {
      dataSyncManager = new DataSyncManager()
    })

    it('should start watching storage changes', () => {
      dataSyncManager.watchStorageChanges()
      
      const status = dataSyncManager.getQueueStatus()
      expect(status.watching).toBe(true)
    })

    it('should stop watching storage changes', () => {
      dataSyncManager.watchStorageChanges()
      dataSyncManager.stopWatchingStorageChanges()
      
      const status = dataSyncManager.getQueueStatus()
      expect(status.watching).toBe(false)
    })

    it('should not start watching if already watching', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      dataSyncManager.watchStorageChanges()
      dataSyncManager.watchStorageChanges() // Second call
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Already watching storage changes')
      )
      
      consoleSpy.mockRestore()
    })
  })

  describe('Storage Change Listeners', () => {
    beforeEach(() => {
      dataSyncManager = new DataSyncManager()
    })

    it('should add storage change listener', () => {
      const listener = vi.fn()
      
      dataSyncManager.addStorageChangeListener(listener)
      
      const status = dataSyncManager.getQueueStatus()
      expect(status).toBeDefined()
    })

    it('should remove storage change listener', () => {
      const listener = vi.fn()
      
      dataSyncManager.addStorageChangeListener(listener)
      dataSyncManager.removeStorageChangeListener(listener)
      
      // Should not throw and should log removal
      expect(() => {
        dataSyncManager.removeStorageChangeListener(listener)
      }).not.toThrow()
    })

    it('should call storage change listeners when storage changes', () => {
      const listener = vi.fn()
      dataSyncManager.addStorageChangeListener(listener)
      
      // Simulate storage change by calling the handler directly
      const mockChanges = {
        'emojiGroups-common': {
          oldValue: { emojis: [] },
          newValue: { emojis: [{ UUID: 'test', displayName: 'Test' }] }
        }
      }
      
      // Get the listener that was added to chrome.storage.local.onChanged
      const chromeListener = mockChrome.storage.local.onChanged.addListener.mock.calls[0][0]
      chromeListener(mockChanges, 'local')
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'emojiGroups-common',
          oldValue: mockChanges['emojiGroups-common'].oldValue,
          newValue: mockChanges['emojiGroups-common'].newValue,
          timestamp: expect.any(Number)
        })
      )
    })
  })

  describe('Storage Synchronization', () => {
    beforeEach(() => {
      dataSyncManager = new DataSyncManager()
    })

    it('should sync storages successfully', async () => {
      // Mock Chrome storage data
      const chromeData = {
        'emojiGroups-common': {
          emojis: [{ UUID: 'chrome-emoji', displayName: 'Chrome Emoji' }],
          lastUpdated: Date.now()
        }
      }
      
      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback(chromeData)
      })

      // Mock localStorage data
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'emojiGroups-common') {
          return JSON.stringify({
            emojis: [{ UUID: 'local-emoji', displayName: 'Local Emoji' }],
            lastUpdated: Date.now() - 1000 // Older timestamp
          })
        }
        return null
      })

      await dataSyncManager.syncStorages()
      
      expect(mockChrome.storage.local.get).toHaveBeenCalled()
      expect(mockLocalStorage.getItem).toHaveBeenCalled()
    })

    it('should handle sync errors gracefully', async () => {
      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        mockChrome.runtime.lastError = new Error('Storage error')
        callback(null)
      })

      await expect(dataSyncManager.syncStorages()).rejects.toThrow('Storage error')
    })
  })

  describe('Notification Queue', () => {
    beforeEach(() => {
      dataSyncManager = new DataSyncManager()
    })

    it('should process notifications with correct priority', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      // Simulate storage changes that trigger notifications
      const mockChanges = {
        'emojiGroups-common': {
          oldValue: null,
          newValue: { emojis: [] }
        },
        'ungrouped-emojis': {
          oldValue: [],
          newValue: [{ UUID: 'test', displayName: 'Test' }]
        }
      }
      
      // Get the chrome listener and trigger it
      const chromeListener = mockChrome.storage.local.onChanged.addListener.mock.calls[0][0]
      chromeListener(mockChanges, 'local')
      
      // Fast-forward timers to trigger debounced processing
      vi.runAllTimers()
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Processing')
      )
      
      consoleSpy.mockRestore()
    })

    it('should clear notification queue', () => {
      dataSyncManager.clearQueue()
      
      const status = dataSyncManager.getQueueStatus()
      expect(status.length).toBe(0)
    })

    it('should get queue status', () => {
      const status = dataSyncManager.getQueueStatus()
      
      expect(status).toHaveProperty('length')
      expect(status).toHaveProperty('processing')
      expect(status).toHaveProperty('watching')
      expect(typeof status.length).toBe('number')
      expect(typeof status.processing).toBe('boolean')
      expect(typeof status.watching).toBe('boolean')
    })
  })

  describe('Custom Events', () => {
    beforeEach(() => {
      dataSyncManager = new DataSyncManager()
    })

    it('should dispatch custom events for notifications', () => {
      const mockChanges = {
        'emojiGroups-common': {
          oldValue: null,
          newValue: { emojis: [] }
        }
      }
      
      // Get the chrome listener and trigger it
      const chromeListener = mockChrome.storage.local.onChanged.addListener.mock.calls[0][0]
      chromeListener(mockChanges, 'local')
      
      // Fast-forward timers to trigger processing
      vi.runAllTimers()
      
      expect(global.window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'data-sync-notification',
          detail: expect.objectContaining({
            type: 'common-emoji',
            data: mockChanges['emojiGroups-common'].newValue,
            timestamp: expect.any(Number),
            priority: 'high'
          })
        })
      )
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      dataSyncManager = new DataSyncManager()
    })

    it('should handle localStorage errors gracefully', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage error')
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      // This should not throw
      expect(() => {
        dataSyncManager.syncStorages()
      }).not.toThrow()
      
      consoleSpy.mockRestore()
    })

    it('should handle JSON parse errors in localStorage', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json')
      
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      // This should not throw
      expect(() => {
        dataSyncManager.syncStorages()
      }).not.toThrow()
      
      consoleSpy.mockRestore()
    })
  })

  describe('Cleanup', () => {
    beforeEach(() => {
      dataSyncManager = new DataSyncManager()
    })

    it('should destroy manager properly', () => {
      dataSyncManager.watchStorageChanges()
      dataSyncManager.destroy()
      
      const status = dataSyncManager.getQueueStatus()
      expect(status.watching).toBe(false)
      expect(status.length).toBe(0)
    })
  })
})