import type { EmojiGroup } from '../type/emoji/emoji'

import storage from './storage'
import settingsStore from './settingsStore'

let emojiGroups: EmojiGroup[] = []
let ungrouped: any[] = []

function initFromStorage() {
  try {
    const p = storage.loadPayload()
    if (p) {
      emojiGroups = Array.isArray(p.emojiGroups)
        ? p.emojiGroups.map((g) => ({ ...g, emojis: [...g.emojis] }))
        : []
      ungrouped = Array.isArray(p.ungrouped) ? p.ungrouped.map((e) => ({ ...e })) : []
      return
    }
  } catch (error) {
    console.warn('[EmojiGroupsStore] Failed to load from storage:', error)
  }

  // No payload in storage: try to load converted defaults from bundled JSON and persist them.
  try {
    if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
      fetch('/static/config/converted_payload.json')
        .then((res) => {
          if (!res.ok) throw new Error('fetch failed')
          return res.json()
        })
        .then((payload: any) => {
          try {
            if (!payload) return
            const gs = Array.isArray(payload.emojiGroups) ? payload.emojiGroups : []
            const ug = Array.isArray(payload.ungrouped) ? payload.ungrouped : []
            // initialize in-memory copies
            emojiGroups = gs.map((g: any) => ({
              ...g,
              emojis: Array.isArray(g.emojis) ? [...g.emojis] : [],
            }))
            ungrouped = ug.map((e: any) => ({ ...e }))
            // persist using settingsStore so storage.savePayload is used consistently
            try {
              settingsStore.setSettings(payload.Settings || {}, emojiGroups)
            } catch (_) {
              // fallback: call settingsStore.save to at least persist groups
              try {
                settingsStore.save(emojiGroups, ungrouped)
              } catch (_) {}
            }
          } catch (_) {}
        })
        .catch((_) => {})
    }
  } catch (_) {}
}

function getEmojiGroups() {
  // 🚀 关键修复：确保返回的表情组按照正确的顺序排列
  const groups = emojiGroups.map((g) => ({ ...g, emojis: [...g.emojis] }))

  // 确保常用表情组始终在第一位
  const commonGroupIndex = groups.findIndex((g) => g.UUID === 'common-emoji-group')
  if (commonGroupIndex > 0) {
    const commonGroup = groups.splice(commonGroupIndex, 1)[0]
    groups.unshift(commonGroup)
    console.log('[EmojiGroupsStore] Moved common group to first position')
  }

  return groups
}

// 获取普通表情分组（排除常用表情分组）
function getNormalGroups() {
  return emojiGroups
    .filter((g) => {
      // 排除常用表情分组（使用UUID匹配）
      if (g.UUID === 'common-emoji-group') return false

      // 排除显示名称包含常用的分组（备用方案）
      const displayName = g.displayName || ''
      if (
        displayName.includes('常用') ||
        displayName.includes('收藏') ||
        displayName.includes('最近')
      ) {
        return false
      }

      return true
    })
    .map((g) => ({ ...g, emojis: [...g.emojis] }))
}

// 获取常用表情分组
function getCommonEmojiGroup() {
  const commonGroup = emojiGroups.find((g) => g.UUID === 'common-emoji-group')
  if (commonGroup) {
    return { ...commonGroup, emojis: [...commonGroup.emojis] }
  }
  return null
}

