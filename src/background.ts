// Enhanced Background Message Hub
// Provides robust message passing and storage synchronization for the extension

import { backgroundLogger, logSystemInfo, CURRENT_LOG_LEVEL, LOG_LEVELS } from './utils/logger'

// Ambient declarations for extension APIs
declare const chrome: any
declare const browser: any

// Enhanced logging with comprehensive message passing tracking
const logger = backgroundLogger

type MessageSender = any

// Message types for the enhanced communication system
interface ExtensionMessage {
  type: string
  payload?: any
  from?: string
  to?: string
  timestamp?: number
  messageId?: string
  requiresAck?: boolean
}

// Active connections tracking for better message delivery
const activeConnections = new Set<string>()
const messageQueue = new Map<string, ExtensionMessage[]>()
const pendingAcks = new Map<string, { message: ExtensionMessage; timestamp: number }>()

// Enhanced broadcast function with retry logic and connection tracking
async function broadcastMessage(message: ExtensionMessage, excludeFrom?: string) {
  const enhancedMessage: ExtensionMessage = {
    ...message,
    from: message.from || 'background',
    timestamp: Date.now(),
    messageId: message.messageId || generateMessageId(),
  }

  logger.messageSent(enhancedMessage.type, enhancedMessage.payload, 'all-contexts')
  logger.debug('Broadcasting message to all contexts except:', excludeFrom)

  // Broadcast to extension contexts (popup, options)
  await broadcastToExtensionContexts(enhancedMessage, excludeFrom)

  // Broadcast to content scripts in all tabs
  await broadcastToContentScripts(enhancedMessage, excludeFrom)
}

// Broadcast to extension contexts (popup, options pages)
async function broadcastToExtensionContexts(message: ExtensionMessage, excludeFrom?: string) {
  if (excludeFrom === 'extension') {
    logger.debug('Skipping extension context broadcast (excluded)')
    return
  }

  logger.debug('Broadcasting to extension contexts:', message.type)

  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage(message, (response: any) => {
        if (chrome.runtime.lastError) {
          // This is expected when no extension pages are open
          logger.debug('Extension context broadcast result:', chrome.runtime.lastError.message)
        } else {
          logger.debug('Extension context broadcast successful for:', message.type)
          logger.messageAcknowledged(message.messageId || 'unknown', true)
        }
      })
    } else if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
      try {
        await browser.runtime.sendMessage(message)
        logger.debug('Extension context broadcast successful (Firefox) for:', message.type)
        logger.messageAcknowledged(message.messageId || 'unknown', true)
      } catch (error) {
        logger.warn('Extension context broadcast failed (Firefox):', error)
      }
    }
  } catch (error) {
    logger.error('Failed to broadcast to extension contexts:', error)
  }
}

// Broadcast to content scripts in all tabs
async function broadcastToContentScripts(message: ExtensionMessage, excludeFrom?: string) {
  if (excludeFrom === 'content-script') {
    logger.debug('Skipping content script broadcast (excluded)')
    return
  }

  logger.debug('Broadcasting to content scripts:', message.type)

  try {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({}, (tabs: any[]) => {
        if (chrome.runtime.lastError) {
          logger.error('Failed to query tabs:', chrome.runtime.lastError)
          return
        }

        logger.debug(`Found ${tabs.length} tabs for content script broadcast`)

        tabs.forEach((tab) => {
          if (
            tab.id &&
            tab.url &&
            !tab.url.startsWith('chrome://') &&
            !tab.url.startsWith('moz-extension://')
          ) {
            try {
              chrome.tabs.sendMessage(tab.id, message, (response: any) => {
                if (chrome.runtime.lastError) {
                  // This is expected for tabs without content scripts
                  logger.trace(
                    `Content script broadcast to tab ${tab.id} result:`,
                    chrome.runtime.lastError.message,
                  )
                } else {
                  logger.debug(
                    `Content script broadcast successful to tab ${tab.id} for:`,
                    message.type,
                  )
                  logger.messageAcknowledged(message.messageId || 'unknown', true)
                }
              })
            } catch (error) {
              logger.warn(`Failed to send message to tab ${tab.id}:`, error)
            }
          }
        })
      })
    }
  } catch (error) {
    logger.error('Failed to broadcast to content scripts:', error)
  }
}

