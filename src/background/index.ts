// background/index.ts - background broker
// Listens for runtime messages and supports broadcasting to other extension contexts and content scripts.

declare const chrome: any
declare const browser: any

import { getRuntimeSyncConfig } from '../data/sync-config'

// runtime-configurable sync params (will be populated async)
const CONFIG: { ACK_TIMEOUT_MS: number; MAX_RETRIES: number; POLL_INTERVAL_MS: number } = {
  ACK_TIMEOUT_MS: 3000,
  MAX_RETRIES: 3,
  POLL_INTERVAL_MS: 1000,
}

// populate from chrome.storage.local if available
try {
  getRuntimeSyncConfig().then((cfg) => {
    try {
      Object.assign(CONFIG, cfg)
      log('Sync config loaded', CONFIG)
    } catch (_) {}
  })
} catch (_) {}

function appendTelemetry(ev: any) {
  try {
    const item = { ts: Date.now(), ...ev }
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['sync_telemetry'], (res: any) => {
        try {
          const arr = Array.isArray(res?.sync_telemetry) ? res.sync_telemetry : []
          arr.push(item)
          // keep telemetry short
          if (arr.length > 200) arr.splice(0, arr.length - 200)
          chrome.storage.local.set({ sync_telemetry: arr })
        } catch (_) {}
      })
    }
  } catch (_) {}
}

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

async function sendMessageToAllTabs(msg: any) {
  try {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({}, (tabs: any[]) => {
        for (const t of tabs) {
          try {
            chrome.tabs.sendMessage(t.id, msg)
          } catch (_) {}
        }
      })
    }
  } catch (_) {}
}