// 获取热门表情（基于使用计数）
function getHotEmojis(forceRefresh = false) {
  console.log('[EmojiGroupsStore] Getting hot emojis, forceRefresh:', forceRefresh)

  // 🚀 关键优化：添加缓存机制和强制刷新功能
  if (!forceRefresh) {
    // 检查是否有缓存且未过期（1分钟内）
    const now = Date.now()
    if (
      cachedHotEmojis.data &&
      cachedHotEmojis.timestamp &&
      now - cachedHotEmojis.timestamp < 60000
    ) {
      console.log(
        '[EmojiGroupsStore] Using cached hot emojis data, count:',
        cachedHotEmojis.data.length,
      )
      return [...cachedHotEmojis.data]
    }
  }

  console.log('[EmojiGroupsStore] Recalculating hot emojis from scratch')

  // 从所有分组收集带使用统计的表情
  const all: any[] = []
  for (const g of emojiGroups) {
    if (Array.isArray(g.emojis)) {
      const groupEmojis = g.emojis.map((e: any) => ({ ...e, groupUUID: g.UUID }))
      all.push(...groupEmojis)
      console.log(`[EmojiGroupsStore] Added ${groupEmojis.length} emojis from group ${g.UUID}`)
    }
  }

  // 添加未分组表情
  const ungroupedEmojis = ungrouped.map((e: any) => ({ ...e, groupUUID: 'ungrouped' }))
  all.push(...ungroupedEmojis)
  console.log(`[EmojiGroupsStore] Added ${ungroupedEmojis.length} ungrouped emojis`)

  const withUsage = all.filter((e) => typeof e.usageCount === 'number' && e.usageCount > 0)
  console.log(`[EmojiGroupsStore] Found ${withUsage.length} emojis with usage count > 0`)

  withUsage.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))

  // Log top 10 for debugging
  if (withUsage.length > 0) {
    console.log('[EmojiGroupsStore] Top 10 hot emojis:')
    withUsage.slice(0, 10).forEach((e, i) => {
      console.log(`  ${i + 1}. ${e.displayName} (${e.usageCount} uses, group: ${e.groupUUID})`)
    })
  }

  // 🚀 关键优化：更新缓存
  cachedHotEmojis.data = withUsage.slice(0, 50)
  cachedHotEmojis.timestamp = Date.now()

  console.log(`[EmojiGroupsStore] Cached ${cachedHotEmojis.data.length} hot emojis`)

  return [...cachedHotEmojis.data]
}

// 🚀 关键优化：添加缓存变量
const cachedHotEmojis = {
  data: null as any[] | null,
  timestamp: 0,
}

function getUngrouped() {
  return ungrouped.map((e) => ({ ...e }))
}

function setEmojiGroups(gs: EmojiGroup[]) {
  emojiGroups = gs.map((g) => ({ ...g, emojis: [...g.emojis] }))
  // persist together with settings (sync)
  settingsStore.save(emojiGroups, ungrouped)
}

function addUngrouped(emoji: any) {
  ungrouped.push(emoji)
  settingsStore.save(emojiGroups, ungrouped)
}

function removeUngroupedByUUID(uuid: string) {
  const idx = ungrouped.findIndex((e) => e.UUID === (uuid as any))
  if (idx >= 0) {
    ungrouped.splice(idx, 1)
    settingsStore.save(emojiGroups, ungrouped)
    return true
  }
  return false
}

