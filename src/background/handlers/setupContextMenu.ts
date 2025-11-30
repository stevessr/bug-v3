import { getChromeAPI } from '../utils/main.ts'

interface StoredSettings {
  data: {
    forceMobileMode?: boolean
    [key: string]: any
  }
  timestamp: number
}

export function setupContextMenu() {
  const chromeAPI = getChromeAPI()
  if (chromeAPI && chromeAPI.runtime && chromeAPI.runtime.onInstalled && chromeAPI.contextMenus) {
    chromeAPI.runtime.onInstalled.addListener(() => {
      chrome.storage.local.get('appSettings', result => {
        // 解析存储格式（仅支持新格式 { data: {...}, timestamp: ... }）来获取 forceMobileMode
        let forceMobileMode = false
        const settings = result.appSettings as StoredSettings
        if (settings && typeof settings === 'object' && settings.data) {
          forceMobileMode = !!settings.data.forceMobileMode
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
      chromeAPI.contextMenus.onClicked.addListener((info: any) => {
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
            // 仅从新格式读取当前设置（{ data: {...}, timestamp })，否则使用空对象
            let currentSettings = {}
            const settings = result.appSettings as StoredSettings
            if (settings && typeof settings === 'object' && settings.data) {
              currentSettings = settings.data
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
