import { sendMessageToDomainTab } from '../utils/domainTabMessenger'

import type { PageFetchMessage, MessageResponse } from '@/types/messages'

export async function handlePageFetchRequest(
  opts: PageFetchMessage['options'],
  sendResponse: (resp: MessageResponse) => void
) {
  if (!opts?.url) {
    sendResponse({ success: false, error: 'Missing url' })
    return
  }

  const resp = await sendMessageToDomainTab<MessageResponse>(opts.url, {
    type: 'PAGE_FETCH',
    options: {
      url: opts.url,
      method: opts.method,
      headers: opts.headers,
      body: opts.body,
      responseType: opts.responseType
    }
  })
  sendResponse(resp)
}
