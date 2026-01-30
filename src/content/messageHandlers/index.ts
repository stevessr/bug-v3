import type { ContentMessage } from './types'
import { agentHandler } from './agentHandler'
import { domQueryHandler } from './domQueryHandler'
import { csrfHandler } from './csrfHandler'
import { linuxDoUserHandler } from './linuxDoUserHandler'
import { pageFetchHandler } from './pageFetchHandler'
import { pageUploadHandler } from './pageUploadHandler'
import { fetchImageHandler } from './fetchImageHandler'
import { settingsHandler } from './settingsHandler'

const handlers = [
  agentHandler,
  domQueryHandler,
  csrfHandler,
  linuxDoUserHandler,
  pageFetchHandler,
  pageUploadHandler,
  fetchImageHandler,
  settingsHandler
]

export function dispatchMessage(
  message: ContentMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
): boolean {
  for (const handler of handlers) {
    if (handler(message, sender, sendResponse)) {
      return true
    }
  }
  return false
}
