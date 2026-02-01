import type { ParsedContent, LightboxImage } from '../types'

const renderImg = (image: LightboxImage, className: string) => {
  const attrs: string[] = []
  const push = (name: string, value?: string) => {
    if (!value) return
    attrs.push(`${name}="${value.replace(/"/g, '&quot;')}"`)
  }
  push('class', className)
  push('src', image.thumbSrc || image.href)
  push('alt', image.alt || '')
  push('width', image.width)
  push('height', image.height)
  push('srcset', image.srcset)
  push('loading', image.loading || 'lazy')
  push('style', image.style)
  return `<img ${attrs.join(' ')} />`
}

const renderCarousel = (images: LightboxImage[]) => {
  if (images.length === 0) return ''
  const track = images.map(img => renderImg(img, 'post-carousel-image')).join('')
  const thumbs = images
    .map(img => renderImg({ ...img, style: undefined }, 'post-carousel-thumb'))
    .join('')
  return `
    <div class="post-carousel">
      <div class="post-carousel-track">${track}</div>
      <div class="post-carousel-thumbs">${thumbs}</div>
    </div>
  `
}

const renderImageGrid = (
  columns: LightboxImage[][],
  columnsCount?: number
): string => {
  const count = columnsCount || columns.length || 2
  const items = columns.flat().map(img => {
    const image = renderImg(img, 'post-image-grid-image')
    return `<div class="post-image-grid-item">${image}</div>`
  })
  return `
    <div class="post-image-grid" style="--grid-columns: ${count};">
      ${items.join('')}
    </div>
  `
}

export const renderSegmentsToHtml = (segments: ParsedContent['segments']): string => {
  return segments
    .map(segment => {
      if (segment.type === 'html') return segment.html
      if (segment.type === 'lightbox') return renderImg(segment.image, 'post-inline-image rounded')
      if (segment.type === 'carousel') return renderCarousel(segment.images)
      if (segment.type === 'image-grid') {
        return renderImageGrid(segment.columns, segment.columnsCount)
      }
      return ''
    })
    .join('')
}
