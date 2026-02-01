import type { Node, Element } from 'hast'

import { findFirst, getPropString, hasClass, isElement, isParent } from './astUtils'

const isCarouselContainer = (node: Element) => {
  // Only remove carousel containers, not regular image grids
  if (hasClass(node, 'd-image-grid--carousel')) return true
  if (getPropString(node, 'data-mode') === 'carousel') return true
  // Only treat as carousel if it contains d-image-carousel
  const carousel = findFirst(node, el => hasClass(el, 'd-image-carousel'))
  return !!carousel
}

export const cleanupMediaNodes = (root: Node) => {
  const walk = (node: Node) => {
    if (!isParent(node)) return
    for (let i = 0; i < node.children.length; ) {
      const child = node.children[i] as Node
      // Remove only carousel containers and lightbox-wrappers
      // Don't remove regular d-image-grid (waterfall layout)
      if (isElement(child) && (hasClass(child, 'lightbox-wrapper') || isCarouselContainer(child))) {
        node.children.splice(i, 1)
        continue
      }
      walk(child)
      i += 1
    }
  }
  walk(root)
}
