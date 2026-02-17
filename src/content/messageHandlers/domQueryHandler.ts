import { getDomTree, getDomTreeAtPoint } from '../agent/dom'

import type { MessageHandler } from './types'

import type { MessageResponse } from '@/types/messages'

export const domQueryHandler: MessageHandler = (message, _sender, sendResponse) => {
  if (message.type !== 'DOM_QUERY') return false

  try {
    const options = message.options && typeof message.options === 'object' ? message.options : {}
    if (message.kind === 'tree') {
      const data = getDomTree(message.selector, options)
      const response: MessageResponse = { success: true, data }
      sendResponse(response)
      return true
    }
    if (message.kind === 'at-point') {
      const x = message.x
      const y = message.y
      if (typeof x !== 'number' || typeof y !== 'number') {
        const response: MessageResponse = { success: false, error: 'DOM 查询坐标无效' }
        sendResponse(response)
        return true
      }
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        const response: MessageResponse = { success: false, error: 'DOM 查询坐标无效' }
        sendResponse(response)
        return true
      }
      const data = getDomTreeAtPoint(x, y, options)
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
