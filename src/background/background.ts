import './utils'
import { getChromeAPI } from './utils'

import { setupOnInstalledListener } from './init'
import {
  setupMessageListener,
  setupStorageChangeListener,
  setupContextMenu,
  setupPeriodicCleanup
} from './handlers'
import { injectBridgeIntoTab } from './scripting'

console.log('Emoji Extension Background script loaded.')

// Wire up listeners and periodic jobs
setupOnInstalledListener()
setupMessageListener()
setupStorageChangeListener()
setupContextMenu()
setupPeriodicCleanup()

// Ensure injected bridge is added to newly updated tabs (e.g., navigation complete)
const chromeAPI = getChromeAPI()
if (chromeAPI && chromeAPI.tabs && chromeAPI.tabs.onUpdated) {
  chromeAPI.tabs.onUpdated.addListener((tabId: number, changeInfo: any, tab: any) => {
    try {
      if (changeInfo.status === 'complete' && tab && !tab.url?.startsWith('chrome://')) {
        injectBridgeIntoTab(tabId).catch(() => {
          // ignore
        })
      }
    } catch (e) {
      // ignore
    }
  })
}
