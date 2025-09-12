import { logger } from './utils/buildFLagsV2'
import { initX } from './x/main'

console.log('[Emoji Extension] content-x loaded')
try {
  initX()
} catch (e) {
  console.error('[content-x] initX failed', e)
}
