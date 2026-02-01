import type { Node, Element } from 'hast'

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

const isInsideOnebox = (ancestors: Element[]) => {
  return ancestors.some(el => hasClass(el, 'onebox'))
}

const isInsideCarousel = (ancestors: Element[]) => {
  return ancestors.some(
    el =>
      hasClass(el, 'd-image-grid--carousel') ||
      getPropString(el, 'data-mode') === 'carousel' ||
      !!findFirst(el, inner => hasClass(inner, 'd-image-carousel'))
  )
}

const isInsideImageGrid = (ancestors: Element[]) => {
  return ancestors.some(
    el =>
      hasClass(el, 'd-image-grid') &&
      !hasClass(el, 'd-image-grid--carousel') &&
      getPropString(el, 'data-mode') !== 'carousel' &&
      !findFirst(el, inner => hasClass(inner, 'd-image-carousel'))
  )
}

export const extractLightboxWrappers = (root: Node, ctx: ParseContext) => {
  traverse(root, (node, parent, index, ancestors) => {
    if (!parent || index === null) return
    if (!isElement(node)) return
    if (!hasClass(node, 'lightbox-wrapper')) return
    if (isInsideOnebox(ancestors)) return
    if (isInsideCarousel(ancestors)) return
    if (isInsideImageGrid(ancestors)) return

    const anchor = findFirst(node, el => el.tagName === 'a' && hasClass(el, 'lightbox'))
    const img = findFirst(node, el => el.tagName === 'img')
    const meta = findFirst(node, el => hasClass(el, 'meta'))

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
    replaceNodeWithText(parent as Parent, index, `__DISCOURSE_LIGHTBOX_${markerIndex}__`)
    return false
  })
}
