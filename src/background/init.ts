import { repairEmptyStorage } from '@/utils/simpleStorage'

/**
 * 初始化默认数据（优化：委托给 simpleStorage 统一管理）
 */
export async function initializeDefaultData() {
  console.log('[Background] Initializing default data')
  await repairEmptyStorage()
}

export function setupOnInstalledListener() {
  const chromeAPI = typeof chrome !== 'undefined' ? chrome : null
  if (chromeAPI?.runtime?.onInstalled) {
    chromeAPI.runtime.onInstalled.addListener(async (details: any) => {
      console.log('Emoji extension installed/updated:', details.reason)
      if (details.reason === 'install') {
        await initializeDefaultData()
      }
    })
  }
}
