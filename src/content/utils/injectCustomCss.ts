import { cachedState } from '../data/state'

import { createE, DOA, DEBI } from '@/content/utils/createEl'

const STYLE_ID = 'emoji-extension-custom-css'

export function applyCustomCssFromCache() {
  try {
    const css = getCombinedCustomCssFromCache()
    if (css && css.trim().length > 0) {
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

// Get combined CSS from blocks in cache
function getCombinedCustomCssFromCache(): string {
  try {
    const settings = cachedState.settings as any
    if (!settings) return ''

    // Check if new block system is available
    if (settings.customCssBlocks && Array.isArray(settings.customCssBlocks)) {
      return settings.customCssBlocks
        .filter((block: any) => block.enabled)
        .map((block: any) => block.content || '')
        .join('\n\n')
        .trim()
    }

    // Fallback to legacy customCss
    if (settings.customCss && typeof settings.customCss === 'string') {
      return settings.customCss.trim()
    }

    return ''
  } catch (e) {
    console.warn('[Emoji Extension] Failed to get combined CSS from cache', e)
    return ''
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
