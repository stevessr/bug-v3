import { getDiscoursePreloadedRecord } from '../discourse/preloaded'

import type { MessageHandler } from './types'

import type { DiscourseSiteSettingsResponse } from '@/types/messages'

const SAFE_SETTING_KEY = /^[a-z][a-z0-9_]{0,95}$/i
const MAX_SETTING_KEYS = 64

export const discourseSiteSettingsHandler: MessageHandler = (message, _sender, sendResponse) => {
  if (message.type !== 'GET_DISCOURSE_SITE_SETTINGS') return false

  const siteSettings = getDiscoursePreloadedRecord('siteSettings', 'site_settings')
  if (!siteSettings) {
    const response: DiscourseSiteSettingsResponse = {
      success: false,
      error: 'Discourse site settings are unavailable in this tab'
    }
    sendResponse(response)
    return true
  }

  const requestedKeys = Array.from(new Set(message.keys || []))
    .filter(key => typeof key === 'string' && SAFE_SETTING_KEY.test(key))
    .slice(0, MAX_SETTING_KEYS)
  const settings: Record<string, string | number | boolean | null> = {}

  requestedKeys.forEach(key => {
    const value = siteSettings[key]
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      settings[key] = value
    }
  })

  const response: DiscourseSiteSettingsResponse = { success: true, settings }
  sendResponse(response)
  return true
}
