import { getCsrfTokenFromPage } from '../utils/csrf'

import type { MessageHandler } from './types'

export const csrfHandler: MessageHandler = (message, _sender, sendResponse) => {
  if (message.type !== 'GET_CSRF_TOKEN') return false

  try {
    sendResponse({ csrfToken: getCsrfTokenFromPage() })
  } catch (error) {
    console.warn('[Emoji Extension] Failed to get CSRF token:', error)
    sendResponse({ csrfToken: '' })
  }
  return true
}
