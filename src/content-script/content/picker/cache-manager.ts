// content-script/content/picker/cache-manager.ts - 缓存管理逻辑

import { createContentScriptCommService } from '../../../services/communication'
import { cachedState, cacheManager, cacheUtils } from '../state'
import type { EmojiGroup } from '../types'

// 导入后台通信函数
interface BackgroundResponse {
  success: boolean
  data?: {
    groups?: any[]
    settings?: any
    ungroupedEmojis?: any[]
  }
  error?: string
}

function sendMessageToBackground(message: any): Promise<BackgroundResponse> {
  return new Promise((resolve) => {
    try {
      if (
        (window as any).chrome &&
        (window as any).chrome.runtime &&
        (window as any).chrome.runtime.sendMessage
      ) {
        ;(window as any).chrome.runtime.sendMessage(message, (response: BackgroundResponse) => {
          resolve(response)
        })
      } else {
        resolve({ success: false, error: 'chrome.runtime.sendMessage not available' })
      }
    } catch (e) {
      resolve({ success: false, error: e instanceof Error ? e.message : String(e) })
    }
  })
}

// 创建通信服务用于实时通知其他页面
const commService = createContentScriptCommService()

// 缓存状态管理
let cacheVersion = 0
const CACHE_EXPIRE_TIME = 600000 // 10分钟缓存过期时间

/**
 * 从后台加载表情组数据
 */
export async function loadGroupsFromBackground(): Promise<EmojiGroup[]> {
  try {
    console.log('[组级缓存] 从后台获取表情组数据')
    const response = await sendMessageToBackground({ type: 'GET_EMOJI_DATA' })

    if (response && response.success && response.data && response.data.groups) {
      const freshGroups = response.data.groups.filter(
        (g: any) => g && typeof g.UUID === 'string' && Array.isArray(g.emojis),
      )

      if (freshGroups.length > 0) {
        // 更新组级别缓存
        freshGroups.forEach((group: any) => {
          if (group.UUID === 'common-emoji-group') {
            cacheUtils.updateCommonGroupCache(group)
          } else {
            cacheUtils.updateGroupCache(group.UUID, group)
          }
        })

        // 更新主缓存
        cachedState.emojiGroups = freshGroups
        console.log(`[组级缓存] 成功加载 ${freshGroups.length} 个表情组`)
        return freshGroups
      }
    }

    console.warn('[组级缓存] 后台没有返回有效数据')
    return []
  } catch (error) {
    console.error('[组级缓存] 从后台加载失败:', error)
    return []
  }
}

/**
 * 后台异步检查更新
 */
export async function checkForUpdatesInBackground(): Promise<void> {
  try {
    console.log('[组级缓存] 后台异步检查更新')

    // 使用较短的超时时间，避免阻塞 UI
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Background check timeout')), 2000)
    })

    const checkPromise = sendMessageToBackground({ type: 'GET_EMOJI_DATA' })

    const response = (await Promise.race([checkPromise, timeoutPromise])) as any

    if (response && response.success && response.data && response.data.groups) {
      const freshGroups = response.data.groups
      let hasUpdates = false

      // 检查是否有组级别更新
      for (const group of freshGroups) {
        if (!group.UUID) continue

        const cachedGroup =
          group.UUID === 'common-emoji-group'
            ? cacheManager.commonGroupCache.data
            : cacheUtils.getGroupCache(group.UUID)

        // 简单的更新检查（比较表情数量和修改时间）
        if (
          !cachedGroup ||
          cachedGroup.emojis?.length !== group.emojis?.length ||
          JSON.stringify(cachedGroup.emojis) !== JSON.stringify(group.emojis)
        ) {
          console.log(`[组级缓存] 检测到组更新: ${group.UUID}`)

          // 更新特定组
          if (group.UUID === 'common-emoji-group') {
            cacheUtils.updateCommonGroupCache(group)
          } else {
            cacheUtils.updateGroupCache(group.UUID, group)
          }

          // 更新主缓存
          const index = cachedState.emojiGroups.findIndex((g) => g.UUID === group.UUID)
          if (index >= 0) {
            cachedState.emojiGroups[index] = group
          }

          hasUpdates = true
        }
      }

      if (hasUpdates) {
        console.log('[组级缓存] 检测到更新，已同步缓存')
      } else {
        console.log('[组级缓存] 未检测到更新')
      }
    }
  } catch (error) {
    // 忙时忽略错误，不影响主流程
    console.debug(
      '[组级缓存] 后台检查更新失败（忽略）:',
      error instanceof Error ? error.message : String(error),
    )
  }
}

