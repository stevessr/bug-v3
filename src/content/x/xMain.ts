import { initXImages } from './xImages'
import { initVideoCopy } from './video/videoCopy'
import { isXMainHost } from './utils'

export function initXMain() {
  try {
    if (!isXMainHost()) return
    initXImages()
    initVideoCopy()
  } catch (err) {
    console.error('[XMain] init failed', err)
  }
}
