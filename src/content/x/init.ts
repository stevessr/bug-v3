import { scanAndInjectCarousel, observeCarousel } from './image/carousel'
import { initVideoCopy } from './video/videoCopy'

function isXPage(): boolean {
  try {
    const host = window.location.hostname.toLowerCase()
    return (
      // x.com and any subdomains like www.x.com, mobile.x.com
      host === 'x.com' ||
      host.endsWith('.x.com') ||
      // legacy twitter domains
      host === 'twitter.com' ||
      host.endsWith('.twitter.com') ||
      host.includes('twitter.com')
    )
  } catch {
    return false
  }
}

export function initX() {
  try {
    const host = window.location.hostname
    console.log('[XOneClick] initX called on host:', host)
    if (!isXPage()) {
      console.log(`[XOneClick] skipping init: not X/Twitter host (hostname=${host})`)
      return
    }
    setTimeout(() => {
      // run initial scan
      scanAndInjectCarousel()
      // start observing DOM changes for subsequent scans
      observeCarousel()
    }, 200)
    // video copy lives in separate module
    initVideoCopy()
    console.log('[XOneClick] initialized')
  } catch (e) {
    console.error('[XOneClick] init failed', e)
  }
}
