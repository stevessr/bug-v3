import settingsStore from '../update/settingsStore'
import emojiGroupsStore from '../update/emojiGroupsStore'
import storage, { addMessageListener } from '../update/storage'
import { createOptionsCommService } from '../../services/communication'

// 存储消息监听器（用于立即响应机制）
let messageListenerCleanup: (() => void) | null = null

// 初始化存储消息监听器
function initializeMessageListener() {
  if (messageListenerCleanup) {
    return // 已经初始化过了
  }

  try {
    messageListenerCleanup = addMessageListener((message: any) => {
      try {
        if (!message || !message.type) return

        // 立即处理存储更新消息，确保前端脚本直接响应
        switch (message.type) {
          case 'payload-updated':
            // 全局数据更新，通知UI刷新
            if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
              window.dispatchEvent(new CustomEvent('app:data-updated', { detail: message.data }))
            }
            break

          case 'item-updated':
            // 单项数据更新
            if (message.data && message.data.key) {
              const customEventData = {
                key: message.data.key,
                value: message.data.value,
                timestamp: message.timestamp,
              }
              if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('app:item-updated', { detail: customEventData }),
                )
              }
            }
            break

          case 'common-emoji-updated':
            // 常用表情更新
            if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('app:common-emoji-updated', { detail: message.data }),
              )
            }
            break

          default:
            // 其他类型的消息，通用处理
            if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
              window.dispatchEvent(new CustomEvent('app:storage-message', { detail: message }))
            }
            break
        }

        console.log('[main.ts] Processed storage message:', message.type)
      } catch (error) {
        console.warn('[main.ts] Error processing storage message:', error)
      }
    })

    console.log('[main.ts] Storage message listener initialized')
  } catch (error) {
    console.warn('[main.ts] Failed to initialize message listener:', error)
  }
}

// 清理消息监听器
function cleanupMessageListener() {
  if (messageListenerCleanup) {
    try {
      messageListenerCleanup()
      messageListenerCleanup = null
      console.log('[main.ts] Storage message listener cleaned up')
    } catch (error) {
      console.warn('[main.ts] Error cleaning up message listener:', error)
    }
  }
}

// 异步初始化数据（用于页面加载时）
export async function initializeData() {
  try {
    // 🚀 关键：首先启动消息监听器，确保立即响应机制
    initializeMessageListener()

    // 这会触发异步的数据加载和缓存
    await storage.loadPayload()
    log('Data initialized successfully')
    return true
  } catch (error) {
    log('Failed to initialize data:', error)
    return false
  }
}

// 刷新所有数据的异步函数
export async function refreshAllData() {
  try {
    // 重新加载数据
    await storage.loadPayload()
    log('All data refreshed successfully')
    return true
  } catch (error) {
    log('Failed to refresh data:', error)
    return false
  }
}

function log(...args: any[]) {
  try {
    console.info('[data-store]', ...args)
  } catch (_) {}
}

export function getSettings() {
  const s = settingsStore.getSettings()
  log('getSettings', s)
  return s
}

export function saveSettings(s: any) {
  log('saveSettings', s)
  settingsStore.setSettings(s, emojiGroupsStore.getEmojiGroups())
  try {
    // notify UI about settings change so components can react immediately
    if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app:settings-changed', { detail: s }))
    }

    // 使用通信服务发送设置变更消息（仅在 options 页面中）
    if (typeof window !== 'undefined' && window.location.pathname.includes('options.html')) {
      try {
        const commService = createOptionsCommService()
        commService.sendSettingsChanged(s)
      } catch (error) {
        console.warn('Failed to send settings via communication service:', error)
      }
    }
  } catch (_) {}
}

export function getGroups() {
  const g = emojiGroupsStore.getEmojiGroups()
  log('getGroups (all)', { count: g.length })
  return g
}

// 获取普通表情分组（排除常用表情分组）
export function getNormalGroups() {
  const g = (emojiGroupsStore as any).getNormalGroups
    ? (emojiGroupsStore as any).getNormalGroups()
    : []
  log('getNormalGroups', { count: g.length })
  return g
}

// 获取常用表情分组
export function getCommonEmojiGroup() {
  const g = (emojiGroupsStore as any).getCommonEmojiGroup
    ? (emojiGroupsStore as any).getCommonEmojiGroup()
    : null
  log('getCommonEmojiGroup', { exists: !!g })
  return g
}

export function getUngrouped() {
  const ug = (emojiGroupsStore as any).getUngrouped ? (emojiGroupsStore as any).getUngrouped() : []
  log('getUngrouped', { count: Array.isArray(ug) ? ug.length : 0 })
  return ug
}

export function getHot() {
  // 使用新的分离接口，不再需要手动计算
  const hot = (emojiGroupsStore as any).getHotEmojis ? (emojiGroupsStore as any).getHotEmojis() : []
  log('getHot', { count: hot.length })
  return hot
}

export function recordUsage(uuid: string) {
  return (emojiGroupsStore as any).recordUsageByUUID(uuid)
}

