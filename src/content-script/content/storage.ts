import { cachedState, cacheManager, cacheUtils } from './state'
import type { EmojiGroup, Settings } from './types'
import { defaultSettings, createDefaultEmojiGroup } from './types'
import { createContentScriptCommService } from '../../services/communication'

// 创建通信服务实例
const commService = createContentScriptCommService()

// 初始化通信监听器
function initCommunicationListeners() {
  // 监听设置变更
  commService.onSettingsChanged((newSettings) => {
    console.log('[缓存] 收到设置更新信号:', newSettings)
    cacheUtils.updateSettingsCache(newSettings)
    cachedState.settings = { ...cachedState.settings, ...newSettings }
  })

  // 监听普通表情组变更
  commService.onNormalGroupsChanged((data) => {
    console.log('[缓存] 收到普通表情组更新信号:', data.groups.length, '个组')
    data.groups.forEach((group) => {
      if (group.UUID && group.UUID !== 'common-emoji-group') {
        cacheUtils.updateGroupCache(group.UUID, group)
        // 更新主缓存中的对应组
        const index = cachedState.emojiGroups.findIndex((g) => g.UUID === group.UUID)
        if (index >= 0) {
          cachedState.emojiGroups[index] = group
        } else {
          cachedState.emojiGroups.push(group)
        }
      }
    })
  })

  // 监听常用表情组变更
  commService.onCommonEmojiGroupChanged((data) => {
    console.log('[缓存] 收到常用表情组更新信号')
    cacheUtils.updateCommonGroupCache(data.group)
    // 更新主缓存中的常用表情组
    const index = cachedState.emojiGroups.findIndex((g) => g.UUID === 'common-emoji-group')
    if (index >= 0) {
      cachedState.emojiGroups[index] = data.group
    } else {
      cachedState.emojiGroups.unshift(data.group) // 放在首位
    }
  })

  // 监听未分组表情变更
  commService.onUngroupedEmojisChanged((data) => {
    console.log('[缓存] 收到未分组表情更新信号:', data.emojis.length, '个表情')
    cacheUtils.updateUngroupedCache(data.emojis)
    cachedState.ungroupedEmojis = data.emojis
  })

  // 监听特定表情组变更
  commService.onSpecificGroupChanged((data) => {
    console.log('[缓存] 收到特定表情组更新信号:', data.groupUUID)
    if (data.groupUUID === 'common-emoji-group') {
      cacheUtils.updateCommonGroupCache(data.group)
    } else {
      cacheUtils.updateGroupCache(data.groupUUID, data.group)
    }

    // 更新主缓存
    const index = cachedState.emojiGroups.findIndex((g) => g.UUID === data.groupUUID)
    if (index >= 0) {
      cachedState.emojiGroups[index] = data.group
    } else {
      if (data.groupUUID === 'common-emoji-group') {
        cachedState.emojiGroups.unshift(data.group)
      } else {
        cachedState.emojiGroups.push(data.group)
      }
    }
  })

  console.log('[缓存] 通信监听器初始化完成')
}

// 在模块加载时初始化监听器
initCommunicationListeners()