function recordUsageByUUID(uuid: string) {
  console.log('[EmojiGroupsStore] Recording usage for UUID:', uuid)

  // try to find in groups first
  const found = findEmojiByUUID(uuid)
  if (found && found.emoji) {
    const e: any = found.emoji
    const now = Date.now()
    const oldUsageCount = e.usageCount || 0

    console.log(
      '[EmojiGroupsStore] Found emoji in group:',
      found.group.UUID,
      'emoji:',
      e.displayName,
      'current usage:',
      oldUsageCount,
    )

    // if no previous lastUsed, treat as new
    if (!e.lastUsed) {
      e.usageCount = 1
      e.lastUsed = now
    } else {
      const days = Math.floor((now - (e.lastUsed || 0)) / (24 * 60 * 60 * 1000))
      if (days >= 1 && typeof e.usageCount === 'number') {
        // decay by 80% per day
        e.usageCount = Math.floor(e.usageCount * Math.pow(0.8, days))
      }
      e.usageCount = (e.usageCount || 0) + 1
      e.lastUsed = now
    }

    console.log('[EmojiGroupsStore] Updated usage count from', oldUsageCount, 'to', e.usageCount)

    // 🚀 关键修复：清除热门表情缓存，强制重新计算
    cachedHotEmojis.data = null
    cachedHotEmojis.timestamp = 0

    // 保存到存储
    try {
      settingsStore.save(emojiGroups, ungrouped)
      console.log('[EmojiGroupsStore] Successfully saved emoji groups to storage')

      // 🚀 关键修复：如果是常用表情组，额外保存到专用键
      if (found.group.UUID === 'common-emoji-group') {
        try {
          storage.saveCommonEmojiGroup(found.group)
          console.log(
            '[EmojiGroupsStore] Successfully saved common emoji group to dedicated storage key',
          )
        } catch (error) {
          console.warn(
            '[EmojiGroupsStore] Failed to save common emoji group to dedicated key:',
            error,
          )
        }
      }

      return true
    } catch (error) {
      console.error('[EmojiGroupsStore] Failed to save emoji groups to storage:', error)
      return false
    }
  }

  // fallback: try ungrouped
  const ue = ungrouped.find((x) => x.UUID === (uuid as any))
  if (ue) {
    const now = Date.now()
    const oldUsageCount = ue.usageCount || 0

    console.log(
      '[EmojiGroupsStore] Found emoji in ungrouped:',
      ue.displayName,
      'current usage:',
      oldUsageCount,
    )

    if (!ue.lastUsed) {
      ue.usageCount = 1
      ue.lastUsed = now
    } else {
      const days = Math.floor((now - (ue.lastUsed || 0)) / (24 * 60 * 60 * 1000))
      if (days >= 1 && typeof ue.usageCount === 'number') {
        ue.usageCount = Math.floor(ue.usageCount * Math.pow(0.8, days))
      }
      ue.usageCount = (ue.usageCount || 0) + 1
      ue.lastUsed = now
    }

    console.log(
      '[EmojiGroupsStore] Updated ungrouped usage count from',
      oldUsageCount,
      'to',
      ue.usageCount,
    )

    // 🚀 关键修复：清除热门表情缓存，强制重新计算
    cachedHotEmojis.data = null
    cachedHotEmojis.timestamp = 0

    try {
      settingsStore.save(emojiGroups, ungrouped)
      console.log('[EmojiGroupsStore] Successfully saved ungrouped emojis to storage')
      return true
    } catch (error) {
      console.error('[EmojiGroupsStore] Failed to save ungrouped emojis to storage:', error)
      return false
    }
  }

  console.warn('[EmojiGroupsStore] Emoji not found with UUID:', uuid)
  return false
}

function findGroupByUUID(uuid: string) {
  return emojiGroups.find((g) => g.UUID === (uuid as any)) || null
}

function findEmojiByUUID(uuid: string) {
  for (const g of emojiGroups) {
    const e = g.emojis.find((it) => it.UUID === (uuid as any))
    if (e) return { group: g, emoji: e }
  }
  return null
}

function addGroup(group: EmojiGroup) {
  emojiGroups.push({ ...group, emojis: [...group.emojis] })
  settingsStore.save(emojiGroups, ungrouped)
}

function removeGroup(uuid: string) {
  const idx = emojiGroups.findIndex((g) => g.UUID === (uuid as any))
  if (idx >= 0) {
    emojiGroups.splice(idx, 1)
    settingsStore.save(emojiGroups, ungrouped)
    return true
  }
  return false
}

function addEmojiToGroup(groupUUID: string, emoji: any, position?: number) {
  const g = emojiGroups.find((x) => x.UUID === (groupUUID as any))
  if (!g) return false
  if (typeof position === 'number' && position >= 0 && position <= g.emojis.length) {
    g.emojis.splice(position, 0, emoji)
  } else {
    g.emojis.push(emoji)
  }
  settingsStore.save(emojiGroups, ungrouped)
  return true
}

