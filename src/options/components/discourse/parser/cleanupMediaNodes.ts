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

  const walk = (node: Node, ancestors: Element[]) => {
    if (!isParent(node)) return
    for (let i = 0; i < node.children.length; ) {
      const child = node.children[i] as Node
      if (isElement(child) && hasClass(child, 'lightbox-wrapper')) {
        if (!isInsideCarousel(ancestors) && !isInsideImageGrid(ancestors) && !isInsideSpoiler(ancestors)) {
          node.children.splice(i, 1)
          continue
        }
      }
      const nextAncestors = isElement(child) ? [...ancestors, child] : ancestors
      walk(child, nextAncestors)
      i += 1
    }
  }
  walk(root, [])
}
