import { getChromeAPI } from '../utils/main.ts'

import { getSettings, setSettings } from '@/utils/simpleStorage'
import { defaultSettings } from '@/types/defaultSettings'

export function setupContextMenu() {
  const chromeAPI = getChromeAPI()
  if (chromeAPI && chromeAPI.runtime && chromeAPI.runtime.onInstalled && chromeAPI.contextMenus) {
    chromeAPI.runtime.onInstalled.addListener(() => {
      void getSettings()
        .then(settings => {
          const forceMobileMode = !!settings?.forceMobileMode

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
        .catch(error => console.error('Context menu settings failed:', error))
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
          void getSettings()
            .then(settings => {
              const currentSettings = settings || defaultSettings

              // 更新设置并保存为新格式
              const timestamp = Date.now()
              const updatedSettings = {
                ...currentSettings,
                forceMobileMode: newCheckedState,
                lastModified: timestamp
              }

              return setSettings(updatedSettings)
            })
            .catch(error => console.error('Context menu settings update failed:', error))
        }
      })
    }
  }
}
