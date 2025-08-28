// background/handlers/emoji-handlers.ts - 表情相关处理器

import { loadFromChromeStorage } from '../utils/storage-utils'
import { ensureCommonEmojiGroup } from '../utils/common-group-utils'

declare const chrome: any
declare const browser: any

function log(...args: any[]) {
  try {
    console.log('[background:emoji-handlers]', ...args)
  } catch (_) {}
}

/**
 * 通用的表情使用计数更新逻辑
 * @param uuid 表情的UUID
 * @param freshData 从存储加载的新鲜数据
 * @returns {boolean} 是否成功找到并更新了表情
 */
export function updateEmojiUsageInData(uuid: string, freshData: any): boolean {
  if (!freshData || !freshData.emojiGroups) {
    return false
  }

  // Find and update the emoji in the data
  for (const group of freshData.emojiGroups) {
    if (group.emojis && Array.isArray(group.emojis)) {
      for (const emoji of group.emojis) {
        if (emoji.UUID === uuid) {
          const now = Date.now()
          if (!emoji.lastUsed) {
            emoji.usageCount = 1
            emoji.lastUsed = now
          } else {
            const days = Math.floor((now - (emoji.lastUsed || 0)) / (24 * 60 * 60 * 1000))
            if (days >= 1 && typeof emoji.usageCount === 'number') {
              emoji.usageCount = Math.floor(emoji.usageCount * Math.pow(0.8, days))
            }
            emoji.usageCount = (emoji.usageCount || 0) + 1
            emoji.lastUsed = now
          }
          return true
        }
      }
    }
  }
  return false
}

/**
 * Chrome环境下的表情使用记录处理函数（主要用于桌面端）
 * @param uuid 表情UUID
 * @param sendResponse 响应回调函数
 * @param emojiGroupsStore 表情组存储实例
 * @param commService 通信服务实例
 * @param lastPayloadGlobal 全局缓存的最后负载
 */
