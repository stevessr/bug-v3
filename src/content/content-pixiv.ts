import { logger } from './utils/buildFLagsV2'
import { initPixiv } from './pixiv/pixiv'

console.log('[Emoji Extension] content-pixiv loaded')
try {
  initPixiv()
} catch (e) {
  console.error('[content-pixiv] initPixiv failed', e)
}
