import type { MessageHandler } from './types'

import type { MessageResponse } from '@/types/messages'

const MAX_SYMBOL_COUNT = 2000
const MAX_SPRITE_BYTES = 2 * 1024 * 1024

/**
 * Read the sprite already loaded by the active Discourse site. Keeping this in
 * the content context preserves per-site theme/plugin icons without packaging
 * a frozen copy of one forum's Font Awesome set in the extension.
 */
export const discourseIconSpriteHandler: MessageHandler = (message, _sender, sendResponse) => {
  if (message.type !== 'GET_DISCOURSE_ICON_SPRITE') return false

  try {
    const symbols: string[] = []
    const seen = new Set<string>()
    let totalBytes = 0

    for (const symbol of document.querySelectorAll<SVGSymbolElement>('symbol[id]')) {
      const id = symbol.id.trim()
      if (!id || seen.has(id)) continue

      const markup = symbol.outerHTML
      if (totalBytes + markup.length > MAX_SPRITE_BYTES) break

      seen.add(id)
      symbols.push(markup)
      totalBytes += markup.length
      if (symbols.length >= MAX_SYMBOL_COUNT) break
    }

    if (symbols.length === 0) {
      const response: MessageResponse = {
        success: false,
        error: 'The target Discourse page has not loaded an SVG icon sprite'
      }
      sendResponse(response)
      return true
    }

    const response: MessageResponse = {
      success: true,
      data: { symbols }
    }
    sendResponse(response)
  } catch (error) {
    const response: MessageResponse = {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
    sendResponse(response)
  }

  return true
}
