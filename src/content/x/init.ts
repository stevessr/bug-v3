import { isXHost, isXMainHost, isXMediaHost } from './utils'
import { initXMain } from './xMain'
import { initXMedia } from './xMedia'

export function initX() {
  try {
    const host = window.location.hostname
    console.log('[XOneClick] initX called on host:', host)
    if (!isXHost()) {
      console.log(`[XOneClick] skipping init: not X/Twitter host (hostname=${host})`)
      return
    }
    setTimeout(() => {
      if (isXMainHost()) {
        initXMain()
        return
      }
      if (isXMediaHost()) {
        initXMedia()
        return
      }
    }, 200)
    console.log('[XOneClick] initialized')
  } catch (e) {
    console.error('[XOneClick] init failed', e)
  }
}
