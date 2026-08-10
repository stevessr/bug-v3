import type { MessageHandler } from './types'
import { getDiscoursePreloadedData } from './pageFetchHandler'

import type { DiscourseSiteSettingsResponse } from '@/types/messages'

const SAFE_SETTING_KEY = /^[a-z][a-z0-9_]{0,95}$/i
const MAX_SETTING_KEYS = 64

const parseRecord = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

export const discourseSiteSettingsHandler: MessageHandler = (message, _sender, sendResponse) => {
  if (message.type !== 'GET_DISCOURSE_SITE_SETTINGS') return false

  const bootstrap = getDiscoursePreloadedData()
  const siteSettings = parseRecord(bootstrap?.siteSettings ?? bootstrap?.site_settings)
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