/**
 * 获取缓存统计信息
 */
export function getCacheStats() {
  return {
    version: cacheVersion,
    expireTime: CACHE_EXPIRE_TIME,
    cachedGroupsCount: cachedState.emojiGroups.length,
    hasCommonGroup: cachedState.emojiGroups.some(g => g.UUID === 'common-emoji-group'),
    cacheUtils: cacheUtils.getCacheStats(),
  }
}

/**
 * 设置数据更新监听器
 */
export function setupCacheListeners() {
  // 监听数据更新消息 - 增强版
  commService.onGroupsChanged(() => {
    console.log('[Emoji Picker] 接收到表情组更新消息，将在下次打开时重新获取数据')
    cacheVersion++ // 增加版本号，标记缓存无效
  })

  commService.onUsageRecorded(() => {
    console.log('[Emoji Picker] 接收到使用记录更新消息，将在下次打开时重新获取数据')
    cacheVersion++ // 增加版本号，标记缓存无效
  })

  // 🚀 关键修复：添加常用表情组专门的监听器
  commService.onCommonEmojiGroupChanged((data) => {
    try {
      console.log('[Emoji Picker] 接收到常用表情组专门更新消息')

      if (data && data.group) {
        // 更新常用表情组缓存
        cacheUtils.updateCommonGroupCache(data.group)

        // 如果存在活跃的表情选择器，立即刷新界面
        const activePicker = document.querySelector(
          '.fk-d-menu[data-identifier="emoji-picker"], .modal-container .emoji-picker',
        )
        if (activePicker) {
          console.log('[Emoji Picker] 发现活跃的表情选择器，触发界面刷新事件')

          // 触发界面刷新事件
          window.dispatchEvent(
            new CustomEvent('emoji-common-group-refreshed', {
              detail: {
                group: data.group,
                timestamp: data.timestamp || Date.now(),
              },
            }),
          )
        }
      }
    } catch (error) {
      console.error('[Emoji Picker] 处理常用表情组更新失败:', error)
    }
  })

  // 🚀 关键修复：添加特定表情组更新监听器
  commService.onSpecificGroupChanged((data) => {
    try {
      if (data && data.groupUUID === 'common-emoji-group' && data.group) {
        console.log('[Emoji Picker] 接收到常用表情组特定更新消息')

        // 更新常用表情组缓存
        cacheUtils.updateCommonGroupCache(data.group)

        // 如果存在活跃的表情选择器，立即刷新界面
        const activePicker = document.querySelector(
          '.fk-d-menu[data-identifier="emoji-picker"], .modal-container .emoji-picker',
        )
        if (activePicker) {
          console.log('[Emoji Picker] 发现活跃的表情选择器，触发界面刷新事件')

          // 触发界面刷新事件
          window.dispatchEvent(
            new CustomEvent('emoji-common-group-refreshed', {
              detail: {
                group: data.group,
                timestamp: data.timestamp || Date.now(),
              },
            }),
          )
        }
      }
    } catch (error) {
      console.error('[Emoji Picker] 处理特定表情组更新失败:', error)
    }
  })
}

/**
 * 无效化缓存
 */
export function invalidateCache() {
  cacheVersion++
  console.log('[缓存管理] 缓存已无效化，版本:', cacheVersion)
}

/**
 * 检查缓存是否激进模式
 */
export function isAggressiveMode(): boolean {
  return cacheManager.isAggressiveMode
}

/**
 * 获取所有缓存的组
 */
export function getAllCachedGroups(): EmojiGroup[] {
  return cacheUtils.getAllCachedGroups()
}

export { cacheVersion, CACHE_EXPIRE_TIME, commService }