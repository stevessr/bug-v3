import { handleAgentAction } from '../agent/actions'

import type { MessageHandler } from './types'

export const agentHandler: MessageHandler = (message, _sender, sendResponse) => {
  if (message.type !== 'AGENT_ACTION') return false

  handleAgentAction(message.action)
    .then(result => sendResponse({ success: true, data: result }))
    .catch((error: any) =>
      sendResponse({ success: false, error: error?.message || '动作执行失败' })
    )
  return true // Keep channel open for async response
}
