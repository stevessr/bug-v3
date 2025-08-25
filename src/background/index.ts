// background/index.ts - background broker
// Listens for runtime messages and supports broadcasting to other extension contexts and content scripts.

declare const chrome: any
declare const browser: any

function log(...args: any[]) {
  try {
    console.log('[background]', ...args)
  } catch (_) {}
}

/*
Content script example to receive broadcasts:

// in your content-script.js
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg && msg.type === 'broadcast') {
      // optionally filter by channel
      if (msg.channel === 'default' || msg.channel === 'my-channel') {
        // handle broadcast payload
        console.log('Received broadcast in content script', msg.payload)
      }
    }
  })
}

*/

async function broadcastToTabs(msg: any) {
  try {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({}, (tabs: any[]) => {
        for (const t of tabs) {
          try {
            chrome.tabs.sendMessage(t.id, msg)
          } catch (_) {}
        }
      })
    } else if (typeof browser !== 'undefined' && browser.tabs) {
      const tabs = await browser.tabs.query({})
      for (const t of tabs) {
        try {
          browser.tabs.sendMessage(t.id, msg).catch(() => {})
        } catch (_) {}
      }
    }
  } catch (_) {}
}

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener(
    (msg: any, sender: any, sendResponse: (resp: any) => void) => {
      log('onMessage', { msg, from: sender })
      try {
      if (msg && msg.type === 'broadcast') {
          const payload = { type: 'broadcast', channel: msg.channel || 'default', from: msg.from || sender, payload: msg.payload }
          // forward to other extension pages / background listeners
          try {
            chrome.runtime.sendMessage(payload)
          } catch (_) {}
          // forward to content scripts in all tabs
          broadcastToTabs(payload)
          sendResponse({ ok: true })
          return true
        }

        if (msg && msg.type === 'relay') {
          // relay to other extension contexts
          try {
            chrome.runtime.sendMessage(msg)
          } catch (_) {}
          sendResponse({ ok: true })
          return true
        }
      } catch (err) {
        // ignore
      }
      // default echo
      sendResponse({ ok: true, echo: msg })
      return true
    },
  )
} else if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.onMessage) {
  browser.runtime.onMessage.addListener((msg: any, sender: any) => {
    log('onMessage', { msg, from: sender })
    try {
      if (msg && msg.type === 'broadcast') {
        const payload = { type: 'broadcast', channel: msg.channel || 'default', from: msg.from || sender, payload: msg.payload }
        try {
          browser.runtime.sendMessage(payload)
        } catch (_) {}
        broadcastToTabs(payload)
        return Promise.resolve({ ok: true })
      }
      if (msg && msg.type === 'relay') {
        try {
          browser.runtime.sendMessage(msg)
        } catch (_) {}
        return Promise.resolve({ ok: true })
      }
    } catch (_) {}
    return Promise.resolve({ ok: true, echo: msg })
  })
}

// expose simple connect handler for long-lived connections
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onConnect) {
  chrome.runtime.onConnect.addListener((port: any) => {
    log('onConnect', port?.name)
    port.onMessage &&
      port.onMessage.addListener((m: any) => {
        log('port message', m)
        if (m && m.type === 'broadcast') {
          chrome.runtime.sendMessage(m)
          broadcastToTabs(m)
        }
      })
  })
}
