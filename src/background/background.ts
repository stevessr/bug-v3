import { getChromeAPI } from './utils'

import { setupOnInstalledListener } from './init'
import {
  setupMessageListener,
  setupStorageChangeListener,
  setupContextMenu,
  setupPeriodicCleanup
} from './handlers'
import { injectBridgeIntoTab, injectAutodetectIntoTab } from './scripting'

console.log('Emoji Extension Background script loaded.')

// Wire up listeners and periodic jobs
setupOnInstalledListener()
setupMessageListener()
setupStorageChangeListener()
setupContextMenu()
setupPeriodicCleanup()

// Programmatic injection on tab navigation
const chromeAPI = getChromeAPI()
if (chromeAPI && chromeAPI.tabs && chromeAPI.tabs.onUpdated) {
  chromeAPI.tabs.onUpdated.addListener(async (tabId: number, changeInfo: any, tab: any) => {
    try {
      if (changeInfo.status === 'complete' && tab && !tab.url?.startsWith('chrome://')) {
        // Inject autodetect script first to determine page type
        await injectAutodetectIntoTab(tabId).catch(() => {
          // ignore
        })
        // Also inject bridge for extension communication
        await injectBridgeIntoTab(tabId).catch(() => {
          // ignore
        })
      }
    } catch (e) {
      // ignore
    }
  })
}

// Also inject on action click (extension icon click) for sites that need immediate injection
if (chromeAPI && chromeAPI.action && chromeAPI.action.onClicked) {
  chromeAPI.action.onClicked.addListener(async (tab: any) => {
    try {
      if (tab && tab.id && !tab.url?.startsWith('chrome://')) {
        await injectAutodetectIntoTab(tab.id).catch(() => {
          // ignore
        })
        await injectBridgeIntoTab(tab.id).catch(() => {
          // ignore
        })
      }
    } catch (e) {
      // ignore
    }
  })
}
