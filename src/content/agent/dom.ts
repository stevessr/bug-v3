export type DomTreeNode = {
  tag: string
  id?: string
  classes?: string[]
  text?: string
  attrs?: Record<string, string>
  children?: DomTreeNode[]
}

type DomTreeOptions = {
  maxDepth?: number
  maxChildren?: number
  includeText?: boolean
  textLimit?: number
  includeMarkdown?: boolean
  markdownLimit?: number
  maxTextBlocks?: number
}

function sanitizeText(text: string, limit: number) {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (!trimmed) return ''
  return trimmed.length > limit ? `${trimmed.slice(0, limit)}…` : trimmed
}

const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'template', 'svg', 'path'])
const TEXT_CONTAINER_TAGS = new Set([
  'p',
  'span',
  'a',
  'button',
  'label',
  'li',
  'dt',
  'dd',
  'td',
  'th',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'summary',
  'figcaption',
  'caption',
  'option'
])
const TEXT_BLOCK_TAGS = new Set([
  'p',
  'li',
  'dt',
  'dd',
  'td',
  'th',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'summary',
  'figcaption',
  'caption'
])
const INTERACTIVE_TAGS = new Set(['a', 'button', 'input', 'textarea', 'select', 'option', 'label'])

function isHidden(element: Element): boolean {
  if (element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true') return true
  if (element instanceof HTMLElement) {
    const style = window.getComputedStyle(element)
    if (style.display === 'none' || style.visibility === 'hidden') return true
    if (style.opacity === '0') return true
  }
  return false
}

function getOwnText(element: Element): string {
  let text = ''
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || ''
    }
  }
  return text
}

function getElementText(element: Element, limit: number): string {
  const tag = element.tagName.toLowerCase()
  const aria = element.getAttribute('aria-label') || ''
  const title = element.getAttribute('title') || ''
  const alt = element.getAttribute('alt') || ''
  const placeholder = element.getAttribute('placeholder') || ''
  const type = element.getAttribute('type') || ''

  if (tag === 'input') {
    if (type.toLowerCase() === 'password') return sanitizeText(placeholder || aria || title, limit)
    const inputValue = (element as HTMLInputElement).value || ''
    const label = placeholder || aria || title
    const text = label || (type === 'button' || type === 'submit' ? inputValue : '')
    return sanitizeText(text, limit)
  }

  if (tag === 'textarea') {
    const text = (element as HTMLTextAreaElement).value || placeholder || aria || title
    return sanitizeText(text, limit)
  }

  if (tag === 'select') {
    const selected = (element as HTMLSelectElement).selectedOptions?.[0]
    const text = selected?.textContent || aria || title || ''
    return sanitizeText(text, limit)
  }

  if (tag === 'option') {
    return sanitizeText(element.textContent || '', limit)
  }

  const direct = getOwnText(element)
  const text = direct || element.textContent || aria || title || alt
  return sanitizeText(text, limit)
}

function shouldIncludeText(element: Element): boolean {
  const tag = element.tagName.toLowerCase()
  if (INTERACTIVE_TAGS.has(tag)) return true
  if (TEXT_CONTAINER_TAGS.has(tag)) return true
  const hasElementChildren = element.children.length > 0
  return !hasElementChildren
}

function getAttrs(element: Element): Record<string, string> | undefined {
  const tag = element.tagName.toLowerCase()
  const attrs: Record<string, string> = {}
  if (tag === 'a') {
    const href = element.getAttribute('href') || ''
    if (href && href.length <= 200) attrs.href = href
  }
  if (tag === 'img') {
    const alt = element.getAttribute('alt') || ''
    if (alt) attrs.alt = alt
  }
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    const type = element.getAttribute('type') || ''
    const name = element.getAttribute('name') || ''
    const placeholder = element.getAttribute('placeholder') || ''
    if (type) attrs.type = type
    if (name) attrs.name = name
    if (placeholder) attrs.placeholder = placeholder
  }
  const role = element.getAttribute('role') || ''
  if (role) attrs.role = role
  return Object.keys(attrs).length > 0 ? attrs : undefined
}

