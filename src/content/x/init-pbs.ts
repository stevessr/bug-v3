import { scanAndInjectCarousel, observeCarousel } from './image/carousel'

function isPbsDomain(): boolean {
  try {
    const host = window.location.hostname.toLowerCase()
    return (
      host === 'pbs.twimg.com' ||
      host.endsWith('.twimg.com') ||
      host.includes('twimg.com') ||
      host.includes('pbs.twimg')
    )
  } catch {
    return false
  }
}

/**
 * 初始化仅针对图片托管域 (pbs.twimg.com / *.twimg.com)
 * 只运行图片相关逻辑（比如 carousel 注入）
 */
export function initPbs() {
  try {
    const host = window.location.hostname
    console.log('[XOneClick] initPbs called on host:', host)
    if (!isPbsDomain()) {
      console.log(`[XOneClick] skipping pbs init: not pbs/twimg host (hostname=${host})`)
      return
    }
    setTimeout(() => {
      // 仅运行图片扫描与注入
      scanAndInjectCarousel()
      // observe DOM changes on pbs image pages too
      observeCarousel()
    }, 200)
    console.log('[XOneClick] pbs initialized')
  } catch (e) {
    console.error('[XOneClick] initPbs failed', e)
  }
}
