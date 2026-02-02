import { defineComponent, ref, computed } from 'vue'

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
    const currentIndex = ref(0)
    const navDirection = ref<'next' | 'prev'>('next')

    const total = computed(() => props.images.length)

    const currentImage = computed(() => props.images[currentIndex.value])

    const clampIndex = (index: number) => {
      if (total.value === 0) return 0
      const mod = index % total.value
      return mod < 0 ? mod + total.value : mod
    }

    const scrollToIndex = (index: number, direction: 'next' | 'prev') => {
      navDirection.value = direction
      currentIndex.value = clampIndex(index)
    }

    const handlePrev = () => scrollToIndex(currentIndex.value - 1, 'prev')
    const handleNext = () => scrollToIndex(currentIndex.value + 1, 'next')

    return () => (
      <div class="post-carousel-tsx">
        {currentImage.value ? (
          <div class={['post-carousel-focus-tsx', `is-${navDirection.value}`]}>
            <a
              class="post-carousel-link-tsx"
              href={currentImage.value.href}
              title={currentImage.value.title || currentImage.value.alt || undefined}
              target="_blank"
              rel="noopener noreferrer"
              data-no-router="true"
            >
              {(() => {
                const ratio = getAspectRatio(currentImage.value)
                const frameStyle = ratio
                  ? {
                      aspectRatio: String(ratio),
                      backgroundColor: currentImage.value.dominantColor
                        ? `#${currentImage.value.dominantColor}`
                        : undefined
                    }
                  : undefined
                return (
                  <div
                    class="post-carousel-frame-tsx"
                    style={frameStyle}
                  >
                    <img
                      class="post-carousel-image-tsx"
                      src={getImageSrc(currentImage.value)}
                      alt={currentImage.value.alt || ''}
                      width={currentImage.value.width}
                      height={currentImage.value.height}
                      srcset={currentImage.value.srcset}
                      data-base62-sha1={currentImage.value.base62Sha1}
                      data-dominant-color={currentImage.value.dominantColor}
                      loading={currentImage.value.loading || 'lazy'}
                    />
                  </div>
                )
              })()}
            </a>
          </div>
        ) : null}
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
                  onClick={() =>
                    scrollToIndex(idx, idx >= currentIndex.value ? 'next' : 'prev')
                  }
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
