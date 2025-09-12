// 自动初始化入口，注入即执行
try {
  initX()
} catch (e) {
  // silent
}
import { initVideoCopy } from './videoCopy'
import { scanAndInjectCarousel } from './carousel'
import { initImages } from './images'
import { initImagePage } from './imagePage'

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

function initX() {
  try {
    if (!isXPage()) return
    initImages()
    setTimeout(scanAndInjectCarousel, 200)
    initImagePage()
    initVideoCopy()
  } catch (e) {
    // noop
  }
}

export { initX }
