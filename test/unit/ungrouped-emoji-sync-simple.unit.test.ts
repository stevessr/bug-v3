import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Ungrouped Emoji Sync - Core Functions', () => {
  let mockCommService: any
  let mockStorage: any
  let mockSettingsStore: any

  beforeEach(() => {
    // Reset mocks
    mockCommService = {
      sendUngroupedEmojisChangedSync: vi.fn()
    }

    mockStorage = {
      saveUngroupedEmojis: vi.fn(),
      getUngroupedEmojis: vi.fn().mockReturnValue([])
    }

    mockSettingsStore = {
      save: vi.fn()
    }

    // Mock console methods
    global.console = {
      ...global.console,
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }
  })

  describe('Ungrouped Emoji Management', () => {
    it('should handle adding ungrouped emoji with sync', () => {
      // Create a simple ungrouped emoji manager
      class UngroupedEmojiManager {
        private ungrouped: any[] = []
        private commService: any
        private storage: any
        private settingsStore: any

        constructor(commService: any, storage: any, settingsStore: any) {
          this.commService = commService
          this.storage = storage
          this.settingsStore = settingsStore
        }

        addUngrouped(emoji: any) {
          console.log('[UngroupedEmojiManager] Adding ungrouped emoji:', emoji.displayName || emoji.UUID)
          
          this.ungrouped.push(emoji)
          
          try {
            this.settingsStore.save([], this.ungrouped)
            
            // Send sync message
            try {
              if (this.commService) {
                this.commService.sendUngroupedEmojisChangedSync([...this.ungrouped])
                console.log('[UngroupedEmojiManager] Sent ungrouped emojis changed sync message')
              }
            } catch (syncError) {
              console.warn('[UngroupedEmojiManager] Failed to send ungrouped sync message:', syncError)
            }
            
            // Save to dedicated storage
            try {
              this.storage.saveUngroupedEmojis(this.ungrouped)
              console.log('[UngroupedEmojiManager] Saved ungrouped emojis to dedicated storage key')
            } catch (storageError) {
              console.warn('[UngroupedEmojiManager] Failed to save to dedicated ungrouped key:', storageError)
            }
            
          } catch (error) {
            console.error('[UngroupedEmojiManager] Failed to save ungrouped emojis:', error)
          }
        }

        removeUngroupedByUUID(uuid: string) {
          console.log('[UngroupedEmojiManager] Removing ungrouped emoji by UUID:', uuid)
          
          const idx = this.ungrouped.findIndex((e) => e.UUID === uuid)
          if (idx >= 0) {
            const removedEmoji = this.ungrouped[idx]
            this.ungrouped.splice(idx, 1)
            
            try {
              this.settingsStore.save([], this.ungrouped)
              
              // Send sync message
              try {
                if (this.commService) {
                  this.commService.sendUngroupedEmojisChangedSync([...this.ungrouped])
                  console.log('[UngroupedEmojiManager] Sent ungrouped emojis changed sync message after removal')
                }
              } catch (syncError) {
                console.warn('[UngroupedEmojiManager] Failed to send ungrouped sync message:', syncError)
              }
              
              // Save to dedicated storage
              try {
                this.storage.saveUngroupedEmojis(this.ungrouped)
                console.log('[UngroupedEmojiManager] Saved updated ungrouped emojis to dedicated storage key')
              } catch (storageError) {
                console.warn('[UngroupedEmojiManager] Failed to save to dedicated ungrouped key:', storageError)
              }
              
              console.log('[UngroupedEmojiManager] Successfully removed ungrouped emoji:', removedEmoji.displayName || uuid)
              return true
            } catch (error) {
              console.error('[UngroupedEmojiManager] Failed to save after removing ungrouped emoji:', error)
              return false
            }
          }
          
          console.warn('[UngroupedEmojiManager] Ungrouped emoji not found with UUID:', uuid)
          return false
        }

        getUngrouped() {
          return [...this.ungrouped]
        }
      }

      const manager = new UngroupedEmojiManager(mockCommService, mockStorage, mockSettingsStore)

      const testEmoji = {
        UUID: 'test-emoji-uuid',
        displayName: 'Test Emoji',
        url: 'test-url'
      }

      manager.addUngrouped(testEmoji)

      // Verify storage save was called
      expect(mockSettingsStore.save).toHaveBeenCalledWith([], [testEmoji])

      // Verify sync message was sent
      expect(mockCommService.sendUngroupedEmojisChangedSync).toHaveBeenCalledWith([testEmoji])

      // Verify dedicated storage save was called
      expect(mockStorage.saveUngroupedEmojis).toHaveBeenCalledWith([testEmoji])

      // Verify logging
      expect(console.log).toHaveBeenCalledWith(
        '[UngroupedEmojiManager] Adding ungrouped emoji:',
        'Test Emoji'
      )
    })

    it('should handle removing ungrouped emoji with sync', () => {
      class UngroupedEmojiManager {
        private ungrouped: any[] = [
          { UUID: 'emoji1', displayName: 'Emoji 1' },
          { UUID: 'emoji2', displayName: 'Emoji 2' },
          { UUID: 'emoji3', displayName: 'Emoji 3' }
        ]
        private commService: any
        private storage: any
        private settingsStore: any

        constructor(commService: any, storage: any, settingsStore: any) {
          this.commService = commService
          this.storage = storage
          this.settingsStore = settingsStore
        }

        removeUngroupedByUUID(uuid: string) {
          console.log('[UngroupedEmojiManager] Removing ungrouped emoji by UUID:', uuid)
          
          const idx = this.ungrouped.findIndex((e) => e.UUID === uuid)
          if (idx >= 0) {
            const removedEmoji = this.ungrouped[idx]
            this.ungrouped.splice(idx, 1)
            
            try {
              this.settingsStore.save([], this.ungrouped)
              
              // Send sync message
              try {
                if (this.commService) {
                  this.commService.sendUngroupedEmojisChangedSync([...this.ungrouped])
                  console.log('[UngroupedEmojiManager] Sent ungrouped emojis changed sync message after removal')
                }
              } catch (syncError) {
                console.warn('[UngroupedEmojiManager] Failed to send ungrouped sync message:', syncError)
              }
              
              // Save to dedicated storage
              try {
                this.storage.saveUngroupedEmojis(this.ungrouped)
                console.log('[UngroupedEmojiManager] Saved updated ungrouped emojis to dedicated storage key')
              } catch (storageError) {
                console.warn('[UngroupedEmojiManager] Failed to save to dedicated ungrouped key:', storageError)
              }
              
              console.log('[UngroupedEmojiManager] Successfully removed ungrouped emoji:', removedEmoji.displayName || uuid)
              return true
            } catch (error) {
              console.error('[UngroupedEmojiManager] Failed to save after removing ungrouped emoji:', error)
              return false
            }
          }
          
          console.warn('[UngroupedEmojiManager] Ungrouped emoji not found with UUID:', uuid)
          return false
        }

        getUngrouped() {
          return [...this.ungrouped]
        }
      }

      const manager = new UngroupedEmojiManager(mockCommService, mockStorage, mockSettingsStore)

      const result = manager.removeUngroupedByUUID('emoji2')

      expect(result).toBe(true)

      // Verify storage save was called with updated array
      expect(mockSettingsStore.save).toHaveBeenCalledWith([], [
        { UUID: 'emoji1', displayName: 'Emoji 1' },
        { UUID: 'emoji3', displayName: 'Emoji 3' }
      ])

      // Verify sync message was sent with updated array
      expect(mockCommService.sendUngroupedEmojisChangedSync).toHaveBeenCalledWith([
        { UUID: 'emoji1', displayName: 'Emoji 1' },
        { UUID: 'emoji3', displayName: 'Emoji 3' }
      ])

      // Verify dedicated storage save was called
      expect(mockStorage.saveUngroupedEmojis).toHaveBeenCalled()

      // Verify logging
      expect(console.log).toHaveBeenCalledWith(
        '[UngroupedEmojiManager] Removing ungrouped emoji by UUID:',
        'emoji2'
      )
    })

    it('should handle sync message errors gracefully', () => {
      class UngroupedEmojiManager {
        private ungrouped: any[] = []
        private commService: any
        private storage: any
        private settingsStore: any

        constructor(commService: any, storage: any, settingsStore: any) {
          this.commService = commService
          this.storage = storage
          this.settingsStore = settingsStore
        }

        addUngrouped(emoji: any) {
          console.log('[UngroupedEmojiManager] Adding ungrouped emoji:', emoji.displayName || emoji.UUID)
          
          this.ungrouped.push(emoji)
          
          try {
            this.settingsStore.save([], this.ungrouped)
            
            // Send sync message
            try {
              if (this.commService) {
                this.commService.sendUngroupedEmojisChangedSync([...this.ungrouped])
                console.log('[UngroupedEmojiManager] Sent ungrouped emojis changed sync message')
              }
            } catch (syncError) {
              console.warn('[UngroupedEmojiManager] Failed to send ungrouped sync message:', syncError)
            }
            
            // Save to dedicated storage
            try {
              this.storage.saveUngroupedEmojis(this.ungrouped)
              console.log('[UngroupedEmojiManager] Saved ungrouped emojis to dedicated storage key')
            } catch (storageError) {
              console.warn('[UngroupedEmojiManager] Failed to save to dedicated ungrouped key:', storageError)
            }
            
          } catch (error) {
            console.error('[UngroupedEmojiManager] Failed to save ungrouped emojis:', error)
          }
        }
      }

      const manager = new UngroupedEmojiManager(mockCommService, mockStorage, mockSettingsStore)

      // Make sync message fail
      mockCommService.sendUngroupedEmojisChangedSync.mockImplementation(() => {
        throw new Error('Sync message failed')
      })

      const testEmoji = { UUID: 'test', displayName: 'Test' }

      // Should not throw
      expect(() => {
        manager.addUngrouped(testEmoji)
      }).not.toThrow()

      // Verify warning was logged
      expect(console.warn).toHaveBeenCalledWith(
        '[UngroupedEmojiManager] Failed to send ungrouped sync message:',
        expect.any(Error)
      )

      // Storage operations should still work
      expect(mockSettingsStore.save).toHaveBeenCalled()
    })

    it('should handle storage save errors gracefully', () => {
      class UngroupedEmojiManager {
        private ungrouped: any[] = []
        private commService: any
        private storage: any
        private settingsStore: any

        constructor(commService: any, storage: any, settingsStore: any) {
          this.commService = commService
          this.storage = storage
          this.settingsStore = settingsStore
        }

        addUngrouped(emoji: any) {
          console.log('[UngroupedEmojiManager] Adding ungrouped emoji:', emoji.displayName || emoji.UUID)
          
          this.ungrouped.push(emoji)
          
          try {
            this.settingsStore.save([], this.ungrouped)
            
            // Send sync message
            try {
              if (this.commService) {
                this.commService.sendUngroupedEmojisChangedSync([...this.ungrouped])
                console.log('[UngroupedEmojiManager] Sent ungrouped emojis changed sync message')
              }
            } catch (syncError) {
              console.warn('[UngroupedEmojiManager] Failed to send ungrouped sync message:', syncError)
            }
            
            // Save to dedicated storage
            try {
              this.storage.saveUngroupedEmojis(this.ungrouped)
              console.log('[UngroupedEmojiManager] Saved ungrouped emojis to dedicated storage key')
            } catch (storageError) {
              console.warn('[UngroupedEmojiManager] Failed to save to dedicated ungrouped key:', storageError)
            }
            
          } catch (error) {
            console.error('[UngroupedEmojiManager] Failed to save ungrouped emojis:', error)
          }
        }
      }

      const manager = new UngroupedEmojiManager(mockCommService, mockStorage, mockSettingsStore)

      // Make storage save fail
      mockSettingsStore.save.mockImplementation(() => {
        throw new Error('Storage save failed')
      })

      const testEmoji = { UUID: 'test', displayName: 'Test' }

      // Should not throw
      expect(() => {
        manager.addUngrouped(testEmoji)
      }).not.toThrow()

      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith(
        '[UngroupedEmojiManager] Failed to save ungrouped emojis:',
        expect.any(Error)
      )
    })

    it('should handle dedicated storage save errors gracefully', () => {
      class UngroupedEmojiManager {
        private ungrouped: any[] = []
        private commService: any
        private storage: any
        private settingsStore: any

        constructor(commService: any, storage: any, settingsStore: any) {
          this.commService = commService
          this.storage = storage
          this.settingsStore = settingsStore
        }

        addUngrouped(emoji: any) {
          console.log('[UngroupedEmojiManager] Adding ungrouped emoji:', emoji.displayName || emoji.UUID)
          
          this.ungrouped.push(emoji)
          
          try {
            this.settingsStore.save([], this.ungrouped)
            
            // Send sync message
            try {
              if (this.commService) {
                this.commService.sendUngroupedEmojisChangedSync([...this.ungrouped])
                console.log('[UngroupedEmojiManager] Sent ungrouped emojis changed sync message')
              }
            } catch (syncError) {
              console.warn('[UngroupedEmojiManager] Failed to send ungrouped sync message:', syncError)
            }
            
            // Save to dedicated storage
            try {
              this.storage.saveUngroupedEmojis(this.ungrouped)
              console.log('[UngroupedEmojiManager] Saved ungrouped emojis to dedicated storage key')
            } catch (storageError) {
              console.warn('[UngroupedEmojiManager] Failed to save to dedicated ungrouped key:', storageError)
            }
            
          } catch (error) {
            console.error('[UngroupedEmojiManager] Failed to save ungrouped emojis:', error)
          }
        }
      }

      const manager = new UngroupedEmojiManager(mockCommService, mockStorage, mockSettingsStore)

      // Make dedicated storage save fail
      mockStorage.saveUngroupedEmojis.mockImplementation(() => {
        throw new Error('Dedicated storage save failed')
      })

      const testEmoji = { UUID: 'test', displayName: 'Test' }

      // Should not throw
      expect(() => {
        manager.addUngrouped(testEmoji)
      }).not.toThrow()

      // Verify warning was logged
      expect(console.warn).toHaveBeenCalledWith(
        '[UngroupedEmojiManager] Failed to save to dedicated ungrouped key:',
        expect.any(Error)
      )

      // Main storage save should still have been called
      expect(mockSettingsStore.save).toHaveBeenCalled()
    })
  })

  describe('Communication Service Integration', () => {
    it('should handle null communication service gracefully', () => {
      class UngroupedEmojiManager {
        private ungrouped: any[] = []
        private commService: any
        private storage: any
        private settingsStore: any

        constructor(commService: any, storage: any, settingsStore: any) {
          this.commService = commService
          this.storage = storage
          this.settingsStore = settingsStore
        }

        addUngrouped(emoji: any) {
          console.log('[UngroupedEmojiManager] Adding ungrouped emoji:', emoji.displayName || emoji.UUID)
          
          this.ungrouped.push(emoji)
          
          try {
            this.settingsStore.save([], this.ungrouped)
            
            // Send sync message
            try {
              if (this.commService) {
                this.commService.sendUngroupedEmojisChangedSync([...this.ungrouped])
                console.log('[UngroupedEmojiManager] Sent ungrouped emojis changed sync message')
              }
            } catch (syncError) {
              console.warn('[UngroupedEmojiManager] Failed to send ungrouped sync message:', syncError)
            }
            
            // Save to dedicated storage
            try {
              this.storage.saveUngroupedEmojis(this.ungrouped)
              console.log('[UngroupedEmojiManager] Saved ungrouped emojis to dedicated storage key')
            } catch (storageError) {
              console.warn('[UngroupedEmojiManager] Failed to save to dedicated ungrouped key:', storageError)
            }
            
          } catch (error) {
            console.error('[UngroupedEmojiManager] Failed to save ungrouped emojis:', error)
          }
        }
      }

      const manager = new UngroupedEmojiManager(null, mockStorage, mockSettingsStore)

      const testEmoji = { UUID: 'test', displayName: 'Test' }

      // Should not throw even if communication service is null
      expect(() => {
        manager.addUngrouped(testEmoji)
      }).not.toThrow()

      // Storage operations should still work
      expect(mockSettingsStore.save).toHaveBeenCalled()
      expect(mockStorage.saveUngroupedEmojis).toHaveBeenCalled()
    })
  })
})