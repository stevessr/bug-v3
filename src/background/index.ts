// background/index.ts - background broker
// Listens for runtime messages and supports broadcasting to other extension contexts and content scripts.

declare const chrome: any
declare const browser: any

import { getRuntimeSyncConfig } from '../data/sync-config'
import { createBackgroundCommService } from '../services/communication'

// 创建通信服务实例
const commService = createBackgroundCommService()

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

// expose last payload so tabs that open late can request it
let lastPayloadGlobal: any = null

// Import data stores for accessing emoji data
let emojiGroupsStore: any = null
let settingsStore: any = null

// 独立的表情使用记录处理函数

/**
 * 通用的表情使用计数更新逻辑
 * @param uuid 表情的UUID
 * @param freshData 从存储加载的新鲜数据
 * @returns {boolean} 是否成功找到并更新了表情
 */
function updateEmojiUsageInData(uuid: string, freshData: any): boolean {
  if (!freshData || !freshData.emojiGroups) {
    return false
  }

  // Find and update the emoji in the data
  for (const group of freshData.emojiGroups) {
    if (group.emojis && Array.isArray(group.emojis)) {
      for (const emoji of group.emojis) {
        if (emoji.UUID === uuid) {
          const now = Date.now()
          if (!emoji.lastUsed) {
            emoji.usageCount = 1
            emoji.lastUsed = now
          } else {
            const days = Math.floor((now - (emoji.lastUsed || 0)) / (24 * 60 * 60 * 1000))
            if (days >= 1 && typeof emoji.usageCount === 'number') {
              emoji.usageCount = Math.floor(emoji.usageCount * Math.pow(0.8, days))
            }
            emoji.usageCount = (emoji.usageCount || 0) + 1
            emoji.lastUsed = now
          }
          return true
        }
      }
    }
  }
  return false
}

/**
 * Chrome环境下的表情使用记录处理函数（主要用于桌面端）
 * @param uuid 表情UUID
 * @param sendResponse 响应回调函数
 */
