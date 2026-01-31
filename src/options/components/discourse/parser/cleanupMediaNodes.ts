import type { Node, Element } from 'hast'

import { getPropString, hasClass, isElement, isParent } from './astUtils'

const isCarouselContainer = (node: Element) => {
  if (hasClass(node, 'd-image-grid--carousel')) return true
  if (getPropString(node, 'data-mode') === 'carousel') return true
  if (hasClass(node, 'd-image-grid')) return true
  return false
}

export const cleanupMediaNodes = (root: Node) => {
  const walk = (node: Node) => {
    if (!isParent(node)) return
    for (let i = 0; i < node.children.length; ) {
      const child = node.children[i] as Node
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
