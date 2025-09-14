import type { AddEmojiButtonData } from '../types'
import { createPixivEmojiButton as emojiCreate } from './emojiButton'
import { createPixivOpenInNewTabButton as openCreate } from './openButton'

// Router: 根据当前 hostname 决定返回哪个按钮实现。
export function createPixivEmojiButton(data: AddEmojiButtonData): HTMLElement {
  try {
    const host = typeof window !== 'undefined' && window.location && window.location.hostname
    if (host && host.includes('pixiv.net')) {
      return openCreate(data)
    }
  } catch (_e) {
    void _e
  }
  return emojiCreate(data)
}

export { createPixivOpenInNewTabButton } from './openButton'
export { createPixivEmojiButton as createPixivEmojiButtonImpl } from './emojiButton'
