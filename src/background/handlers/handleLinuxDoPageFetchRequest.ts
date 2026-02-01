import { handlePageFetchRequest } from './handlePageFetchRequest'

import type { LinuxDoPageFetchMessage, MessageResponse } from '@/types/messages'

export async function handleLinuxDoPageFetchRequest(
  opts: LinuxDoPageFetchMessage['options'],
  _sendResponse: (resp: MessageResponse) => void
) {
  handlePageFetchRequest(opts, _sendResponse)
}
