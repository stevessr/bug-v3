import { handleAgentAction } from '../agent/actions'

import type { MessageHandler } from './types'

import type { MessageResponse } from '@/types/messages'

export const agentHandler: MessageHandler = (message, _sender, sendResponse) => {
  if (message.type !== 'AGENT_ACTION') return false

  handleAgentAction(message.action)
    .then(result => {
      const response: MessageResponse = { success: true, data: result }
      sendResponse(response)
    })
    .catch((error: any) => {
      const errorResponse: MessageResponse = {
        success: false,
        error: error?.message || '动作执行失败'
      }
      sendResponse(errorResponse)
    })
  return true // Keep channel open for async response
}
