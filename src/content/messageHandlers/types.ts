import type { AgentAction } from '@/agent/types'

export type ContentMessage =
  | { type: 'AGENT_ACTION'; action: AgentAction }
  | {
      type: 'DOM_QUERY'
      kind: 'tree' | 'at-point'
      selector?: string
      x?: number
      y?: number
      options?: any
    }
  | { type: 'GET_CSRF_TOKEN' }
  | { type: 'GET_LINUX_DO_USER' }
  | { type: 'PAGE_FETCH'; options: any }
  | { type: 'PAGE_UPLOAD'; options: any }
  | { type: 'FETCH_IMAGE'; url: string }
  | { type: 'SETTINGS_UPDATED'; updates?: any }

export type MessageHandler<T extends ContentMessage = ContentMessage> = (
  message: T,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
) => boolean | Promise<void> | void
