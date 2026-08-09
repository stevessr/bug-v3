import { setWorkflowRecordingEnabled } from '../agent/workflowRecorder'

import type { MessageHandler } from './types'

import type { MessageResponse } from '@/types/messages'

export const workflowRecorderHandler: MessageHandler = (message, _sender, sendResponse) => {
  if (message.type !== 'AGENT_RECORDING_SET_STATE') return false

  setWorkflowRecordingEnabled(message.active)
  const response: MessageResponse<{ active: boolean }> = {
    success: true,
    data: { active: message.active }
  }
  sendResponse(response)
  return true
}