function removeEmojiFromGroup(groupUUID: string, emojiUUID: string) {
  const g = emojiGroups.find((x) => x.UUID === (groupUUID as any))
  if (!g) return false
  const idx = g.emojis.findIndex((e) => e.UUID === (emojiUUID as any))
  if (idx >= 0) {
    g.emojis.splice(idx, 1)
    settingsStore.save(emojiGroups, ungrouped)
    return true
  }
  return false
}

function moveEmojiBetweenGroups(
  fromGroupUUID: string,
  toGroupUUID: string,
  emojiUUID: string,
  toIndex?: number,
) {
  const from = emojiGroups.find((x) => x.UUID === (fromGroupUUID as any))
  const to = emojiGroups.find((x) => x.UUID === (toGroupUUID as any))
  if (!from || !to) return false
  const idx = from.emojis.findIndex((e) => e.UUID === (emojiUUID as any))
  if (idx < 0) return false
  const [e] = from.emojis.splice(idx, 1)
  if (typeof toIndex === 'number' && toIndex >= 0 && toIndex <= to.emojis.length) {
    to.emojis.splice(toIndex, 0, e)
  } else {
    to.emojis.push(e)
  }
  settingsStore.save(emojiGroups, ungrouped)
  return true
}

function reorderEmojiInGroup(groupUUID: string, fromIndex: number, toIndex: number) {
  const g = emojiGroups.find((x) => x.UUID === (groupUUID as any))
  if (!g) return false
  if (fromIndex < 0 || fromIndex >= g.emojis.length) return false
  const [e] = g.emojis.splice(fromIndex, 1)
  g.emojis.splice(Math.min(Math.max(0, toIndex), g.emojis.length), 0, e)
  settingsStore.save(emojiGroups, ungrouped)
  return true
}

function reorderGroups(fromIndex: number, toIndex: number) {
  if (fromIndex < 0 || fromIndex >= emojiGroups.length) return false
  const [g] = emojiGroups.splice(fromIndex, 1)
  emojiGroups.splice(Math.min(Math.max(0, toIndex), emojiGroups.length), 0, g)
  settingsStore.save(emojiGroups, ungrouped)
  return true
}

function resetAllUsageCounts() {
  for (const g of emojiGroups) {
    if (Array.isArray(g.emojis)) {
      for (const e of g.emojis) {
        e.usageCount = 0
        e.lastUsed = undefined
      }
    }
  }
  for (const e of ungrouped) {
    e.usageCount = 0
    e.lastUsed = undefined
  }
  settingsStore.save(emojiGroups, ungrouped)
}

function resetUsageCountByUUID(uuid: string) {
  const found = findEmojiByUUID(uuid)
  if (found && found.emoji) {
    const e: any = found.emoji
    e.usageCount = 0
    e.lastUsed = undefined
    settingsStore.save(emojiGroups, ungrouped)
    return true
  }
  // fallback: try ungrouped
  const ue = ungrouped.find((x) => x.UUID === (uuid as any))
  if (ue) {
    ue.usageCount = 0
    ue.lastUsed = undefined
    settingsStore.save(emojiGroups, ungrouped)
    return true
  }
  return false
}

initFromStorage()

export default {
  resetAllUsageCounts,
  getEmojiGroups,
  getNormalGroups,
  getCommonEmojiGroup,
  getHotEmojis,
  getUngrouped,
  setEmojiGroups,
  findGroupByUUID,
  findEmojiByUUID,
  addGroup,
  removeGroup,
  addEmojiToGroup,
  removeEmojiFromGroup,
  moveEmojiBetweenGroups,
  reorderEmojiInGroup,
  reorderGroups,
  addUngrouped,
  removeUngroupedByUUID,
  recordUsageByUUID,
  resetUsageCountByUUID,
}
