import settingsStore from '../update/settingsStore'
import emojiGroupsStore from '../update/emojiGroupsStore'
import storage from '../update/storage'

export function getSettings() {
  return settingsStore.getSettings()
}

export function saveSettings(s: any) {
  settingsStore.setSettings(s, emojiGroupsStore.getEmojiGroups())
}

export function getGroups() {
  return emojiGroupsStore.getEmojiGroups()
}

export function getUngrouped() {
  return emojiGroupsStore.getUngrouped()
}

export function getHot() {
  // best-effort: gather emojis with usageCount
  const all: any[] = []
  for (const g of getGroups()) {
    if (Array.isArray(g.emojis))
      all.push(...g.emojis.map((e: any) => ({ ...e, groupUUID: g.UUID })))
  }
  const withUsage = all.filter((e) => typeof e.usageCount === 'number')
  withUsage.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
  return withUsage.slice(0, 50)
}

export function recordUsage(uuid: string) {
  return (emojiGroupsStore as any).recordUsageByUUID(uuid)
}

export function exportPayload() {
  const payload = { Settings: getSettings(), emojiGroups: getGroups() }
  return JSON.stringify(payload, null, 2)
}

export function importPayload(p: any) {
  if (!p) return false
  if (p.Settings) settingsStore.setSettings(p.Settings, p.emojiGroups || undefined)
  if (Array.isArray(p.emojiGroups)) emojiGroupsStore.setEmojiGroups(p.emojiGroups)
  if (Array.isArray(p.ungrouped)) {
    // naive migration: replace existing ungrouped with provided
    const ug = p.ungrouped
    ;(emojiGroupsStore as any).setEmojiGroups(emojiGroupsStore.getEmojiGroups())
    // set ungrouped internal state if supported
    if ((emojiGroupsStore as any).addUngrouped && Array.isArray(ug)) {
      ug.forEach((e: any) => (emojiGroupsStore as any).addUngrouped(e))
    }
  }
  return true
}

export default {
  getSettings,
  saveSettings,
  getGroups,
  getUngrouped,
  getHot,
  exportPayload,
  importPayload,
}
