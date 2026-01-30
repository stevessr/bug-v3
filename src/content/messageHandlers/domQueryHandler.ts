import { getDomTree, getDomTreeAtPoint } from '../agent/dom'

import type { MessageHandler } from './types'

import type { MessageResponse } from '@/types/messages'

export const domQueryHandler: MessageHandler = (message, _sender, sendResponse) => {
  if (message.type !== 'DOM_QUERY') return false

  try {
    if (message.kind === 'tree') {
      const data = getDomTree(message.selector, message.options || {})
      const response: MessageResponse = { success: true, data }
      sendResponse(response)
      return true
    }
    if (message.kind === 'at-point') {
      const data = getDomTreeAtPoint(message.x ?? 0, message.y ?? 0, message.options || {})
      const response: MessageResponse = { success: true, data }
      sendResponse(response)
      return true
    }
    const errorResponse: MessageResponse = { success: false, error: '未知 DOM 查询类型' }
    sendResponse(errorResponse)
  } catch (error: any) {
    const errorResponse: MessageResponse = {
      success: false,
      error: error?.message || 'DOM 查询失败'
    }
    sendResponse(errorResponse)
  }
  return true
}
