import { initPixiv } from '../pixiv/detector'
import { initBilibili } from '../bilibili/bilibili'
import { initX } from '../x/init'
import { initXhs } from '../xhs/init'
import { initReddit } from '../reddit/reddit'

import { requestSettingFromBackground } from './requestSetting'

// logger removed: replaced by direct console usage in migration

// NOTE: Requesting the full configuration from background is deprecated for
// this module. Consumers should use `requestSettingFromBackground` to fetch
// single keys on demand to reduce IPC payload and improve performance.

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
    initReddit()
  } catch (e) {
    console.error('[OneClickAdd] initReddit failed', e)
  }

  try {
    initXIfEnabled()
  } catch (e) {
    console.error('[OneClickAdd] initX failed', e)
  }

  try {
    initXhs()
  } catch (xhsErr) {
    console.error('[XOneClick] initXhs failed', xhsErr)
  }
}

// Exported helper: check settings and initialize X-specific injection if enabled.
export async function initXIfEnabled(): Promise<void> {
  try {
    // Request only the single setting we care about to reduce payload and
    // avoid requesting the entire configuration object.
    const val = await requestSettingFromBackground('enableXcomExtraSelectors')

    const enabled = val === null || val === undefined || val === true

    if (val === null || val === undefined) {
      console.log(
        '[XOneClick] enableXcomExtraSelectors unavailable; defaulting to enabled for X injection'
      )
    } else {
      console.log('[XOneClick] fetched enableXcomExtraSelectors from background:', val)
    }
    console.log('[XOneClick] init decision - enabled:', enabled)

    if (enabled) {
      try {
        initX()
        console.log('[XOneClick] initX invoked')
      } catch (innerErr) {
        console.error('[XOneClick] initX threw an error during invocation', innerErr)
      }
    } else {
      console.log('[XOneClick] skipping init: enableXcomExtraSelectors disabled in settings')
    }
  } catch (err) {
    console.error('[OneClickAdd] initX check failed', err)
  }
}
