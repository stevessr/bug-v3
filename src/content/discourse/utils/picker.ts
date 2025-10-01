import { createDesktopEmojiPicker } from './dekstop'
import { createMobileEmojiPicker } from './mobile'

export const isMobile = (): boolean => {
  const userAgent = navigator.userAgent
  const mobileKeywords = ['Android', 'iPhone', 'iPad', 'iPod', 'Windows Phone']
  return mobileKeywords.some(keyword => userAgent.includes(keyword))
}

export async function createEmojiPicker(isMobileView: boolean): Promise<HTMLElement> {
  console.log('[Emoji Extension] Creating picker for isMobileView:', isMobileView)
  if (isMobileView) {
    return createMobileEmojiPicker()
  }
  return createDesktopEmojiPicker()
}
