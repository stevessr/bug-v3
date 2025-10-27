import { cachedState } from '../data/state'

import { createE, DOA, DEBI } from '@/content/utils/createEl'

const STYLE_ID = 'emoji-extension-custom-css'

export function applyCustomCssFromCache() {
  try {
    const css = cachedState.settings && (cachedState.settings as any).customCss
    if (css && typeof css === 'string' && css.trim().length > 0) {
      ESI(STYLE_ID, css)
      console.log('[Emoji Extension] 应用自定义 css')
      console.log('[Emoji Extension] css\n', css)
    } else {
      // remove existing style element if present
      const el = DEBI(STYLE_ID)
      if (el && el.parentNode) el.parentNode.removeChild(el)
      console.log('[Emoji Extension] Removed custom CSS (empty)')
    }
  } catch (e) {
    console.warn('[Emoji Extension] Failed to apply custom CSS', e)
  }
}

// Ensures style is injected into document.body
export function ESI(id: string, css: string): void {
  DOA(
    createE('style', {
      id: id,
      text: css
    })
  )
}
