import type { Node, Element } from 'hast'

import { buildLightbox, ParseContext } from './context'
import {
  findAll,
  findFirst,
  getPropString,
  hasClass,
  isElement,
  replaceNodeWithText,
  stringifyChildren
} from './astUtils'
import { traverse } from './traverse'

const isCarouselContainer = (node: Element) => {
  if (hasClass(node, 'd-image-grid--carousel')) return true
  if (getPropString(node, 'data-mode') === 'carousel') return true
  const carousel = findFirst(node, el => hasClass(el, 'd-image-carousel'))
  return !!carousel
}

const isInsideOnebox = (ancestors: Element[]) => {
  return ancestors.some(el => hasClass(el, 'onebox'))
}

export const extractCarousels = (root: Node, ctx: ParseContext) => {
  traverse(root, (node, parent, index, ancestors) => {
    if (!parent || index === null) return
    if (!isElement(node)) return
    if (isInsideOnebox(ancestors)) return
    if (!isCarouselContainer(node)) return

    const slides = findAll(node, el => hasClass(el, 'd-image-carousel__slide'))
    const items = slides
      .map(slide => {
        const anchor = findFirst(slide, el => el.tagName === 'a' && hasClass(el, 'lightbox'))
        const img = findFirst(slide, el => el.tagName === 'img')
        const meta = findFirst(slide, el => hasClass(el, 'meta'))
        const lightbox = buildLightbox(ctx, {
          href: anchor
            ? getPropString(anchor, 'href')
            : img
              ? getPropString(img, 'src')
              : undefined,
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
        return lightbox
      })
      .filter(Boolean)

    if (items.length === 0) return

    const markerIndex = ctx.carousels.length
    ctx.carousels.push(items as ParseContext['carousels'][number])
    replaceNodeWithText(parent as Parent, index, `__DISCOURSE_CAROUSEL_${markerIndex}__`)
    return false
  })
}
