import { sendMessageToLinuxDoTab } from '../utils/linuxDoTabMessenger'

import type { LinuxDoPageFetchMessage, MessageResponse } from '@/types/messages'

export async function handleLinuxDoPageFetchRequest(
  opts: LinuxDoPageFetchMessage['options'],
  _sendResponse: (resp: MessageResponse) => void
) {
  if (!opts?.url) {
    _sendResponse({ success: false, error: 'Missing url' })
    return
  }

  const resp = await sendMessageToLinuxDoTab<MessageResponse>({
    type: 'PAGE_FETCH',
    options: {
      url: opts.url,
      method: opts.method,
      headers: opts.headers,
      body: opts.body,
      responseType: opts.responseType
    }
  })
  _sendResponse(resp)
}
