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
    const dragX = ref(0)
    const isDragging = ref(false)
    const isAnimating = ref(false)
    const pendingDirection = ref<'next' | 'prev' | null>(null)
    const suppressClick = ref(false)
    const containerWidth = ref(0)
    const lastPointerX = ref(0)

    const total = computed(() => props.images.length)

    const currentImage = computed(() => props.images[currentIndex.value])

    const clampIndex = (index: number) => {
      if (total.value === 0) return 0
      const mod = index % total.value
      return mod < 0 ? mod + total.value : mod
    }

    const getIndex = (offset: number) => clampIndex(currentIndex.value + offset)

    const beginAnimateTo = (direction: 'next' | 'prev') => {
      if (isAnimating.value || total.value <= 1) return
      pendingDirection.value = direction
      isAnimating.value = true
      suppressClick.value = true
      dragX.value = direction === 'next' ? -containerWidth.value : containerWidth.value
    }

    const snapBack = () => {
      if (isAnimating.value) return
      isAnimating.value = true
      pendingDirection.value = null
      dragX.value = 0
    }

    const handlePrev = () => beginAnimateTo('prev')
    const handleNext = () => beginAnimateTo('next')

    const handlePointerDown = (event: PointerEvent) => {
      if (total.value <= 1 || isAnimating.value) return
      if (!(event.currentTarget instanceof HTMLElement)) return
      event.currentTarget.setPointerCapture(event.pointerId)
      isDragging.value = true
      suppressClick.value = false
      lastPointerX.value = event.clientX
      containerWidth.value = event.currentTarget.getBoundingClientRect().width || 1
      dragX.value = 0
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!isDragging.value || isAnimating.value) return
      const delta = event.clientX - lastPointerX.value
      lastPointerX.value = event.clientX
      const width = containerWidth.value || 1
      dragX.value += delta
      if (dragX.value > width) dragX.value = width
      if (dragX.value < -width) dragX.value = -width
      if (Math.abs(dragX.value) > 4) {
        suppressClick.value = true
      }
    }

    const handlePointerUp = () => {
      if (!isDragging.value) return
      isDragging.value = false
      const threshold = containerWidth.value * 0.2
      if (Math.abs(dragX.value) >= threshold) {
        beginAnimateTo(dragX.value < 0 ? 'next' : 'prev')
      } else {
        snapBack()
      }
    }

    const handleTransitionEnd = () => {
      if (!isAnimating.value) return
      if (pendingDirection.value) {
        currentIndex.value = getIndex(pendingDirection.value === 'next' ? 1 : -1)
      }
      pendingDirection.value = null
      isAnimating.value = false
      dragX.value = 0
    }

    const handleLinkClick = (event: MouseEvent) => {
      if (suppressClick.value) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    return () => (
      <div class="post-carousel-tsx">
        {currentImage.value ? (
          <div
            class={['post-carousel-focus-tsx', isDragging.value ? 'is-dragging' : '']}
            onPointerdown={handlePointerDown}
            onPointermove={handlePointerMove}
            onPointerup={handlePointerUp}
            onPointercancel={handlePointerUp}
          >
            <div
              class={['post-carousel-track-tsx', isAnimating.value ? 'is-animating' : '']}
              style={{ transform: `translateX(calc(-100% + ${dragX.value}px))` }}
              onTransitionend={handleTransitionEnd}
            >
              {[getIndex(-1), getIndex(0), getIndex(1)].map((idx, slot) => {
                const image = props.images[idx]
                const ratio = getAspectRatio(image)
                const frameStyle = ratio
                  ? {
                      aspectRatio: String(ratio),
                      backgroundColor: image.dominantColor ? `#${image.dominantColor}` : undefined
                    }
                  : undefined
                return (
                  <div class="post-carousel-slide-tsx" key={`${image.base62Sha1 || image.href}-${slot}`}>
                    <a
                      class="post-carousel-link-tsx"
                      href={image.href}
                      title={image.title || image.alt || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-no-router="true"
                      onClick={handleLinkClick}
                    >
                      <div class="post-carousel-frame-tsx" style={frameStyle}>
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
                  onClick={() => {
                    if (idx === currentIndex.value) return
                    beginAnimateTo(idx > currentIndex.value ? 'next' : 'prev')
                  }}
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
