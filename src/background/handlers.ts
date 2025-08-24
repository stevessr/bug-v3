import { newStorageHelpers } from '../utils/newStorage'

import { getChromeAPI } from './utils'

export function setupMessageListener() {
  const chromeAPI = getChromeAPI()
  if (chromeAPI && chromeAPI.runtime && chromeAPI.runtime.onMessage) {
    chromeAPI.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: any) => {
      console.log('Background received message:', message)

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

        default:
          console.log('Unknown message type:', message.type)
          sendResponse({ success: false, error: 'Unknown message type' })
      }

      if (message.action) {
        switch (message.action) {
          case 'addToFavorites':
            handleAddToFavorites(message.emoji, sendResponse)
            return true

          case 'addEmojiFromWeb':
            handleAddEmojiFromWeb(message.emojiData, sendResponse)
            return true

          default:
            console.log('Unknown action:', message.action)
            sendResponse({ success: false, error: 'Unknown action' })
        }
      }
    })
  }
}

export async function handleAddEmojiFromWeb(emojiData: any, sendResponse: (response: any) => void) {
  try {
    // 获取所有表情组
    const groups = await newStorageHelpers.getAllEmojiGroups()

    // 找到未分组表情组
    let ungroupedGroup = groups.find((g: any) => g.id === 'ungrouped')
    if (!ungroupedGroup) {
      // 如果未分组表情组不存在，创建一个
      ungroupedGroup = {
        id: 'ungrouped',
        name: '未分组',
        icon: '📦',
        order: 999,
        emojis: []
      }
      groups.push(ungroupedGroup)
    }

    // 检查是否已存在相同URL的表情
    const existingEmoji = ungroupedGroup.emojis.find((e: any) => e.url === emojiData.url)
    if (existingEmoji) {
      sendResponse({ success: false, error: '此表情已存在于未分组中' })
      return
    }

    // 创建新表情
    const newEmoji = {
      id: `emoji-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      packet: Date.now(),
      name: emojiData.name,
      url: emojiData.url,
      groupId: 'ungrouped',
      addedAt: Date.now()
    }

    ungroupedGroup.emojis.push(newEmoji)

    // 保存到存储
    await newStorageHelpers.setAllEmojiGroups(groups)

    console.log('[Background] 成功添加表情到未分组:', newEmoji.name)
    sendResponse({ success: true, message: '表情已添加到未分组' })
  } catch (error) {
    console.error('[Background] 添加表情失败:', error)
    sendResponse({ success: false, error: error instanceof Error ? error.message : '添加失败' })
  }
}

export async function handleAddToFavorites(emoji: any, sendResponse: (response: any) => void) {
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
    const favGroup = finalGroups.find((g: any) => g.id === 'favorites')!

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
      } catch (e) {
        // ignore
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

export async function handleGetEmojiData(sendResponse: (response: any) => void) {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI || !chromeAPI.storage) {
    sendResponse({ success: false, error: 'Chrome storage API not available' })
    return
  }

  try {
    const data = await chromeAPI.storage.local.get(['emojiGroups', 'appSettings', 'favorites'])

    // 解析新的存储格式，appSettings 现在是 { data: {...}, timestamp: ... } 的格式
    let settings = {}
    if (data.appSettings) {
      if (data.appSettings.data && typeof data.appSettings.data === 'object') {
        // 新格式：{ data: {...}, timestamp: ... }
        settings = data.appSettings.data
      } else if (typeof data.appSettings === 'object') {
        // 兼容旧格式：直接是设置对象
        settings = data.appSettings
      }
    }

    sendResponse({
      success: true,
      data: {
        groups: data.emojiGroups || [],
        settings: settings,
        favorites: data.favorites || []
      }
    })
  } catch (error: any) {
    console.error('Failed to get emoji data:', error)
    sendResponse({ success: false, error: error.message })
  }
}

export async function handleSaveEmojiData(data: any, sendResponse: (response: any) => void) {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI || !chromeAPI.storage) {
    sendResponse({ success: false, error: 'Chrome storage API not available' })
    return
  }

  try {
    await chromeAPI.storage.local.set(data)
    sendResponse({ success: true })
  } catch (error: any) {
    console.error('Failed to save emoji data:', error)
    sendResponse({ success: false, error: error.message })
  }
}

export async function handleSyncSettings(settings: any, sendResponse: (response: any) => void) {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI || !chromeAPI.storage || !chromeAPI.tabs) {
    sendResponse({ success: false, error: 'Chrome API not available' })
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

    sendResponse({ success: true })
  } catch (error: any) {
    console.error('Failed to sync settings:', error)
    sendResponse({ success: false, error: error.message })
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