async function handleEmojiUsageChrome(uuid: string, sendResponse: (resp: any) => void) {
  try {
    log('Recording emoji usage for UUID (Chrome):', uuid)
    let success = false
    let shouldNotifyCommonGroup = false

    // Try to use emoji groups store if available
    if (emojiGroupsStore && typeof emojiGroupsStore.recordUsageByUUID === 'function') {
      try {
        success = emojiGroupsStore.recordUsageByUUID(uuid)
        log('recordUsageByUUID result (Chrome):', success)
        shouldNotifyCommonGroup = success
      } catch (error) {
        log('Error calling recordUsageByUUID (Chrome):', error)
      }
    }

    // If direct store call failed, try to load fresh data and update
    if (!success) {
      try {
        const freshData: any = await loadFromChromeStorage()
        if (updateEmojiUsageInData(uuid, freshData)) {
          // Save back to storage using Chrome API
          try {
            if (chrome.storage && chrome.storage.local && chrome.storage.local.set) {
              const saveData: any = {}
              freshData.emojiGroups.forEach((group: any) => {
                saveData[`emojiGroups-${group.UUID}`] = group
              })
              chrome.storage.local.set(saveData, () => {
                if (chrome.runtime.lastError) {
                  log('Error saving emoji usage update (Chrome):', chrome.runtime.lastError)
                  sendResponse({
                    success: false,
                    error: 'Failed to save to Chrome storage',
                  })
                } else {
                  log('Successfully saved emoji usage update (Chrome)')
                  // Update global cache
                  lastPayloadGlobal = freshData
                  success = true
                  shouldNotifyCommonGroup = true

                  // 发送响应
                  sendResponse({
                    success: true,
                    message: 'Usage recorded successfully',
                  })

                  // 🚀 关键修复：使用记录更新后，通知常用表情组变更
                  if (shouldNotifyCommonGroup) {
                    try {
                      // 获取更新后的常用表情组
                      const updatedCommonGroup = emojiGroupsStore?.getCommonEmojiGroup
                        ? emojiGroupsStore.getCommonEmojiGroup()
                        : null

                      if (updatedCommonGroup) {
                        log('Sending common emoji group update notification after usage record')
                        commService.sendCommonEmojiGroupChanged(updatedCommonGroup)
                        commService.sendSpecificGroupChanged(
                          'common-emoji-group',
                          updatedCommonGroup,
                        )
                      }
                    } catch (notifyError) {
                      log('Error sending common group update notification:', notifyError)
                    }
                  }
                }
              })
              return // Early return to avoid double response
            }
          } catch (saveError) {
            log('Error saving emoji usage (Chrome):', saveError)
          }
        }
      } catch (error) {
        log('Error updating emoji usage in fresh data (Chrome):', error)
      }
    }

    // Send response if not already sent
    sendResponse({
      success: success,
      message: success ? 'Usage recorded successfully' : 'Failed to record usage',
    })

    // 🚀 关键修复：如果通过 store 更新成功，也要发送通知
    if (shouldNotifyCommonGroup) {
      try {
        // 获取更新后的常用表情组
        const updatedCommonGroup = emojiGroupsStore?.getCommonEmojiGroup
          ? emojiGroupsStore.getCommonEmojiGroup()
          : null

        if (updatedCommonGroup) {
          log('Sending common emoji group update notification after store usage record')
          commService.sendCommonEmojiGroupChanged(updatedCommonGroup)
          commService.sendSpecificGroupChanged('common-emoji-group', updatedCommonGroup)
        }
      } catch (notifyError) {
        log('Error sending common group update notification:', notifyError)
      }
    }
  } catch (error) {
    log('Error handling RECORD_EMOJI_USAGE (Chrome):', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Firefox环境下的表情使用记录处理函数（主要用于移动端）
 * @param uuid 表情UUID
 * @returns Promise<object> 响应对象
 */
async function handleEmojiUsageFirefox(uuid: string): Promise<object> {
  try {
    log('Recording emoji usage for UUID (Firefox):', uuid)
    let success = false
    let shouldNotifyCommonGroup = false

    // Try to use emoji groups store if available
    if (emojiGroupsStore && typeof emojiGroupsStore.recordUsageByUUID === 'function') {
      try {
        success = emojiGroupsStore.recordUsageByUUID(uuid)
        log('recordUsageByUUID result (Firefox):', success)
        shouldNotifyCommonGroup = success
      } catch (error) {
        log('Error calling recordUsageByUUID (Firefox):', error)
      }
    }

    // If direct store call failed, try to load fresh data and update
    if (!success) {
      try {
        const freshData: any = await loadFromChromeStorage()
        if (updateEmojiUsageInData(uuid, freshData)) {
          // Save back to storage using Firefox API
          try {
            if (browser.storage && browser.storage.local && browser.storage.local.set) {
              const saveData: any = {}
              freshData.emojiGroups.forEach((group: any) => {
                saveData[`emojiGroups-${group.UUID}`] = group
              })
              await browser.storage.local.set(saveData)
              log('Successfully saved emoji usage update (Firefox)')
              success = true
              shouldNotifyCommonGroup = true
              // Update global cache
              lastPayloadGlobal = freshData
            }
          } catch (saveError) {
            log('Error saving emoji usage (Firefox):', saveError)
          }
        }
      } catch (error) {
        log('Error updating emoji usage in fresh data (Firefox):', error)
      }
    }

    // 🚀 关键修复：Firefox环境下也要发送常用表情组更新通知
    if (shouldNotifyCommonGroup) {
      try {
        // 获取更新后的常用表情组
        const updatedCommonGroup = emojiGroupsStore?.getCommonEmojiGroup
          ? emojiGroupsStore.getCommonEmojiGroup()
          : null

        if (updatedCommonGroup) {
          log('Sending common emoji group update notification after usage record (Firefox)')
          commService.sendCommonEmojiGroupChanged(updatedCommonGroup)
          commService.sendSpecificGroupChanged('common-emoji-group', updatedCommonGroup)
        }
      } catch (notifyError) {
        log('Error sending common group update notification (Firefox):', notifyError)
      }
    }

    return {
      success: success,
      message: success ? 'Usage recorded successfully' : 'Failed to record usage',
    }
  } catch (error) {
    log('Error handling RECORD_EMOJI_USAGE (Firefox):', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// Load emoji data directly from chrome.storage.local
async function loadFromChromeStorage(): Promise<any> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get(null, (items: any) => {
          try {
            if (chrome.runtime.lastError) {
              log('Chrome storage error:', chrome.runtime.lastError)
              resolve(null)
              return
            }

            // Assemble payload from storage items
            const Settings = items['Settings'] || {}
            const ungrouped = items['ungrouped'] || []

            // Collect emoji groups using index
            const emojiGroups: any[] = []
            const indexList = items['emojiGroups-index'] || []

            if (Array.isArray(indexList)) {
              for (const uuid of indexList) {
                const groupKey = `emojiGroups-${uuid}`
                const group = items[groupKey]
                if (group) {
                  emojiGroups.push(group)
                }
              }
            }

            // If no groups found via index, scan for all emojiGroups-* keys
            if (emojiGroups.length === 0) {
              Object.keys(items).forEach((key) => {
                if (key.startsWith('emojiGroups-') && key !== 'emojiGroups-index') {
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
      })
    }
  } catch (error) {
    log('Error accessing chrome storage:', error)
  }
  return null
}

// Initialize stores and load data from chrome storage
;(async () => {
  try {
    // Try to import the stores
    const [emojiModule, settingsModule] = await Promise.all([
      import('../data/update/emojiGroupsStore'),
      import('../data/update/settingsStore'),
    ])

    emojiGroupsStore = emojiModule.default
    settingsStore = settingsModule.default

    log('Emoji stores imported successfully')

    // Wait a bit for the emojiGroupsStore.initFromStorage() to complete its async loading
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Try to get data from stores first (they load from extension storage)
    try {
      const groups = emojiGroupsStore.getEmojiGroups() || []
      const settings = settingsStore.getSettings() || {}
      const ungrouped = emojiGroupsStore.getUngrouped() || []

      if (groups.length > 0) {
        // Data successfully loaded from emojiGroupsStore
        lastPayloadGlobal = {
          Settings: settings,
          emojiGroups: groups,
          ungrouped: ungrouped,
        }
        log('Loaded data from emojiGroupsStore:', {
          groupsCount: groups.length,
          emojisCount: groups.reduce((sum: number, g: any) => sum + (g.emojis?.length || 0), 0),
        })
        return
      }
    } catch (err) {
      log('Failed to get data from stores:', err)
    }

    // If stores don't have data, try loading directly from chrome storage
    try {
      const storagePayload: any = await loadFromChromeStorage()
      if (storagePayload && storagePayload.emojiGroups && storagePayload.emojiGroups.length > 0) {
        lastPayloadGlobal = storagePayload
        log('Loaded data directly from chrome storage:', {
          groupsCount: storagePayload.emojiGroups.length,
          emojisCount: storagePayload.emojiGroups.reduce(
            (sum: number, g: any) => sum + (g.emojis?.length || 0),
            0,
          ),
        })
        return
      }
    } catch (err) {
      log('Failed to load from chrome storage:', err)
    }

    log('No emoji data found in extension storage - data needs to be imported via options page')
  } catch (err) {
    log('Failed to import emoji stores:', err)
  }
})()

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

// Offscreen document helpers
let creatingOffscreen: Promise<void> | null = null
const OFFSCREEN_PATH = 'offscreen.html'

async function ensureOffscreenDocument() {
  try {
    const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_PATH)

    // Chrome 116+ supports runtime.getContexts
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && 'getContexts' in chrome.runtime) {
        const contexts = await chrome.runtime.getContexts({
          contextTypes: ['OFFSCREEN_DOCUMENT'],
          documentUrls: [offscreenUrl],
        })
        if (Array.isArray(contexts) && contexts.length > 0) return
      } else if (
        typeof self !== 'undefined' &&
        (self as any).clients &&
        (self as any).clients.matchAll
      ) {
        const clients = await (self as any).clients.matchAll()
        if (
          Array.isArray(clients) &&
          clients.some((c: any) => c && c.url && c.url.includes(offscreenUrl))
        )
          return
      }
    } catch (err) {
      // ignore context-check errors and try to create
    }

    if (creatingOffscreen) {
      await creatingOffscreen
      return
    }

    creatingOffscreen = (async () => {
      try {
        if (typeof chrome !== 'undefined' && chrome.offscreen && chrome.offscreen.createDocument) {
          await chrome.offscreen.createDocument({
            url: OFFSCREEN_PATH,
            reasons: ['LOCAL_STORAGE'],
            justification: 'Sync localStorage with chrome.storage',
          })
          log('offscreen document created')
        } else {
          log('offscreen API not available')
        }
      } catch (err) {
        log('ensureOffscreenDocument create error', err)
      } finally {
        creatingOffscreen = null
      }
    })()

    await creatingOffscreen
  } catch (err) {
    log('ensureOffscreenDocument error', err)
  }
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
      // also keep a global copy accessible to requesters
      try {
        lastPayloadGlobal = payload
      } catch (_) {}
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
        // write a session copy to chrome.storage.local first so late tabs can pick it up
        try {
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set(
              { session_payload: lastPayload, session_pending_global: true },
              () => {
                try {
                  // after persisted, instruct all tabs to mark session pending and broadcast session payload
                  sendMessageToAllTabs({
                    type: 'set-local-flag',
                    key: 'bugcopilot_flag_session_pending',
                    value: 'true',
                  })
                  broadcastToTabs({ type: 'sync-session', payload: lastPayload })
                } catch (_) {}
              },
            )
          } else {
            // fallback: if storage not available, proceed with broadcast
            sendMessageToAllTabs({
              type: 'set-local-flag',
              key: 'bugcopilot_flag_session_pending',
              value: 'true',
            })
            broadcastToTabs({ type: 'sync-session', payload: lastPayload })
          }
        } catch (_) {
          // if setting storage fails, fallback to broadcast
          try {
            sendMessageToAllTabs({
              type: 'set-local-flag',
              key: 'bugcopilot_flag_session_pending',
              value: 'true',
            })
            broadcastToTabs({ type: 'sync-session', payload: lastPayload })
          } catch (_) {}
        }
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
            // ensure session_payload persisted before retrying broadcast
            try {
              if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set(
                  { session_payload: lastPayload, session_pending_global: true },
                  () => {
                    try {
                      sendMessageToAllTabs({
                        type: 'set-local-flag',
                        key: 'bugcopilot_flag_session_pending',
                        value: 'true',
                      })
                      broadcastToTabs({ type: 'sync-session', payload: lastPayload })
                    } catch (_) {}
                  },
                )
              } else {
                sendMessageToAllTabs({
                  type: 'set-local-flag',
                  key: 'bugcopilot_flag_session_pending',
                  value: 'true',
                })
                broadcastToTabs({ type: 'sync-session', payload: lastPayload })
              }
            } catch (_) {
              sendMessageToAllTabs({
                type: 'set-local-flag',
                key: 'bugcopilot_flag_session_pending',
                value: 'true',
              })
              broadcastToTabs({ type: 'sync-session', payload: lastPayload })
            }
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
    async (msg: any, sender: any, sendResponse: (resp: any) => void) => {
      log('onMessage', { msg, from: sender })

      // Handle GET_EMOJI_DATA request from content scripts
      if (msg && msg.type === 'GET_EMOJI_DATA') {
        try {
          let groups = []
          let settings = {}
          let ungroupedEmojis = []

          // First try to get from global cache
          if (lastPayloadGlobal) {
            groups = lastPayloadGlobal.emojiGroups || []
            settings = lastPayloadGlobal.Settings || {}
            ungroupedEmojis = lastPayloadGlobal.ungrouped || []
          } else if (emojiGroupsStore && settingsStore) {
            // Try to get from stores if available
            try {
              groups = emojiGroupsStore.getEmojiGroups() || []
              settings = settingsStore.getSettings() || {}
              ungroupedEmojis = emojiGroupsStore.getUngrouped() || []
            } catch (_) {}
          }

          // If no data found, try loading directly from chrome storage
          if (groups.length === 0) {
            try {
              const freshData: any = await loadFromChromeStorage()
              if (freshData && freshData.emojiGroups) {
                groups = freshData.emojiGroups || []
                settings = freshData.Settings || {}
                ungroupedEmojis = freshData.ungrouped || []
                // Update cache
                lastPayloadGlobal = freshData
                log('Refreshed data from chrome storage for GET_EMOJI_DATA')
              }
            } catch (err) {
              log('Failed to refresh from chrome storage:', err)
            }
          }

          log('Responding to GET_EMOJI_DATA:', {
            groupsCount: groups.length,
            emojisCount: groups.reduce((sum: number, g: any) => sum + (g.emojis?.length || 0), 0),
            ungroupedCount: ungroupedEmojis.length,
            hasSettings: !!settings,
          })

          // 使用新的分离接口返回数据
          let normalGroups = groups
          let commonEmojiGroup = null
          let hotEmojis = []

          try {
            if (emojiGroupsStore && emojiGroupsStore.getNormalGroups) {
              normalGroups = emojiGroupsStore.getNormalGroups()
            }
            if (emojiGroupsStore && emojiGroupsStore.getCommonEmojiGroup) {
              commonEmojiGroup = emojiGroupsStore.getCommonEmojiGroup()
            }
            if (emojiGroupsStore && emojiGroupsStore.getHotEmojis) {
              hotEmojis = emojiGroupsStore.getHotEmojis()
            }
          } catch (err) {
            // 如果新接口不可用，使用简单过滤
            normalGroups = groups.filter((g: any) => g.UUID !== 'common-emoji-group')
            commonEmojiGroup = groups.find((g: any) => g.UUID === 'common-emoji-group') || null
          }

          sendResponse({
            success: true,
            data: {
              groups, // 保持原始完整数据以兼容
              normalGroups, // 新增：普通分组
              commonEmojiGroup, // 新增：常用表情分组
              hotEmojis, // 新增：热门表情
              settings,
              ungroupedEmojis,
            },
          })
        } catch (error) {
          log('Error handling GET_EMOJI_DATA:', error)
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          })
        }
        return true
      }

      // Handle RECORD_EMOJI_USAGE request from content scripts
      if (msg && msg.type === 'RECORD_EMOJI_USAGE' && msg.uuid) {
        handleEmojiUsageChrome(msg.uuid, sendResponse)
        return true
      }

      // handle payload-updated events from page localStorage
      try {
        if (msg && msg.type === 'payload-updated') {
          try {
            log('received payload-updated from page, payload keys:', Object.keys(msg.payload || {}))
            SyncManager.onLocalPayloadUpdated(msg.payload)
            // Update global payload for content scripts
            lastPayloadGlobal = msg.payload
          } catch (_) {}
          sendResponse({ ok: true })
          return
        }
        // allow requests to ensure an offscreen document exists
        if (msg && (msg.type === 'ensure-offscreen' || msg.target === 'offscreen')) {
          try {
            ensureOffscreenDocument()
          } catch (err) {
            log('ensureOffscreenDocument request error', err)
          }
          sendResponse({ ok: true })
          return
        }
        if (msg && msg.type === 'stage-ack') {
          try {
            SyncManager.onStageAck(msg.stage)
          } catch (_) {}
          sendResponse({ ok: true })
          return
        }
        // content script requesting the current session payload (e.g., late-initialized tab)
        if (msg && msg.type === 'request-session-payload') {
          try {
            if (lastPayloadGlobal) {
              // if tabs API available, respond only to sender tab
              try {
                if (chrome.tabs && sender && sender.tab && sender.tab.id != null) {
                  chrome.tabs.sendMessage(sender.tab.id, {
                    type: 'sync-session',
                    payload: lastPayloadGlobal,
                  })
                } else {
                  // fallback: broadcast to all
                  broadcastToTabs({ type: 'sync-session', payload: lastPayloadGlobal })
                }
              } catch (_) {
                broadcastToTabs({ type: 'sync-session', payload: lastPayloadGlobal })
              }
            }
          } catch (_) {}
          sendResponse({ ok: true })
          return
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
            chrome.runtime.sendMessage(payload, (_resp: any) => {
              try {
                if (chrome.runtime && chrome.runtime.lastError) {
                  log('sendMessage error:', chrome.runtime.lastError)
                }
              } catch (_) {}
            })
          } catch (_) {}
          // forward to content scripts in all tabs
          broadcastToTabs(payload)
          sendResponse({ ok: true })
          return
        }

        if (msg && msg.type === 'relay') {
          // relay to other extension contexts
          try {
            chrome.runtime.sendMessage(msg, (_resp: any) => {
              try {
                if (chrome.runtime && chrome.runtime.lastError) {
                  log('sendMessage error:', chrome.runtime.lastError)
                }
              } catch (_) {}
            })
          } catch (_) {}
          sendResponse({ ok: true })
          return true
        }
      } catch (err) {
        // ignore
      }
      // default echo
      sendResponse({ ok: true, echo: msg })
      return
    },
  )
} else if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.onMessage) {
  browser.runtime.onMessage.addListener(async (msg: any, sender: any) => {
    log('onMessage', { msg, from: sender })

    // Handle GET_EMOJI_DATA request from content scripts
    if (msg && msg.type === 'GET_EMOJI_DATA') {
      try {
        let groups = []
        let settings = {}
        let ungroupedEmojis = []

        // First try to get from global cache
        if (lastPayloadGlobal) {
          groups = lastPayloadGlobal.emojiGroups || []
          settings = lastPayloadGlobal.Settings || {}
          ungroupedEmojis = lastPayloadGlobal.ungrouped || []
        } else if (emojiGroupsStore && settingsStore) {
          try {
            groups = emojiGroupsStore.getEmojiGroups() || []
            settings = settingsStore.getSettings() || {}
            ungroupedEmojis = emojiGroupsStore.getUngrouped() || []
          } catch (_) {}
        }

        // If no data found, try loading directly from chrome storage
        if (groups.length === 0) {
          try {
            const freshData: any = await loadFromChromeStorage()
            if (freshData && freshData.emojiGroups) {
              groups = freshData.emojiGroups || []
              settings = freshData.Settings || {}
              ungroupedEmojis = freshData.ungrouped || []
              // Update cache
              lastPayloadGlobal = freshData
              log('Refreshed data from chrome storage for GET_EMOJI_DATA (browser)')
            }
          } catch (err) {
            log('Failed to refresh from chrome storage (browser):', err)
          }
        }

        return Promise.resolve({
          success: true,
          data: {
            groups,
            settings,
            ungroupedEmojis,
          },
        })
      } catch (error) {
        return Promise.resolve({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // Handle RECORD_EMOJI_USAGE request from content scripts
    if (msg && msg.type === 'RECORD_EMOJI_USAGE' && msg.uuid) {
      return handleEmojiUsageFirefox(msg.uuid)
    }

    try {
      if (msg && msg.type === 'payload-updated') {
        try {
          SyncManager.onLocalPayloadUpdated(msg.payload)
          lastPayloadGlobal = msg.payload
        } catch (_) {}
        return Promise.resolve({ ok: true })
      }

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
          try {
            chrome.runtime.sendMessage(m, (_resp: any) => {
              try {
                if (chrome.runtime && chrome.runtime.lastError) {
                  log('sendMessage error (port->runtime):', chrome.runtime.lastError)
                }
              } catch (_) {}
            })
          } catch (_) {}
          broadcastToTabs(m)
        }
      })
  })
}
