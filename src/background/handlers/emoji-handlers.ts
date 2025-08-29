/* eslint-disable no-unused-vars */
// background/handlers/emoji-handlers.ts - 表情相关处理器

import { loadFromChromeStorage } from '../utils/storage-utils'
import { ensureCommonEmojiGroup } from '../utils/common-group-utils'

// 精确化 chrome/browser 的最小声明，避免使用 any
declare const chrome: {
  storage?: {
    local?: {
      // chrome.storage.local.set(items, callback)
      set?(_items: Record<string, unknown>, callback?: () => void): void
    }
  }
  runtime?: {
    lastError?: unknown
  }
}

declare const browser: {
  storage?: {
    local?: {
      // browser.storage.local.set 返回 Promise
      set?(_items: Record<string, unknown>): Promise<void>
    }
  }
}

// 新增接口：避免使用 any，列出文件中实际调用到的方法（可选方法用 ?）
interface EmojiGroupsStore {
  // 记录使用，返回是否成功
  recordUsageByUUID(uuid: string): boolean
  // 查找表情及其所在分组
  findEmojiByUUID?(uuid: string): { emoji: any; group: any } | null
  // 将最新数据设置到缓存
  setCache?(data: any): void
  // 获取常用分组
  getCommonEmojiGroup?(): any
  // 通过 UUID 查找分组
  findGroupByUUID?(uuid: string): any
  // 获取全部分组
  getEmojiGroups?(): any[]
  // 新接口：普通分组
  getNormalGroups?(): any[]
  // 新接口：热门表情
  getHotEmojis?(): any[]
  // 未分组表情
  getUngrouped?(): any[]
}

interface CommunicationService {
  sendCommonEmojiGroupChanged(group: any): void
  sendSpecificGroupChanged(groupUUID: string, group: any): void
  sendUsageRecorded(uuid: string): void
}

interface SettingsStore {
  getSettings(): any
}

