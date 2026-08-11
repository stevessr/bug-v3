import { defineComponent, computed } from 'vue'
import { Image } from 'ant-design-vue'

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
        style={{ '--masonry-columns': String(columns.value) }}
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
              <div
                class="post-masonry-frame-tsx"
                style={frameStyle}
                data-discourse-url={image.href}
                data-image-url={image.href}
                title={image.title || image.alt || undefined}
              >
                <Image
                  class="post-masonry-image-tsx"
                  wrapperClassName="post-masonry-image-wrapper-tsx"
                  src={getImageSrc(image)}
                  preview={{ src: image.href }}
                  width={image.width}
                  height={image.height}
                  // @ts-ignore Ant Image accepts srcset/loading even though the
                  // current type definition omits these HTML attributes.
                  srcset={image.srcset}
                  loading={(image.loading as 'eager' | 'lazy' | undefined) || 'lazy'}
                  // Keep the original metadata available to the browser context
                  // menu and image proxy without putting an anchor in front of
                  // Ant Design's preview trigger.
                  data-base62-sha1={image.base62Sha1}
                  data-dominant-color={image.dominantColor}
                />
              </div>
            </div>
          )
        })}
      </div>
    )
  }
})
