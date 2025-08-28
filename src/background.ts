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

// Keys for chrome storage access
const KEY_SETTINGS = 'Settings'
const KEY_UNGROUPED = 'ungrouped'
const KEY_EMOJI_PREFIX = 'emojiGroups-'
const KEY_EMOJI_INDEX = 'emojiGroups-index'

// Function to load data from chrome.storage.local
async function loadFromChromeStorage(): Promise<any> {
  return new Promise((resolve) => {
    try {
      if (chrome && chrome.storage && chrome.storage.local && chrome.storage.local.get) {
        chrome.storage.local.get(null, (items: any) => {
          try {
            if (chrome.runtime.lastError) {
              log('Chrome storage error:', chrome.runtime.lastError)
              resolve(null)
              return
            }

            // Assemble payload from storage items
            const Settings = items[KEY_SETTINGS] || {}
            const ungrouped = items[KEY_UNGROUPED] || []

            // Collect emoji groups using index
            const emojiGroups: any[] = []
            const indexList = items[KEY_EMOJI_INDEX] || []

            if (Array.isArray(indexList)) {
              for (const uuid of indexList) {
                const groupKey = `${KEY_EMOJI_PREFIX}${uuid}`
                const group = items[groupKey]
                if (group) {
                  emojiGroups.push(group)
                }
              }
            }

            // If no groups found via index, scan for all emojiGroups-* keys
            if (emojiGroups.length === 0) {
              Object.keys(items).forEach((key) => {
                if (key.startsWith(KEY_EMOJI_PREFIX)) {
                  const group = items[key]
                  if (group) {
                    emojiGroups.push(group)
                  }
                }
              })
            }

            const payload = {
              Settings,
              emojiGroups,
              ungrouped,
            }

            log('Loaded from chrome storage:', {
              settingsKeys: Object.keys(Settings).length,
              groupsCount: emojiGroups.length,
              ungroupedCount: ungrouped.length,
            })

            resolve(payload)
          } catch (error) {
            log('Error assembling storage data:', error)
            resolve(null)
          }
        })
      } else {
        resolve(null)
      }
    } catch (error) {
      log('Error accessing chrome storage:', error)
      resolve(null)
    }
  })
}

