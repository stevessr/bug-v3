import { initXImages } from './xImages'
import { initVideoCopy } from './video/videoCopy'
import { initAutoDownload } from './autoDownload'
import { isXMainHost } from './utils'

export function initXMain() {
  try {
    if (!isXMainHost()) return
    initXImages()
    initVideoCopy()
    initAutoDownload()
  } catch (err) {
    console.error('[XMain] init failed', err)
  }
}
