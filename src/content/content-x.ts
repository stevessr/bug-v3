import { logger } from './utils/buildFLagsV2'
import { initX } from './x/main'

logger.log('[Emoji Extension] content-x loaded')
try {
  initX()
} catch (e) {
  logger.error('[content-x] initX failed', e)
}
