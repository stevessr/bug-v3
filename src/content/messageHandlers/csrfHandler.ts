import { getCsrfTokenFromPage } from '../utils/csrf'

import type { MessageHandler } from './types'

import type { CsrfTokenResponse } from '@/types/messages'

export const csrfHandler: MessageHandler = (message, _sender, sendResponse) => {
  if (message.type !== 'GET_CSRF_TOKEN') return false

  try {
    const response: CsrfTokenResponse = { csrfToken: getCsrfTokenFromPage() }
    sendResponse(response)
  } catch (error) {
    console.warn('[Emoji Extension] Failed to get CSRF token:', error)
    sendResponse({ csrfToken: '' })
  }
  return true
}
