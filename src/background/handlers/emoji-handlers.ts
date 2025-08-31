/* eslint-disable no-unused-vars */
// background/handlers/emoji-handlers.ts - 表情相关处理器

import type { BackgroundDataManager } from '../data-manager'

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

interface CommunicationService {
  sendCommonEmojiGroupChanged(group: any): void
  sendCommonEmojiUpdated(group: any): void
  sendSpecificGroupChanged(groupUUID: string, group: any): void
  sendUsageRecorded(uuid: string): void
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
 * Chrome环境下的表情使用记录处理函数（主要用于桌面端）
 * @param uuid 表情UUID
 * @param sendResponse 响应回调函数
 * @param dataManager 全局数据管理器
 * @param commService 通信服务实例
 */
export async function handleEmojiUsageChrome(
  uuid: string,
  _resp: ResponseCallback | null,
  dataManager: BackgroundDataManager,
  commService: CommunicationService,
) {
  try {
    log('🎯 Recording emoji usage for UUID (Chrome):', uuid)
    
    // 确保数据已加载
    await dataManager.waitForData()
    
    // 通过数据管理器记录使用
    const success = await dataManager.recordEmojiUsage(uuid)
    
    // 发送响应
    _resp?.({
      success: success,
      message: success ? 'Usage recorded successfully' : 'Failed to record usage',
    })

    if (success) {
      log('✅ Successfully recorded emoji usage (Chrome):', uuid)
      
      // 发送使用记录通知
      commService.sendUsageRecorded(uuid)
      
      // 获取更新后的数据并广播
      const data = dataManager.getData()
      
      // 查找常用表情组并发送更新通知
      const commonGroup = data.emojiGroups.find((g: any) => g.UUID === 'common-emoji-group')
      if (commonGroup) {
        log('📡 Broadcasting common emoji group update (Chrome)')
        commService.sendCommonEmojiGroupChanged(commonGroup)
        commService.sendSpecificGroupChanged('common-emoji-group', commonGroup)
      }
    } else {
      log('❌ Failed to record emoji usage (Chrome):', uuid)
    }
  } catch (error) {
    log('❌ Error handling RECORD_EMOJI_USAGE (Chrome):', error)
    _resp?.({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Firefox环境下的表情使用记录处理函数（主要用于移动端）
 * @param uuid 表情UUID
 * @param dataManager 全局数据管理器
 * @param commService 通信服务实例
 * @returns Promise<object> 响应对象
 */
export async function handleEmojiUsageFirefox(
  uuid: string,
  dataManager: BackgroundDataManager,
  commService: CommunicationService,
): Promise<object> {
  try {
    log('🎯 Recording emoji usage for UUID (Firefox):', uuid)
    
    // 确保数据已加载
    await dataManager.waitForData()
    
    // 通过数据管理器记录使用
    const success = await dataManager.recordEmojiUsage(uuid)

    if (success) {
      log('✅ Successfully recorded emoji usage (Firefox):', uuid)
      
      // 发送使用记录通知
      commService.sendUsageRecorded(uuid)
      
      // 获取更新后的数据并广播
      const data = dataManager.getData()
      
      // 查找常用表情组并发送更新通知
      const commonGroup = data.emojiGroups.find((g: any) => g.UUID === 'common-emoji-group')
      if (commonGroup) {
        log('📡 Broadcasting common emoji group update (Firefox)')
        commService.sendCommonEmojiGroupChanged(commonGroup)
        commService.sendSpecificGroupChanged('common-emoji-group', commonGroup)
      }
    } else {
      log('❌ Failed to record emoji usage (Firefox):', uuid)
    }

    return {
      success: success,
      message: success ? 'Usage recorded successfully' : 'Failed to record usage',
    }
  } catch (error) {
    log('❌ Error handling RECORD_EMOJI_USAGE (Firefox):', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * 处理获取表情数据的请求
 * @param dataManager 全局数据管理器
 * @returns Promise<object> 响应对象
 */
export async function handleGetEmojiData(
  dataManager: BackgroundDataManager,
): Promise<object> {
  try {
    log('🔍 Handling GET_EMOJI_DATA request')
    
    // 确保数据已加载
    await dataManager.waitForData()
    
    // 获取最新数据
    const data = dataManager.getData()
    const stats = dataManager.getStats()
    
    log('📊 Returning emoji data:', {
      groupsCount: stats.groupsCount,
      emojisCount: stats.emojisCount,
      ungroupedCount: stats.ungroupedCount,
      isLoaded: stats.isLoaded,
      dataAge: stats.dataAge
    })

    // 确保常用表情组存在
    let emojiGroups = [...data.emojiGroups]
    const hasCommonGroup = emojiGroups.some((g: any) => g.UUID === 'common-emoji-group')
    
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
      emojiGroups.unshift(commonGroup)
      log('📌 Added default common emoji group to response')
    }

    // 分离不同类型的数据
    const normalGroups = emojiGroups.filter((g: any) => g.UUID !== 'common-emoji-group')
    const commonEmojiGroup = emojiGroups.find((g: any) => g.UUID === 'common-emoji-group') || null
    
    // 计算热门表情（基于使用次数）
    const hotEmojis: any[] = []
    emojiGroups.forEach((group: any) => {
      if (group.emojis && Array.isArray(group.emojis)) {
        group.emojis.forEach((emoji: any) => {
          if (emoji.usageCount && emoji.usageCount > 0) {
            hotEmojis.push({
              ...emoji,
              groupUUID: group.UUID
            })
          }
        })
      }
    })
    
    // 添加未分组表情中的热门表情
    if (data.ungroupedEmojis && Array.isArray(data.ungroupedEmojis)) {
      data.ungroupedEmojis.forEach((emoji: any) => {
        if (emoji.usageCount && emoji.usageCount > 0) {
          hotEmojis.push({
            ...emoji,
            groupUUID: 'ungrouped'
          })
        }
      })
    }
    
    // 按使用次数排序
    hotEmojis.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))

    const response = {
      success: true,
      data: {
        groups: emojiGroups, // 保持原始完整数据以兼容
        normalGroups, // 新增：普通分组
        commonEmojiGroup, // 新增：常用表情分组
        hotEmojis: hotEmojis.slice(0, 50), // 新增：热门表情（最多50个）
        settings: data.settings,
        ungroupedEmojis: data.ungroupedEmojis,
      },
    }

    log('✅ Successfully prepared emoji data response')
    return response
  } catch (error) {
    log('❌ Error handling GET_EMOJI_DATA:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
