
import { initDiscourse } from './discourse/discourse'

console.log('[Emoji Extension] content-discourse loaded')
try {
  initDiscourse()
} catch (e) {
  console.error('[content-discourse] initDiscourse failed', e)
}
