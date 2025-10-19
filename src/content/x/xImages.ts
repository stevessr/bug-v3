import { scanAndInjectCarousel, observeCarousel } from './image/carousel'
import { isImageInjectionEnabled } from './xConfig'

export function initXImages() {
  try {
    // 检查图片注入功能开关
    if (!isImageInjectionEnabled()) {
      console.log('[XImages] Image injection disabled by config')
      return
    }
    
    scanAndInjectCarousel()
    observeCarousel()
  } catch (err) {
    console.error('[XImages] init failed', err)
  }
}
