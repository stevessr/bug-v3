import type { Node, Parent, Element } from 'hast'

import { isElement, isParent } from './astUtils'

export type TraverseHandler = (
  node: Node,
  parent: Parent | null,
  index: number | null,
  ancestors: Element[]
) => boolean | void

export const traverse = (root: Node, handler: TraverseHandler) => {
  const walk = (node: Node, parent: Parent | null, index: number | null, ancestors: Element[]) => {
    const shouldDescend = handler(node, parent, index, ancestors)
    if (shouldDescend === false) return
    if (!isParent(node)) return
    const nextAncestors = isElement(node) ? [...ancestors, node] : ancestors
    for (let i = 0; i < node.children.length; i += 1) {
      const child = node.children[i] as Node
      walk(child, node, i, nextAncestors)
    }
  }
  walk(root, null, null, [])
}
