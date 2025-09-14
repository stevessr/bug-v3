import { initPixiv } from '../pixiv/detector'
import { initBilibili } from '../bilibili/bilibili'
import { initX } from '../x/init'

// logger removed: replaced by direct console usage in migration

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
    console.error('[OneClickAdd] initPixiv failed', e)
  }

  try {
    initBilibili()
  } catch (e) {
    console.error('[OneClickAdd] initBilibili failed', e)
  }

  try {
    // Only initialize X/Twitter injection if the user enabled it in settings.
    // Use an async IIFE because this function is not async.
    ;(async () => {
      try {
        const settings = await requestSettingsFromBackground()
        // If settings cannot be read (null), default to enabling X injection so
        // we still attempt to initialize on x.com. If settings are present,
        // respect the enableXcomExtraSelectors flag.
        const enabled = settings == null ? true : !!settings.enableXcomExtraSelectors
        console.log('[XOneClick] init check - settings:', settings, 'enabled:', enabled)
        if (enabled) {
          initX()
        } else {
          console.log('[XOneClick] skipping init: enableXcomExtraSelectors disabled in settings')
        }
      } catch (err) {
        console.error('[OneClickAdd] initX check failed', err)
      }
    })()
  } catch (e) {
    console.error('[OneClickAdd] initX failed', e)
  }
}
