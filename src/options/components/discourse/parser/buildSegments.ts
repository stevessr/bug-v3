import type { ParsedContent, LightboxImage } from '../types'

export const buildSegments = (
  html: string,
  lightboxes: LightboxImage[],
  carousels: LightboxImage[][]
): ParsedContent['segments'] => {
  const markers: Array<{ marker: string; type: 'lightbox' | 'carousel'; index: number }> = []
  lightboxes.forEach((_item, idx) => {
    markers.push({ marker: `__DISCOURSE_LIGHTBOX_${idx}__`, type: 'lightbox', index: idx })
  })
  carousels.forEach((_item, idx) => {
    markers.push({ marker: `__DISCOURSE_CAROUSEL_${idx}__`, type: 'carousel', index: idx })
  })

  const segments: ParsedContent['segments'] = []
  let cursor = 0

  const pushHtmlChunk = (chunk: string) => {
    if (chunk && chunk.trim().length > 0) {
      segments.push({ type: 'html', html: chunk })
    }
  }

  while (cursor < html.length) {
    let nextIndex = -1
    let nextMarker: (typeof markers)[number] | null = null
    for (const marker of markers) {
      const idx = html.indexOf(marker.marker, cursor)
      if (idx !== -1 && (nextIndex === -1 || idx < nextIndex)) {
        nextIndex = idx
        nextMarker = marker
      }
    }
    if (nextIndex === -1 || !nextMarker) break

    const chunk = html.slice(cursor, nextIndex)
    pushHtmlChunk(chunk)

    if (nextMarker.type === 'lightbox') {
      const image = lightboxes[nextMarker.index]
      if (image) segments.push({ type: 'lightbox', image })
    } else {
      const items = carousels[nextMarker.index] || []
      if (items.length > 0) segments.push({ type: 'carousel', images: items })
    }

    cursor = nextIndex + nextMarker.marker.length
  }

  if (cursor < html.length) {
    pushHtmlChunk(html.slice(cursor))
  }

  if (segments.length === 0) {
    segments.push({ type: 'html', html })
  }

  return segments
}