// Generate unique message IDs
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Enhanced storage management with real-time synchronization
let lastPayload: any = null
let storageInitialized = false

// Storage keys
const KEY_SETTINGS = 'Settings'
const KEY_UNGROUPED = 'ungrouped'
const KEY_EMOJI_PREFIX = 'emojiGroups-'
const KEY_EMOJI_INDEX = 'emojiGroups-index'
const KEY_COMMON_EMOJI_GROUP = 'emojiGroups-common-emoji-group'

// Storage change tracking
const storageChangeHandlers = new Map<string, (newValue: any, oldValue: any) => void>()

// Initialize storage change listener for real-time synchronization
function initializeStorageSync() {
  if (storageInitialized) {
    logger.debug('Storage sync already initialized')
    return
  }

  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes: any, areaName: string) => {
        if (areaName !== 'local') {
          logger.trace('Ignoring storage changes in area:', areaName)
          return
        }

        const changedKeys = Object.keys(changes)
        logger.info('Storage changes detected:', changedKeys)
        logger.storageOperation(
          'change-detected',
          changedKeys.join(','),
          true,
          CURRENT_LOG_LEVEL >= LOG_LEVELS.TRACE ? changes : undefined,
        )

        handleStorageChanges(changes)
      })

      storageInitialized = true
      logger.info('✅ Storage synchronization initialized successfully')
    } else {
      logger.warn('Chrome storage API not available')
    }
  } catch (error) {
    logger.error('Failed to initialize storage sync:', error)
  }
}

// Handle storage changes and broadcast updates
async function handleStorageChanges(changes: any) {
  const changedKeys = Object.keys(changes)
  let shouldBroadcastGroups = false
  let shouldBroadcastSettings = false
  let shouldBroadcastCommonEmoji = false

  // Check what types of data changed
  for (const key of changedKeys) {
    if (key === KEY_SETTINGS) {
      shouldBroadcastSettings = true
    } else if (
      key === KEY_UNGROUPED ||
      key === KEY_EMOJI_INDEX ||
      key.startsWith(KEY_EMOJI_PREFIX)
    ) {
      shouldBroadcastGroups = true

      // Special handling for common emoji group
      if (key === KEY_COMMON_EMOJI_GROUP) {
        shouldBroadcastCommonEmoji = true
      }
    }
  }

  // Reload payload to get fresh data
  try {
    const freshPayload = await loadFromChromeStorage()
    if (freshPayload) {
      lastPayload = freshPayload
      logger.info('Payload updated from storage changes')
    }
  } catch (error) {
    logger.error('Failed to reload payload after storage changes:', error)
  }

  // Broadcast appropriate change notifications
  if (shouldBroadcastSettings && lastPayload?.Settings) {
    await broadcastMessage({
      type: 'app:settings-changed',
      payload: lastPayload.Settings,
    })
  }

  if (shouldBroadcastGroups && lastPayload?.emojiGroups) {
    await broadcastMessage({
      type: 'app:groups-changed',
      payload: lastPayload.emojiGroups,
    })

    // Separate broadcasts for normal groups and common emoji group
    const normalGroups = lastPayload.emojiGroups.filter((g: any) => g.UUID !== 'common-emoji-group')
    const commonGroup = lastPayload.emojiGroups.find((g: any) => g.UUID === 'common-emoji-group')

    await broadcastMessage({
      type: 'app:normal-groups-changed',
      payload: { groups: normalGroups, timestamp: Date.now() },
    })

    if (commonGroup) {
      await broadcastMessage({
        type: 'app:common-group-changed',
        payload: { group: commonGroup, timestamp: Date.now() },
      })
    }
  }

  if (shouldBroadcastCommonEmoji && lastPayload?.emojiGroups) {
    const commonGroup = lastPayload.emojiGroups.find((g: any) => g.UUID === 'common-emoji-group')
    if (commonGroup) {
      await broadcastMessage({
        type: 'COMMON_EMOJI_UPDATED',
        payload: { commonGroup, timestamp: Date.now() },
      })

      await broadcastMessage({
        type: 'app:specific-group-changed',
        payload: { groupUUID: 'common-emoji-group', group: commonGroup, timestamp: Date.now() },
      })
    }
  }
}

