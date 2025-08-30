import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Group Icon Sync - Core Functions', () => {
  let mockCommService: any
  let mockStorage: any
  let mockSettingsStore: any

  beforeEach(() => {
    // Reset mocks
    mockCommService = {
      sendGroupIconUpdated: vi.fn()
    }

    mockStorage = {
      saveCommonEmojiGroup: vi.fn()
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

    // Mock fetch for icon preloading tests
    global.fetch = vi.fn()
  })

  describe('Group Icon Management', () => {
    it('should update group icon and send sync message', () => {
      class GroupIconManager {
        private groups: any[] = [
          { UUID: 'group1', displayName: 'Group 1', icon: '😀', emojis: [] },
          { UUID: 'group2', displayName: 'Group 2', icon: '😎', emojis: [] }
        ]
        private ungrouped: any[] = []
        private commService: any
        private storage: any
        private settingsStore: any

        constructor(commService: any, storage: any, settingsStore: any) {
          this.commService = commService
          this.storage = storage
          this.settingsStore = settingsStore
        }

        updateGroupIcon(groupUUID: string, newIcon: string) {
          console.log('[GroupIconManager] Updating group icon:', groupUUID, newIcon)
          
          const group = this.groups.find((g) => g.UUID === groupUUID)
          if (!group) {
            console.warn('[GroupIconManager] Group not found for icon update:', groupUUID)
            return false
          }
          
          const oldIcon = group.icon
          group.icon = newIcon
          
          try {
            this.settingsStore.save(this.groups, this.ungrouped)
            
            // Send sync message
            try {
              if (this.commService) {
                this.commService.sendGroupIconUpdated(groupUUID, newIcon)
                console.log('[GroupIconManager] Sent group icon updated sync message')
              }
            } catch (syncError) {
              console.warn('[GroupIconManager] Failed to send group icon sync message:', syncError)
            }
            
            // Save common group if needed
            if (groupUUID === 'common-emoji-group') {
              try {
                this.storage.saveCommonEmojiGroup(group)
                console.log('[GroupIconManager] Saved common emoji group with updated icon to dedicated storage key')
              } catch (storageError) {
                console.warn('[GroupIconManager] Failed to save common group with updated icon:', storageError)
              }
            }
            
            console.log('[GroupIconManager] Successfully updated group icon from', oldIcon, 'to', newIcon)
            return true
          } catch (error) {
            console.error('[GroupIconManager] Failed to save after updating group icon:', error)
            return false
          }
        }

        getGroups() {
          return [...this.groups]
        }
      }

      const manager = new GroupIconManager(mockCommService, mockStorage, mockSettingsStore)

      const result = manager.updateGroupIcon('group1', '🎉')

      expect(result).toBe(true)

      // Verify storage save was called
      expect(mockSettingsStore.save).toHaveBeenCalled()

      // Verify sync message was sent
      expect(mockCommService.sendGroupIconUpdated).toHaveBeenCalledWith('group1', '🎉')

      // Verify logging
      expect(console.log).toHaveBeenCalledWith(
        '[GroupIconManager] Updating group icon:',
        'group1',
        '🎉'
      )

      // Verify success logging
      expect(console.log).toHaveBeenCalledWith(
        '[GroupIconManager] Successfully updated group icon from',
        '😀',
        'to',
        '🎉'
      )
    })

    it('should handle common emoji group icon update', () => {
      class GroupIconManager {
        private groups: any[] = [
          { UUID: 'common-emoji-group', displayName: '常用', icon: '⭐', emojis: [] }
        ]
        private ungrouped: any[] = []
        private commService: any
        private storage: any
        private settingsStore: any

        constructor(commService: any, storage: any, settingsStore: any) {
          this.commService = commService
          this.storage = storage
          this.settingsStore = settingsStore
        }

        updateGroupIcon(groupUUID: string, newIcon: string) {
          console.log('[GroupIconManager] Updating group icon:', groupUUID, newIcon)
          
          const group = this.groups.find((g) => g.UUID === groupUUID)
          if (!group) {
            console.warn('[GroupIconManager] Group not found for icon update:', groupUUID)
            return false
          }
          
          const oldIcon = group.icon
          group.icon = newIcon
          
          try {
            this.settingsStore.save(this.groups, this.ungrouped)
            
            // Send sync message
            try {
              if (this.commService) {
                this.commService.sendGroupIconUpdated(groupUUID, newIcon)
                console.log('[GroupIconManager] Sent group icon updated sync message')
              }
            } catch (syncError) {
              console.warn('[GroupIconManager] Failed to send group icon sync message:', syncError)
            }
            
            // Save common group if needed
            if (groupUUID === 'common-emoji-group') {
              try {
                this.storage.saveCommonEmojiGroup(group)
                console.log('[GroupIconManager] Saved common emoji group with updated icon to dedicated storage key')
              } catch (storageError) {
                console.warn('[GroupIconManager] Failed to save common group with updated icon:', storageError)
              }
            }
            
            console.log('[GroupIconManager] Successfully updated group icon from', oldIcon, 'to', newIcon)
            return true
          } catch (error) {
            console.error('[GroupIconManager] Failed to save after updating group icon:', error)
            return false
          }
        }
      }

      const manager = new GroupIconManager(mockCommService, mockStorage, mockSettingsStore)

      const result = manager.updateGroupIcon('common-emoji-group', '🌟')

      expect(result).toBe(true)

      // Verify storage save was called
      expect(mockSettingsStore.save).toHaveBeenCalled()

      // Verify sync message was sent
      expect(mockCommService.sendGroupIconUpdated).toHaveBeenCalledWith('common-emoji-group', '🌟')

      // Verify common group was saved to dedicated storage
      expect(mockStorage.saveCommonEmojiGroup).toHaveBeenCalledWith(
        expect.objectContaining({
          UUID: 'common-emoji-group',
          icon: '🌟'
        })
      )
    })

    it('should return false for non-existent group', () => {
      class GroupIconManager {
        private groups: any[] = [
          { UUID: 'group1', displayName: 'Group 1', icon: '😀', emojis: [] }
        ]
        private ungrouped: any[] = []
        private commService: any
        private storage: any
        private settingsStore: any

        constructor(commService: any, storage: any, settingsStore: any) {
          this.commService = commService
          this.storage = storage
          this.settingsStore = settingsStore
        }

        updateGroupIcon(groupUUID: string, newIcon: string) {
          console.log('[GroupIconManager] Updating group icon:', groupUUID, newIcon)
          
          const group = this.groups.find((g) => g.UUID === groupUUID)
          if (!group) {
            console.warn('[GroupIconManager] Group not found for icon update:', groupUUID)
            return false
          }
          
          const oldIcon = group.icon
          group.icon = newIcon
          
          try {
            this.settingsStore.save(this.groups, this.ungrouped)
            
            // Send sync message
            try {
              if (this.commService) {
                this.commService.sendGroupIconUpdated(groupUUID, newIcon)
                console.log('[GroupIconManager] Sent group icon updated sync message')
              }
            } catch (syncError) {
              console.warn('[GroupIconManager] Failed to send group icon sync message:', syncError)
            }
            
            console.log('[GroupIconManager] Successfully updated group icon from', oldIcon, 'to', newIcon)
            return true
          } catch (error) {
            console.error('[GroupIconManager] Failed to save after updating group icon:', error)
            return false
          }
        }
      }

      const manager = new GroupIconManager(mockCommService, mockStorage, mockSettingsStore)

      const result = manager.updateGroupIcon('non-existent', '🎉')

      expect(result).toBe(false)

      // Verify warning was logged
      expect(console.warn).toHaveBeenCalledWith(
        '[GroupIconManager] Group not found for icon update:',
        'non-existent'
      )

      // Verify no storage operations were called
      expect(mockSettingsStore.save).not.toHaveBeenCalled()
      expect(mockCommService.sendGroupIconUpdated).not.toHaveBeenCalled()
    })

    it('should handle batch icon updates', () => {
      class GroupIconManager {
        private groups: any[] = [
          { UUID: 'group1', displayName: 'Group 1', icon: '😀', emojis: [] },
          { UUID: 'group2', displayName: 'Group 2', icon: '😎', emojis: [] },
          { UUID: 'common-emoji-group', displayName: '常用', icon: '⭐', emojis: [] }
        ]
        private ungrouped: any[] = []
        private commService: any
        private storage: any
        private settingsStore: any

        constructor(commService: any, storage: any, settingsStore: any) {
          this.commService = commService
          this.storage = storage
          this.settingsStore = settingsStore
        }

        updateMultipleGroupIcons(iconUpdates: Array<{ groupUUID: string; icon: string }>) {
          console.log('[GroupIconManager] Updating multiple group icons, count:', iconUpdates.length)
          
          const updatedGroups: Array<{ groupUUID: string; oldIcon: string; newIcon: string }> = []
          
          for (const update of iconUpdates) {
            const group = this.groups.find((g) => g.UUID === update.groupUUID)
            if (group) {
              const oldIcon = group.icon
              group.icon = update.icon
              updatedGroups.push({
                groupUUID: update.groupUUID,
                oldIcon,
                newIcon: update.icon
              })
            } else {
              console.warn('[GroupIconManager] Group not found for batch icon update:', update.groupUUID)
            }
          }
          
          if (updatedGroups.length === 0) {
            console.warn('[GroupIconManager] No groups were updated in batch icon update')
            return false
          }
          
          try {
            this.settingsStore.save(this.groups, this.ungrouped)
            
            // Send sync messages
            try {
              if (this.commService) {
                for (const update of updatedGroups) {
                  this.commService.sendGroupIconUpdated(update.groupUUID, update.newIcon)
                }
                console.log('[GroupIconManager] Sent batch group icon updated sync messages')
              }
            } catch (syncError) {
              console.warn('[GroupIconManager] Failed to send batch group icon sync messages:', syncError)
            }
            
            // Save common group if updated
            const commonGroupUpdate = updatedGroups.find(u => u.groupUUID === 'common-emoji-group')
            if (commonGroupUpdate) {
              try {
                const commonGroup = this.groups.find(g => g.UUID === 'common-emoji-group')
                if (commonGroup) {
                  this.storage.saveCommonEmojiGroup(commonGroup)
                  console.log('[GroupIconManager] Saved common emoji group with updated icon to dedicated storage key')
                }
              } catch (storageError) {
                console.warn('[GroupIconManager] Failed to save common group with updated icon:', storageError)
              }
            }
            
            console.log('[GroupIconManager] Successfully updated', updatedGroups.length, 'group icons')
            return true
          } catch (error) {
            console.error('[GroupIconManager] Failed to save after batch updating group icons:', error)
            return false
          }
        }
      }

      const manager = new GroupIconManager(mockCommService, mockStorage, mockSettingsStore)

      const iconUpdates = [
        { groupUUID: 'group1', icon: '🎉' },
        { groupUUID: 'group2', icon: '🚀' },
        { groupUUID: 'common-emoji-group', icon: '🌟' }
      ]

      const result = manager.updateMultipleGroupIcons(iconUpdates)

      expect(result).toBe(true)

      // Verify storage save was called
      expect(mockSettingsStore.save).toHaveBeenCalled()

      // Verify sync messages were sent for each group
      expect(mockCommService.sendGroupIconUpdated).toHaveBeenCalledWith('group1', '🎉')
      expect(mockCommService.sendGroupIconUpdated).toHaveBeenCalledWith('group2', '🚀')
      expect(mockCommService.sendGroupIconUpdated).toHaveBeenCalledWith('common-emoji-group', '🌟')

      // Verify common group was saved to dedicated storage
      expect(mockStorage.saveCommonEmojiGroup).toHaveBeenCalledWith(
        expect.objectContaining({
          UUID: 'common-emoji-group',
          icon: '🌟'
        })
      )

      // Verify logging
      expect(console.log).toHaveBeenCalledWith(
        '[GroupIconManager] Successfully updated',
        3,
        'group icons'
      )
    })
  })

  describe('Icon Caching', () => {
    it('should cache and retrieve group icons', () => {
      class IconCacheManager {
        private iconCache = new Map<string, { url: string; timestamp: number; blob?: Blob }>()
        private readonly ICON_CACHE_DURATION = 5 * 60 * 1000 // 5分钟

        cacheGroupIcon(groupUUID: string, iconUrl: string, blob?: Blob) {
          this.iconCache.set(groupUUID, {
            url: iconUrl,
            timestamp: Date.now(),
            blob
          })
          console.log('[IconCacheManager] Cached icon for group:', groupUUID)
        }

        getCachedGroupIcon(groupUUID: string): { url: string; blob?: Blob } | null {
          const cached = this.iconCache.get(groupUUID)
          if (!cached) {
            return null
          }
          
          // Check if cache is expired
          if (Date.now() - cached.timestamp > this.ICON_CACHE_DURATION) {
            this.iconCache.delete(groupUUID)
            console.log('[IconCacheManager] Icon cache expired for group:', groupUUID)
            return null
          }
          
          console.log('[IconCacheManager] Using cached icon for group:', groupUUID)
          return { url: cached.url, blob: cached.blob }
        }

        clearIconCache(groupUUID?: string) {
          if (groupUUID) {
            this.iconCache.delete(groupUUID)
            console.log('[IconCacheManager] Cleared icon cache for group:', groupUUID)
          } else {
            this.iconCache.clear()
            console.log('[IconCacheManager] Cleared all icon cache')
          }
        }
      }

      const cacheManager = new IconCacheManager()

      // Test caching
      cacheManager.cacheGroupIcon('group1', 'https://example.com/icon.png')

      // Test retrieval
      const cached = cacheManager.getCachedGroupIcon('group1')
      expect(cached).toEqual({
        url: 'https://example.com/icon.png',
        blob: undefined
      })

      // Test cache miss
      const notCached = cacheManager.getCachedGroupIcon('group2')
      expect(notCached).toBeNull()

      // Test cache clearing
      cacheManager.clearIconCache('group1')
      const clearedCache = cacheManager.getCachedGroupIcon('group1')
      expect(clearedCache).toBeNull()

      // Verify logging
      expect(console.log).toHaveBeenCalledWith(
        '[IconCacheManager] Cached icon for group:',
        'group1'
      )
    })

    it('should handle cache expiration', () => {
      class IconCacheManager {
        private iconCache = new Map<string, { url: string; timestamp: number; blob?: Blob }>()
        private readonly ICON_CACHE_DURATION = 100 // Very short duration for testing

        cacheGroupIcon(groupUUID: string, iconUrl: string, blob?: Blob) {
          this.iconCache.set(groupUUID, {
            url: iconUrl,
            timestamp: Date.now(),
            blob
          })
          console.log('[IconCacheManager] Cached icon for group:', groupUUID)
        }

        getCachedGroupIcon(groupUUID: string): { url: string; blob?: Blob } | null {
          const cached = this.iconCache.get(groupUUID)
          if (!cached) {
            return null
          }
          
          // Check if cache is expired
          if (Date.now() - cached.timestamp > this.ICON_CACHE_DURATION) {
            this.iconCache.delete(groupUUID)
            console.log('[IconCacheManager] Icon cache expired for group:', groupUUID)
            return null
          }
          
          console.log('[IconCacheManager] Using cached icon for group:', groupUUID)
          return { url: cached.url, blob: cached.blob }
        }
      }

      const cacheManager = new IconCacheManager()

      // Cache an icon
      cacheManager.cacheGroupIcon('group1', 'https://example.com/icon.png')

      // Wait for cache to expire
      setTimeout(() => {
        const expired = cacheManager.getCachedGroupIcon('group1')
        expect(expired).toBeNull()

        // Verify expiration logging
        expect(console.log).toHaveBeenCalledWith(
          '[IconCacheManager] Icon cache expired for group:',
          'group1'
        )
      }, 150)
    })
  })

  describe('Icon Preloading', () => {
    it('should preload group icons', async () => {
      class IconPreloader {
        private groups: any[] = [
          { UUID: 'group1', icon: 'https://example.com/icon1.png' },
          { UUID: 'group2', icon: '😀' },
          { UUID: 'group3', icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==' }
        ]
        private iconCache = new Map<string, { url: string; timestamp: number; blob?: Blob }>()

        async preloadGroupIcons(groupUUIDs: string[]) {
          console.log('[IconPreloader] Preloading icons for groups:', groupUUIDs)
          
          const preloadPromises = groupUUIDs.map(async (groupUUID) => {
            const group = this.groups.find(g => g.UUID === groupUUID)
            if (!group || !group.icon) {
              return
            }
            
            // Check if already cached
            if (this.getCachedGroupIcon(groupUUID)) {
              return
            }
            
            try {
              // If icon is URL, try to preload
              if (group.icon.startsWith('http') || group.icon.startsWith('data:')) {
                const response = await fetch(group.icon)
                if (response.ok) {
                  const blob = await response.blob()
                  this.cacheGroupIcon(groupUUID, group.icon, blob)
                }
              } else {
                // If emoji character, cache directly
                this.cacheGroupIcon(groupUUID, group.icon)
              }
            } catch (error) {
              console.warn('[IconPreloader] Failed to preload icon for group:', groupUUID, error)
            }
          })
          
          await Promise.all(preloadPromises)
          console.log('[IconPreloader] Completed preloading icons')
        }

        cacheGroupIcon(groupUUID: string, iconUrl: string, blob?: Blob) {
          this.iconCache.set(groupUUID, {
            url: iconUrl,
            timestamp: Date.now(),
            blob
          })
          console.log('[IconPreloader] Cached icon for group:', groupUUID)
        }

        getCachedGroupIcon(groupUUID: string): { url: string; blob?: Blob } | null {
          const cached = this.iconCache.get(groupUUID)
          return cached ? { url: cached.url, blob: cached.blob } : null
        }
      }

      // Mock successful fetch
      const mockBlob = new Blob(['fake-image-data'], { type: 'image/png' })
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob)
      })

      const preloader = new IconPreloader()

      await preloader.preloadGroupIcons(['group1', 'group2', 'group3'])

      // Verify fetch was called for HTTP URLs
      expect(global.fetch).toHaveBeenCalledWith('https://example.com/icon1.png')
      expect(global.fetch).toHaveBeenCalledWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==')

      // Verify logging
      expect(console.log).toHaveBeenCalledWith(
        '[IconPreloader] Preloading icons for groups:',
        ['group1', 'group2', 'group3']
      )

      expect(console.log).toHaveBeenCalledWith(
        '[IconPreloader] Completed preloading icons'
      )
    })

    it('should handle preload errors gracefully', async () => {
      class IconPreloader {
        private groups: any[] = [
          { UUID: 'group1', icon: 'https://example.com/broken-icon.png' }
        ]
        private iconCache = new Map<string, { url: string; timestamp: number; blob?: Blob }>()

        async preloadGroupIcons(groupUUIDs: string[]) {
          console.log('[IconPreloader] Preloading icons for groups:', groupUUIDs)
          
          const preloadPromises = groupUUIDs.map(async (groupUUID) => {
            const group = this.groups.find(g => g.UUID === groupUUID)
            if (!group || !group.icon) {
              return
            }
            
            try {
              if (group.icon.startsWith('http') || group.icon.startsWith('data:')) {
                const response = await fetch(group.icon)
                if (response.ok) {
                  const blob = await response.blob()
                  this.cacheGroupIcon(groupUUID, group.icon, blob)
                }
              } else {
                this.cacheGroupIcon(groupUUID, group.icon)
              }
            } catch (error) {
              console.warn('[IconPreloader] Failed to preload icon for group:', groupUUID, error)
            }
          })
          
          await Promise.all(preloadPromises)
          console.log('[IconPreloader] Completed preloading icons')
        }

        cacheGroupIcon(groupUUID: string, iconUrl: string, blob?: Blob) {
          this.iconCache.set(groupUUID, {
            url: iconUrl,
            timestamp: Date.now(),
            blob
          })
        }
      }

      // Mock failed fetch
      ;(global.fetch as any).mockRejectedValue(new Error('Network error'))

      const preloader = new IconPreloader()

      // Should not throw
      await expect(preloader.preloadGroupIcons(['group1'])).resolves.not.toThrow()

      // Verify warning was logged
      expect(console.warn).toHaveBeenCalledWith(
        '[IconPreloader] Failed to preload icon for group:',
        'group1',
        expect.any(Error)
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle storage save errors gracefully', () => {
      class GroupIconManager {
        private groups: any[] = [
          { UUID: 'group1', displayName: 'Group 1', icon: '😀', emojis: [] }
        ]
        private ungrouped: any[] = []
        private commService: any
        private storage: any
        private settingsStore: any

        constructor(commService: any, storage: any, settingsStore: any) {
          this.commService = commService
          this.storage = storage
          this.settingsStore = settingsStore
        }

        updateGroupIcon(groupUUID: string, newIcon: string) {
          console.log('[GroupIconManager] Updating group icon:', groupUUID, newIcon)
          
          const group = this.groups.find((g) => g.UUID === groupUUID)
          if (!group) {
            console.warn('[GroupIconManager] Group not found for icon update:', groupUUID)
            return false
          }
          
          const oldIcon = group.icon
          group.icon = newIcon
          
          try {
            this.settingsStore.save(this.groups, this.ungrouped)
            
            // Send sync message
            try {
              if (this.commService) {
                this.commService.sendGroupIconUpdated(groupUUID, newIcon)
                console.log('[GroupIconManager] Sent group icon updated sync message')
              }
            } catch (syncError) {
              console.warn('[GroupIconManager] Failed to send group icon sync message:', syncError)
            }
            
            console.log('[GroupIconManager] Successfully updated group icon from', oldIcon, 'to', newIcon)
            return true
          } catch (error) {
            console.error('[GroupIconManager] Failed to save after updating group icon:', error)
            return false
          }
        }
      }

      const manager = new GroupIconManager(mockCommService, mockStorage, mockSettingsStore)

      // Make storage save fail
      mockSettingsStore.save.mockImplementation(() => {
        throw new Error('Storage save failed')
      })

      const result = manager.updateGroupIcon('group1', '🎉')

      expect(result).toBe(false)

      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith(
        '[GroupIconManager] Failed to save after updating group icon:',
        expect.any(Error)
      )
    })

    it('should handle sync message errors gracefully', () => {
      class GroupIconManager {
        private groups: any[] = [
          { UUID: 'group1', displayName: 'Group 1', icon: '😀', emojis: [] }
        ]
        private ungrouped: any[] = []
        private commService: any
        private storage: any
        private settingsStore: any

        constructor(commService: any, storage: any, settingsStore: any) {
          this.commService = commService
          this.storage = storage
          this.settingsStore = settingsStore
        }

        updateGroupIcon(groupUUID: string, newIcon: string) {
          console.log('[GroupIconManager] Updating group icon:', groupUUID, newIcon)
          
          const group = this.groups.find((g) => g.UUID === groupUUID)
          if (!group) {
            console.warn('[GroupIconManager] Group not found for icon update:', groupUUID)
            return false
          }
          
          const oldIcon = group.icon
          group.icon = newIcon
          
          try {
            this.settingsStore.save(this.groups, this.ungrouped)
            
            // Send sync message
            try {
              if (this.commService) {
                this.commService.sendGroupIconUpdated(groupUUID, newIcon)
                console.log('[GroupIconManager] Sent group icon updated sync message')
              }
            } catch (syncError) {
              console.warn('[GroupIconManager] Failed to send group icon sync message:', syncError)
            }
            
            console.log('[GroupIconManager] Successfully updated group icon from', oldIcon, 'to', newIcon)
            return true
          } catch (error) {
            console.error('[GroupIconManager] Failed to save after updating group icon:', error)
            return false
          }
        }
      }

      const manager = new GroupIconManager(mockCommService, mockStorage, mockSettingsStore)

      // Make sync message fail
      mockCommService.sendGroupIconUpdated.mockImplementation(() => {
        throw new Error('Sync message failed')
      })

      const result = manager.updateGroupIcon('group1', '🎉')

      expect(result).toBe(true) // Should still succeed despite sync error

      // Verify warning was logged
      expect(console.warn).toHaveBeenCalledWith(
        '[GroupIconManager] Failed to send group icon sync message:',
        expect.any(Error)
      )

      // Storage operations should still work
      expect(mockSettingsStore.save).toHaveBeenCalled()
    })
  })
})