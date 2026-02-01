import type { Node, Element, Parent } from 'hast'

import { buildLightbox, ParseContext } from './context'
import {
  findFirst,
  getPropString,
  hasClass,
  isElement,
  replaceNodeWithText,
  stringifyChildren
} from './astUtils'
import { traverse } from './traverse'

const isImageGrid = (node: Element) => {
  // Only match d-image-grid that is NOT a carousel
  if (!hasClass(node, 'd-image-grid')) return false
  if (hasClass(node, 'd-image-grid--carousel')) return false
  if (getPropString(node, 'data-mode') === 'carousel') return false
  // Check if it contains d-image-carousel (which would make it a carousel)
  const hasCarousel = findFirst(node, el => hasClass(el, 'd-image-carousel'))
  if (hasCarousel) return false
  return true
}

const isInsideOnebox = (ancestors: Element[]) => {
  return ancestors.some(el => hasClass(el, 'onebox'))
}

export const extractImageGrid = (root: Node, ctx: ParseContext) => {
  traverse(root, (node, parent, index, ancestors) => {
    if (!parent || index === null) return
    if (!isElement(node)) return
    if (isInsideOnebox(ancestors)) return
    if (!isImageGrid(node)) return

    // Extract lightbox wrappers from the grid
    const lightboxWrappers = Array.from(node.children)
      .filter((child): child is Element => isElement(child) && hasClass(child, 'd-image-grid-column'))
      .flatMap(column => Array.from(column.children))
      .filter((child): child is Element => isElement(child) && hasClass(child, 'lightbox-wrapper'))

    // Replace each lightbox-wrapper with a marker
    lightboxWrappers.forEach(wrapper => {
      const wrapperColumn = wrapper.parentNode as Element | null
      if (!wrapperColumn) return
      const wrapperIndex = wrapperColumn.children.indexOf(wrapper)
      if (wrapperIndex === -1) return

      const anchor = findFirst(wrapper, el => el.tagName === 'a' && hasClass(el, 'lightbox'))
      const img = findFirst(wrapper, el => el.tagName === 'img')
      const meta = findFirst(wrapper, el => hasClass(el, 'meta'))

      const lightbox = buildLightbox(ctx, {
        href: anchor ? getPropString(anchor, 'href') : img ? getPropString(img, 'src') : undefined,
        downloadHref: anchor ? getPropString(anchor, 'data-download-href') : undefined,
        title: anchor ? getPropString(anchor, 'title') : undefined,
        thumbSrc: img ? getPropString(img, 'src') : undefined,
        alt: img ? getPropString(img, 'alt') : undefined,
        base62Sha1: img ? getPropString(img, 'data-base62-sha1') : undefined,
        width: img ? getPropString(img, 'width') : undefined,
        height: img ? getPropString(img, 'height') : undefined,
        srcset: img ? getPropString(img, 'srcset') : undefined,
        dominantColor: img ? getPropString(img, 'data-dominant-color') : undefined,
        loading: img ? getPropString(img, 'loading') : undefined,
        style: img ? getPropString(img, 'style') : undefined,
        metaHtml: meta ? stringifyChildren(ctx, meta) : undefined
      })
      if (!lightbox) return

      const markerIndex = ctx.lightboxes.length
      ctx.lightboxes.push(lightbox)
      replaceNodeWithText(wrapperColumn as Parent, wrapperIndex, `__DISCOURSE_LIGHTBOX_${markerIndex}__`)
    })

    // Don't descend into the grid's children anymore
    return false
  })
}