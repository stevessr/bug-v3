import type { Node, Parent } from 'hast'

import {
  getPropString,
  hasClass,
  isElement,
  isParent,
  removeNode,
  stringifyChildren
} from './astUtils'
import { traverse } from './traverse'
import type { ParseContext } from './context'

export const extractFootnotes = (root: Node, ctx: ParseContext) => {
  const footnotes: Record<string, string> = {}
  const removals: Array<{ parent: Parent; index: number }> = []

  traverse(root, (node, parent, index) => {
    if (!parent || index === null) return
    if (!isElement(node)) return

    if (node.tagName === 'hr' && hasClass(node, 'footnotes-sep')) {
      removals.push({ parent, index })
      return
    }

    if (node.tagName === 'ol' && hasClass(node, 'footnotes-list')) {
      if (isParent(node)) {
        node.children.forEach(child => {
          if (!isElement(child) || child.tagName !== 'li') return
          if (!hasClass(child, 'footnote-item')) return
          const id = getPropString(child, 'id')
          if (!id || !isParent(child)) return

          child.children = child.children.filter(inner => {
            if (!isElement(inner)) return true
            if (inner.tagName !== 'a') return true
            return !hasClass(inner, 'footnote-backref')
          })

          const html = stringifyChildren(ctx, child)
          if (html.trim().length > 0) {
            footnotes[id] = html
          }
        })
      }
      removals.push({ parent, index })
    }
  })

  removals
    .sort((a, b) => (a.parent === b.parent ? b.index - a.index : 0))
    .forEach(({ parent, index }) => removeNode(parent, index))

  return footnotes
}
