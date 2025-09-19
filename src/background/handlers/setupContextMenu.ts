import { getChromeAPI } from '../utils/main.ts'

export function setupContextMenu() {
  const browserAPI = getChromeAPI()
  if (browserAPI && browserAPI.runtime && browserAPI.runtime.onInstalled && browserAPI.contextMenus) {
    browserAPI.runtime.onInstalled.addListener(async () => {
      try {
        const result = await browserAPI.storage.local.get('appSettings')
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

        if (browserAPI.contextMenus && browserAPI.contextMenus.create) {
          browserAPI.contextMenus.create({
            id: 'open-emoji-options',
            title: '表情管理',
            contexts: ['page']
          })
          browserAPI.contextMenus.create({
            id: 'force-mobile-mode',
            title: '强制使用移动模式',
            type: 'checkbox',
            checked: forceMobileMode,
            contexts: ['page']
          })
        }
      } catch (error) {
        console.error('Error setting up context menu:', error)
      }
    })

    if (browserAPI.contextMenus.onClicked) {
      browserAPI.contextMenus.onClicked.addListener(async (info: any, _tab: any) => {
        if (
          info.menuItemId === 'open-emoji-options' &&
          browserAPI.runtime &&
          browserAPI.runtime.openOptionsPage
        ) {
          browserAPI.runtime.openOptionsPage()
        } else if (info.menuItemId === 'force-mobile-mode') {
          const newCheckedState = info.checked

          try {
            // 获取当前设置并更新 forceMobileMode
            const result = await browserAPI.storage.local.get('appSettings')
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

            await browserAPI.storage.local.set({ appSettings: appSettingsData })
          } catch (error) {
            console.error('Error updating force mobile mode setting:', error)
          }
        }
      })
    }
  }
}
