import { newStorageHelpers } from '../utils/newStorage'

import { getChromeAPI } from './utils'
import {
  handleDownloadAndSendToDiscourse,
  handleDownloadForUser,
  handleUploadAndAddEmoji,
  handleDownloadAndUploadEmoji
} from './downloadAndSend'
import { handleAddEmojiFromWeb } from './handlers/addEmojiFromWeb'

export function setupMessageListener() {
  const chromeAPI = getChromeAPI()
  if (chromeAPI && chromeAPI.runtime && chromeAPI.runtime.onMessage) {
    chromeAPI.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: any) => {
      console.log('Background received message:', message)
      // mark unused sender as intentionally unused
      void _sender

      // 首先检查 message.type
      if (message.type) {
        switch (message.type) {
          case 'GET_EMOJI_DATA':
            handleGetEmojiData(sendResponse)
            return true

          case 'SAVE_EMOJI_DATA':
            handleSaveEmojiData(message.data, sendResponse)
            return true

          case 'SYNC_SETTINGS':
            handleSyncSettings(message.settings, sendResponse)
            return true

          case 'REQUEST_LINUX_DO_AUTH':
            handleLinuxDoAuthRequest(sendResponse)
            return true

          default:
            console.log('Unknown message type:', message.type)
            // mark message.type as referenced for linters
            void message.type
            sendResponse({ success: false, error: 'Unknown message type' })
            return false
        }
      }

      // 然后检查 message.action
      if (message.action) {
        switch (message.action) {
          case 'addToFavorites':
            handleAddToFavorites(message.emoji, sendResponse)
            return true

          case 'addEmojiFromWeb':
            handleAddEmojiFromWeb(message.emojiData, sendResponse)
            return true

          case 'downloadAndSendToDiscourse':
            handleDownloadAndSendToDiscourse(message.payload, sendResponse)
            return true

          case 'downloadForUser':
            handleDownloadForUser(message.payload, sendResponse)
            return true

          case 'uploadAndAddEmoji':
            handleUploadAndAddEmoji(message.payload, sendResponse)
            return true

          case 'downloadAndUploadEmoji':
            handleDownloadAndUploadEmoji(message.payload, sendResponse)
            return true

          case 'saveLastDiscourse':
            handleSaveLastDiscourse(message.payload, sendResponse)
            return true

          default:
            console.log('Unknown action:', message.action)
            // mark message.action as referenced for linters
            void message.action
            sendResponse({ success: false, error: 'Unknown action' })
            return false
        }
      }

      // 如果既没有 type 也没有 action
      console.log('Message has no type or action:', message)
      sendResponse({ success: false, error: 'Message has no type or action' })
    })
  }
}

// ...existing code...

// handleAddEmojiFromWeb moved to ./handlers/addEmojiFromWeb.ts

