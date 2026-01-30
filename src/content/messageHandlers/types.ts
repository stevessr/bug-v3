import type { ContentMessage } from '@/types/messages'

export type { ContentMessage }

export type MessageHandler<T extends ContentMessage = ContentMessage> = (
  message: T,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
) => boolean | Promise<void> | void
