import { sendMessageToDomainTab } from '../utils/domainTabMessenger'

import type { MessageResponse } from '@/types/messages'

export async function handleDiscourseIconSpriteRequest(
  url: string,
  sendResponse: (response: MessageResponse) => void
) {
  if (!url) {
    sendResponse({ success: false, error: 'Missing url' })
    return
  }

  const response = await sendMessageToDomainTab<MessageResponse>(url, {
    type: 'GET_DISCOURSE_ICON_SPRITE'
  })
  sendResponse(response)
}
