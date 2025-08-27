// src/offscreen/offscreen.ts
declare const chrome: any

function log(...args: any[]) {
  console.log('[offscreen]', ...args)
}

let lastLocalStoragePayload: string | null = null
let lastSessionStoragePayload: string | null = null

const KEY_SETTINGS = 'Settings'
const KEY_UNGROUPED = 'ungrouped'
const KEY_EMOJI_PREFIX = 'emojiGroups-'

// 1s interval for localStorage -> sessionStorage
setInterval(() => {
  try {
    // prefer monolithic payload for compatibility
    const currentLocalStoragePayload = localStorage.getItem('bugcopilot_settings_v1')
    if (currentLocalStoragePayload && currentLocalStoragePayload !== lastLocalStoragePayload) {
      log('localStorage monolithic changed, updating sessionStorage')
      sessionStorage.setItem('bugcopilot_settings_v1', currentLocalStoragePayload)
      lastLocalStoragePayload = currentLocalStoragePayload

      // try to ensure extension storage is updated too (mirror localStorage into extension storage)
      try {
        const payload = JSON.parse(currentLocalStoragePayload)
        ;(async () => {
          try {
            const mod = await import('../data/update/storage')
            if (mod && typeof mod.savePayload === 'function') {
              try {
                mod.savePayload(payload)
              } catch (_) {}
            }
          } catch (_) {}
        })()
      } catch (_) {}

      return
    }

    // assemble from split keys
    try {
      const settingsRaw = localStorage.getItem(KEY_SETTINGS)
      const ungroupedRaw = localStorage.getItem(KEY_UNGROUPED)
      const Settings = settingsRaw ? JSON.parse(settingsRaw) : null
      const ungrouped = ungroupedRaw ? JSON.parse(ungroupedRaw) : []
      const emojiGroups: any[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (!k) continue
        if (k.startsWith(KEY_EMOJI_PREFIX)) {
          try {
            const g = JSON.parse(localStorage.getItem(k) as string)
            emojiGroups.push(g)
          } catch (_) {}
        }
      }
      const assembled = { Settings: Settings || {}, emojiGroups, ungrouped }
      const assembledRaw = JSON.stringify(assembled)
      if (assembledRaw !== lastLocalStoragePayload) {
        log('localStorage split-keys changed, updating sessionStorage')
        sessionStorage.setItem('bugcopilot_settings_v1', assembledRaw)
        lastLocalStoragePayload = assembledRaw

        // also mirror assembled payload into extension storage via storage.savePayload
        ;(async () => {
          try {
            const mod = await import('../data/update/storage')
            if (mod && typeof mod.savePayload === 'function') {
              try {
                mod.savePayload(assembled)
              } catch (_) {}
            }
          } catch (_) {}
        })()
      }
    } catch (err) {
      // ignore
    }
  } catch (error) {
    log('Error in localStorage -> sessionStorage sync:', error)
  }
}, 1000)

// 5s interval for sessionStorage -> background script
setInterval(() => {
  try {
    const currentSessionStoragePayload = sessionStorage.getItem('bugcopilot_settings_v1')
    if (
      currentSessionStoragePayload &&
      currentSessionStoragePayload !== lastSessionStoragePayload
    ) {
      log('sessionStorage changed, sending to background')
      const payload = JSON.parse(currentSessionStoragePayload)
      try {
        chrome.runtime.sendMessage({ type: 'session-storage-updated', payload }, (_resp: any) => {
          try {
            if (chrome.runtime && chrome.runtime.lastError) {
              log('offscreen sendMessage error:', chrome.runtime.lastError)
            }
          } catch (_) {}
        })
      } catch (_) {}
      lastSessionStoragePayload = currentSessionStoragePayload
    }
  } catch (error) {
    log('Error in sessionStorage -> background sync:', error)
  }
}, 5000)
