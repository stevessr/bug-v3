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

export function isImageUrl(value: string | null | undefined): boolean {
  if (!value) return false
  // Accept data URIs (base64) directly
  if (typeof value === 'string' && value.startsWith('data:image/')) return true
  try {
    const url = new URL(value)
    // Accept http(s) with common image extensions
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(url.pathname)
    }
    return false
  } catch {
    return false
  }
}
