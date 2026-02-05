import type { Node, Element } from 'hast'

import { buildLightbox, ParseContext } from './context'
import {
  findAll,
  findFirst,
  getClassList,
  getPropString,
  hasClass,
  isElement,
  replaceNodeWithText,
  stringifyChildren
} from './astUtils'
import { traverse } from './traverse'

const isCarouselContainer = (node: Element) => {
  // Check if node has carousel-specific classes or data attributes
  if (hasClass(node, 'd-image-grid--carousel')) return true
  if (getPropString(node, 'data-mode') === 'carousel') return true
  // Only treat as carousel if it contains d-image-carousel (not just d-image-grid)
  const carousel = findFirst(node, el => hasClass(el, 'd-image-carousel'))
  return !!carousel
}

const isInsideOnebox = (ancestors: Element[]) => {
  return ancestors.some(el => hasClass(el, 'onebox'))
}

const isInsideQuote = (ancestors: Element[]) => {
  return ancestors.some(el => hasClass(el, 'quote'))
}

const isInsideSpoiler = (ancestors: Element[]) => {
  return ancestors.some(el => hasClass(el, 'spoiled') || hasClass(el, 'spoiler-blurred'))
}

export const extractCarousels = (root: Node, ctx: ParseContext) => {
  //console.log('[extractCarousels] Starting carousel extraction')
  let foundCount = 0
  traverse(root, (node, parent, index, ancestors) => {
    if (!parent || index === null) return
    if (!isElement(node)) return
    if (isInsideOnebox(ancestors)) return
    if (isInsideQuote(ancestors)) return
    if (isInsideSpoiler(ancestors)) return

    const isCarousel = isCarouselContainer(node)
    /*
    console.log('[extractCarousels] Node check:', {
      tagName: node.tagName,
      classes: getClassList(node),
      isCarousel
    })
    */

    if (!isCarousel) return

    foundCount++
    //console.log('[extractCarousels] Found carousel #' + foundCount)

    const slides = findAll(node, el => hasClass(el, 'd-image-carousel__slide'))
    //console.log('[extractCarousels] Slides:', slides.length)

    const buildFromContainer = (container: Element) => {
      const anchor = findFirst(container, el => el.tagName === 'a' && hasClass(el, 'lightbox'))
      const img = findFirst(container, el => el.tagName === 'img')
      const meta = findFirst(container, el => hasClass(el, 'meta'))
      return buildLightbox(ctx, {
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
    }

    let items = slides
      .map(slide => buildFromContainer(slide))
      .filter(Boolean) as ParseContext['carousels'][number]

    if (items.length === 0) {
      const wrappers = findAll(node, el => hasClass(el, 'lightbox-wrapper'))
      items = wrappers
        .map(wrapper => buildFromContainer(wrapper))
        .filter(Boolean) as ParseContext['carousels'][number]
    }

    //console.log('[extractCarousels] Items:', items.length)

    if (items.length === 0) return

    const markerIndex = ctx.carousels.length
    const marker = `__DISCOURSE_CAROUSEL_${markerIndex}__`
    //console.log('[extractCarousels] Replacing with marker:', marker)
    ctx.carousels.push(items as ParseContext['carousels'][number])
    replaceNodeWithText(parent as Parent, index, marker)
    return false
  })

  //console.log('[extractCarousels] Total carousels found:', foundCount)
}
