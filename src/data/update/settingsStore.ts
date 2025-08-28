import type { Settings } from '../type/settings/settings'
import type { EmojiGroup } from '../type/emoji/emoji'

import storage from './storage'
import type { PersistPayload } from './storage'

const defaults: Settings = {
  imageScale: 30,
  defaultEmojiGroupUUID: '00000000-0000-0000-0000-000000000000' as any,
  gridColumns: 4,
  outputFormat: 'markdown',
  MobileMode: false,
  sidebarCollapsed: false,
  lastModified: new Date(),
}

let current: Settings = { ...defaults }
type Listener = (s: Settings) => void
const listeners: Listener[] = []

function initFromPayload(p?: PersistPayload | null) {
  if (!p) return
  current = { ...defaults, ...(p.Settings || {}) }
  if (current.lastModified && typeof (current.lastModified as any) === 'string') {
    current.lastModified = new Date(current.lastModified as any as string)
  }
}

function getSettings() {
  return { ...current }
}

function setSettings(patch: Partial<Settings>, groups?: EmojiGroup[]) {
  current = { ...current, ...patch }
  save(groups)
}

function save(groups?: EmojiGroup[], ungrouped?: any[]) {
  // Added ungrouped parameter
  current.lastModified = new Date()
  // preserve any existing ungrouped payload if present
  const existing = storage.loadPayload()
  // ensure we NEVER persist a `scale` field on emoji objects — scale must always come from settings
  function stripScaleFromEmoji(e: any) {
    if (!e || typeof e !== 'object') return e
    const { scale, ...rest } = e
    return { ...rest }
  }

  function stripScaleFromGroups(gs: EmojiGroup[] | undefined) {
    if (!Array.isArray(gs)) return []
    return gs.map((g) => {
      const emojis = Array.isArray((g as any).emojis)
        ? (g as any).emojis.map((ee: any) => stripScaleFromEmoji(ee))
        : []
      return { ...g, emojis }
    })
  }

  const payload: PersistPayload = {
    Settings: current,
    emojiGroups: stripScaleFromGroups(groups || []),
    // Use the passed ungrouped array, fallback to existing if not provided
    ungrouped: (ungrouped || existing?.ungrouped || []).map((u: any) => stripScaleFromEmoji(u)),
  }
  storage.savePayload(payload)
  listeners.forEach((l) => l(current))
}

function onChange(fn: Listener) {
  listeners.push(fn)
  return () => {
    const idx = listeners.indexOf(fn)
    if (idx >= 0) listeners.splice(idx, 1)
  }
}

// init from storage
initFromPayload(storage.loadPayload())

export default {
  defaults,
  getSettings,
  setSettings,
  save,
  onChange,
}
