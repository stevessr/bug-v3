import { logger } from './utils/buildFLagsV2'
import { initDiscourse } from './discourse/discourse'

logger.log('[Emoji Extension] content-discourse loaded')
try {
  initDiscourse()
} catch (e) {
  logger.error('[content-discourse] initDiscourse failed', e)
}
