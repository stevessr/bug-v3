import { defineComponent, computed } from 'vue'

import type { LightboxImage } from '../types'
import '../css/ImageMasonry.css'

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
  name: 'ImageMasonry',
  props: {
    columns: { type: Array as () => LightboxImage[][], required: true },
    columnsCount: { type: Number, default: 2 }
  },
  setup(props) {
    const items = computed(() => props.columns.flat())
    const columns = computed(() => Math.max(1, props.columnsCount || props.columns.length || 2))

    return () => (
      <div
        class="post-masonry-tsx"
        data-columns={columns.value}
        style={{ columnCount: String(columns.value) }}
      >
        {items.value.map(image => {
          const ratio = getAspectRatio(image)
          const frameStyle = ratio
            ? {
                aspectRatio: String(ratio),
                backgroundColor: image.dominantColor ? `#${image.dominantColor}` : undefined
              }
            : undefined
          return (
            <div class="post-masonry-item-tsx" key={image.base62Sha1 || image.href}>
              <a
                class="post-masonry-link-tsx"
                href={image.href}
                title={image.title || image.alt || undefined}
                target="_blank"
                rel="noopener noreferrer"
                data-no-router="true"
              >
                <div class="post-masonry-frame-tsx" style={frameStyle}>
                  <img
                    class="post-masonry-image-tsx"
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
    )
  }
})
