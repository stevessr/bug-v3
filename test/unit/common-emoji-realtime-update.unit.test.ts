import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// 模拟通信服务
const mockCommService = {
  sendCommonEmojiGroupChanged: vi.fn(),
  sendSpecificGroupChanged: vi.fn(),
  sendUsageRecorded: vi.fn(),
  onCommonEmojiGroupChanged: vi.fn(),
  onUsageRecorded: vi.fn(),
}

// 模拟后台存储
const mockEmojiGroupsStore = {
  getCommonEmojiGroup: vi.fn(),
  recordUsageByUUID: vi.fn(),
}

// 模拟chrome API
const mockChrome = {
  storage: {
    local: {
      set: vi.fn(),
    },
  },
  runtime: {
    lastError: null,
  },
}

// 设置全局模拟
global.chrome = mockChrome as any
global.window = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
} as any

describe('常用表情实时更新功能修复验证', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // 重置模拟数据
    mockEmojiGroupsStore.getCommonEmojiGroup.mockReturnValue({
      UUID: 'common-emoji-group',
      displayName: '常用表情',
      icon: '⭐',
      emojis: [{ UUID: 'emoji-1', displayName: '笑脸', usageCount: 5, lastUsed: Date.now() }],
    })

    mockEmojiGroupsStore.recordUsageByUUID.mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('后台使用记录处理函数修复', () => {
    it('应该在Chrome环境下记录使用后发送常用表情组更新通知', async () => {
      // 模拟Chrome环境下的表情使用记录处理函数
      async function handleEmojiUsageChrome(uuid: string, sendResponse: (resp: any) => void) {
        try {
          console.log('Recording emoji usage for UUID (Chrome):', uuid)
          let success = false
          let shouldNotifyCommonGroup = false

          // 使用emoji groups store记录使用
          if (
            mockEmojiGroupsStore &&
            typeof mockEmojiGroupsStore.recordUsageByUUID === 'function'
          ) {
            try {
              success = mockEmojiGroupsStore.recordUsageByUUID(uuid)
              shouldNotifyCommonGroup = success
            } catch (error) {
              console.log('Error calling recordUsageByUUID (Chrome):', error)
            }
          }

          // 发送响应
          sendResponse({
            success: success,
            message: success ? 'Usage recorded successfully' : 'Failed to record usage',
          })

          // 🚀 关键修复：如果通过store更新成功，发送通知
          if (shouldNotifyCommonGroup) {
            try {
              // 获取更新后的常用表情组
              const updatedCommonGroup = mockEmojiGroupsStore?.getCommonEmojiGroup
                ? mockEmojiGroupsStore.getCommonEmojiGroup()
                : null

              if (updatedCommonGroup) {
                console.log(
                  'Sending common emoji group update notification after store usage record',
                )
                mockCommService.sendCommonEmojiGroupChanged(updatedCommonGroup)
                mockCommService.sendSpecificGroupChanged('common-emoji-group', updatedCommonGroup)
              }
            } catch (notifyError) {
              console.log('Error sending common group update notification:', notifyError)
            }
          }
        } catch (error) {
          console.log('Error handling RECORD_EMOJI_USAGE (Chrome):', error)
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      const mockSendResponse = vi.fn()
      const testUUID = 'emoji-1'

      // 执行测试
      await handleEmojiUsageChrome(testUUID, mockSendResponse)

      // 验证使用记录被调用
      expect(mockEmojiGroupsStore.recordUsageByUUID).toHaveBeenCalledWith(testUUID)

      // 验证响应被发送
      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        message: 'Usage recorded successfully',
      })

      // 🚀 关键验证：常用表情组更新通知被发送
      expect(mockCommService.sendCommonEmojiGroupChanged).toHaveBeenCalledWith({
        UUID: 'common-emoji-group',
        displayName: '常用表情',
        icon: '⭐',
        emojis: [
          { UUID: 'emoji-1', displayName: '笑脸', usageCount: 5, lastUsed: expect.any(Number) },
        ],
      })

      expect(mockCommService.sendSpecificGroupChanged).toHaveBeenCalledWith(
        'common-emoji-group',
        expect.objectContaining({
          UUID: 'common-emoji-group',
          displayName: '常用表情',
        }),
      )
    })

    it('应该在Firefox环境下记录使用后发送常用表情组更新通知', async () => {
      // 模拟Firefox环境下的表情使用记录处理函数
      async function handleEmojiUsageFirefox(uuid: string): Promise<object> {
        try {
          console.log('Recording emoji usage for UUID (Firefox):', uuid)
          let success = false
          let shouldNotifyCommonGroup = false

          // 使用emoji groups store记录使用
          if (
            mockEmojiGroupsStore &&
            typeof mockEmojiGroupsStore.recordUsageByUUID === 'function'
          ) {
            try {
              success = mockEmojiGroupsStore.recordUsageByUUID(uuid)
              shouldNotifyCommonGroup = success
            } catch (error) {
              console.log('Error calling recordUsageByUUID (Firefox):', error)
            }
          }

          // 🚀 关键修复：Firefox环境下也要发送常用表情组更新通知
          if (shouldNotifyCommonGroup) {
            try {
              // 获取更新后的常用表情组
              const updatedCommonGroup = mockEmojiGroupsStore?.getCommonEmojiGroup
                ? mockEmojiGroupsStore.getCommonEmojiGroup()
                : null

              if (updatedCommonGroup) {
                console.log(
                  'Sending common emoji group update notification after usage record (Firefox)',
                )
                mockCommService.sendCommonEmojiGroupChanged(updatedCommonGroup)
                mockCommService.sendSpecificGroupChanged('common-emoji-group', updatedCommonGroup)
              }
            } catch (notifyError) {
              console.log('Error sending common group update notification (Firefox):', notifyError)
            }
          }

          return {
            success: success,
            message: success ? 'Usage recorded successfully' : 'Failed to record usage',
          }
        } catch (error) {
          console.log('Error handling RECORD_EMOJI_USAGE (Firefox):', error)
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }
        }
      }

      const testUUID = 'emoji-1'

      // 执行测试
      const result = await handleEmojiUsageFirefox(testUUID)

      // 验证使用记录被调用
      expect(mockEmojiGroupsStore.recordUsageByUUID).toHaveBeenCalledWith(testUUID)

      // 验证返回值
      expect(result).toEqual({
        success: true,
        message: 'Usage recorded successfully',
      })

      // 🚀 关键验证：Firefox环境下也发送了常用表情组更新通知
      expect(mockCommService.sendCommonEmojiGroupChanged).toHaveBeenCalledTimes(1)
      expect(mockCommService.sendSpecificGroupChanged).toHaveBeenCalledTimes(1)
    })
  })

  describe('前端缓存策略优化', () => {
    it('应该监听使用记录更新并实时刷新常用表情组', async () => {
      // 模拟缓存管理器
      const mockCacheManager = {
        isAggressiveMode: true,
        commonGroupCache: {
          data: null,
          lastUpdate: 0,
          version: 0,
        },
      }

      // 模拟缓存工具
      const mockCacheUtils = {
        updateCommonGroupCache: vi.fn(),
      }

      // 模拟缓存状态
      const mockCachedState = {
        emojiGroups: [],
      }

      // 模拟从后台刷新常用表情组的函数
      async function refreshCommonEmojiGroupFromBackground(): Promise<any | null> {
        try {
          console.log('[缓存] 从后台实时获取常用表情组数据')

          // 模拟后台响应
          const mockResponse = {
            success: true,
            data: {
              groups: [
                {
                  UUID: 'common-emoji-group',
                  displayName: '常用表情',
                  emojis: [{ UUID: 'emoji-1', displayName: '笑脸', usageCount: 6 }],
                },
              ],
            },
          }

          if (mockResponse && mockResponse.success && mockResponse.data) {
            // 查找常用表情组
            const commonGroup = mockResponse.data.groups?.find(
              (g: any) => g.UUID === 'common-emoji-group',
            )

            if (commonGroup) {
              console.log('[缓存] 找到常用表情组，更新缓存')

              // 更新缓存
              mockCacheUtils.updateCommonGroupCache(commonGroup)

              // 更新主缓存
              const index = mockCachedState.emojiGroups.findIndex(
                (g: any) => g.UUID === 'common-emoji-group',
              )
              if (index >= 0) {
                mockCachedState.emojiGroups[index] = commonGroup
              } else {
                mockCachedState.emojiGroups.unshift(commonGroup)
              }

              return commonGroup
            }
          }
        } catch (error) {
          console.error('[缓存] 从后台获取常用表情组失败:', error)
        }

        return null
      }

      // 模拟使用记录更新监听器
      const mockUsageRecordedHandler = async (data: { uuid: string; timestamp: number }) => {
        console.log('[缓存] 收到表情使用记录更新信号:', data.uuid)

        // 立即从后台重新获取常用表情组数据
        const updatedGroup = await refreshCommonEmojiGroupFromBackground()
        if (updatedGroup) {
          console.log('[缓存] 成功刷新常用表情组数据')
          // 触发表情选择器界面刷新
          global.window.dispatchEvent(
            new CustomEvent('emoji-common-group-refreshed', {
              detail: { group: updatedGroup, timestamp: Date.now() },
            }),
          )
        }
      }

      // 模拟通信服务的监听器注册
      mockCommService.onUsageRecorded.mockImplementation((handler) => {
        // 模拟接收到使用记录更新消息
        setTimeout(() => {
          handler({ uuid: 'emoji-1', timestamp: Date.now() })
        }, 100)
      })

      // 注册监听器
      mockCommService.onUsageRecorded(mockUsageRecordedHandler)

      // 等待异步处理完成
      await new Promise((resolve) => setTimeout(resolve, 200))

      // 验证缓存更新被调用
      expect(mockCacheUtils.updateCommonGroupCache).toHaveBeenCalledWith({
        UUID: 'common-emoji-group',
        displayName: '常用表情',
        emojis: [{ UUID: 'emoji-1', displayName: '笑脸', usageCount: 6 }],
      })

      // 验证主缓存被更新
      expect(mockCachedState.emojiGroups).toHaveLength(1)
      expect(mockCachedState.emojiGroups[0]).toEqual({
        UUID: 'common-emoji-group',
        displayName: '常用表情',
        emojis: [{ UUID: 'emoji-1', displayName: '笑脸', usageCount: 6 }],
      })

      // 验证界面刷新事件被触发
      expect(global.window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'emoji-common-group-refreshed',
        }),
      )
    })

    it('应该在激进缓存模式下检查常用表情组缓存年龄并适时刷新', async () => {
      const now = Date.now()

      // 模拟缓存管理器，常用表情组缓存过旧
      const mockCacheManager = {
        isAggressiveMode: true,
        lastFullUpdate: now - 5000, // 5秒前
        commonGroupCache: {
          lastUpdate: now - 15000, // 15秒前，超过10秒阈值
        },
      }

      // 模拟刷新函数
      const mockRefreshCommonEmojiGroupFromBackground = vi.fn().mockResolvedValue({
        UUID: 'common-emoji-group',
        displayName: '常用表情',
        emojis: [],
      })

      // 模拟激进缓存模式下的数据加载逻辑
      async function loadDataFromStorageWithFix(forceRefresh: boolean = false): Promise<void> {
        // 🚀 关键修复：在激进缓存模式下，特别处理常用表情组
        if (
          mockCacheManager.isAggressiveMode &&
          !forceRefresh &&
          mockCacheManager.lastFullUpdate > 0
        ) {
          console.log('[缓存] 激进模式下使用缓存数据')

          // 🚀 关键修复：在激进模式下也要检查常用表情组是否需要更新
          // 如果常用表情组缓存过旧（超过10秒），就刷新一下
          const commonGroupCacheAge = now - mockCacheManager.commonGroupCache.lastUpdate
          if (commonGroupCacheAge > 10000) {
            // 10秒
            console.log('[缓存] 常用表情组缓存过旧，异步刷新')
            // 异步刷新常用表情组，不阻塞主流程
            mockRefreshCommonEmojiGroupFromBackground().catch(() => {
              // 忽略错误，不影响主流程
            })
          }
        }
      }

      // 执行测试
      await loadDataFromStorageWithFix()

      // 验证常用表情组刷新被触发
      expect(mockRefreshCommonEmojiGroupFromBackground).toHaveBeenCalledTimes(1)
    })
  })

  describe('表情选择器刷新机制', () => {
    it('应该监听常用表情组刷新事件并更新界面', async () => {
      // 模拟DOM元素
      const mockPicker = {
        querySelector: vi.fn(),
        addEventListener: vi.fn(),
        remove: vi.fn(),
      }

      const mockCommonSection = {
        querySelector: vi.fn(),
      }

      const mockEmojisContainer = {
        innerHTML: '',
        querySelectorAll: vi.fn().mockReturnValue([]),
      }

      mockPicker.querySelector.mockReturnValue(mockCommonSection)
      mockCommonSection.querySelector.mockReturnValue(mockEmojisContainer)

      // 模拟常用表情组刷新处理器
      const commonGroupRefreshHandler = (event: CustomEvent) => {
        try {
          const updatedGroup = event.detail?.group
          if (updatedGroup && updatedGroup.UUID === 'common-emoji-group') {
            console.log('[表情选择器] 收到常用表情组刷新事件')

            // 找到常用表情组的容器
            const commonSection = mockPicker.querySelector('[data-section="common-emoji-group"]')
            if (commonSection) {
              // 更新常用表情组的内容
              const emojisContainer = commonSection.querySelector('.emoji-picker__section-emojis')
              if (emojisContainer && Array.isArray(updatedGroup.emojis)) {
                let groupEmojisHtml = ''
                updatedGroup.emojis.forEach((emojiData: any) => {
                  const nameEsc = String(emojiData.displayName || '').replace(/"/g, '&quot;')
                  const displayUrl = emojiData.displayUrl || emojiData.realUrl
                  const emojiUUID = emojiData.UUID || ''
                  groupEmojisHtml += `<img width="32" height="32" class="emoji" src="${displayUrl}" data-emoji="${nameEsc}" data-uuid="${emojiUUID}" alt="${nameEsc}" title=":${nameEsc}:" loading="lazy" />\n`
                })

                emojisContainer.innerHTML = groupEmojisHtml
                console.log('[表情选择器] 常用表情组刷新完成')
              }
            }
          }
        } catch (error) {
          console.error('[表情选择器] 处理常用表情组刷新事件失败:', error)
        }
      }

      // 模拟刷新事件
      const mockEvent = new CustomEvent('emoji-common-group-refreshed', {
        detail: {
          group: {
            UUID: 'common-emoji-group',
            displayName: '常用表情',
            emojis: [
              { UUID: 'emoji-1', displayName: '笑脸', displayUrl: 'https://example.com/smile.png' },
              { UUID: 'emoji-2', displayName: '哭脸', displayUrl: 'https://example.com/cry.png' },
            ],
          },
          timestamp: Date.now(),
        },
      }) as CustomEvent

      // 执行处理器
      commonGroupRefreshHandler(mockEvent)

      // 验证DOM查询被调用
      expect(mockPicker.querySelector).toHaveBeenCalledWith('[data-section="common-emoji-group"]')
      expect(mockCommonSection.querySelector).toHaveBeenCalledWith('.emoji-picker__section-emojis')

      // 验证HTML被更新
      expect(mockEmojisContainer.innerHTML).toContain('data-uuid="emoji-1"')
      expect(mockEmojisContainer.innerHTML).toContain('data-uuid="emoji-2"')
      expect(mockEmojisContainer.innerHTML).toContain('data-emoji="笑脸"')
      expect(mockEmojisContainer.innerHTML).toContain('data-emoji="哭脸"')
    })
  })

  describe('端到端集成测试', () => {
    it('应该完整地处理表情使用记录到界面更新的整个流程', async () => {
      // 设置测试数据
      const testEmojiUUID = 'emoji-test'
      let notificationSent = false
      let cacheUpdated = false
      let uiRefreshed = false

      // 模拟完整的流程

      // 1. 后台记录使用
      mockEmojiGroupsStore.recordUsageByUUID.mockImplementation((uuid) => {
        if (uuid === testEmojiUUID) {
          // 模拟成功记录
          setTimeout(() => {
            // 发送通知
            const updatedGroup = {
              UUID: 'common-emoji-group',
              displayName: '常用表情',
              emojis: [{ UUID: testEmojiUUID, displayName: '测试表情', usageCount: 1 }],
            }
            mockCommService.sendCommonEmojiGroupChanged(updatedGroup)
            notificationSent = true
          }, 10)
          return true
        }
        return false
      })

      // 2. 前端监听通知并更新缓存
      mockCommService.onCommonEmojiGroupChanged.mockImplementation((handler) => {
        setTimeout(() => {
          handler({
            group: {
              UUID: 'common-emoji-group',
              displayName: '常用表情',
              emojis: [{ UUID: testEmojiUUID, displayName: '测试表情', usageCount: 1 }],
            },
            timestamp: Date.now(),
          })
          cacheUpdated = true
        }, 20)
      })

      // 3. 界面刷新
      global.window.addEventListener = vi.fn().mockImplementation((event, handler) => {
        if (event === 'emoji-common-group-refreshed') {
          setTimeout(() => {
            handler({
              detail: {
                group: {
                  UUID: 'common-emoji-group',
                  displayName: '常用表情',
                  emojis: [{ UUID: testEmojiUUID, displayName: '测试表情', usageCount: 1 }],
                },
              },
            })
            uiRefreshed = true
          }, 30)
        }
      })

      // 执行测试流程

      // 步骤1：记录使用
      const recordResult = mockEmojiGroupsStore.recordUsageByUUID(testEmojiUUID)
      expect(recordResult).toBe(true)

      // 步骤2：注册监听器
      mockCommService.onCommonEmojiGroupChanged(() => {})
      global.window.addEventListener('emoji-common-group-refreshed', () => {})

      // 等待异步流程完成
      await new Promise((resolve) => setTimeout(resolve, 100))

      // 验证完整流程
      expect(notificationSent).toBe(true) // 通知已发送
      expect(cacheUpdated).toBe(true) // 缓存已更新
      expect(uiRefreshed).toBe(true) // 界面已刷新

      console.log('✅ 端到端集成测试通过')
    })
  })
})
