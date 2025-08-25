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

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener(
    (msg: any, sender: MessageSender, sendResponse: (resp: any) => void) => {
      log({ event: 'onMessage', msg, sender })
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
    return { ok: true, echo: msg }
  })
}