// SyncManager: orchestrates payload flow localStorage -> session -> extended -> indexedDB
const SyncManager = (function () {
  let sessionTimer: any = null
  let extendedTimer: any = null
  let indexedTimer: any = null
  let ackTimeout: any = null
  let retries: number = 0
  let lastPayload: any = null

  function clearTimers() {
    try {
      if (sessionTimer) clearInterval(sessionTimer)
    } catch (_) {}
    try {
      if (extendedTimer) clearInterval(extendedTimer)
    } catch (_) {}
    try {
      if (indexedTimer) clearInterval(indexedTimer)
    } catch (_) {}
    sessionTimer = extendedTimer = indexedTimer = null
    try {
      if (ackTimeout) clearTimeout(ackTimeout)
    } catch (_) {}
    ackTimeout = null
    retries = 0
  }

  function onLocalPayloadUpdated(payload: any) {
    try {
      lastPayload = payload
      log('SyncManager: local updated, scheduling session sync')
      appendTelemetry({ event: 'local_payload_updated' })
      // start session timer (1s)
      try {
        if (sessionTimer) clearInterval(sessionTimer)
      } catch (_) {}
      retries = 0
      sessionTimer = setInterval(() => doSessionSync(), CONFIG.POLL_INTERVAL_MS)
    } catch (_) {}
  }

  function onStageAck(stage: string) {
    try {
      log('SyncManager: received stage ack', stage)
      if (stage === 'session') {
        // stop session timer and immediately run extended sync
        try {
          if (sessionTimer) clearInterval(sessionTimer)
        } catch (_) {}
        sessionTimer = null
        // run extended sync now
        doExtendedSync()
        return
      }
      if (stage === 'extended') {
        try {
          if (extendedTimer) clearInterval(extendedTimer)
        } catch (_) {}
        extendedTimer = null
        // run indexed sync now
        doIndexedSync()
        return
      }
    } catch (_) {}
  }

  async function doSessionSync() {
    try {
      if (!lastPayload) return
      log('SyncManager: broadcasting session payload')
      // broadcast to all tabs so content scripts can set sessionStorage
      try {
        // instruct all tabs to mark session pending and broadcast session payload
        sendMessageToAllTabs({
          type: 'set-local-flag',
          key: 'bugcopilot_flag_session_pending',
          value: 'true',
        })
        broadcastToTabs({ type: 'sync-session', payload: lastPayload })
        // start ack timeout waiting for stage-ack
        try {
          if (ackTimeout) clearTimeout(ackTimeout)
        } catch (_) {}
        ackTimeout = setTimeout(() => onStageTimeout('session'), CONFIG.ACK_TIMEOUT_MS)
      } catch (_) {}
      // after broadcasting, stop session timer and schedule extended sync
      try {
        if (sessionTimer) clearInterval(sessionTimer)
      } catch (_) {}
      sessionTimer = null
      // schedule extended sync in 5s (interval to retry)
      try {
        if (extendedTimer) clearInterval(extendedTimer)
      } catch (_) {}
      extendedTimer = setInterval(() => doExtendedSync(), 5000)
    } catch (_) {}
  }

  async function doExtendedSync() {
    try {
      if (!lastPayload) return
      log('SyncManager: writing extended storage')
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ extended_payload: lastPayload })
          // notify tabs that extended storage will be updated
          sendMessageToAllTabs({
            type: 'set-local-flag',
            key: 'bugcopilot_flag_extended_pending',
            value: 'true',
          })
          // start ack timeout waiting for stage-ack
          try {
            if (ackTimeout) clearTimeout(ackTimeout)
          } catch (_) {}
          ackTimeout = setTimeout(() => onStageTimeout('extended'), CONFIG.ACK_TIMEOUT_MS)
        }
      } catch (_) {}
      // stop extended timer and schedule indexedDB sync
      try {
        if (extendedTimer) clearInterval(extendedTimer)
      } catch (_) {}
      extendedTimer = null
      try {
        if (indexedTimer) clearInterval(indexedTimer)
      } catch (_) {}
      indexedTimer = setInterval(() => doIndexedSync(), 10000)
    } catch (_) {}
  }

  async function doIndexedSync() {
    try {
      if (!lastPayload) return
      log('SyncManager: writing indexedDB')
      try {
        const req = indexedDB.open('bugcopilot-db', 1)
        req.onupgradeneeded = (e: any) => {
          try {
            const db = e.target.result
            if (!db.objectStoreNames.contains('payloads'))
              db.createObjectStore('payloads', { keyPath: 'ts' })
          } catch (_) {}
        }
        req.onsuccess = () => {
          try {
            const db = req.result
            const tx = db.transaction('payloads', 'readwrite')
            const storeDB = tx.objectStore('payloads')
            storeDB.put({ ts: Date.now(), payload: lastPayload })
            tx.oncomplete = () => {
              try {
                log('SyncManager: indexedDB write complete')
                appendTelemetry({ event: 'indexeddb_write', ok: true })
              } catch (_) {}
            }
          } catch (_) {}
        }
        req.onerror = () => {
          try {
            log('SyncManager: indexedDB write error')
            appendTelemetry({ event: 'indexeddb_write', ok: false })
          } catch (_) {}
        }
      } catch (_) {}
      // cleanup
      try {
        if (indexedTimer) clearInterval(indexedTimer)
      } catch (_) {}
      indexedTimer = null
      // clear any pending flags in tabs now that everything persisted
      try {
        sendMessageToAllTabs({ type: 'clear-local-flag', key: 'bugcopilot_flag_session_pending' })
        sendMessageToAllTabs({ type: 'clear-local-flag', key: 'bugcopilot_flag_extended_pending' })
      } catch (_) {}
      lastPayload = null
      try {
        if (ackTimeout) clearTimeout(ackTimeout)
      } catch (_) {}
      ackTimeout = null
      retries = 0
    } catch (_) {}
  }

  function onStageTimeout(stage: string) {
    try {
      retries = (retries || 0) + 1
      log('SyncManager: stage timeout', stage, 'retry', retries)
      appendTelemetry({ event: 'stage_timeout', stage, retry: retries })
      if (retries <= CONFIG.MAX_RETRIES) {
        // resend the stage messages
        if (stage === 'session') {
          try {
            sendMessageToAllTabs({
              type: 'set-local-flag',
              key: 'bugcopilot_flag_session_pending',
              value: 'true',
            })
            broadcastToTabs({ type: 'sync-session', payload: lastPayload })
          } catch (_) {}
          try {
            if (ackTimeout) clearTimeout(ackTimeout)
          } catch (_) {}
          ackTimeout = setTimeout(() => onStageTimeout('session'), CONFIG.ACK_TIMEOUT_MS)
          return
        }
        if (stage === 'extended') {
          try {
            sendMessageToAllTabs({
              type: 'set-local-flag',
              key: 'bugcopilot_flag_extended_pending',
              value: 'true',
            })
            // also re-write extended payload in case of transient error
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
              chrome.storage.local.set({ extended_payload: lastPayload })
            }
          } catch (_) {}
          try {
            if (ackTimeout) clearTimeout(ackTimeout)
          } catch (_) {}
          ackTimeout = setTimeout(() => onStageTimeout('extended'), CONFIG.ACK_TIMEOUT_MS)
          return
        }
      }
      // max retries exceeded — proceed to next stage to avoid stalling
      log('SyncManager: max retries exceeded for', stage, 'proceeding')
      appendTelemetry({ event: 'stage_max_retries', stage })
      try {
        if (stage === 'session') doExtendedSync()
        if (stage === 'extended') doIndexedSync()
      } catch (_) {}
      try {
        if (ackTimeout) clearTimeout(ackTimeout)
      } catch (_) {}
      ackTimeout = null
      retries = 0
    } catch (_) {}
  }

  return { onLocalPayloadUpdated, clearTimers, onStageAck }
})()

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener(
    (msg: any, sender: any, sendResponse: (resp: any) => void) => {
      log('onMessage', { msg, from: sender })
      // handle payload-updated events from page localStorage
      try {
        if (msg && msg.type === 'payload-updated') {
          try {
            SyncManager.onLocalPayloadUpdated(msg.payload)
          } catch (_) {}
          sendResponse({ ok: true })
          return true
        }
        if (msg && msg.type === 'stage-ack') {
          try {
            SyncManager.onStageAck(msg.stage)
          } catch (_) {}
          sendResponse({ ok: true })
          return true
        }
      } catch (_) {}
      try {
        if (msg && msg.type === 'broadcast') {
          const payload = {
            type: 'broadcast',
            channel: msg.channel || 'default',
            from: msg.from || sender,
            payload: msg.payload,
          }
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
        const payload = {
          type: 'broadcast',
          channel: msg.channel || 'default',
          from: msg.from || sender,
          payload: msg.payload,
        }
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