// initialize cache: prefer to load from chrome storage, fall back to localStorage
;(async () => {
  try {
    // First try chrome storage
    const chromePayload = await loadFromChromeStorage()
    if (chromePayload && chromePayload.emojiGroups && chromePayload.emojiGroups.length > 0) {
      lastPayload = chromePayload
      log('Initialized with chrome storage data:', chromePayload.emojiGroups.length, 'groups')
      return
    }
  } catch (error) {
    log('Failed to load from chrome storage:', error)
  }

  // Fallback to loading via storage module
  try {
    const mod = await import('./data/update/storage')
    if (mod && typeof mod.loadPayload === 'function') {
      try {
        lastPayload = mod.loadPayload()
        if (lastPayload) {
          log('Initialized with storage module data')
          return
        }
      } catch (_) {
        lastPayload = null
      }
    }
  } catch (_) {
    // ignore import failures
  }

  // final fallback to localStorage if module import failed or loadPayload not available
  try {
    const raw =
      (globalThis as any).localStorage?.getItem &&
      (globalThis as any).localStorage.getItem('bugcopilot_settings_v1')
    lastPayload = raw ? JSON.parse(raw) : null
    if (lastPayload) {
      log('Initialized with localStorage fallback')
    }
  } catch (_) {
    lastPayload = null
  }

  if (!lastPayload) {
    log('No payload found in any storage location')
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
          log('Payload updated, new cache has', payload.emojiGroups?.length || 0, 'groups')
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
          try {
            // Broadcast to content scripts that settings have been updated
            broadcastFromBackground({ type: 'SETTINGS_UPDATED' })
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

        // Handle GET_EMOJI_DATA requests from content scripts
        if (msg && msg.type === 'GET_EMOJI_DATA') {
          try {
            // Refresh data from chrome storage before responding
            loadFromChromeStorage()
              .then((freshPayload) => {
                try {
                  const payload = freshPayload || lastPayload
                  if (payload && payload.emojiGroups && Array.isArray(payload.emojiGroups)) {
                    const response = {
                      success: true,
                      data: {
                        groups: payload.emojiGroups,
                        // 增加分离数据结构支持
                        normalGroups: (payload.emojiGroups || []).filter(
                          (g: any) => g.UUID !== 'common-emoji-group',
                        ),
                        commonEmojiGroup:
                          (payload.emojiGroups || []).find(
                            (g: any) => g.UUID === 'common-emoji-group',
                          ) || null,
                        hotEmojis: [], // 后续实现热门表情计算
                        settings: payload.Settings || {},
                        ungroupedEmojis: payload.ungrouped || [],
                      },
                    }
                    log('Responding to GET_EMOJI_DATA with', payload.emojiGroups.length, 'groups')
                    sendResponse && sendResponse(response)
                  } else {
                    log('No emoji data available for GET_EMOJI_DATA request')
                    sendResponse &&
                      sendResponse({
                        success: false,
                        error: 'No emoji data available',
                      })
                  }
                } catch (error) {
                  log('Error preparing GET_EMOJI_DATA response:', error)
                  sendResponse &&
                    sendResponse({
                      success: false,
                      error: error instanceof Error ? error.message : String(error),
                    })
                }
              })
              .catch((error) => {
                log('Error loading fresh data for GET_EMOJI_DATA:', error)
                try {
                  // Fallback to cached payload
                  const payload = lastPayload
                  if (payload && payload.emojiGroups && Array.isArray(payload.emojiGroups)) {
                    const response = {
                      success: true,
                      data: {
                        groups: payload.emojiGroups,
                        settings: payload.Settings || {},
                        ungroupedEmojis: payload.ungrouped || [],
                      },
                    }
                    sendResponse && sendResponse(response)
                  } else {
                    sendResponse &&
                      sendResponse({
                        success: false,
                        error: 'No emoji data available',
                      })
                  }
                } catch (_) {
                  sendResponse &&
                    sendResponse({
                      success: false,
                      error: 'Failed to load emoji data',
                    })
                }
              })
          } catch (error) {
            try {
              sendResponse &&
                sendResponse({
                  success: false,
                  error: error instanceof Error ? error.message : String(error),
                })
            } catch (_) {}
          }
          // Return true to indicate async response
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
        lastPayload = payload
        log('Payload updated (browser), new cache has', payload.emojiGroups?.length || 0, 'groups')
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
        try {
          broadcastFromBackground({ type: 'SETTINGS_UPDATED' })
        } catch (_) {}
      }

      // Handle GET_EMOJI_DATA for Firefox
      if (msg && msg.type === 'GET_EMOJI_DATA') {
        return loadFromChromeStorage()
          .then((freshPayload) => {
            try {
              const payload = freshPayload || lastPayload
              if (payload && payload.emojiGroups && Array.isArray(payload.emojiGroups)) {
                const response = {
                  success: true,
                  data: {
                    groups: payload.emojiGroups,
                    // 增加分离数据结构支持
                    normalGroups: (payload.emojiGroups || []).filter(
                      (g: any) => g.UUID !== 'common-emoji-group',
                    ),
                    commonEmojiGroup:
                      (payload.emojiGroups || []).find(
                        (g: any) => g.UUID === 'common-emoji-group',
                      ) || null,
                    hotEmojis: [], // 后续实现热门表情计算
                    settings: payload.Settings || {},
                    ungroupedEmojis: payload.ungrouped || [],
                  },
                }
                log(
                  'Responding to GET_EMOJI_DATA (browser) with',
                  payload.emojiGroups.length,
                  'groups',
                )
                return response
              } else {
                log('No emoji data available for GET_EMOJI_DATA request (browser)')
                return {
                  success: false,
                  error: 'No emoji data available',
                }
              }
            } catch (error) {
              log('Error preparing GET_EMOJI_DATA response (browser):', error)
              return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              }
            }
          })
          .catch((error) => {
            log('Error loading fresh data for GET_EMOJI_DATA (browser):', error)
            try {
              const payload = lastPayload
              if (payload && payload.emojiGroups && Array.isArray(payload.emojiGroups)) {
                return {
                  success: true,
                  data: {
                    groups: payload.emojiGroups,
                    settings: payload.Settings || {},
                    ungroupedEmojis: payload.ungrouped || [],
                  },
                }
              } else {
                return {
                  success: false,
                  error: 'No emoji data available',
                }
              }
            } catch (_) {
              return {
                success: false,
                error: 'Failed to load emoji data',
              }
            }
          })
      }
    } catch (_) {}
    return { ok: true, echo: msg }
  })
}
