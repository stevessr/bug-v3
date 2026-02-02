import { defineComponent, ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

import type { LightboxImage } from '../types'
import '../css/ImageCarousel.css'

const getRatioFromStyle = (style?: string) => {
  if (!style) return null
  const match = style.match(/aspect-ratio\s*:\s*([0-9.]+)\s*\/\s*([0-9.]+)/i)
  if (!match) return null
  const w = Number(match[1])
  const h = Number(match[2])
  if (!Number.isFinite(w) || !Number.isFinite(h) || h === 0) return null
  return w / h
}

const getAspectRatio = (image: LightboxImage) => {
  const fromStyle = getRatioFromStyle(image.style)
  if (fromStyle) return fromStyle
  const w = Number(image.width)
  const h = Number(image.height)
  if (Number.isFinite(w) && Number.isFinite(h) && h > 0) return w / h
  return null
}

const getImageSrc = (image: LightboxImage) => image.thumbSrc || image.href

export default defineComponent({
  name: 'ImageCarousel',
  props: {
    images: { type: Array as () => LightboxImage[], required: true }
  },
  setup(props) {
    const trackRef = ref<HTMLDivElement | null>(null)
    const currentIndex = ref(0)

    const total = computed(() => props.images.length)

    const scrollToIndex = async (index: number) => {
      const track = trackRef.value
      if (!track) return
      const clamped = Math.min(Math.max(index, 0), Math.max(0, total.value - 1))
      currentIndex.value = clamped
      await nextTick()
      const slide = track.querySelector<HTMLDivElement>(`[data-slide='${clamped}']`)
      slide?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }

    const handlePrev = () => scrollToIndex(currentIndex.value - 1)
    const handleNext = () => scrollToIndex(currentIndex.value + 1)

    const handleScroll = () => {
      const track = trackRef.value
      if (!track) return
      const slides = Array.from(track.querySelectorAll<HTMLDivElement>('[data-slide]'))
      if (slides.length === 0) return
      const trackRect = track.getBoundingClientRect()
      const center = trackRect.left + trackRect.width / 2
      let bestIndex = 0
      let bestDistance = Number.POSITIVE_INFINITY
      slides.forEach((slide, idx) => {
        const rect = slide.getBoundingClientRect()
        const slideCenter = rect.left + rect.width / 2
        const distance = Math.abs(slideCenter - center)
        if (distance < bestDistance) {
          bestDistance = distance
          bestIndex = idx
        }
      })
      currentIndex.value = bestIndex
    }

    onMounted(() => {
      const track = trackRef.value
      if (track) {
        track.addEventListener('scroll', handleScroll, { passive: true })
      }
    })

    onUnmounted(() => {
      const track = trackRef.value
      if (track) {
        track.removeEventListener('scroll', handleScroll)
      }
    })

    return () => (
      <div class="post-carousel-tsx">
        <div class="post-carousel-track-tsx" ref={trackRef}>
          {props.images.map((image, idx) => {
            const ratio = getAspectRatio(image)
            const wrapperStyle = ratio
              ? {
                  aspectRatio: String(ratio),
                  backgroundColor: image.dominantColor ? `#${image.dominantColor}` : undefined
                }
              : undefined
            return (
              <div
                class="post-carousel-slide-tsx"
                key={image.base62Sha1 || image.href}
                data-slide={idx}
              >
                <a
                  class="post-carousel-link-tsx"
                  href={image.href}
                  title={image.title || image.alt || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-no-router="true"
                >
                  <div class="post-carousel-frame-tsx" style={wrapperStyle}>
                    <img
                      class="post-carousel-image-tsx"
                      src={getImageSrc(image)}
                      alt={image.alt || ''}
                      width={image.width}
                      height={image.height}
                      srcset={image.srcset}
                      data-base62-sha1={image.base62Sha1}
                      data-dominant-color={image.dominantColor}
                      loading={image.loading || 'lazy'}
                    />
                  </div>
                </a>
              </div>
            )
          })}
        </div>
        {total.value > 1 ? (
          <div class="post-carousel-controls-tsx">
            <button
              class="post-carousel-nav-tsx"
              type="button"
              aria-label="上一张"
              onClick={handlePrev}
            >
              ‹
            </button>
            <div class="post-carousel-dots-tsx">
              {props.images.map((_, idx) => (
                <button
                  key={`dot-${idx}`}
                  type="button"
                  class={['post-carousel-dot-tsx', idx === currentIndex.value ? 'is-active' : '']}
                  aria-label={`转到幻灯片 ${idx + 1}`}
                  aria-current={idx === currentIndex.value ? 'true' : undefined}
                  onClick={() => scrollToIndex(idx)}
                />
              ))}
            </div>
            <button
              class="post-carousel-nav-tsx"
              type="button"
              aria-label="下一张"
              onClick={handleNext}
            >
              ›
            </button>
          </div>
        ) : null}
      </div>
    )
  }
})
