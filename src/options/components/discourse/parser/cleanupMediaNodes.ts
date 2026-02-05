import type { Node, Element } from 'hast'

import { findFirst, getPropString, hasClass, isElement, isParent } from './astUtils'

export const cleanupMediaNodes = (root: Node) => {
  const isInsideCarousel = (ancestors: Element[]) => {
    return ancestors.some(
      el =>
        hasClass(el, 'd-image-carousel') ||
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
        getPropString(el, 'data-mode') !== 'carousel'
    )
  }

  const isInsideSpoiler = (ancestors: Element[]) => {
    return ancestors.some(el => hasClass(el, 'spoiled') || hasClass(el, 'spoiler-blurred'))
  }

  const isInsideQuote = (ancestors: Element[]) => {
    return ancestors.some(el => hasClass(el, 'quote'))
  }

  const walk = (node: Node, ancestors: Element[]) => {
    if (!isParent(node)) return
    const currentAncestors = isElement(node) ? [...ancestors, node] : ancestors
    for (let i = 0; i < node.children.length; ) {
      const child = node.children[i] as Node
      if (isElement(child) && hasClass(child, 'lightbox-wrapper')) {
        if (
          !isInsideCarousel(currentAncestors) &&
          !isInsideImageGrid(currentAncestors) &&
          !isInsideSpoiler(currentAncestors) &&
          !isInsideQuote(currentAncestors)
        ) {
          node.children.splice(i, 1)
          continue
        }
      }
      const nextAncestors = isElement(child) ? [...currentAncestors, child] : currentAncestors
      walk(child, nextAncestors)
      i += 1
    }
  }
  walk(root, [])
}
