import type { Settings } from '../type/settings/settings'
import type { EmojiGroup } from '../type/emoji/emoji'

const STORAGE_KEY = 'bugcopilot_settings_v1'

export type PersistPayload = {
  Settings: Settings
  emojiGroups: EmojiGroup[]
  // newly added: ungrouped emojis that are not inside any group
  ungrouped?: any[]
}

export function loadPayload(): PersistPayload | null {
  if (typeof window === 'undefined' || !window.localStorage) return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersistPayload
  } catch (_) {
    return null
  }
}

export function savePayload(payload: PersistPayload) {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch (_) {
    // ignore
  }
}

export default { loadPayload, savePayload }
