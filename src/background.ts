// Simple background message broker
// Listens for runtime messages and forwards them or logs them.

// This file is intended to be registered as the extension background/service worker entry.

// minimal ambient declarations to satisfy TS in the extension background context
declare const chrome: any
declare const browser: any

function log(...args: any[]) {
  try {
    console.log('[background]', ...args)
  } catch (_) {}
}

type MessageSender = any

// Helper to broadcast a message from background to other extension contexts
function broadcastFromBackground(message: any) {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      // include a `from` marker so recipients can ignore their own messages
      chrome.runtime.sendMessage({ ...(message || {}), from: 'background' }, () => {})
    }
  } catch (err) {
    try {
      if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
        browser.runtime.sendMessage({ ...(message || {}), from: 'background' })
      }
    } catch (_) {}
  }
}

// cache last payload received from pages so content scripts can request it
let lastPayload: any = null

// initialize cache: prefer to load via extension storage module, fall back to localStorage
;(async () => {
  try {
    const mod = await import('./data/update/storage')
    if (mod && typeof mod.loadPayload === 'function') {
      try {
        lastPayload = mod.loadPayload()
        return
      } catch (_) {
        lastPayload = null
      }
    }
  } catch (_) {
    // ignore import failures
  }

  // fallback to localStorage if module import failed or loadPayload not available
  try {
    const raw =
      (globalThis as any).localStorage?.getItem &&
      (globalThis as any).localStorage.getItem('bugcopilot_settings_v1')
    lastPayload = raw ? JSON.parse(raw) : null
  } catch (_) {
    lastPayload = null
  }
})()

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener(
    (msg: any, sender: MessageSender, sendResponse: (resp: any) => void) => {
      log({ event: 'onMessage', msg, sender })

      try {
        // When storage.savePayload writes to localStorage it sends a `payload-updated` message
        // to background; background should broadcast the updated payload to other pages so UI
        // can refresh (groups, settings, ungrouped).
        if (msg && msg.type === 'payload-updated' && msg.payload) {
          const payload = msg.payload || {}
          // update cache
          lastPayload = payload
          try {
            // broadcast groups changed
            broadcastFromBackground({
              type: 'app:groups-changed',
              payload: payload.emojiGroups || [],
            })
          } catch (_) {}
          try {
            // broadcast settings changed
            broadcastFromBackground({
              type: 'app:settings-changed',
              payload: payload.Settings || {},
            })
          } catch (_) {}
          try {
            // also notify data import/update if needed
            broadcastFromBackground({ type: 'app:data-imported', payload })
          } catch (_) {}
        }

        // allow content scripts to request the latest payload from background
        if (msg && msg.type === 'request-payload') {
          try {
            // reply with cached payload
            sendResponse && sendResponse({ ok: true, payload: lastPayload })
          } catch (_) {
            try {
              sendResponse && sendResponse({ ok: false })
            } catch (_) {}
          }
          // avoid further sendResponse
          return true
        }
      } catch (_) {}

      // echo back for debugging
      try {
        sendResponse && sendResponse({ ok: true, echo: msg })
      } catch (_) {}
      return true
    },
  )
} else if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.onMessage) {
  browser.runtime.onMessage.addListener((msg: any, sender: MessageSender) => {
    log({ event: 'onMessage', msg, sender })
    try {
      if (msg && msg.type === 'payload-updated' && msg.payload) {
        const payload = msg.payload || {}
        try {
          broadcastFromBackground({
            type: 'app:groups-changed',
            payload: payload.emojiGroups || [],
          })
        } catch (_) {}
        try {
          broadcastFromBackground({ type: 'app:settings-changed', payload: payload.Settings || {} })
        } catch (_) {}
        try {
          broadcastFromBackground({ type: 'app:data-imported', payload })
        } catch (_) {}
      }
    } catch (_) {}
    return { ok: true, echo: msg }
  })
}
