import { createDesktopEmojiPicker } from './dekstop'
import { createMobileEmojiPicker } from './mobile'
import type { PickerContext } from './editor'

export const isMobile = (): boolean => {
  const userAgent = navigator.userAgent
  const mobileKeywords = ['Android', 'iPhone', 'iPad', 'iPod', 'Windows Phone']
  return mobileKeywords.some(keyword => userAgent.includes(keyword))
}

export async function createEmojiPicker(
  isMobileView: boolean,
  context: PickerContext = 'composer'
): Promise<HTMLElement> {
  console.log('[Emoji Extension] Creating picker for isMobileView:', isMobileView)
  if (isMobileView) {
    return createMobileEmojiPicker(context)
  }
  return createDesktopEmojiPicker(context)
}
