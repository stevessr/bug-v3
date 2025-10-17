import { initXImages } from './xImages'
import { isXMediaHost } from './utils'

export function initXMedia() {
  try {
    if (!isXMediaHost()) return
    initXImages()
  } catch (err) {
    console.error('[XMedia] init failed', err)
  }
}
