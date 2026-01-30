import { sendMessageToLinuxDoTab } from '../utils/linuxDoTabMessenger'

import type { LinuxDoUploadMessage, MessageResponse } from '@/types/messages'

export async function handleLinuxDoUploadRequest(
  opts: LinuxDoUploadMessage['options'],
  _sendResponse: (resp: MessageResponse) => void
) {
  if (!opts?.url) {
    _sendResponse({ success: false, error: 'Missing url' })
    return
  }

  const resp = await sendMessageToLinuxDoTab<MessageResponse>({
    type: 'PAGE_UPLOAD',
    options: {
      url: opts.url,
      fileData: opts.fileData,
      fileName: opts.fileName,
      mimeType: opts.mimeType,
      sha1: opts.sha1
    }
  })
  _sendResponse(resp)
}
