import { notify } from '../utils/notify'

import type { MessageHandler } from './types'

export const fetchImageHandler: MessageHandler = (message, _sender, sendResponse) => {
  if (message.type !== 'FETCH_IMAGE') return false

  const url = message.url
  if (!url) {
    sendResponse({ success: false, error: 'Missing url' })
    return true
  }

  // 提取文件名用于显示
  let displayName = 'image'
  try {
    const u = new URL(url)
    const pathname = u.pathname
    const name = pathname.split('/').pop()
    if (name) displayName = name.length > 20 ? name.slice(0, 20) + '...' : name
  } catch {
    /* ignore */
  }

  // 显示通知：正在帮助插件获取图片
  notify(`正在获取：${displayName}`, 'info', 2000)

  fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'image/*,*/* '
    }
  })
    .then(async res => {
      if (!res.ok) {
        sendResponse({ success: false, error: `HTTP ${res.status}: ${res.statusText}` })
        return
      }
      const blob = await res.blob()
      const arrayBuffer = await blob.arrayBuffer()
      sendResponse({
        success: true,
        data: Array.from(new Uint8Array(arrayBuffer)),
        mimeType: blob.type,
        size: blob.size
      })
    })
    .catch((error: any) => {
      sendResponse({ success: false, error: error?.message || 'Image fetch failed' })
    })
  return true
}
