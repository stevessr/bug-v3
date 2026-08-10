import { sendMessageToDomainTab } from '../utils/domainTabMessenger'

import type { DiscourseSiteSettingsResponse } from '@/types/messages'

/**
 * Ask a content script on the exact Discourse origin for the small, explicitly
 * allow-listed subset of public client settings needed by the browser UI.
 */
export async function handleDiscourseSiteSettingsRequest(
  url: string,
  keys: string[],
  sendResponse: (response: DiscourseSiteSettingsResponse) => void
) {
  if (!url) {
    sendResponse({ success: false, error: 'Missing url' })
    return
  }

  if (!Array.isArray(keys)) {
    sendResponse({ success: false, error: 'Missing keys' })
    return
  }

  const response = await sendMessageToDomainTab<DiscourseSiteSettingsResponse>(url, {
    type: 'GET_DISCOURSE_SITE_SETTINGS',
    url,
    keys
  })
  sendResponse(response)
}
