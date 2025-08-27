import type { Settings } from '../type/settings/settings'
declare const chrome: any
import type { EmojiGroup } from '../type/emoji/emoji'

const STORAGE_KEY = 'bugcopilot_settings_v1'
const KEY_SETTINGS = 'Settings'
const KEY_UNGROUPED = 'ungrouped'
const KEY_EMOJI_PREFIX = 'emojiGroups-'

// in-memory cache mirroring chrome.storage.local for synchronous reads
let extCache: Record<string, any> = {}

// try to populate extCache from chrome.storage.local (async)
try {
  if (
    typeof chrome !== 'undefined' &&
    chrome.storage &&
    chrome.storage.local &&
    typeof chrome.storage.local.get === 'function'
  ) {
    try {
      chrome.storage.local.get(null, (items: any) => {
        try {
          extCache = items || {}
        } catch (_) {}
      })
    } catch (_) {}
  }
} catch (_) {}

export type PersistPayload = {
  Settings: Settings
  emojiGroups: EmojiGroup[]
  // newly added: ungrouped emojis that are not inside any group
  ungrouped?: any[]
}

export function loadPayload(): PersistPayload | null {
  if (typeof window === 'undefined' || !window.localStorage) return null
  try {
    // backward compat: if monolithic payload exists, use it
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        return JSON.parse(raw) as PersistPayload
      } catch (_) {
        // fallthrough to try split keys
      }
    }

    // assemble from split keys
    const settingsRaw = window.localStorage.getItem(KEY_SETTINGS)
    const ungroupedRaw = window.localStorage.getItem(KEY_UNGROUPED)

    const Settings = settingsRaw ? JSON.parse(settingsRaw) : null
    const ungrouped = ungroupedRaw ? JSON.parse(ungroupedRaw) : []

    // collect emoji groups by scanning keys
    const emojiGroups: any[] = []
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i)
        if (!k) continue
        if (k.startsWith(KEY_EMOJI_PREFIX)) {
          try {
            const g = JSON.parse(window.localStorage.getItem(k) as string)
            emojiGroups.push(g)
          } catch (_) {}
        }
      }
    } catch (_) {}

    if (!Settings && emojiGroups.length === 0 && (!ungrouped || ungrouped.length === 0)) return null

    return { Settings: Settings || ({} as any), emojiGroups, ungrouped }
  } catch (_) {
    return null
  }
}

export function savePayload(payload: PersistPayload) {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    // Write Settings
    try {
      window.localStorage.setItem(KEY_SETTINGS, JSON.stringify(payload.Settings || {}))
    } catch (_) {}

    // Write ungrouped
    try {
      window.localStorage.setItem(KEY_UNGROUPED, JSON.stringify(payload.ungrouped || []))
    } catch (_) {}

    // Write each emoji group into its own key: emojiGroups-$ID
    try {
      // Remove any existing emojiGroups-* keys that are not present in the new payload to avoid stale groups
      const existingKeys: string[] = []
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i)
        if (k && k.startsWith(KEY_EMOJI_PREFIX)) existingKeys.push(k)
      }

      const incomingKeys: string[] = []
      ;(payload.emojiGroups || []).forEach((g: any) => {
        const k = `${KEY_EMOJI_PREFIX}${g.uuid}`
        incomingKeys.push(k)
        try {
          window.localStorage.setItem(k, JSON.stringify(g))
        } catch (_) {}
      })

      // remove stale keys
      existingKeys.forEach((k) => {
        if (!incomingKeys.includes(k)) {
          try {
            window.localStorage.removeItem(k)
          } catch (_) {}
        }
      })
    } catch (_) {}

    // set a local flag indicating session sync is pending for this tab
    try {
      window.localStorage.setItem('bugcopilot_flag_session_pending', 'true')
    } catch (_) {}

    // notify background that localStorage payload updated (send assembled payload)
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        try {
          chrome.runtime.sendMessage({ type: 'payload-updated', payload }, (_resp: any) => {
            try {
              if (chrome.runtime && chrome.runtime.lastError) {
                // ignore but log
              }
            } catch (_) {}
          })
        } catch (_) {}
      }
    } catch (_) {}

    // also write to extension storage (async) if available
    try {
      if (
        typeof chrome !== 'undefined' &&
        chrome.storage &&
        chrome.storage.local &&
        typeof chrome.storage.local.set === 'function'
      ) {
        const storeObj: any = {}
        storeObj[KEY_SETTINGS] = payload.Settings || {}
        storeObj[KEY_UNGROUPED] = payload.ungrouped || []
        ;(payload.emojiGroups || []).forEach((g: any) => {
          storeObj[`${KEY_EMOJI_PREFIX}${g.uuid}`] = g
        })
        try {
          chrome.storage.local.set(storeObj, () => {
            try {
              // ignore errors; no need to block
            } catch (_) {}
          })
        } catch (_) {}
        try {
          // update in-memory mirror
          Object.keys(storeObj).forEach((k) => {
            try {
              extCache[k] = storeObj[k]
            } catch (_) {}
          })
        } catch (_) {}
      }
    } catch (_) {}
  } catch (_) {
    // ignore
  }
}

// Generic helpers to read/write arbitrary keys using the same dual-write strategy
export function setItem(key: string, value: any) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value))
      } catch (_) {}
    }
  } catch (_) {}

  try {
    if (
      typeof chrome !== 'undefined' &&
      chrome.storage &&
      chrome.storage.local &&
      typeof chrome.storage.local.set === 'function'
    ) {
      try {
        const obj: any = {}
        obj[key] = value
        chrome.storage.local.set(obj, () => {})
        try {
          // keep in-memory cache in sync for fast reads
          extCache[key] = value
        } catch (_) {}
      } catch (_) {}
    }
  } catch (_) {}
}

export function getItem(key: string): any | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(key)
      if (raw) {
        try {
          return JSON.parse(raw)
        } catch (_) {
          return null
        }
      }
    }
  } catch (_) {}
  try {
    // fallback to in-memory mirror of chrome.storage.local
    if (extCache && Object.prototype.hasOwnProperty.call(extCache, key)) {
      return extCache[key]
    }
  } catch (_) {}
  return null
}

export default { loadPayload, savePayload, setItem, getItem }