export async function handleEmojiUsageChrome(
  uuid: string, 
  sendResponse: (resp: any) => void,
  emojiGroupsStore: any,
  commService: any,
  lastPayloadGlobal: any
) {
  try {
    log('Recording emoji usage for UUID (Chrome):', uuid)
    let success = false
    let shouldNotifyCommonGroup = false

    // Try to use emoji groups store if available
    if (emojiGroupsStore && typeof emojiGroupsStore.recordUsageByUUID === 'function') {
      try {
        success = emojiGroupsStore.recordUsageByUUID(uuid)
        log('recordUsageByUUID result (Chrome):', success)
        shouldNotifyCommonGroup = success
      } catch (error) {
        log('Error calling recordUsageByUUID (Chrome):', error)
      }
    }

    // If direct store call failed, try to load fresh data and update
    if (!success) {
      try {
        const freshData: any = await loadFromChromeStorage()
        if (updateEmojiUsageInData(uuid, freshData)) {
          // Save back to storage using Chrome API
          try {
            if (chrome.storage && chrome.storage.local && chrome.storage.local.set) {
              const saveData: any = {}
              freshData.emojiGroups.forEach((group: any) => {
                // 使用正确的存储键名
                if (group.UUID === 'common-emoji-group') {
                  saveData['emojiGroups-common'] = group
                } else {
                  saveData[`emojiGroups-${group.UUID}`] = group
                }
              })
              chrome.storage.local.set(saveData, () => {
                if (chrome.runtime.lastError) {
                  log('Error saving emoji usage update (Chrome):', chrome.runtime.lastError)
                  sendResponse({
                    success: false,
                    error: 'Failed to save to Chrome storage',
                  })
                } else {
                  log('Successfully saved emoji usage update (Chrome)')
                  // Update global cache
                  lastPayloadGlobal = freshData
                  success = true
                  shouldNotifyCommonGroup = true

                  // 发送响应
                  sendResponse({
                    success: true,
                    message: 'Usage recorded successfully',
                  })

                  // 🚀 关键修复：使用记录更新后，通知常用表情组变更
                  if (shouldNotifyCommonGroup) {
                    try {
                      // 获取更新后的常用表情组
                      const updatedCommonGroup = emojiGroupsStore?.getCommonEmojiGroup
                        ? emojiGroupsStore.getCommonEmojiGroup()
                        : null

                      if (updatedCommonGroup) {
                        log('Sending common emoji group update notification after usage record')
                        commService.sendCommonEmojiGroupChanged(updatedCommonGroup)
                        commService.sendSpecificGroupChanged(
                          'common-emoji-group',
                          updatedCommonGroup,
                        )
                      }
                    } catch (notifyError) {
                      log('Error sending common group update notification:', notifyError)
                    }
                  }
                }
              })
              return // Early return to avoid double response
            }
          } catch (saveError) {
            log('Error saving emoji usage (Chrome):', saveError)
          }
        }
      } catch (error) {
        log('Error updating emoji usage in fresh data (Chrome):', error)
      }
    }

    // Send response if not already sent
    sendResponse({
      success: success,
      message: success ? 'Usage recorded successfully' : 'Failed to record usage',
    })

    // 🚀 关键修复：如果通过 store 更新成功，也要发送通知
    if (shouldNotifyCommonGroup) {
      try {
        // 获取更新后的常用表情组
        const updatedCommonGroup = emojiGroupsStore?.getCommonEmojiGroup
          ? emojiGroupsStore.getCommonEmojiGroup()
          : null

        if (updatedCommonGroup) {
          log('Sending common emoji group update notification after store usage record')
          commService.sendCommonEmojiGroupChanged(updatedCommonGroup)
          commService.sendSpecificGroupChanged('common-emoji-group', updatedCommonGroup)
        }
      } catch (notifyError) {
        log('Error sending common group update notification:', notifyError)
      }
    }
  } catch (error) {
    log('Error handling RECORD_EMOJI_USAGE (Chrome):', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Firefox环境下的表情使用记录处理函数（主要用于移动端）
 * @param uuid 表情UUID
 * @param emojiGroupsStore 表情组存储实例
 * @param commService 通信服务实例
 * @param lastPayloadGlobal 全局缓存的最后负载
 * @returns Promise<object> 响应对象
 */
export async function handleEmojiUsageFirefox(
  uuid: string,
  emojiGroupsStore: any,
  commService: any,
  lastPayloadGlobal: any
): Promise<object> {
  try {
    log('Recording emoji usage for UUID (Firefox):', uuid)
    let success = false
    let shouldNotifyCommonGroup = false

    // Try to use emoji groups store if available
    if (emojiGroupsStore && typeof emojiGroupsStore.recordUsageByUUID === 'function') {
      try {
        success = emojiGroupsStore.recordUsageByUUID(uuid)
        log('recordUsageByUUID result (Firefox):', success)
        shouldNotifyCommonGroup = success
      } catch (error) {
        log('Error calling recordUsageByUUID (Firefox):', error)
      }
    }

    // If direct store call failed, try to load fresh data and update
    if (!success) {
      try {
        const freshData: any = await loadFromChromeStorage()
        if (updateEmojiUsageInData(uuid, freshData)) {
          // Save back to storage using Firefox API
          try {
            if (browser.storage && browser.storage.local && browser.storage.local.set) {
              const saveData: any = {}
              freshData.emojiGroups.forEach((group: any) => {
                // 使用正确的存储键名
                if (group.UUID === 'common-emoji-group') {
                  saveData['emojiGroups-common'] = group
                } else {
                  saveData[`emojiGroups-${group.UUID}`] = group
                }
              })
              await browser.storage.local.set(saveData)
              log('Successfully saved emoji usage update (Firefox)')
              success = true
              shouldNotifyCommonGroup = true
              // Update global cache
              lastPayloadGlobal = freshData
            }
          } catch (saveError) {
            log('Error saving emoji usage (Firefox):', saveError)
          }
        }
      } catch (error) {
        log('Error updating emoji usage in fresh data (Firefox):', error)
      }
    }

    // 🚀 关键修复：Firefox环境下也要发送常用表情组更新通知
    if (shouldNotifyCommonGroup) {
      try {
        // 获取更新后的常用表情组
        const updatedCommonGroup = emojiGroupsStore?.getCommonEmojiGroup
          ? emojiGroupsStore.getCommonEmojiGroup()
          : null

        if (updatedCommonGroup) {
          log('Sending common emoji group update notification after usage record (Firefox)')
          commService.sendCommonEmojiGroupChanged(updatedCommonGroup)
          commService.sendSpecificGroupChanged('common-emoji-group', updatedCommonGroup)
        }
      } catch (notifyError) {
        log('Error sending common group update notification (Firefox):', notifyError)
      }
    }

    return {
      success: success,
      message: success ? 'Usage recorded successfully' : 'Failed to record usage',
    }
  } catch (error) {
    log('Error handling RECORD_EMOJI_USAGE (Firefox):', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * 处理获取表情数据的请求
 * @param emojiGroupsStore 表情组存储实例
 * @param settingsStore 设置存储实例  
 * @param lastPayloadGlobal 全局缓存的最后负载
 * @returns Promise<object> 响应对象
 */
export async function handleGetEmojiData(
  emojiGroupsStore: any,
  settingsStore: any,
  lastPayloadGlobal: any
): Promise<object> {
  try {
    let groups = []
    let settings = {}
    let ungroupedEmojis = []

    // First try to get from global cache
    if (lastPayloadGlobal) {
      groups = lastPayloadGlobal.emojiGroups || []
      settings = lastPayloadGlobal.Settings || {}
      ungroupedEmojis = lastPayloadGlobal.ungrouped || []
    } else if (emojiGroupsStore && settingsStore) {
      try {
        groups = emojiGroupsStore.getEmojiGroups() || []
        settings = settingsStore.getSettings() || {}
        ungroupedEmojis = emojiGroupsStore.getUngrouped() || []
      } catch (_) {}
    }

    // If no data found, try loading directly from chrome storage
    if (groups.length === 0) {
      try {
        const freshData: any = await loadFromChromeStorage()
        if (freshData && freshData.emojiGroups) {
          // 确保常用表情组存在
          const ensuredData = ensureCommonEmojiGroup(freshData)
          groups = ensuredData.emojiGroups || []
          settings = ensuredData.Settings || {}
          ungroupedEmojis = ensuredData.ungrouped || []
          // Update cache
          lastPayloadGlobal = ensuredData
          log('Refreshed data from chrome storage for GET_EMOJI_DATA')
        }
      } catch (err) {
        log('Failed to refresh from chrome storage:', err)
      }
    }

    // 最后确保 groups 中包含常用表情组
    if (groups.length > 0) {
      const hasCommonGroup = groups.some((g: any) => g.UUID === 'common-emoji-group')
      if (!hasCommonGroup) {
        const commonGroup = {
          UUID: 'common-emoji-group',
          id: 'common-emoji-group',
          displayName: '常用',
          icon: '⭐',
          order: 0,
          emojis: [],
          originalId: 'favorites'
        }
        groups.unshift(commonGroup)
        log('补充了常用表情组到响应数据中')
      }
    }

    // 使用新的分离接口返回数据
    let normalGroups = groups
    let commonEmojiGroup = null
    let hotEmojis = []

    try {
      if (emojiGroupsStore && emojiGroupsStore.getNormalGroups) {
        normalGroups = emojiGroupsStore.getNormalGroups()
      }
      if (emojiGroupsStore && emojiGroupsStore.getCommonEmojiGroup) {
        commonEmojiGroup = emojiGroupsStore.getCommonEmojiGroup()
      }
      if (emojiGroupsStore && emojiGroupsStore.getHotEmojis) {
        hotEmojis = emojiGroupsStore.getHotEmojis()
      }
    } catch (err) {
      // 如果新接口不可用，使用简单过滤
      normalGroups = groups.filter((g: any) => g.UUID !== 'common-emoji-group')
      commonEmojiGroup = groups.find((g: any) => g.UUID === 'common-emoji-group') || null
    }

    return {
      success: true,
      data: {
        groups, // 保持原始完整数据以兼容
        normalGroups, // 新增：普通分组
        commonEmojiGroup, // 新增：常用表情分组
        hotEmojis, // 新增：热门表情
        settings,
        ungroupedEmojis,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}