import { loadDataFromStorage } from '../data/storage'
import { applyCustomCssFromCache } from '../utils/injectCustomCss'
import { publishCloudflareWallEnabled } from '../utils/cloudflareWallSettingsBridge'

import type { MessageHandler } from './types'

import type { MessageResponse } from '@/types/messages'

export const settingsHandler: MessageHandler = (message, _sender, sendResponse) => {
  if (message.type !== 'SETTINGS_UPDATED') return false

  console.log('[Emoji Extension] Settings updated from background, reloading data')
  const updates = message.updates as Record<string, unknown> | undefined
  if (updates && typeof updates.enableLinuxDoAutoChallenge === 'boolean') {
    publishCloudflareWallEnabled(updates.enableLinuxDoAutoChallenge)
  }

  // 如果有 updates，优先使用增量更新
  loadDataFromStorage(message.updates)
  // re-apply custom css after settings updated
  try {
    applyCustomCssFromCache()
  } catch (error) {
    console.warn('[Emoji Extension] Failed to re-apply custom CSS after settings update:', error)
  }

  const response: MessageResponse = { success: true }
  sendResponse(response)
  return true
}
