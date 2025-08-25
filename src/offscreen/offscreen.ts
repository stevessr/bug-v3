// src/offscreen/offscreen.ts
declare const chrome: any

function log(...args: any[]) {
  console.log('[offscreen]', ...args)
}

let lastLocalStoragePayload: string | null = null
let lastSessionStoragePayload: string | null = null

// 1s interval for localStorage -> sessionStorage
setInterval(() => {
  try {
    const currentLocalStoragePayload = localStorage.getItem('bugcopilot_settings_v1')
    if (currentLocalStoragePayload && currentLocalStoragePayload !== lastLocalStoragePayload) {
      log('localStorage changed, updating sessionStorage')
      sessionStorage.setItem('bugcopilot_settings_v1', currentLocalStoragePayload)
      lastLocalStoragePayload = currentLocalStoragePayload
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