// 新增：为响应回调定义类型别名，避免在函数类型里命名参数导致未使用警告
type ResponseCallback = (
  response?: { success?: boolean; message?: string; error?: string } | null,
) => void

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

  let updatedGroupUUID = null // 记录被更新的表情所在的组UUID

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
          updatedGroupUUID = group.UUID // 记录被更新的组
          break
        }
      }
    }
    if (updatedGroupUUID) break // 找到并更新后退出循环
  }

  return updatedGroupUUID !== null
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
  _resp: ResponseCallback | null, // 使用类型别名，移除内联命名参数以避免未使用报错
  emojiGroupsStore: EmojiGroupsStore | null,
  commService: CommunicationService,

  _lastPayloadGlobal: unknown, // 重命名并改为 unknown
) {
  try {
    log('Recording emoji usage for UUID (Chrome):', uuid)
    let success = false
    let shouldNotifyCommonGroup = false
    let updatedGroupUUID = null // 记录被更新的表情所在的组UUID
    let emojiInfo = null // 记录表情信息用于日志

    // Try to use emoji groups store if available
    if (emojiGroupsStore && typeof emojiGroupsStore.recordUsageByUUID === 'function') {
      try {
        // 🚀 关键修复：先查找表情信息用于日志和通知
        if (typeof emojiGroupsStore.findEmojiByUUID === 'function') {
          const found = emojiGroupsStore.findEmojiByUUID(uuid)
          if (found && found.emoji && found.group) {
            emojiInfo = {
              name: found.emoji.displayName,
              groupUUID: found.group.UUID,
              oldUsageCount: found.emoji.usageCount || 0,
            }
            updatedGroupUUID = found.group.UUID
            log('Found emoji before update (Chrome):', emojiInfo)
          }
        }

        success = emojiGroupsStore.recordUsageByUUID(uuid)
        log('recordUsageByUUID result (Chrome):', success)

        if (success && emojiInfo) {
          shouldNotifyCommonGroup = true
          log('Successfully updated emoji usage (Chrome):', {
            uuid,
            name: emojiInfo.name,
            groupUUID: emojiInfo.groupUUID,
            oldCount: emojiInfo.oldUsageCount,
          })
        }
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
                if (chrome.runtime && chrome.runtime.lastError) {
                  log('Error saving emoji usage update (Chrome):', chrome.runtime.lastError)
                  // 安全调用，避免 _resp 为 null 时调用
                  _resp?.({
                    success: false,
                    error: 'Failed to save to Chrome storage',
                  })
                } else {
                  log('Successfully saved emoji usage update (Chrome)')
                  // 不再直接赋值到入参，改为通过 store 更新缓存（若提供）
                  try {
                    if (emojiGroupsStore && typeof emojiGroupsStore.setCache === 'function') {
                      emojiGroupsStore.setCache(freshData)
                    }
                  } catch (cacheErr) {
                    log('Error updating store cache after Chrome save:', cacheErr)
                  }
                  success = true
                  shouldNotifyCommonGroup = true

                  // 发送响应
                  // 安全调用
                  _resp?.({
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
    // 安全调用，避免可能为 null
    _resp?.({
      success: success,
      message: success ? 'Usage recorded successfully' : 'Failed to record usage',
    })

    // 🚀 关键修复：如果通过 store 更新成功，也要发送通知
    if (shouldNotifyCommonGroup) {
      try {
        log('Sending usage recorded notification (Chrome):', { uuid, emojiInfo })

        // 发送使用记录通知
        commService.sendUsageRecorded(uuid)

        // 获取更新后的常用表情组
        const updatedCommonGroup = emojiGroupsStore?.getCommonEmojiGroup
          ? emojiGroupsStore.getCommonEmojiGroup()
          : null

        if (updatedCommonGroup) {
          log('Sending common emoji group update notification after store usage record')
          commService.sendCommonEmojiGroupChanged(updatedCommonGroup)
          commService.sendSpecificGroupChanged('common-emoji-group', updatedCommonGroup)
        }

        // 如果更新的不是常用表情组，也发送特定组的更新通知
        if (updatedGroupUUID && updatedGroupUUID !== 'common-emoji-group') {
          try {
            const updatedGroup = emojiGroupsStore?.findGroupByUUID
              ? emojiGroupsStore.findGroupByUUID(updatedGroupUUID)
              : null
            if (updatedGroup) {
              log('Sending specific group update notification (Chrome):', updatedGroupUUID)
              commService.sendSpecificGroupChanged(updatedGroupUUID, updatedGroup)
            }
          } catch (groupError) {
            log('Error sending specific group notification (Chrome):', groupError)
          }
        }
      } catch (notifyError) {
        log('Error sending common group update notification:', notifyError)
      }
    }
  } catch (error) {
    log('Error handling RECORD_EMOJI_USAGE (Chrome):', error)
    // 保留原有的空值检查风格（等价）
    _resp &&
      _resp({
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
  emojiGroupsStore: EmojiGroupsStore | null,
  commService: CommunicationService,
  _lastPayloadGlobal: unknown, // 重命名并改为 unknown
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
              // 不再直接赋值到入参，改为通过 store 更新缓存（若提供）
              try {
                if (emojiGroupsStore && typeof emojiGroupsStore.setCache === 'function') {
                  emojiGroupsStore.setCache(freshData)
                }
              } catch (cacheErr) {
                log('Error updating store cache after Firefox save:', cacheErr)
              }
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
  emojiGroupsStore: EmojiGroupsStore | null,
  settingsStore: SettingsStore | null,
  _lastPayloadGlobal: unknown, // 重命名并改为 unknown
): Promise<object> {
  try {
    let groups = []
    let settings = {}
    let ungroupedEmojis = []

    // First try to get from global cache
    if (
      _lastPayloadGlobal &&
      typeof _lastPayloadGlobal === 'object' &&
      _lastPayloadGlobal !== null
    ) {
      const cached = _lastPayloadGlobal as {
        emojiGroups?: unknown
        Settings?: unknown
        ungrouped?: unknown
      }
      groups = (cached.emojiGroups as any) || []
      settings = (cached.Settings as any) || {}
      ungroupedEmojis = (cached.ungrouped as any) || []
    } else if (emojiGroupsStore && settingsStore) {
      try {
        // 安全调用：先判断方法是否存在并且是函数，避免 "不能调用可能是未定义的对象" 的编译/运行错误
        if (typeof emojiGroupsStore.getEmojiGroups === 'function') {
          groups = emojiGroupsStore.getEmojiGroups() || []
        } else {
          groups = []
        }

        if (typeof settingsStore.getSettings === 'function') {
          settings = settingsStore.getSettings() || {}
        } else {
          settings = {}
        }

        if (typeof emojiGroupsStore.getUngrouped === 'function') {
          ungroupedEmojis = emojiGroupsStore.getUngrouped() || []
        } else {
          ungroupedEmojis = []
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
          // 不再直接赋值到入参，改为通过 store 更新缓存（若提供）
          try {
            if (emojiGroupsStore && typeof emojiGroupsStore.setCache === 'function') {
              emojiGroupsStore.setCache(ensuredData)
            }
          } catch (cacheErr) {
            log('Error updating store cache after GET_EMOJI_DATA refresh:', cacheErr)
          }
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
          originalId: 'favorites',
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
