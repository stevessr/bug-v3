// WebSocket integration with manager for userscript
import { logger } from '@/config/buildFlags'
import { saveDataToLocalStorage } from './userscript-storage'

// WebSocket state
let managerWs: WebSocket | null = null
let wsReconnectAttempts = 0
let wsReconnectTimer: number | null = null

// Initialize userscript data function reference (will be set by main module)
let initializeUserscriptDataFn: (() => Promise<void>) | null = null

export function setInitializeUserscriptDataFn(fn: () => Promise<void>) {
  initializeUserscriptDataFn = fn
}

function connectToManagerWS() {
  try {
    const wsUrl = localStorage.getItem('emoji_extension_ws_url') || 'ws://localhost:8765'
    if (!wsUrl) return
    if (managerWs && managerWs.readyState === WebSocket.OPEN) return

    logger.log('[Userscript WS] Connecting to', wsUrl)
    managerWs = new WebSocket(wsUrl)

    managerWs.onopen = () => {
      logger.log('[Userscript WS] connected to manager')
      wsReconnectAttempts = 0
      // Optionally request an export immediately
      try {
        managerWs?.send(JSON.stringify({ type: 'request_export' }))
      } catch (e) {
        logger.warn('[Userscript WS] failed to send request_export', e)
      }
    }

    managerWs.onmessage = ev => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg && msg.type === 'export' && msg.payload) {
          logger.log('[Userscript WS] Received export payload from manager')
          const payload = msg.payload
          // Persist to userscript storage using existing API
          try {
            // Save groups and settings if present
            if (payload.emojiGroups) {
              // userscript-storage expects groups array stored under STORAGE_KEY
              saveDataToLocalStorage({ emojiGroups: payload.emojiGroups })
            }
            if (payload.settings) {
              saveDataToLocalStorage({ settings: payload.settings })
            }
            // Refresh in-memory state
            if (initializeUserscriptDataFn) {
              initializeUserscriptDataFn()
            }
            logger.log('[Userscript WS] Imported manager data into localStorage')
          } catch (e) {
            logger.error('[Userscript WS] Failed to persist manager payload', e)
          }
        } else {
          logger.log('[Userscript WS] message', msg)
        }
      } catch (e) {
        logger.warn('[Userscript WS] invalid message', ev.data)
      }
    }

    managerWs.onclose = () => {
      logger.warn('[Userscript WS] connection closed')
      managerWs = null
      scheduleWsReconnect()
    }

    managerWs.onerror = err => {
      logger.error('[Userscript WS] error', err)
      // Let onclose handle reconnect
    }
  } catch (error) {
    logger.error('[Userscript WS] connect failed', error)
    scheduleWsReconnect()
  }
}

function scheduleWsReconnect() {
  try {
    wsReconnectAttempts = Math.min(10, wsReconnectAttempts + 1)
    const backoff = Math.min(30000, 1000 * Math.pow(1.5, wsReconnectAttempts))
    if (wsReconnectTimer) window.clearTimeout(wsReconnectTimer)
    wsReconnectTimer = window.setTimeout(() => {
      connectToManagerWS()
    }, backoff)
    logger.log('[Userscript WS] scheduled reconnect in', backoff, 'ms')
  } catch (e) {
    logger.error('[Userscript WS] schedule reconnect failed', e)
  }
}

// Initialize WebSocket connection and BroadcastChannel listener
export function initializeWebSocketManager() {
  // Start automatic connection in background (best-effort)
  try {
    // Delay a bit to avoid racing during page load
    setTimeout(() => {
      connectToManagerWS()
    }, 2000)
  } catch (e) {
    logger.warn('[Userscript WS] failed to start auto-connect', e)
  }

  // Listen for manager presence via BroadcastChannel for auto-discovery
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('emoji-manager-channel')
      bc.onmessage = ev => {
        try {
          const msg = ev.data
          if (msg && msg.type === 'manager:presence' && msg.wsUrl) {
            logger.log('[Userscript] Discovered manager wsUrl via BroadcastChannel:', msg.wsUrl)
            try {
              localStorage.setItem('emoji_extension_ws_url', msg.wsUrl)
            } catch (e) {
              logger.warn('[Userscript] failed to persist ws url', e)
            }
            // Attempt immediate connect
            connectToManagerWS()
          }
        } catch (e) {
          logger.warn('[Userscript] BroadcastChannel message parse failed', e)
        }
      }
    }
  } catch (e) {
    logger.warn('[Userscript] BroadcastChannel not available', e)
  }
}