function formatMarkdownBlock(tag: string, text: string): string {
  if (!text) return ''
  if (tag.startsWith('h')) {
    const level = Number(tag.slice(1))
    if (Number.isFinite(level) && level >= 1 && level <= 6) {
      return `${'#'.repeat(level)} ${text}`
    }
  }
  if (tag === 'li') return `- ${text}`
  if (tag === 'a') return `- [链接] ${text}`
  if (tag === 'button') return `- [按钮] ${text}`
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return `- [输入] ${text}`
  return text
}

function getDomMarkdown(root: Element, options: DomTreeOptions): string {
  const blocks: string[] = []
  const limit = options.markdownLimit ?? 4000
  const maxBlocks = options.maxTextBlocks ?? 60
  const textLimit = options.textLimit ?? 160
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)

  let length = 0
  while (walker.nextNode()) {
    const element = walker.currentNode as Element
    const tag = element.tagName.toLowerCase()
    if (SKIP_TAGS.has(tag) || isHidden(element)) continue
    if (!TEXT_BLOCK_TAGS.has(tag) && !INTERACTIVE_TAGS.has(tag)) continue
    let parent = element.parentElement
    let skip = false
    while (parent) {
      const ptag = parent.tagName.toLowerCase()
      if (TEXT_BLOCK_TAGS.has(ptag) || INTERACTIVE_TAGS.has(ptag)) {
        skip = true
        break
      }
      parent = parent.parentElement
    }
    if (skip) continue

    const text = getElementText(element, textLimit)
    if (!text) continue
    const line = formatMarkdownBlock(tag, text)
    if (!line) continue
    blocks.push(line)
    length += line.length + 1
    if (blocks.length >= maxBlocks || length >= limit) break
  }

  return blocks.join('\n')
}

function buildTree(element: Element, options: DomTreeOptions, depth: number): DomTreeNode | null {
  const tag = element.tagName.toLowerCase()
  if (SKIP_TAGS.has(tag) || isHidden(element)) return null
  const node: DomTreeNode = {
    tag
  }

  if (element.id) node.id = element.id
  if (element.classList.length > 0) node.classes = Array.from(element.classList)

  if (options.includeText) {
    if (shouldIncludeText(element)) {
      const text = getElementText(element, options.textLimit || 120)
      if (text) node.text = text
    }
  }

  const attrs = getAttrs(element)
  if (attrs) node.attrs = attrs

  if (depth >= (options.maxDepth ?? 4)) return node

  const children = Array.from(element.children)
  const limit = options.maxChildren ?? 20
  if (children.length > 0) {
    const nextChildren = children
      .slice(0, limit)
      .map(child => buildTree(child, options, depth + 1))
      .filter(Boolean) as DomTreeNode[]
    if (nextChildren.length > 0) node.children = nextChildren
  }

  return node
}

type DomTreeResult = DomTreeNode | { tree: DomTreeNode; markdown: string }

export function getDomTree(selector?: string, options: DomTreeOptions = {}): DomTreeResult {
  const root = selector ? document.querySelector(selector) : document.documentElement
  if (!root) {
    throw new Error('未找到 DOM 根节点')
  }
  const tree = buildTree(root, options, 0)
  if (!tree) {
    throw new Error('未找到可用 DOM 节点')
  }
  if (options.includeMarkdown) {
    return { tree, markdown: getDomMarkdown(root, options) }
  }
  return tree
}

export function getDomTreeAtPoint(
  x: number,
  y: number,
  options: DomTreeOptions = {}
): DomTreeResult {
  const element = document.elementFromPoint(x, y)
  if (!element) {
    throw new Error('未找到坐标对应元素')
  }
  const tree = buildTree(element, options, 0)
  if (!tree) {
    throw new Error('未找到可用 DOM 节点')
  }
  if (options.includeMarkdown) {
    return { tree, markdown: getDomMarkdown(element, options) }
  }
  return tree
}
