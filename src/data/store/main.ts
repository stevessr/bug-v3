import settingsStore from '../update/settingsStore'
import emojiGroupsStore from '../update/emojiGroupsStore'
import storage from '../update/storage'
import { createOptionsCommService } from '../../services/communication'

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

export default {
  getSettings,
  saveSettings,
  getGroups,
  getNormalGroups,
  getCommonEmojiGroup,
  getUngrouped,
  getHot,
  resetHot,
  exportPayload,
  importPayload,
  moveUngroupedToGroup,
  reorderEmojiInGroup,
  reorderGroups,
  resetHotByUUID,
}
