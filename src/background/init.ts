import { repairEmptyStorage } from '@/utils/simpleStorage'

/**
 * 初始化默认数据（优化：委托给 simpleStorage 统一管理）
 */
export async function initializeDefaultData() {
  console.log('[Background] Initializing default data')
  await repairEmptyStorage()
}

/**
 * 设置 Side Panel 为窗口级别，避免切换 tab 时刷新
 */
export function setupSidePanel() {
  const chromeAPI = typeof chrome !== 'undefined' ? chrome : null
  if (chromeAPI?.sidePanel) {
    // Set side panel to window-level (no tabId) to prevent reload on tab switch
    chromeAPI.sidePanel
      .setOptions({
        path: 'index.html?type=sidebar',
        enabled: true
      })
      .catch((e: Error) => {
        console.warn('[Background] Failed to set side panel options:', e)
      })
  }
}

export function setupOnInstalledListener() {
  const chromeAPI = typeof chrome !== 'undefined' ? chrome : null
  if (chromeAPI?.runtime?.onInstalled) {
    chromeAPI.runtime.onInstalled.addListener(async (details: any) => {
      console.log('Emoji extension installed/updated:', details.reason)
      if (details.reason === 'install') {
        await initializeDefaultData()
      }
      // Configure side panel on install/update
      setupSidePanel()
    })
  }
}