export async function handleAddToFavorites(emoji: any, sendResponse: any) {
  // mark callback as referenced to avoid unused-var lint
  void sendResponse
  try {
    // Use the unified newStorageHelpers to read/update groups for consistency
    const groups = await newStorageHelpers.getAllEmojiGroups()
    const favoritesGroup = groups.find((g: any) => g.id === 'favorites')
    if (!favoritesGroup) {
      console.warn('Favorites group not found - creating one')
      const newFavorites = { id: 'favorites', name: 'Favorites', icon: '⭐', order: 0, emojis: [] }
      groups.unshift(newFavorites)
    }

    const finalGroups = groups
    const favGroup = finalGroups.find((g: any) => g.id === 'favorites') as any

    const now = Date.now()
    const existingEmojiIndex = favGroup.emojis.findIndex((e: any) => e.url === emoji.url)

    if (existingEmojiIndex !== -1) {
      const existingEmoji = favGroup.emojis[existingEmojiIndex]
      const lastUsed = existingEmoji.lastUsed || 0
      const timeDiff = now - lastUsed
      const twelveHours = 12 * 60 * 60 * 1000

      if (timeDiff < twelveHours) {
        existingEmoji.usageCount = (existingEmoji.usageCount || 0) + 1
      } else {
        const currentCount = existingEmoji.usageCount || 1
        existingEmoji.usageCount = Math.floor(currentCount * 0.8) + 1
        existingEmoji.lastUsed = now
      }
    } else {
      const favoriteEmoji = {
        ...emoji,
        id: `fav-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        groupId: 'favorites',
        usageCount: 1,
        lastUsed: now,
        addedAt: now
      }
      favGroup.emojis.push(favoriteEmoji)
    }

    favGroup.emojis.sort((a: any, b: any) => (b.lastUsed || 0) - (a.lastUsed || 0))

    // Persist via newStorageHelpers which updates group index and individual groups
    await newStorageHelpers.setAllEmojiGroups(finalGroups)

    // Notify content scripts by updating chrome.storage (legacy compatibility)
    const chromeAPI = getChromeAPI()
    if (chromeAPI && chromeAPI.storage && chromeAPI.storage.local) {
      try {
        await new Promise<void>((resolve, reject) => {
          chromeAPI.storage.local.set({ emojiGroups: finalGroups }, () => {
            if (chromeAPI.runtime.lastError) reject(chromeAPI.runtime.lastError)
            else resolve()
          })
        })
      } catch (_e) {
        // ignored intentionally
        void _e
      }
    }

    sendResponse({ success: true, message: 'Added to favorites' })
  } catch (error) {
    console.error('Failed to add emoji to favorites:', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// downloadAndSendToDiscourse is implemented in ./downloadAndSend and imported above

export async function handleGetEmojiData(_sendResponse: (_resp: any) => void) {
  // mark callback as referenced
  void _sendResponse

  try {
    // Use newStorageHelpers which understands the migrated storage layout
    const groups = await newStorageHelpers.getAllEmojiGroups()
    const settings = await newStorageHelpers.getSettings()
    const favorites = await newStorageHelpers.getFavorites()

    _sendResponse({
      success: true,
      data: {
        groups: groups || [],
        settings: settings || {},
        favorites: favorites || []
      }
    })
  } catch (error: any) {
    console.error('Failed to get emoji data via newStorageHelpers:', error)
    _sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export async function handleSaveEmojiData(data: any, _sendResponse: (_resp: any) => void) {
  // mark callback as referenced
  void _sendResponse
  // no additional args expected here
  const chromeAPI = getChromeAPI()
  if (!chromeAPI || !chromeAPI.storage) {
    _sendResponse({ success: false, error: 'Chrome storage API not available' })
    return
  }

  try {
    await chromeAPI.storage.local.set(data)
    _sendResponse({ success: true })
  } catch (error: any) {
    console.error('Failed to save emoji data:', error)
    _sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export async function handleSyncSettings(settings: any, _sendResponse: (_resp: any) => void) {
  // mark callback as referenced
  void _sendResponse
  // no additional args expected here
  const chromeAPI = getChromeAPI()
  if (!chromeAPI || !chromeAPI.storage || !chromeAPI.tabs) {
    _sendResponse({ success: false, error: 'Chrome API not available' })
    return
  }

  try {
    // 保存为新的存储格式：{ data: {...}, timestamp: ... }
    const timestamp = Date.now()
    const appSettingsData = {
      data: { ...settings, lastModified: timestamp },
      timestamp: timestamp
    }

    await chromeAPI.storage.local.set({ appSettings: appSettingsData })

    const tabs = await chromeAPI.tabs.query({})
    for (const tab of tabs) {
      if (tab.id) {
        chromeAPI.tabs
          .sendMessage(tab.id, {
            type: 'SETTINGS_UPDATED',
            settings: settings
          })
          .catch(() => {
            // Ignore errors for tabs that don't have content script
          })
      }
    }

    _sendResponse({ success: true })
  } catch (error: any) {
    console.error('Failed to sync settings:', error)
    _sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export async function handleLinuxDoAuthRequest(_sendResponse: (_resp: any) => void) {
  // Handler for requesting linux.do cookies and CSRF token from the options page
  void _sendResponse
  const chromeAPI = getChromeAPI()
  if (!chromeAPI || !chromeAPI.tabs || !chromeAPI.cookies) {
    _sendResponse({ success: false, error: 'Chrome API not available' })
    return
  }

  try {
    // Get linux.do cookies
    const cookies = await chromeAPI.cookies.getAll({ domain: 'linux.do' })
    const cookieString = cookies.map((cookie: any) => `${cookie.name}=${cookie.value}`).join('; ')

    // Try to get CSRF token from linux.do tabs
    let csrfToken = ''
    try {
      const tabs = await chromeAPI.tabs.query({ url: 'https://linux.do/*' })
      if (tabs.length > 0 && tabs[0].id) {
        try {
          const response = await chromeAPI.tabs.sendMessage(tabs[0].id, {
            type: 'GET_CSRF_TOKEN'
          })
          if (response && response.csrfToken) {
            csrfToken = response.csrfToken
          }
        } catch (sendMessageError) {
          // 尝试其他 linux.do 标签页
          for (let i = 1; i < tabs.length; i++) {
            if (tabs[i].id) {
              try {
                const response = await chromeAPI.tabs.sendMessage(tabs[i].id, {
                  type: 'GET_CSRF_TOKEN'
                })
                if (response && response.csrfToken) {
                  csrfToken = response.csrfToken
                  break
                }
              } catch (e) {
                // 继续尝试下一个标签页
                continue
              }
            }
          }
          if (!csrfToken) {
            console.warn('Failed to get CSRF token from any linux.do tab:', sendMessageError)
          }
        }
      } else {
        console.warn('No linux.do tabs found')
      }
    } catch (e) {
      console.warn('Failed to get CSRF token from linux.do tab:', e)
    }

    _sendResponse({
      success: true,
      csrfToken: csrfToken,
      cookies: cookieString
    })
  } catch (error: any) {
    console.error('Failed to get linux.do auth info:', error)
    _sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export async function handleSaveLastDiscourse(payload: any, sendResponse: any) {
  void sendResponse
  try {
    const chromeAPI = getChromeAPI()
    if (!chromeAPI || !chromeAPI.storage || !chromeAPI.storage.local) {
      sendResponse({ success: false, error: 'chrome storage not available' })
      return
    }

    // Expect payload to be { base: string, cookie?: string, csrf?: string }
    await new Promise<void>((resolve, reject) => {
      try {
        chromeAPI.storage.local.set({ lastDiscourse: payload }, () => {
          if (chromeAPI.runtime.lastError) reject(chromeAPI.runtime.lastError)
          else resolve()
        })
      } catch (e) {
        reject(e)
      }
    })

    sendResponse({ success: true })
  } catch (error) {
    console.error('Failed to save lastDiscourse', error)
    sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) })
  }
}

export function setupStorageChangeListener() {
  const chromeAPI = getChromeAPI()
  if (chromeAPI && chromeAPI.storage && chromeAPI.storage.onChanged) {
    chromeAPI.storage.onChanged.addListener((changes: any, namespace: any) => {
      console.log('Storage changed:', changes, namespace)
      // Placeholder for cloud sync or other reactions
    })
  }
}

export function setupContextMenu() {
  const chromeAPI = getChromeAPI()
  if (chromeAPI && chromeAPI.runtime && chromeAPI.runtime.onInstalled && chromeAPI.contextMenus) {
    chromeAPI.runtime.onInstalled.addListener(() => {
      chrome.storage.local.get('appSettings', result => {
        // 解析新的存储格式来获取 forceMobileMode
        let forceMobileMode = false
        if (result.appSettings) {
          if (result.appSettings.data && typeof result.appSettings.data === 'object') {
            // 新格式：{ data: {...}, timestamp: ... }
            forceMobileMode = result.appSettings.data.forceMobileMode || false
          } else if (typeof result.appSettings === 'object') {
            // 兼容旧格式：直接是设置对象
            forceMobileMode = result.appSettings.forceMobileMode || false
          }
        }

        if (chromeAPI.contextMenus && chromeAPI.contextMenus.create) {
          chromeAPI.contextMenus.create({
            id: 'open-emoji-options',
            title: '表情管理',
            contexts: ['page']
          })
          chromeAPI.contextMenus.create({
            id: 'force-mobile-mode',
            title: '强制使用移动模式',
            type: 'checkbox',
            checked: forceMobileMode,
            contexts: ['page']
          })
        }
      })
    })

    if (chromeAPI.contextMenus.onClicked) {
      chromeAPI.contextMenus.onClicked.addListener((info: any, _tab: any) => {
        if (
          info.menuItemId === 'open-emoji-options' &&
          chromeAPI.runtime &&
          chromeAPI.runtime.openOptionsPage
        ) {
          chromeAPI.runtime.openOptionsPage()
        } else if (info.menuItemId === 'force-mobile-mode') {
          const newCheckedState = info.checked

          // 获取当前设置并更新 forceMobileMode
          chrome.storage.local.get('appSettings', result => {
            let currentSettings = {}
            if (result.appSettings) {
              if (result.appSettings.data && typeof result.appSettings.data === 'object') {
                currentSettings = result.appSettings.data
              } else if (typeof result.appSettings === 'object') {
                currentSettings = result.appSettings
              }
            }

            // 更新设置并保存为新格式
            const timestamp = Date.now()
            const updatedSettings = {
              ...currentSettings,
              forceMobileMode: newCheckedState,
              lastModified: timestamp
            }

            const appSettingsData = {
              data: updatedSettings,
              timestamp: timestamp
            }

            chrome.storage.local.set({ appSettings: appSettingsData })
          })
        }
      })
    }
  }
}

export function setupPeriodicCleanup() {
  setInterval(
    async () => {
      const chromeAPI = getChromeAPI()
      if (!chromeAPI || !chromeAPI.storage) return

      try {
        const data = await chromeAPI.storage.local.get(['emojiGroups'])
        if (data.emojiGroups) {
          console.log('Storage cleanup check completed')
        }
      } catch (error) {
        console.error('Storage cleanup error:', error)
      }
    },
    24 * 60 * 60 * 1000
  )
}
