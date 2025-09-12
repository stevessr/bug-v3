import { logger } from './utils/buildFLagsV2'
import { initBilibili } from './bilibili/bilibili'

console.log('[Emoji Extension] content-bilibili loaded')
try {
  initBilibili()
} catch (e) {
  console.error('[content-bilibili] initBilibili failed', e)
}
