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

        // 🚀 关键修复：当检测到更新时，触发界面刷新事件
        window.dispatchEvent(
          new CustomEvent('emoji-groups-cache-updated', {
            detail: {
              groups: freshGroups,
              timestamp: Date.now(),
            },
          }),
        )
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
    hasCommonGroup: cachedState.emojiGroups.some((g) => g.UUID === 'common-emoji-group'),
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

      // 🚀 关键修复：处理其他组的更新
      if (data && data.groupUUID && data.group && data.groupUUID !== 'common-emoji-group') {
        console.log(`[Emoji Picker] 接收到组 ${data.groupUUID} 更新消息`)

        // 更新组缓存
        cacheUtils.updateGroupCache(data.groupUUID, data.group)

        // 更新主缓存
        const index = cachedState.emojiGroups.findIndex((g) => g.UUID === data.groupUUID)
        if (index >= 0) {
          cachedState.emojiGroups[index] = data.group
        }
      }
    } catch (error) {
      console.error('[Emoji Picker] 处理特定表情组更新失败:', error)
    }
  })

  // 🚀 新增：监听常用表情实时更新消息
  commService.onCommonEmojiUpdated((commonGroup) => {
    try {
      console.log('[Emoji Picker] 接收到常用表情实时更新消息')

      if (commonGroup) {
        // 立即更新常用表情组缓存
        cacheUtils.updateCommonGroupCache(commonGroup)

        // 更新主缓存中的常用表情组
        const index = cachedState.emojiGroups.findIndex((g) => g.UUID === 'common-emoji-group')
        if (index >= 0) {
          cachedState.emojiGroups[index] = commonGroup
        }

        // 如果存在活跃的表情选择器，立即刷新常用表情显示
        const activePicker = document.querySelector(
          '.fk-d-menu[data-identifier="emoji-picker"], .modal-container .emoji-picker',
        )
        if (activePicker) {
          console.log('[Emoji Picker] 立即刷新常用表情显示')
          refreshCommonEmojiSection(activePicker, commonGroup)
        }
      }
    } catch (error) {
      console.error('[Emoji Picker] 处理常用表情实时更新失败:', error)
    }
  })

  // 🚀 新增：监听表情排序变更消息
  commService.onEmojiOrderChanged((groupUUID, updatedOrder) => {
    try {
      console.log('[Emoji Picker] 接收到表情排序变更消息')

      if (groupUUID && updatedOrder) {
        // 更新对应组的缓存
        if (groupUUID === 'common-emoji-group') {
          const commonGroup = cacheUtils.getCommonGroupCache()
          if (commonGroup && commonGroup.emojis) {
            // 重新排序表情
            const reorderedEmojis = updatedOrder.map((uuid: string) =>
              commonGroup.emojis.find((e: any) => e.UUID === uuid)
            ).filter(Boolean)
            
            commonGroup.emojis = reorderedEmojis
            cacheUtils.updateCommonGroupCache(commonGroup)
          }
        } else {
          const group = cacheUtils.getGroupCache(groupUUID)
          if (group && group.emojis) {
            // 重新排序表情
            const reorderedEmojis = updatedOrder.map((uuid: string) =>
              group.emojis.find((e: any) => e.UUID === uuid)
            ).filter(Boolean)
            
            group.emojis = reorderedEmojis
            cacheUtils.updateGroupCache(groupUUID, group)
          }
        }

        // 如果存在活跃的表情选择器，立即刷新对应组的显示
        const activePicker = document.querySelector(
          '.fk-d-menu[data-identifier="emoji-picker"], .modal-container .emoji-picker',
        )
        if (activePicker) {
          console.log(`[Emoji Picker] 立即刷新组 ${groupUUID} 的表情排序`)
          refreshGroupEmojiOrder(activePicker, groupUUID, updatedOrder)
        }
      }
    } catch (error) {
      console.error('[Emoji Picker] 处理表情排序变更失败:', error)
    }
  })

  // 🚀 新增：监听分组图标更新消息
  commService.onGroupIconUpdated((groupUUID, iconUrl) => {
    try {
      console.log('[Emoji Picker] 接收到分组图标更新消息')

      if (groupUUID && iconUrl) {
        // 更新对应组的图标缓存
        if (groupUUID === 'common-emoji-group') {
          const commonGroup = cacheUtils.getCommonGroupCache()
          if (commonGroup) {
            commonGroup.icon = iconUrl
            cacheUtils.updateCommonGroupCache(commonGroup)
          }
        } else {
          const group = cacheUtils.getGroupCache(groupUUID)
          if (group) {
            group.icon = iconUrl
            cacheUtils.updateGroupCache(groupUUID, group)
          }
        }

        // 如果存在活跃的表情选择器，立即刷新图标显示
        const activePicker = document.querySelector(
          '.fk-d-menu[data-identifier="emoji-picker"], .modal-container .emoji-picker',
        )
        if (activePicker) {
          console.log(`[Emoji Picker] 立即刷新组 ${groupUUID} 的图标`)
          refreshGroupIcon(activePicker, groupUUID, iconUrl)
        }
      }
    } catch (error) {
      console.error('[Emoji Picker] 处理分组图标更新失败:', error)
    }
  })

  // 🚀 新增：监听未分组表情变更消息
  commService.onUngroupedEmojisChangedSync((ungroupedEmojis) => {
    try {
      console.log('[Emoji Picker] 接收到未分组表情变更消息')

      if (ungroupedEmojis) {
        // 更新未分组表情缓存
        cachedState.ungroupedEmojis = ungroupedEmojis

        // 如果存在活跃的表情选择器，立即刷新未分组表情显示
        const activePicker = document.querySelector(
          '.fk-d-menu[data-identifier="emoji-picker"], .modal-container .emoji-picker',
        )
        if (activePicker) {
          console.log('[Emoji Picker] 立即刷新未分组表情显示')
          refreshUngroupedEmojisSection(activePicker, ungroupedEmojis)
        }
      }
    } catch (error) {
      console.error('[Emoji Picker] 处理未分组表情变更失败:', error)
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

/**
 * 刷新常用表情组显示
 */
function refreshCommonEmojiSection(picker: Element, commonGroup: any) {
  try {
    const commonSection = picker.querySelector('[data-group-uuid="common-emoji-group"]')
    if (!commonSection) {
      console.warn('[Emoji Picker] 未找到常用表情组区域')
      return
    }

    // 重新生成常用表情组的HTML
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

/**
 * 刷新组内表情排序
 */
function refreshGroupEmojiOrder(picker: Element, groupUUID: string, updatedOrder: string[]) {
  try {
    const groupSection = picker.querySelector(`[data-group-uuid="${groupUUID}"]`)
    if (!groupSection) {
      console.warn(`[Emoji Picker] 未找到组 ${groupUUID} 的区域`)
      return
    }

    const sectionContent = groupSection.querySelector('.emoji-section-content')
    if (!sectionContent) {
      return
    }

    // 获取现有的表情元素
    const existingEmojis = Array.from(sectionContent.querySelectorAll('.emoji-item'))
    const emojiMap = new Map()
    
    existingEmojis.forEach(emoji => {
      const uuid = emoji.getAttribute('data-emoji-uuid')
      if (uuid) {
        emojiMap.set(uuid, emoji)
      }
    })

    // 按新顺序重新排列
    const reorderedElements: Element[] = []
    updatedOrder.forEach(uuid => {
      const element = emojiMap.get(uuid)
      if (element) {
        reorderedElements.push(element)
      }
    })

    // 清空并重新添加
    sectionContent.innerHTML = ''
    reorderedElements.forEach(element => {
      sectionContent.appendChild(element)
    })

    console.log(`[Emoji Picker] 组 ${groupUUID} 的表情排序已刷新`)
  } catch (error) {
    console.error('[Emoji Picker] 刷新表情排序失败:', error)
  }
}

/**
 * 刷新分组图标
 */
function refreshGroupIcon(picker: Element, groupUUID: string, iconUrl: string) {
  try {
    // 更新导航栏中的图标
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

    // 更新组标题中的图标（如果有）
    const groupSection = picker.querySelector(`[data-group-uuid="${groupUUID}"]`)
    if (groupSection) {
      const titleIcon = groupSection.querySelector('.emoji-section-title .icon, .emoji-section-title img')
      if (titleIcon) {
        if (titleIcon.tagName === 'IMG') {
          (titleIcon as HTMLImageElement).src = iconUrl
        } else {
          titleIcon.textContent = iconUrl
        }
      }
    }

    console.log(`[Emoji Picker] 组 ${groupUUID} 的图标已刷新`)
  } catch (error) {
    console.error('[Emoji Picker] 刷新分组图标失败:', error)
  }
}

/**
 * 刷新未分组表情显示
 */
function refreshUngroupedEmojisSection(picker: Element, ungroupedEmojis: any[]) {
  try {
    // 查找未分组表情的显示区域
    const ungroupedSection = picker.querySelector('[data-group-uuid="ungrouped"], .ungrouped-emojis-section')
    if (!ungroupedSection) {
      // 如果没有未分组区域，可能需要创建一个
      console.log('[Emoji Picker] 未找到未分组表情区域，可能需要创建')
      return
    }

    // 重新生成未分组表情的HTML
    const emojisHtml = ungroupedEmojis.map((emoji: any) => 
      `<div class="emoji-item" data-emoji-uuid="${emoji.UUID}" title="${emoji.displayName}">
        <img src="${emoji.url}" alt="${emoji.displayName}" loading="lazy" />
      </div>`
    ).join('')

    const sectionContent = ungroupedSection.querySelector('.emoji-section-content')
    if (sectionContent) {
      sectionContent.innerHTML = emojisHtml
      console.log('[Emoji Picker] 未分组表情显示已刷新')
    }
  } catch (error) {
    console.error('[Emoji Picker] 刷新未分组表情显示失败:', error)
  }
}

export { cacheVersion, CACHE_EXPIRE_TIME, commService }
