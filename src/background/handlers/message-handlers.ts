// background/handlers/message-handlers.ts - 消息处理器

import {
  handleGetEmojiData,
  handleEmojiUsageChrome,
  handleEmojiUsageFirefox,
} from './emoji-handlers'

declare const chrome: any
declare const browser: any

function log(...args: any[]) {
  try {
    console.log('[background:message-handlers]', ...args)
  } catch (_) {}
}

/**
 * 向所有标签页发送消息
 * @param message 要发送的消息
 */
function sendMessageToAllTabs(message: any) {
  try {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({}, (tabs: any[]) => {
        if (chrome.runtime.lastError) return
        for (const tab of tabs) {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, message, () => {
              // ignore errors
              try {
                if (chrome.runtime.lastError) {
                  // tab might not have content script
                }
              } catch (_) {}
            })
          }
        }
      })
    }
  } catch (_) {}
}

/**
 * 向所有标签页广播消息
 * @param payload 要广播的消息负载
 */
function broadcastToTabs(payload: any) {
  try {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({}, (tabs: any[]) => {
        if (chrome.runtime.lastError) return
        for (const tab of tabs) {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, payload, () => {
              try {
                if (chrome.runtime.lastError) {
                  // tab might not have content script, ignore
                }
              } catch (_) {}
            })
          }
        }
      })
    }
  } catch (_) {}
}

/**
 * 设置Chrome环境下的消息监听器
 * @param emojiGroupsStore 表情组存储实例
 * @param settingsStore 设置存储实例
 * @param commService 通信服务实例
 * @param lastPayloadGlobal 全局缓存的最后负载
 * @param SyncManager 同步管理器
 */
export function setupChromeMessageListener(
  emojiGroupsStore: any,
  settingsStore: any,
  commService: any,
  lastPayloadGlobal: any,
  SyncManager: any,
) {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(
      (msg: any, sender: any, sendResponse: (resp: any) => void) => {
        log('onMessage', { msg, from: sender })

        // Handle GET_EMOJI_DATA request from content scripts
        if (msg && msg.type === 'GET_EMOJI_DATA') {
          handleGetEmojiData(emojiGroupsStore, settingsStore, lastPayloadGlobal)
            .then((response) => sendResponse(response))
            .catch((error) =>
              sendResponse({
                success: false,
                error: error instanceof Error ? error.message : String(error),
              }),
            )
          return true // Keep the message channel open for async response
        }

        // Handle RECORD_EMOJI_USAGE request from content scripts
        if (msg && msg.type === 'RECORD_EMOJI_USAGE' && msg.uuid) {
          handleEmojiUsageChrome(
            msg.uuid,
            sendResponse,
            emojiGroupsStore,
            commService,
            lastPayloadGlobal,
          )
          return true // Keep the message channel open for async response
        }

        try {
          if (msg && msg.type === 'payload-updated') {
            try {
              SyncManager.onLocalPayloadUpdated(msg.payload)
              lastPayloadGlobal = msg.payload
            } catch (_) {}
            sendResponse({ ok: true })
            return
          }

          // 🚀 关键修复：添加一个通用消息中继器
          // 捕获所有未被特殊处理的消息，并将它们转发给其他页面
          // 这是确保 popup 和 options 之间实时同步的关键
          if (msg && msg.from && msg.from !== 'background') {
            log('🔄 Relaying message:', msg.type, 'from:', msg.from)

            // 转发到其他扩展页面（popup, options）
            try {
              chrome.runtime.sendMessage(msg, (_response: any) => {
                if (chrome.runtime.lastError) {
                  // 忽略错误，因为可能没有活动的接收者
                  log('⚠️ Message relay error (expected):', chrome.runtime.lastError.message)
                } else {
                  log('✅ Message relayed successfully:', msg.type)
                }
              })
            } catch (error) {
              log('❌ Message relay exception:', error)
            }

            // 转发到所有内容脚本
            broadcastToTabs(msg)

            // 确认消息已被处理
            sendResponse({ ok: true, relayed: true })
            return true
          }

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
  }
}

/**
 * 设置Firefox环境下的消息监听器
 * @param emojiGroupsStore 表情组存储实例
 * @param settingsStore 设置存储实例
 * @param commService 通信服务实例
 * @param lastPayloadGlobal 全局缓存的最后负载
 * @param SyncManager 同步管理器
 */
export function setupFirefoxMessageListener(
  emojiGroupsStore: any,
  settingsStore: any,
  commService: any,
  lastPayloadGlobal: any,
  SyncManager: any,
) {
  if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.onMessage) {
    browser.runtime.onMessage.addListener(async (msg: any, sender: any) => {
      log('onMessage', { msg, from: sender })

      // Handle GET_EMOJI_DATA request from content scripts
      if (msg && msg.type === 'GET_EMOJI_DATA') {
        return handleGetEmojiData(emojiGroupsStore, settingsStore, lastPayloadGlobal)
      }

      // Handle RECORD_EMOJI_USAGE request from content scripts
      if (msg && msg.type === 'RECORD_EMOJI_USAGE' && msg.uuid) {
        return handleEmojiUsageFirefox(msg.uuid, emojiGroupsStore, commService, lastPayloadGlobal)
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
}

/**
 * 设置Chrome环境下的连接监听器
 */
export function setupChromeConnectListener() {
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
}

export { sendMessageToAllTabs, broadcastToTabs }
