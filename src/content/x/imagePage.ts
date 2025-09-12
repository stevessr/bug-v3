import { createOverlayBtn } from './images'

export function initImagePage() {
  try {
    // Only run on hosts that serve standalone images (pbs.twimg.com, twimg, etc.)
    const host = window.location.hostname.toLowerCase()
    const isMediaHost =
      host === 'pbs.twimg.com' ||
      host.endsWith('.twimg.com') ||
      host.includes('twimg.com') ||
      host.includes('pbs.twimg')
    if (!isMediaHost) return

    // If there's a top-level img element or the body is the image, try to inject overlay
    setTimeout(() => {
      const imgs = Array.from(document.querySelectorAll('img')) as HTMLImageElement[]
      if (imgs.length === 0) return
      // Prefer the largest image on the page
      let largest: HTMLImageElement | null = null
      let area = 0
      imgs.forEach(i => {
        try {
          const r = i.getBoundingClientRect()
          const a = r.width * r.height
          if (a > area) {
            area = a
            largest = i
          }
        } catch {
          // ignore
        }
      })
      if (!largest) largest = imgs[0]
      const src = largest.src || largest.getAttribute('src') || ''
      if (!src) return
      const name = src.split('/').pop()?.split('?')[0] || '表情'
      createOverlayBtn({ name, url: src }, largest)
    }, 200)
  } catch (e) {
    // noop
  }
}

try {
  initImagePage()
} catch (e) {
  // noop
}
