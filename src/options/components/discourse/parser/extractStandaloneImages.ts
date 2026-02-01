import type { Node, Element, Parent } from 'hast'

import { buildLightbox, ParseContext } from './context'
import { getClassList, getPropString, hasClass, isElement, replaceNodeWithText } from './astUtils'
import { traverse } from './traverse'

const isInsideOnebox = (ancestors: Element[]) => {
  return ancestors.some(el => hasClass(el, 'onebox'))
}

const isInsideCarousel = (ancestors: Element[]) => {
  return ancestors.some(
    el =>
      hasClass(el, 'd-image-carousel') ||
      hasClass(el, 'd-image-grid--carousel') ||
      getPropString(el, 'data-mode') === 'carousel'
  )
}

const isInsideImageGrid = (ancestors: Element[]) => {
  return ancestors.some(
    el => hasClass(el, 'd-image-grid') && !hasClass(el, 'd-image-grid--carousel')
  )
}

const isInsideLightboxWrapper = (ancestors: Element[]) => {
  return ancestors.some(el => hasClass(el, 'lightbox-wrapper'))
}

const isInsideSpoiler = (ancestors: Element[]) => {
  return ancestors.some(el => hasClass(el, 'spoiled') || hasClass(el, 'spoiler-blurred'))
}

export const extractStandaloneImages = (root: Node, ctx: ParseContext) => {
  traverse(root, (node, parent, index, ancestors) => {
    if (!parent || index === null) return
    if (!isElement(node)) return
    if (node.tagName !== 'img') return
    if (isInsideOnebox(ancestors)) return
    if (isInsideCarousel(ancestors)) return
    if (isInsideImageGrid(ancestors)) return
    if (isInsideSpoiler(ancestors)) return
    if (isInsideLightboxWrapper(ancestors)) return

    const src = getPropString(node, 'src')
    if (!src) return
    const classList = getClassList(node)
    if (src.includes('/images/emoji/') || classList.includes('emoji')) return
    if (classList.includes('avatar')) return
    if (classList.includes('site-icon')) return

    const lightbox = buildLightbox(ctx, {
      href: src,
      thumbSrc: src,
      alt: getPropString(node, 'alt'),
      base62Sha1: getPropString(node, 'data-base62-sha1'),
      width: getPropString(node, 'width'),
      height: getPropString(node, 'height'),
      srcset: getPropString(node, 'srcset'),
      dominantColor: getPropString(node, 'data-dominant-color'),
      loading: getPropString(node, 'loading'),
      style: getPropString(node, 'style')
    })
    if (!lightbox) return

    const markerIndex = ctx.lightboxes.length
    ctx.lightboxes.push(lightbox)
    replaceNodeWithText(parent as Parent, index, `__DISCOURSE_LIGHTBOX_${markerIndex}__`)
    return false
  })
}
