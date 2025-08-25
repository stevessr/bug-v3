import type { EmojiGroup } from '../type/emoji/emoji'
import storage from './storage'
import settingsStore from './settingsStore'

let emojiGroups: EmojiGroup[] = []
let ungrouped: any[] = []

function initFromStorage() {
  const p = storage.loadPayload()
  emojiGroups = Array.isArray(p?.emojiGroups) ? p!.emojiGroups : []
  ungrouped = Array.isArray(p?.ungrouped) ? p!.ungrouped : []
}

function getEmojiGroups() {
  return emojiGroups.map((g) => ({ ...g, emojis: [...g.emojis] }))
}

function getUngrouped() {
  return ungrouped.map((e) => ({ ...e }))
}

function setEmojiGroups(gs: EmojiGroup[]) {
  emojiGroups = gs.map((g) => ({ ...g, emojis: [...g.emojis] }))
  // persist together with settings
  settingsStore.save(emojiGroups)
}

function addUngrouped(emoji: any) {
  ungrouped.push(emoji)
  settingsStore.save(emojiGroups)
}

function removeUngroupedByUUID(uuid: string) {
  const idx = ungrouped.findIndex((e) => e.UUID === (uuid as any))
  if (idx >= 0) {
    ungrouped.splice(idx, 1)
    settingsStore.save(emojiGroups)
    return true
  }
  return false
}

function recordUsageByUUID(uuid: string) {
  // try to find in groups first
  const found = findEmojiByUUID(uuid)
  if (found && found.emoji) {
    const e: any = found.emoji
    const now = Date.now()
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
    settingsStore.save(emojiGroups)
    return true
  }
  // fallback: try ungrouped
  const ue = ungrouped.find((x) => x.UUID === (uuid as any))
  if (ue) {
    const now = Date.now()
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
    settingsStore.save(emojiGroups)
    return true
  }
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
  settingsStore.save(emojiGroups)
}

function removeGroup(uuid: string) {
  const idx = emojiGroups.findIndex((g) => g.UUID === (uuid as any))
  if (idx >= 0) {
    emojiGroups.splice(idx, 1)
    settingsStore.save(emojiGroups)
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
  settingsStore.save(emojiGroups)
  return true
}

function removeEmojiFromGroup(groupUUID: string, emojiUUID: string) {
  const g = emojiGroups.find((x) => x.UUID === (groupUUID as any))
  if (!g) return false
  const idx = g.emojis.findIndex((e) => e.UUID === (emojiUUID as any))
  if (idx >= 0) {
    g.emojis.splice(idx, 1)
    settingsStore.save(emojiGroups)
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
  settingsStore.save(emojiGroups)
  return true
}

function reorderEmojiInGroup(groupUUID: string, fromIndex: number, toIndex: number) {
  const g = emojiGroups.find((x) => x.UUID === (groupUUID as any))
  if (!g) return false
  if (fromIndex < 0 || fromIndex >= g.emojis.length) return false
  const [e] = g.emojis.splice(fromIndex, 1)
  g.emojis.splice(Math.min(Math.max(0, toIndex), g.emojis.length), 0, e)
  settingsStore.save(emojiGroups)
  return true
}

initFromStorage()

export default {
  getEmojiGroups,
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
  addUngrouped,
  removeUngroupedByUUID,
  recordUsageByUUID,
}