interface BackgroundResponse {
  success: boolean
  data?: {
    groups?: EmojiGroup[]
    settings?: Partial<Settings>
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

function validateEmojiGroup(group: any): group is EmojiGroup {
  return (
    group &&
    typeof group.UUID === 'string' &&
    typeof group.displayName === 'string' &&
    typeof group.order === 'number' &&
    Array.isArray(group.emojis)
  )
}

function validateSettings(settings: any): settings is Partial<Settings> {
  return (
    settings &&
    typeof settings === 'object' &&
    (settings.imageScale === undefined || typeof settings.imageScale === 'number') &&
    (settings.gridColumns === undefined ||
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].includes(settings.gridColumns)) &&
    (settings.outputFormat === undefined ||
      ['html', 'markdown', 'bbcode'].includes(settings.outputFormat)) &&
    (settings.MobileMode === undefined || typeof settings.MobileMode === 'boolean') &&
    (settings.defaultEmojiGroupUUID === undefined ||
      typeof settings.defaultEmojiGroupUUID === 'string')
  )
}

export async function loadDataFromStorage(forceRefresh: boolean = false): Promise<void> {
  try {
    const now = Date.now()

    // 在激进缓存模式下，除非强制刷新或是首次加载，否则优先使用缓存
    if (cacheManager.isAggressiveMode && !forceRefresh && cacheManager.lastFullUpdate > 0) {
      console.log('[缓存] 激进模式下使用缓存数据')

      // 使用缓存的数据
      const cachedGroups = cacheUtils.getAllCachedGroups()
      if (cachedGroups.length > 0) {
        cachedState.emojiGroups = cachedGroups
        cachedState.settings = { ...cachedState.settings, ...cacheManager.settingsCache.data }
        cachedState.ungroupedEmojis = cacheManager.ungroupedCache.data

        console.log('[缓存] 使用缓存数据：', {
          groupsCount: cachedGroups.length,
          ungroupedCount: cacheManager.ungroupedCache.data.length,
          cacheStats: cacheUtils.getCacheStats(),
        })
        return
      }
    }

    console.log('[缓存] 从后台请求表情数据')
    const resp = await sendMessageToBackground({ type: 'GET_EMOJI_DATA' })

    if (resp && resp.success && resp.data) {
      const groups = resp.data.groups || []
      const settings = resp.data.settings || {}
      const ungroupedEmojis = resp.data.ungroupedEmojis || []

      console.log('[缓存] 从后台收到数据:', groups?.length || 0, '个组')

      if (Array.isArray(groups) && groups.length > 0) {
        const validGroups = groups.filter(validateEmojiGroup)
        const totalEmojis = validGroups.reduce((sum, group) => sum + group.emojis.length, 0)

        if (validGroups.length > 0 && totalEmojis > 0) {
          // 更新缓存和主状态
          cachedState.emojiGroups = validGroups

          // 更新组级别缓存
          validGroups.forEach((group) => {
            if (group.UUID === 'common-emoji-group') {
              cacheUtils.updateCommonGroupCache(group)
            } else {
              cacheUtils.updateGroupCache(group.UUID, group)
            }
          })

          console.log(
            `[缓存] 成功加载 ${validGroups.length} 个有效组，共 ${totalEmojis} 个表情（从后台）`,
          )
        } else {
          console.warn('[缓存] 组存在但不包含有效表情，使用默认值（从后台）')
          cachedState.emojiGroups = [createDefaultEmojiGroup()]
        }
      } else {
        console.warn('[缓存] 后台响应中未找到有效的表情组，使用默认值')
        cachedState.emojiGroups = [createDefaultEmojiGroup()]
      }

      if (validateSettings(settings)) {
        cachedState.settings = { ...cachedState.settings, ...settings }
        cacheUtils.updateSettingsCache(settings)
        console.log('[缓存] 加载设置（从后台）:', cachedState.settings)
      }

      if (Array.isArray(ungroupedEmojis)) {
        cachedState.ungroupedEmojis = ungroupedEmojis
        cacheUtils.updateUngroupedCache(ungroupedEmojis)
      }

      // 记录最后一次全量更新时间
      cacheManager.lastFullUpdate = now
    } else {
      console.warn('[缓存] 后台未返回表情数据，使用默认值')
      cachedState.emojiGroups = [createDefaultEmojiGroup()]
      cachedState.settings = { ...defaultSettings }
    }

    const finalEmojisCount = cachedState.emojiGroups.reduce(
      (sum, group) => sum + group.emojis.length,
      0,
    )

    console.log('[缓存] 最终缓存状态（从后台）:', {
      groupsCount: cachedState.emojiGroups.length,
      emojisCount: finalEmojisCount,
      ungroupedCount: cachedState.ungroupedEmojis.length,
      settings: cachedState.settings,
      cacheStats: cacheUtils.getCacheStats(),
    })
  } catch (error) {
    console.error('[缓存] 从后台加载失败（模块）:', error)

    // 失败时尝试使用缓存数据
    const cachedGroups = cacheUtils.getAllCachedGroups()
    if (cachedGroups.length > 0) {
      console.log('[缓存] 使用缓存数据作为备用')
      cachedState.emojiGroups = cachedGroups
      cachedState.settings = { ...cachedState.settings, ...cacheManager.settingsCache.data }
      cachedState.ungroupedEmojis = cacheManager.ungroupedCache.data
    } else {
      cachedState.emojiGroups = [createDefaultEmojiGroup()]
      cachedState.settings = { ...defaultSettings }
      cachedState.ungroupedEmojis = []
    }
  }
}
