import { logger } from './utils/buildFLagsV2'
import { initBilibili } from './bilibili/bilibili'

logger.log('[Emoji Extension] content-bilibili loaded')
try {
  initBilibili()
} catch (e) {
  logger.error('[content-bilibili] initBilibili failed', e)
}
