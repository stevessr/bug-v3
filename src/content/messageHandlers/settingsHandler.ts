import { loadDataFromStorage } from '../data/storage'
import { applyCustomCssFromCache } from '../utils/injectCustomCss'

import type { MessageHandler } from './types'

export const settingsHandler: MessageHandler = (message, _sender, _sendResponse) => {
  if (message.type !== 'SETTINGS_UPDATED') return false

  console.log('[Emoji Extension] Settings updated from background, reloading data')
  // 如果有 updates，优先使用增量更新
  loadDataFromStorage(message.updates)
  // re-apply custom css after settings updated
  try {
    applyCustomCssFromCache()
  } catch (_e) {
    void _e
  }
  return true
}
