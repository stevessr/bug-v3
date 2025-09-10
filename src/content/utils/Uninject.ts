import { logger } from './buildFLagsV2'
import { initPixiv } from '../pixiv/pixiv'
import { initBilibili } from '../bilibili/bilibili'
import { initX } from '../x/main'

// Helper: request settings from background (uses GET_EMOJI_DATA which returns settings)
function requestSettingsFromBackground(): Promise<any> {
  return new Promise(resolve => {
    try {
      if (
        (window as any).chrome &&
        (window as any).chrome.runtime &&
        (window as any).chrome.runtime.sendMessage
      ) {
        ;(window as any).chrome.runtime.sendMessage({ type: 'GET_EMOJI_DATA' }, (resp: any) => {
          if (resp && resp.success && resp.data && resp.data.settings) {
            resolve(resp.data.settings)
          } else {
            resolve(null)
          }
        })
      } else {
        resolve(null)
      }
    } catch (e) {
      void e
      resolve(null)
    }
  })
}

export function Uninject() {
  try {
    initPixiv()
  } catch (e) {
    logger.error('[OneClickAdd] initPixiv failed', e)
  }

  try {
    initBilibili()
  } catch (e) {
    logger.error('[OneClickAdd] initBilibili failed', e)
  }

  try {
    // Only initialize X/Twitter injection if the user enabled it in settings.
    // Use an async IIFE because this function is not async.
    ;(async () => {
      try {
        const settings = await requestSettingsFromBackground()
        const enabled = !!(settings && settings.enableXcomExtraSelectors)
        if (enabled) {
          initX()
        } else {
          logger.log('[XOneClick] skipping init: enableXcomExtraSelectors disabled in settings')
        }
      } catch (err) {
        logger.error('[OneClickAdd] initX check failed', err)
      }
    })()
  } catch (e) {
    logger.error('[OneClickAdd] initX failed', e)
  }
}
