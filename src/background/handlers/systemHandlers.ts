import { getChromeAPI } from '../utils'

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
        let forceMobileMode = false
        if (result.appSettings) {
          if (result.appSettings.data && typeof result.appSettings.data === 'object') {
            forceMobileMode = result.appSettings.data.forceMobileMode || false
          } else if (typeof result.appSettings === 'object') {
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

          chrome.storage.local.get('appSettings', result => {
            let currentSettings = {}
            if (result.appSettings) {
              if (result.appSettings.data && typeof result.appSettings.data === 'object') {
                currentSettings = result.appSettings.data
              } else if (typeof result.appSettings === 'object') {
                currentSettings = result.appSettings
              }
            }

            const timestamp = Date.now()
            const updatedSettings = {
              ...currentSettings,
              forceMobileMode: newCheckedState,
              lastModified: timestamp
            }

            const appSettingsData = { data: updatedSettings, timestamp }

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
