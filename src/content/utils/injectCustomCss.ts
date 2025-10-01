import { ensureStyleInjected } from '../../userscript/utils/injectStyles'
import { cachedState } from '../data/state'

const STYLE_ID = 'emoji-extension-custom-css'

export function applyCustomCssFromCache() {
  try {
    const css = cachedState.settings && (cachedState.settings as any).customCss
    if (css && typeof css === 'string' && css.trim().length > 0) {
      ensureStyleInjected(STYLE_ID, css)
      console.log('[Emoji Extension] 应用自定义 css')
      console.log('[Emoji Extension] css\n', css)
    } else {
      // remove existing style element if present
      const el = document.getElementById(STYLE_ID)
      if (el && el.parentNode) el.parentNode.removeChild(el)
      console.log('[Emoji Extension] Removed custom CSS (empty)')
    }
  } catch (e) {
    console.warn('[Emoji Extension] Failed to apply custom CSS', e)
  }
}


