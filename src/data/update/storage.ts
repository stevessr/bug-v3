import type { Settings } from '../type/settings/settings'
declare const chrome: any
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
    // set a local flag indicating session sync is pending for this tab
    try {
      window.localStorage.setItem('bugcopilot_flag_session_pending', 'true')
    } catch (_) {}
    // notify background that localStorage payload updated
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: 'payload-updated', payload })
      }
    } catch (_) {}
  } catch (_) {
    // ignore
  }
}

export default { loadPayload, savePayload }