export function resetHot() {
  return (emojiGroupsStore as any).resetAllUsageCounts()
}

export function resetHotByUUID(uuid: string) {
  return (emojiGroupsStore as any).resetUsageCountByUUID(uuid)
}

export function exportPayload() {
  const payload = { Settings: getSettings(), emojiGroups: getGroups(), ungrouped: getUngrouped() }
  log('exportPayload')
  return JSON.stringify(payload, null, 2)
}

export function importPayload(p: any) {
  if (!p) return false
  log(
    'importPayload',
    p && {
      hasSettings: !!p.Settings,
      groups: Array.isArray(p.emojiGroups) ? p.emojiGroups.length : 0,
      ungrouped: Array.isArray(p.ungrouped) ? p.ungrouped.length : 0,
    },
  )
  if (p.Settings) settingsStore.setSettings(p.Settings, p.emojiGroups || undefined)
  try {
    if (p.Settings && typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app:settings-changed', { detail: p.Settings }))
    }

    // 使用通信服务发送设置变更消息（仅在 options 页面中）
    if (
      p.Settings &&
      typeof window !== 'undefined' &&
      window.location.pathname.includes('options.html')
    ) {
      try {
        const commService = createOptionsCommService()
        commService.sendSettingsChanged(p.Settings)
      } catch (error) {
        console.warn('Failed to send settings via communication service:', error)
      }
    }
  } catch (_) {}

  if (Array.isArray(p.emojiGroups)) {
    emojiGroupsStore.setEmojiGroups(p.emojiGroups)
    // 使用通信服务发送表情组变更消息（仅在 options 页面中）
    try {
      if (typeof window !== 'undefined' && window.location.pathname.includes('options.html')) {
        const commService = createOptionsCommService()
        commService.sendGroupsChanged(p.emojiGroups)
      }
    } catch (error) {
      console.warn('Failed to send groups via communication service:', error)
    }
  }

  if (Array.isArray(p.ungrouped) && (emojiGroupsStore as any).addUngrouped) {
    // replace existing ungrouped with imported ones
    const existing: any[] = (emojiGroupsStore as any).getUngrouped
      ? (emojiGroupsStore as any).getUngrouped()
      : []
    if (Array.isArray(existing)) {
      existing.forEach((e: any) => {
        try {
          ;(emojiGroupsStore as any).removeUngroupedByUUID(e.UUID)
        } catch (_) {}
      })
    }
    p.ungrouped.forEach((e: any) => (emojiGroupsStore as any).addUngrouped(e))
  }

  // 发送数据导入完成消息
  try {
    if (typeof window !== 'undefined' && window.location.pathname.includes('options.html')) {
      const commService = createOptionsCommService()
      commService.sendDataImported(p)
    }
  } catch (error) {
    console.warn('Failed to send data import via communication service:', error)
  }

  return true
}

export function moveUngroupedToGroup(uuids: string[], groupUUID: string) {
  if (!Array.isArray(uuids) || !groupUUID) return { moved: 0 }
  const existing: any[] = (emojiGroupsStore as any).getUngrouped
    ? (emojiGroupsStore as any).getUngrouped()
    : []
  let moved = 0
  for (const u of uuids) {
    const idx = existing.findIndex((e: any) => e.UUID === u)
    if (idx < 0) continue
    const e = existing[idx]
    try {
      ;(emojiGroupsStore as any).addEmojiToGroup(groupUUID, e)
      ;(emojiGroupsStore as any).removeUngroupedByUUID(e.UUID)
      moved++
    } catch (err) {
      // ignore individual failures
    }
  }
  log('moveUngroupedToGroup', { groupUUID, moved })
  return { moved }
}

export function reorderEmojiInGroup(groupUUID: string, fromIndex: number, toIndex: number) {
  try {
    const ok = (emojiGroupsStore as any).reorderEmojiInGroup(groupUUID, fromIndex, toIndex)
    log('reorderEmojiInGroup', { groupUUID, fromIndex, toIndex, ok })
    return ok
  } catch (err) {
    log('reorderEmojiInGroup', 'error', err)
    return false
  }
}

export function reorderGroups(fromIndex: number, toIndex: number) {
  try {
    const ok = (emojiGroupsStore as any).reorderGroups
      ? (emojiGroupsStore as any).reorderGroups(fromIndex, toIndex)
      : false
    log('reorderGroups', { fromIndex, toIndex, ok })
    return ok
  } catch (err) {
    log('reorderGroups', 'error', err)
    return false
  }
}

// 导出清理函数，供外部调用
export function cleanup() {
  cleanupMessageListener()
}

export default {
  initializeData,
  refreshAllData,
  cleanup,
  getSettings,
  saveSettings,
  getGroups,
  getNormalGroups,
  getCommonEmojiGroup,
  getUngrouped,
  getHot,
  recordUsage,
  resetHot,
  exportPayload,
  importPayload,
  moveUngroupedToGroup,
  reorderEmojiInGroup,
  reorderGroups,
  resetHotByUUID,
}
