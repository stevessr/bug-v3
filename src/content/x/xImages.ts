import { scanAndInjectCarousel, observeCarousel } from './image/carousel'

export function initXImages() {
  try {
    scanAndInjectCarousel()
    observeCarousel()
  } catch (err) {
    console.error('[XImages] init failed', err)
  }
}