// Enhanced function to load data from chrome.storage.local with better error handling
async function loadFromChromeStorage(): Promise<any> {
  return new Promise((resolve) => {
    try {
      if (chrome && chrome.storage && chrome.storage.local && chrome.storage.local.get) {
        chrome.storage.local.get(null, (items: any) => {
          try {
            if (chrome.runtime.lastError) {
              logger.error('Chrome storage error:', chrome.runtime.lastError)
              resolve(null)
              return
            }

            // Assemble payload from storage items
            const Settings = items[KEY_SETTINGS] || {}
            const ungrouped = items[KEY_UNGROUPED] || []

            // Collect emoji groups using index with enhanced common emoji group handling
            const emojiGroups: any[] = []
            const indexList = items[KEY_EMOJI_INDEX] || []

            // First, try to load common emoji group specifically
            const commonEmojiGroup = items[KEY_COMMON_EMOJI_GROUP]
            if (commonEmojiGroup && commonEmojiGroup.UUID === 'common-emoji-group') {
              emojiGroups.push(commonEmojiGroup)
              logger.commonEmojiOperation('loaded', commonEmojiGroup.emojis?.length || 0, true)
            }

            // Load other groups using index
            if (Array.isArray(indexList)) {
              for (const uuid of indexList) {
                // Skip common emoji group as it's already loaded
                if (uuid === 'common-emoji-group') continue

                const groupKey = `${KEY_EMOJI_PREFIX}${uuid}`
                const group = items[groupKey]
                if (group && group.UUID !== 'common-emoji-group') {
                  emojiGroups.push(group)
                }
              }
            }

            // If no groups found via index, scan for all emojiGroups-* keys (fallback)
            if (emojiGroups.length <= 1) {
              // Only common group or no groups
              Object.keys(items).forEach((key) => {
                if (key.startsWith(KEY_EMOJI_PREFIX) && key !== KEY_COMMON_EMOJI_GROUP) {
                  const group = items[key]
                  if (group && group.UUID !== 'common-emoji-group') {
                    // Avoid duplicates
                    const exists = emojiGroups.some((g) => g.UUID === group.UUID)
                    if (!exists) {
                      emojiGroups.push(group)
                    }
                  }
                }
              })
            }

            // Sort groups: common emoji group first, then by order
            emojiGroups.sort((a, b) => {
              if (a.UUID === 'common-emoji-group') return -1
              if (b.UUID === 'common-emoji-group') return 1
              return (a.order || 0) - (b.order || 0)
            })

            const payload = {
              Settings,
              emojiGroups,
              ungrouped,
            }

            logger.info('Enhanced storage load completed:', {
              settingsKeys: Object.keys(Settings).length,
              groupsCount: emojiGroups.length,
              commonEmojiCount: commonEmojiGroup?.emojis?.length || 0,
              ungroupedCount: ungrouped.length,
            })

            resolve(payload)
          } catch (error) {
            logger.error('Error assembling storage data:', error)
            resolve(null)
          }
        })
      } else {
        resolve(null)
      }
    } catch (error) {
      logger.error('Error accessing chrome storage:', error)
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
      logger.info(
        'Initialized with chrome storage data:',
        chromePayload.emojiGroups.length,
        'groups',
      )
      return
    }
  } catch (error) {
    logger.warn('Failed to load from chrome storage:', error)
  }

  // Fallback to loading via storage module
  try {
    const mod = await import('./data/update/storage')
    if (mod && typeof mod.loadPayload === 'function') {
      try {
        lastPayload = mod.loadPayload()
        if (lastPayload) {
          logger.info('Initialized with storage module data')
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
      logger.info('Initialized with localStorage fallback')
    }
  } catch (_) {
    lastPayload = null
  }

  if (!lastPayload) {
    logger.warn('No payload found in any storage location')
  }
})()

// Enhanced message handling system
async function handleIncomingMessage(
  msg: any,
  sender: MessageSender,
  sendResponse: (response?: any) => void,
) {
  const messageId = msg.messageId || generateMessageId()
  logger.messageReceived(msg.type, msg.payload, msg.from || 'unknown')
  logger.debug('Processing message with ID:', messageId)

  try {
    // Handle payload updates with enhanced broadcasting
    if (msg && msg.type === 'payload-updated' && msg.payload) {
      const payload = msg.payload || {}
      lastPayload = payload
      logger.info('Payload updated, new cache has', payload.emojiGroups?.length || 0, 'groups')

      // Enhanced broadcasting with multiple message types
      await broadcastMessage(
        {
          type: 'app:groups-changed',
          payload: payload.emojiGroups || [],
        },
        msg.from,
      )

      // Separate broadcasts for better granularity
      const normalGroups = (payload.emojiGroups || []).filter(
        (g: any) => g.UUID !== 'common-emoji-group',
      )
      const commonGroup = (payload.emojiGroups || []).find(
        (g: any) => g.UUID === 'common-emoji-group',
      )

      await broadcastMessage(
        {
          type: 'app:normal-groups-changed',
          payload: { groups: normalGroups, timestamp: Date.now() },
        },
        msg.from,
      )

      if (commonGroup) {
        await broadcastMessage(
          {
            type: 'app:common-group-changed',
            payload: { group: commonGroup, timestamp: Date.now() },
          },
          msg.from,
        )

        await broadcastMessage(
          {
            type: 'COMMON_EMOJI_UPDATED',
            payload: { commonGroup, timestamp: Date.now() },
          },
          msg.from,
        )
      }

      sendResponse({ ok: true, messageId })
      return true
    }

    // Handle broadcast requests
    if (msg && msg.type === 'broadcast') {
      const broadcastPayload = {
        type: msg.broadcastType || 'broadcast',
        payload: msg.payload,
        from: msg.from || 'background',
        timestamp: Date.now(),
      }

      await broadcastMessage(broadcastPayload, msg.from)
      sendResponse({ ok: true, messageId })
      return true
    }

    // Handle relay requests (forward messages to all contexts)
    if (msg && msg.type === 'relay') {
      await broadcastMessage(
        {
          ...msg,
          from: msg.from || 'background',
          timestamp: Date.now(),
        },
        msg.from,
      )

      sendResponse({ ok: true, messageId })
      return true
    }

    // Handle payload requests from content scripts
    if (msg && msg.type === 'request-payload') {
      try {
        // Ensure we have fresh data
        if (!lastPayload) {
          lastPayload = await loadFromChromeStorage()
        }

        sendResponse({ ok: true, payload: lastPayload, messageId })
      } catch (error) {
        logger.error('Failed to handle payload request:', error)
        sendResponse({ ok: false, error: 'Failed to load payload', messageId })
      }
      return true
    }

    // Handle direct message forwarding (enhanced relay system)
    if (msg && msg.from && msg.from !== 'background') {
      logger.debug('Relaying message:', msg.type, 'from:', msg.from)

      // Forward to all other contexts
      await broadcastMessage(
        {
          ...msg,
          timestamp: Date.now(),
        },
        msg.from,
      )

      sendResponse({ ok: true, relayed: true, messageId })
      return true
    }

    // Default response for unhandled messages
    sendResponse({ ok: true, echo: msg, messageId })
    return true
  } catch (error) {
    logger.error('Error handling message:', error)
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      messageId,
    })
    return true
  }
}

