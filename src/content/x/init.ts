import { scanAndInjectCarousel } from './image/carousel'
import { initVideoCopy } from './video/videoCopy'

function isXPage(): boolean {
  try {
    const host = window.location.hostname.toLowerCase()
    return (
      host === 'x.com' ||
      host.endsWith('.twitter.com') ||
      host.includes('twitter.com') ||
      host === 'pbs.twimg.com' ||
      host.endsWith('.twimg.com') ||
      host.includes('twimg.com') ||
      host.includes('pbs.twimg')
    )
  } catch {
    return false
  }
}

export function initX() {
  try {
    if (!isXPage()) {
      console.log('[XOneClick] skipping init: not X/Twitter host')
      return
    }
    setTimeout(() => {
      // run initial scan
      scanAndInjectCarousel()
    }, 200)
    // video copy lives in separate module
    initVideoCopy()
    console.log('[XOneClick] initialized')
  } catch (e) {
    console.error('[XOneClick] init failed', e)
  }
}
