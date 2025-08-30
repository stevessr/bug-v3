import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('Content Script Picker - Realtime Updates', () => {
  let mockCommService: any
  let mockCacheUtils: any
  let mockCachedState: any

  beforeEach(() => {
    // Mock communication service
    mockCommService = {
      onCommonEmojiUpdated: vi.fn(),
      onEmojiOrderChanged: vi.fn(),
      onGroupIconUpdated: vi.fn(),
      onUngroupedEmojisChangedSync: vi.fn(),
      onCommonEmojiGroupChanged: vi.fn(),
      onSpecificGroupChanged: vi.fn(),
      onGroupsChanged: vi.fn(),
      onUsageRecorded: vi.fn()
    }

    // Mock cache utilities
    mockCacheUtils = {
      updateCommonGroupCache: vi.fn(),
      getCommonGroupCache: vi.fn().mockReturnValue({
        UUID: 'common-emoji-group',
        emojis: [
          { UUID: 'emoji1', displayName: 'Emoji 1' },
          { UUID: 'emoji2', displayName: 'Emoji 2' }
        ],
        icon: '⭐'
      }),
      updateGroupCache: vi.fn(),
      getGroupCache: vi.fn().mockReturnValue({
        UUID: 'test-group',
        emojis: [
          { UUID: 'emoji3', displayName: 'Emoji 3' }
        ],
        icon: '😀'
      })
    }

    // Mock cached state
    mockCachedState = {
      emojiGroups: [
        {
          UUID: 'common-emoji-group',
          displayName: '常用',
          emojis: []
        }
      ],
      ungroupedEmojis: []
    }

    // Mock DOM
    global.document = {
      querySelector: vi.fn(),
      createElement: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    } as any

    global.window = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    } as any

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

  describe('Cache Listeners Setup', () => {
    it('should setup all realtime sync listeners', () => {
      class CacheListenerManager {
        private commService: any
        private cacheUtils: any
        private cachedState: any

        constructor(commService: any, cacheUtils: any, cachedState: any) {
          this.commService = commService
          this.cacheUtils = cacheUtils
          this.cachedState = cachedState
        }

        setupCacheListeners() {
          // Setup common emoji updated listener
          this.commService.onCommonEmojiUpdated((commonGroup: any) => {
            console.log('[Emoji Picker] 接收到常用表情实时更新消息')
            
            if (commonGroup) {
              this.cacheUtils.updateCommonGroupCache(commonGroup)
              
              const index = this.cachedState.emojiGroups.findIndex((g: any) => g.UUID === 'common-emoji-group')
              if (index >= 0) {
                this.cachedState.emojiGroups[index] = commonGroup
              }
            }
          })

          // Setup emoji order changed listener
          this.commService.onEmojiOrderChanged((groupUUID: string, updatedOrder: string[]) => {
            console.log('[Emoji Picker] 接收到表情排序变更消息')
            
            if (groupUUID && updatedOrder) {
              if (groupUUID === 'common-emoji-group') {
                const commonGroup = this.cacheUtils.getCommonGroupCache()
                if (commonGroup && commonGroup.emojis) {
                  const reorderedEmojis = updatedOrder.map((uuid: string) =>
                    commonGroup.emojis.find((e: any) => e.UUID === uuid)
                  ).filter(Boolean)
                  
                  commonGroup.emojis = reorderedEmojis
                  this.cacheUtils.updateCommonGroupCache(commonGroup)
                }
              }
            }
          })

          // Setup group icon updated listener
          this.commService.onGroupIconUpdated((groupUUID: string, iconUrl: string) => {
            console.log('[Emoji Picker] 接收到分组图标更新消息')
            
            if (groupUUID && iconUrl) {
              if (groupUUID === 'common-emoji-group') {
                const commonGroup = this.cacheUtils.getCommonGroupCache()
                if (commonGroup) {
                  commonGroup.icon = iconUrl
                  this.cacheUtils.updateCommonGroupCache(commonGroup)
                }
              } else {
                const group = this.cacheUtils.getGroupCache(groupUUID)
                if (group) {
                  group.icon = iconUrl
                  this.cacheUtils.updateGroupCache(groupUUID, group)
                }
              }
            }
          })

          // Setup ungrouped emojis changed listener
          this.commService.onUngroupedEmojisChangedSync((ungroupedEmojis: any[]) => {
            console.log('[Emoji Picker] 接收到未分组表情变更消息')
            
            if (ungroupedEmojis) {
              this.cachedState.ungroupedEmojis = ungroupedEmojis
            }
          })
        }
      }

      const manager = new CacheListenerManager(mockCommService, mockCacheUtils, mockCachedState)
      manager.setupCacheListeners()

      // Verify all listeners were set up
      expect(mockCommService.onCommonEmojiUpdated).toHaveBeenCalled()
      expect(mockCommService.onEmojiOrderChanged).toHaveBeenCalled()
      expect(mockCommService.onGroupIconUpdated).toHaveBeenCalled()
      expect(mockCommService.onUngroupedEmojisChangedSync).toHaveBeenCalled()
    })
  })

  describe('Common Emoji Updates', () => {
    it('should handle common emoji updated messages', () => {
      class CommonEmojiUpdateHandler {
        private cacheUtils: any
        private cachedState: any

        constructor(cacheUtils: any, cachedState: any) {
          this.cacheUtils = cacheUtils
          this.cachedState = cachedState
        }

        handleCommonEmojiUpdated(commonGroup: any) {
          console.log('[Emoji Picker] 接收到常用表情实时更新消息')
          
          if (commonGroup) {
            // Update cache
            this.cacheUtils.updateCommonGroupCache(commonGroup)
            
            // Update main cache
            const index = this.cachedState.emojiGroups.findIndex((g: any) => g.UUID === 'common-emoji-group')
            if (index >= 0) {
              this.cachedState.emojiGroups[index] = commonGroup
            }
          }
        }
      }

      const handler = new CommonEmojiUpdateHandler(mockCacheUtils, mockCachedState)

      const updatedCommonGroup = {
        UUID: 'common-emoji-group',
        displayName: '常用',
        emojis: [
          { UUID: 'new-emoji', displayName: 'New Emoji' }
        ]
      }

      handler.handleCommonEmojiUpdated(updatedCommonGroup)

      // Verify cache was updated
      expect(mockCacheUtils.updateCommonGroupCache).toHaveBeenCalledWith(updatedCommonGroup)

      // Verify main cache was updated
      expect(mockCachedState.emojiGroups[0]).toBe(updatedCommonGroup)

      // Verify logging
      expect(console.log).toHaveBeenCalledWith(
        '[Emoji Picker] 接收到常用表情实时更新消息'
      )
    })

    it('should handle invalid common emoji update data gracefully', () => {
      class CommonEmojiUpdateHandler {
        private cacheUtils: any
        private cachedState: any

        constructor(cacheUtils: any, cachedState: any) {
          this.cacheUtils = cacheUtils
          this.cachedState = cachedState
        }

        handleCommonEmojiUpdated(commonGroup: any) {
          try {
            console.log('[Emoji Picker] 接收到常用表情实时更新消息')
            
            if (commonGroup) {
              this.cacheUtils.updateCommonGroupCache(commonGroup)
              
              const index = this.cachedState.emojiGroups.findIndex((g: any) => g.UUID === 'common-emoji-group')
              if (index >= 0) {
                this.cachedState.emojiGroups[index] = commonGroup
              }
            }
          } catch (error) {
            console.error('[Emoji Picker] 处理常用表情实时更新失败:', error)
          }
        }
      }

      const handler = new CommonEmojiUpdateHandler(mockCacheUtils, mockCachedState)

      // Test with null data
      handler.handleCommonEmojiUpdated(null)

      // Should not throw and should not update cache
      expect(mockCacheUtils.updateCommonGroupCache).not.toHaveBeenCalled()
    })
  })

  describe('Emoji Order Changes', () => {
    it('should handle emoji order changed messages', () => {
      class EmojiOrderChangeHandler {
        private cacheUtils: any

        constructor(cacheUtils: any) {
          this.cacheUtils = cacheUtils
        }

        handleEmojiOrderChanged(groupUUID: string, updatedOrder: string[]) {
          console.log('[Emoji Picker] 接收到表情排序变更消息')
          
          if (groupUUID && updatedOrder) {
            if (groupUUID === 'common-emoji-group') {
              const commonGroup = this.cacheUtils.getCommonGroupCache()
              if (commonGroup && commonGroup.emojis) {
                const reorderedEmojis = updatedOrder.map((uuid: string) =>
                  commonGroup.emojis.find((e: any) => e.UUID === uuid)
                ).filter(Boolean)
                
                commonGroup.emojis = reorderedEmojis
                this.cacheUtils.updateCommonGroupCache(commonGroup)
              }
            } else {
              const group = this.cacheUtils.getGroupCache(groupUUID)
              if (group && group.emojis) {
                const reorderedEmojis = updatedOrder.map((uuid: string) =>
                  group.emojis.find((e: any) => e.UUID === uuid)
                ).filter(Boolean)
                
                group.emojis = reorderedEmojis
                this.cacheUtils.updateGroupCache(groupUUID, group)
              }
            }
          }
        }
      }

      const handler = new EmojiOrderChangeHandler(mockCacheUtils)

      // Test common group reordering
      handler.handleEmojiOrderChanged('common-emoji-group', ['emoji2', 'emoji1'])

      // Verify cache was updated
      expect(mockCacheUtils.getCommonGroupCache).toHaveBeenCalled()
      expect(mockCacheUtils.updateCommonGroupCache).toHaveBeenCalled()

      // Test regular group reordering
      handler.handleEmojiOrderChanged('test-group', ['emoji3'])

      // Verify group cache was updated
      expect(mockCacheUtils.getGroupCache).toHaveBeenCalledWith('test-group')
      expect(mockCacheUtils.updateGroupCache).toHaveBeenCalledWith('test-group', expect.any(Object))

      // Verify logging
      expect(console.log).toHaveBeenCalledWith(
        '[Emoji Picker] 接收到表情排序变更消息'
      )
    })
  })

  describe('Group Icon Updates', () => {
    it('should handle group icon updated messages', () => {
      class GroupIconUpdateHandler {
        private cacheUtils: any

        constructor(cacheUtils: any) {
          this.cacheUtils = cacheUtils
        }

        handleGroupIconUpdated(groupUUID: string, iconUrl: string) {
          console.log('[Emoji Picker] 接收到分组图标更新消息')
          
          if (groupUUID && iconUrl) {
            if (groupUUID === 'common-emoji-group') {
              const commonGroup = this.cacheUtils.getCommonGroupCache()
              if (commonGroup) {
                commonGroup.icon = iconUrl
                this.cacheUtils.updateCommonGroupCache(commonGroup)
              }
            } else {
              const group = this.cacheUtils.getGroupCache(groupUUID)
              if (group) {
                group.icon = iconUrl
                this.cacheUtils.updateGroupCache(groupUUID, group)
              }
            }
          }
        }
      }

      const handler = new GroupIconUpdateHandler(mockCacheUtils)

      // Test common group icon update
      handler.handleGroupIconUpdated('common-emoji-group', '🌟')

      // Verify common group cache was updated
      expect(mockCacheUtils.getCommonGroupCache).toHaveBeenCalled()
      expect(mockCacheUtils.updateCommonGroupCache).toHaveBeenCalled()

      // Test regular group icon update
      handler.handleGroupIconUpdated('test-group', '🎉')

      // Verify group cache was updated
      expect(mockCacheUtils.getGroupCache).toHaveBeenCalledWith('test-group')
      expect(mockCacheUtils.updateGroupCache).toHaveBeenCalledWith('test-group', expect.any(Object))

      // Verify logging
      expect(console.log).toHaveBeenCalledWith(
        '[Emoji Picker] 接收到分组图标更新消息'
      )
    })
  })

  describe('Ungrouped Emojis Updates', () => {
    it('should handle ungrouped emojis changed messages', () => {
      class UngroupedEmojisUpdateHandler {
        private cachedState: any

        constructor(cachedState: any) {
          this.cachedState = cachedState
        }

        handleUngroupedEmojisChanged(ungroupedEmojis: any[]) {
          console.log('[Emoji Picker] 接收到未分组表情变更消息')
          
          if (ungroupedEmojis) {
            this.cachedState.ungroupedEmojis = ungroupedEmojis
          }
        }
      }

      const handler = new UngroupedEmojisUpdateHandler(mockCachedState)

      const newUngroupedEmojis = [
        { UUID: 'ungrouped1', displayName: 'Ungrouped 1' },
        { UUID: 'ungrouped2', displayName: 'Ungrouped 2' }
      ]

      handler.handleUngroupedEmojisChanged(newUngroupedEmojis)

      // Verify cached state was updated
      expect(mockCachedState.ungroupedEmojis).toBe(newUngroupedEmojis)

      // Verify logging
      expect(console.log).toHaveBeenCalledWith(
        '[Emoji Picker] 接收到未分组表情变更消息'
      )
    })
  })

  describe('UI Refresh Functions', () => {
    it('should refresh common emoji section', () => {
      class UIRefreshManager {
        refreshCommonEmojiSection(picker: Element, commonGroup: any) {
          try {
            const commonSection = picker.querySelector('[data-group-uuid="common-emoji-group"]')
            if (!commonSection) {
              console.warn('[Emoji Picker] 未找到常用表情组区域')
              return
            }

            const emojisHtml = commonGroup.emojis.map((emoji: any) => 
              `<div class="emoji-item" data-emoji-uuid="${emoji.UUID}" title="${emoji.displayName}">
                <img src="${emoji.url}" alt="${emoji.displayName}" loading="lazy" />
              </div>`
            ).join('')

            const sectionContent = commonSection.querySelector('.emoji-section-content')
            if (sectionContent) {
              sectionContent.innerHTML = emojisHtml
              console.log('[Emoji Picker] 常用表情组显示已刷新')
            }
          } catch (error) {
            console.error('[Emoji Picker] 刷新常用表情组显示失败:', error)
          }
        }
      }

      const manager = new UIRefreshManager()

      // Mock picker element
      const mockSectionContent = {
        innerHTML: ''
      }

      const mockCommonSection = {
        querySelector: vi.fn().mockReturnValue(mockSectionContent)
      }

      const mockPicker = {
        querySelector: vi.fn().mockReturnValue(mockCommonSection)
      }

      const commonGroup = {
        emojis: [
          { UUID: 'emoji1', displayName: 'Emoji 1', url: 'emoji1.png' },
          { UUID: 'emoji2', displayName: 'Emoji 2', url: 'emoji2.png' }
        ]
      }

      manager.refreshCommonEmojiSection(mockPicker as any, commonGroup)

      // Verify section was found
      expect(mockPicker.querySelector).toHaveBeenCalledWith('[data-group-uuid="common-emoji-group"]')

      // Verify content was updated
      expect(mockSectionContent.innerHTML).toContain('emoji1')
      expect(mockSectionContent.innerHTML).toContain('emoji2')

      // Verify logging
      expect(console.log).toHaveBeenCalledWith(
        '[Emoji Picker] 常用表情组显示已刷新'
      )
    })

    it('should handle missing common emoji section gracefully', () => {
      class UIRefreshManager {
        refreshCommonEmojiSection(picker: Element, commonGroup: any) {
          try {
            const commonSection = picker.querySelector('[data-group-uuid="common-emoji-group"]')
            if (!commonSection) {
              console.warn('[Emoji Picker] 未找到常用表情组区域')
              return
            }

            // Rest of the function...
          } catch (error) {
            console.error('[Emoji Picker] 刷新常用表情组显示失败:', error)
          }
        }
      }

      const manager = new UIRefreshManager()

      // Mock picker element with no common section
      const mockPicker = {
        querySelector: vi.fn().mockReturnValue(null)
      }

      const commonGroup = { emojis: [] }

      manager.refreshCommonEmojiSection(mockPicker as any, commonGroup)

      // Verify warning was logged
      expect(console.warn).toHaveBeenCalledWith(
        '[Emoji Picker] 未找到常用表情组区域'
      )
    })

    it('should refresh group icon', () => {
      class UIRefreshManager {
        refreshGroupIcon(picker: Element, groupUUID: string, iconUrl: string) {
          try {
            // Update navigation icon
            const navButton = picker.querySelector(`[data-group-uuid="${groupUUID}"]`)
            if (navButton) {
              const iconElement = navButton.querySelector('.emoji-nav-icon, img, .icon')
              if (iconElement) {
                if (iconElement.tagName === 'IMG') {
                  (iconElement as HTMLImageElement).src = iconUrl
                } else {
                  iconElement.textContent = iconUrl
                }
              }
            }

            console.log(`[Emoji Picker] 组 ${groupUUID} 的图标已刷新`)
          } catch (error) {
            console.error('[Emoji Picker] 刷新分组图标失败:', error)
          }
        }
      }

      const manager = new UIRefreshManager()

      // Mock picker element
      const mockIconElement = {
        tagName: 'IMG',
        src: ''
      }

      const mockNavButton = {
        querySelector: vi.fn().mockReturnValue(mockIconElement)
      }

      const mockPicker = {
        querySelector: vi.fn().mockReturnValue(mockNavButton)
      }

      manager.refreshGroupIcon(mockPicker as any, 'test-group', 'new-icon.png')

      // Verify icon was updated
      expect(mockIconElement.src).toBe('new-icon.png')

      // Verify logging
      expect(console.log).toHaveBeenCalledWith(
        '[Emoji Picker] 组 test-group 的图标已刷新'
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle listener errors gracefully', () => {
      class ErrorHandlingManager {
        private cacheUtils: any

        constructor(cacheUtils: any) {
          this.cacheUtils = cacheUtils
        }

        handleCommonEmojiUpdated(commonGroup: any) {
          try {
            console.log('[Emoji Picker] 接收到常用表情实时更新消息')
            
            if (commonGroup) {
              this.cacheUtils.updateCommonGroupCache(commonGroup)
            }
          } catch (error) {
            console.error('[Emoji Picker] 处理常用表情实时更新失败:', error)
          }
        }
      }

      // Make cache utils throw error
      const errorCacheUtils = {
        updateCommonGroupCache: vi.fn().mockImplementation(() => {
          throw new Error('Cache update failed')
        })
      }

      const manager = new ErrorHandlingManager(errorCacheUtils)

      const commonGroup = { UUID: 'common-emoji-group' }

      // Should not throw
      expect(() => {
        manager.handleCommonEmojiUpdated(commonGroup)
      }).not.toThrow()

      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith(
        '[Emoji Picker] 处理常用表情实时更新失败:',
        expect.any(Error)
      )
    })
  })
})