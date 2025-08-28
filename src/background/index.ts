// background/index.ts - background broker
// Listens for runtime messages and supports broadcasting to other extension contexts and content scripts.

declare const chrome: any
declare const browser: any

import { getRuntimeSyncConfig } from '../data/sync-config'
import { createBackgroundCommService } from '../services/communication'
import { ensureCommonEmojiGroupInStorage, loadFromChromeStorage, appendTelemetry } from './utils/storage-utils'
import { ensureCommonEmojiGroup } from './utils/common-group-utils'
import { setupChromeMessageListener, setupFirefoxMessageListener, setupChromeConnectListener } from './handlers/message-handlers'

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

// Simple sync manager
const SyncManager = {
  onLocalPayloadUpdated(payload: any) {
    try {
      lastPayloadGlobal = payload
      log('SyncManager: local updated')
      appendTelemetry({ event: 'local_payload_updated' })
    } catch (_) {}
  }
}

function log(...args: any[]) {
  try {
    console.log('[background]', ...args)
  } catch (_) {}
}

// Initialize stores and load data from chrome storage
;(async () => {
  try {
    // 首先确保常用表情组在存储中存在
    await ensureCommonEmojiGroupInStorage()
    
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

// Setup message listeners
setupChromeMessageListener(
  emojiGroupsStore,
  settingsStore,
  commService,
  lastPayloadGlobal,
  SyncManager
)

setupFirefoxMessageListener(
  emojiGroupsStore,
  settingsStore,
  commService,
  lastPayloadGlobal,
  SyncManager
)

setupChromeConnectListener()