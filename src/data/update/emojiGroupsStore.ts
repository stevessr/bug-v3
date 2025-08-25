import type { EmojiGroup } from '../type/emoji/emoji'
import storage from './storage'
import settingsStore from './settingsStore'

let emojiGroups: EmojiGroup[] = []
let ungroupedEmojis: any[] = []

function initFromStorage() {
  const p = storage.loadPayload()
  emojiGroups = Array.isArray(p?.emojiGroups) ? p!.emojiGroups : []
  ungroupedEmojis = Array.isArray(p?.ungrouped) ? p!.ungrouped : []
}

function getEmojiGroups() {
  return emojiGroups.map((g) => ({ ...g, emojis: [...g.emojis] }))
}

function getUngrouped() {
  return ungroupedEmojis.map((e) => ({ ...e }))
}

function setEmojiGroups(gs: EmojiGroup[]) {
  emojiGroups = gs.map((g) => ({ ...g, emojis: [...g.emojis] }))
  // persist together with settings
  settingsStore.save(emojiGroups)
}

function addUngrouped(emoji: any) {
  ungroupedEmojis.push(emoji)
  settingsStore.save(emojiGroups)
}

function removeUngroupedByUUID(uuid: string) {
  const idx = ungroupedEmojis.findIndex((e) => e.UUID === (uuid as any))
  if (idx >= 0) {
    ungroupedEmojis.splice(idx, 1)
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
    e.usageCount = (e.usageCount || 0) + 1
    e.lastUsed = Date.now()
    settingsStore.save(emojiGroups)
    return true
  }
  // fallback: try ungrouped
  const ue = ungroupedEmojis.find((x) => x.UUID === (uuid as any))
  if (ue) {
    ue.usageCount = (ue.usageCount || 0) + 1
    ue.lastUsed = Date.now()
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