// Initialize the enhanced message system
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener(
    (msg: any, sender: MessageSender, sendResponse: (resp: any) => void) => {
      // Handle message asynchronously
      handleIncomingMessage(msg, sender, sendResponse)
      return true // Indicate async response
    },
  )

  // Initialize storage synchronization
  initializeStorageSync()

  logger.info('Enhanced message system initialized for Chrome')
} else if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.onMessage) {
  browser.runtime.onMessage.addListener(async (msg: any, sender: MessageSender) => {
    return new Promise((resolve) => {
      handleIncomingMessage(msg, sender, resolve)
    })
  })

  // Initialize storage synchronization
  initializeStorageSync()

  logger.info('Enhanced message system initialized for Firefox')
} else {
  logger.error('No runtime message API available')
}

// Enhanced GET_EMOJI_DATA handler for content scripts
async function handleGetEmojiData(sendResponse: (response: any) => void) {
  try {
    logger.debug('Handling GET_EMOJI_DATA request')

    // Always get fresh data from storage
    const freshPayload = await loadFromChromeStorage()
    const payload = freshPayload || lastPayload

    if (payload && payload.emojiGroups && Array.isArray(payload.emojiGroups)) {
      // Calculate hot emojis based on usage count
      const allEmojis: any[] = []
      payload.emojiGroups.forEach((group: any) => {
        if (Array.isArray(group.emojis)) {
          group.emojis.forEach((emoji: any) => {
            allEmojis.push({
              ...emoji,
              groupUUID: group.UUID,
            })
          })
        }
      })

      // Sort by usage count and take top 50
      const hotEmojis = allEmojis
        .filter((e) => typeof e.usageCount === 'number' && e.usageCount > 0)
        .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
        .slice(0, 50)

      const response = {
        success: true,
        data: {
          groups: payload.emojiGroups,
          normalGroups: payload.emojiGroups.filter((g: any) => g.UUID !== 'common-emoji-group'),
          commonEmojiGroup:
            payload.emojiGroups.find((g: any) => g.UUID === 'common-emoji-group') || null,
          hotEmojis,
          settings: payload.Settings || {},
          ungroupedEmojis: payload.ungrouped || [],
        },
      }

      logger.info(
        'Responding to GET_EMOJI_DATA with',
        payload.emojiGroups.length,
        'groups and',
        hotEmojis.length,
        'hot emojis',
      )
      sendResponse(response)
    } else {
      logger.warn('No emoji data available for GET_EMOJI_DATA request')
      sendResponse({
        success: false,
        error: 'No emoji data available',
      })
    }
  } catch (error) {
    logger.error('Error handling GET_EMOJI_DATA:', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

// Add GET_EMOJI_DATA handler to the main message handler
const originalHandleIncomingMessage = handleIncomingMessage
async function enhancedHandleIncomingMessage(
  msg: any,
  sender: any,
  sendResponse: (response?: any) => void,
) {
  // Handle GET_EMOJI_DATA requests
  if (msg && msg.type === 'GET_EMOJI_DATA') {
    await handleGetEmojiData(sendResponse)
    return true
  }

  // Handle other messages with the original handler
  return originalHandleIncomingMessage(msg, sender, sendResponse)
}

// Update the message listeners to use the enhanced handler
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  // Remove existing listeners and add the enhanced one
  chrome.runtime.onMessage.removeListener
  chrome.runtime.onMessage.addListener(
    (msg: any, sender: any, sendResponse: (resp: any) => void) => {
      enhancedHandleIncomingMessage(msg, sender, sendResponse)
      return true
    },
  )
} else if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.onMessage) {
  browser.runtime.onMessage.addListener(async (msg: any, sender: any) => {
    return new Promise((resolve) => {
      enhancedHandleIncomingMessage(msg, sender, resolve)
    })
  })
}

// Initialize the enhanced logging and message system
logger.info('🚀 Enhanced background message hub initializing...')
logSystemInfo()

// Initialize storage synchronization
initializeStorageSync()

logger.info('✅ Enhanced background message hub initialized successfully')

// Load initial data
;(async () => {
  try {
    const initialPayload = await loadFromChromeStorage()
    if (initialPayload) {
      lastPayload = initialPayload
      logger.info('Initial payload loaded with', initialPayload.emojiGroups?.length || 0, 'groups')
      logger.commonEmojiOperation(
        'initial-load',
        initialPayload.emojiGroups?.find((g: any) => g.UUID === 'common-emoji-group')?.emojis
          ?.length,
      )
    }
  } catch (error) {
    logger.error('Failed to load initial payload:', error)
  }
})()
