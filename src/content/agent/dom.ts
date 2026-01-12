export type DomTreeNode = {
  tag: string
  id?: string
  classes?: string[]
  text?: string
  children?: DomTreeNode[]
}

type DomTreeOptions = {
  maxDepth?: number
  maxChildren?: number
  includeText?: boolean
  textLimit?: number
}

function sanitizeText(text: string, limit: number) {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (!trimmed) return ''
  return trimmed.length > limit ? `${trimmed.slice(0, limit)}…` : trimmed
}

function buildTree(
  element: Element,
  options: DomTreeOptions,
  depth: number
): DomTreeNode {
  const node: DomTreeNode = {
    tag: element.tagName.toLowerCase()
  }

  if (element.id) node.id = element.id
  if (element.classList.length > 0) node.classes = Array.from(element.classList)

  if (options.includeText) {
    const text = sanitizeText(element.textContent || '', options.textLimit || 120)
    if (text) node.text = text
  }

  if (depth >= (options.maxDepth ?? 4)) return node

  const children = Array.from(element.children)
  const limit = options.maxChildren ?? 20
  if (children.length > 0) {
    node.children = children.slice(0, limit).map(child => buildTree(child, options, depth + 1))
  }

  return node
}

export function getDomTree(selector?: string, options: DomTreeOptions = {}) {
  const root = selector ? document.querySelector(selector) : document.documentElement
  if (!root) {
    throw new Error('未找到 DOM 根节点')
  }
  return buildTree(root, options, 0)
}

export function getDomTreeAtPoint(x: number, y: number, options: DomTreeOptions = {}) {
  const element = document.elementFromPoint(x, y)
  if (!element) {
    throw new Error('未找到坐标对应元素')
  }
  return buildTree(element, options, 0)
}
