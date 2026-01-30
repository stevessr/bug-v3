import { getDomTree, getDomTreeAtPoint } from '../agent/dom'

import type { MessageHandler } from './types'

export const domQueryHandler: MessageHandler = (message, _sender, sendResponse) => {
  if (message.type !== 'DOM_QUERY') return false

  try {
    if (message.kind === 'tree') {
      const data = getDomTree(message.selector, message.options || {})
      sendResponse({ success: true, data })
      return true
    }
    if (message.kind === 'at-point') {
      const data = getDomTreeAtPoint(message.x ?? 0, message.y ?? 0, message.options || {})
      sendResponse({ success: true, data })
      return true
    }
    sendResponse({ success: false, error: '未知 DOM 查询类型' })
  } catch (error: any) {
    sendResponse({ success: false, error: error?.message || 'DOM 查询失败' })
  }
  return true
}
