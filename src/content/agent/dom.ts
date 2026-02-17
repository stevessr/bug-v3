export type DomTreeNode = {
  tag: string
  id?: string
  classes?: string[]
  text?: string
  attrs?: Record<string, string>
  children?: DomTreeNode[]
  truncatedChildren?: boolean
}

type DomTreeOptions = {
  maxDepth?: number
  maxChildren?: number
  includeText?: boolean
  textLimit?: number
  maxTextLength?: number
  includeMarkdown?: boolean
  markdownLimit?: number
  maxTextBlocks?: number
}

type NormalizedDomTreeOptions = {
  maxDepth: number
  maxChildren: number
  includeText: boolean
  textLimit: number
  includeMarkdown: boolean
  markdownLimit: number
  maxTextBlocks: number
}

type DomTraversalContext = {
  hiddenCache: WeakMap<Element, boolean>
}

function sanitizeText(text: string, limit: number) {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (!trimmed) return ''
  return trimmed.length > limit ? `${trimmed.slice(0, limit)}…` : trimmed
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const rounded = Math.floor(parsed)
  if (rounded < min) return min
  if (rounded > max) return max
  return rounded
}

function normalizeOptions(options: DomTreeOptions = {}): NormalizedDomTreeOptions {
  return {
    maxDepth: clampInteger(options.maxDepth, 4, 1, 8),
    maxChildren: clampInteger(options.maxChildren, 20, 1, 80),
    includeText: options.includeText !== false,
    textLimit: clampInteger(options.textLimit ?? options.maxTextLength, 120, 20, 500),
    includeMarkdown: options.includeMarkdown === true,
    markdownLimit: clampInteger(options.markdownLimit, 4000, 400, 40000),
    maxTextBlocks: clampInteger(options.maxTextBlocks, 60, 10, 400)
  }
}

function createTraversalContext(): DomTraversalContext {
  return {
    hiddenCache: new WeakMap<Element, boolean>()
  }
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

function isHidden(element: Element, context: DomTraversalContext): boolean {
  const cached = context.hiddenCache.get(element)
  if (cached !== undefined) return cached

  const parent = element.parentElement
  if (parent && isHidden(parent, context)) {
    context.hiddenCache.set(element, true)
    return true
  }

  let hidden = false
  if (element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true') {
    hidden = true
  } else if (element instanceof HTMLElement) {
    const style = window.getComputedStyle(element)
    hidden =
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0' ||
      style.pointerEvents === 'none'
  }

  context.hiddenCache.set(element, hidden)
  return hidden
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
  return element.children.length === 0
}

function getAttrs(element: Element): Record<string, string> | undefined {
  const tag = element.tagName.toLowerCase()
  const attrs: Record<string, string> = {}

  if (tag === 'a') {
    const href = element.getAttribute('href') || ''
    if (href && href.length <= 240) attrs.href = href
  }

  if (tag === 'img') {
    const src = element.getAttribute('src') || ''
    const alt = element.getAttribute('alt') || ''
    if (src && src.length <= 240) attrs.src = src
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
  const ariaLabel = element.getAttribute('aria-label') || ''
  const dataTestId = element.getAttribute('data-testid') || element.getAttribute('data-test') || ''
  if (role) attrs.role = role
  if (ariaLabel) attrs['aria-label'] = sanitizeText(ariaLabel, 80)
  if (dataTestId) attrs['data-testid'] = sanitizeText(dataTestId, 80)

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

function getDomMarkdown(
  root: Element,
  options: NormalizedDomTreeOptions,
  context: DomTraversalContext
): string {
  const blocks: string[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
  let length = 0

  while (walker.nextNode()) {
    const element = walker.currentNode as Element
    const tag = element.tagName.toLowerCase()
    if (SKIP_TAGS.has(tag) || isHidden(element, context)) continue
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

    const text = getElementText(element, options.textLimit)
    if (!text) continue

    const line = formatMarkdownBlock(tag, text)
    if (!line) continue

    blocks.push(line)
    length += line.length + 1
    if (blocks.length >= options.maxTextBlocks || length >= options.markdownLimit) {
      break
    }
  }

  return blocks.join('\n')
}

function buildTree(
  element: Element,
  options: NormalizedDomTreeOptions,
  depth: number,
  context: DomTraversalContext
): DomTreeNode | null {
  const tag = element.tagName.toLowerCase()
  if (SKIP_TAGS.has(tag) || isHidden(element, context)) return null

  const node: DomTreeNode = { tag }
  if (element.id) node.id = element.id
  if (element.classList.length > 0) {
    node.classes = Array.from(element.classList).slice(0, 8)
  }

  if (options.includeText && shouldIncludeText(element)) {
    const text = getElementText(element, options.textLimit)
    if (text) node.text = text
  }

  const attrs = getAttrs(element)
  if (attrs) node.attrs = attrs

  if (depth >= options.maxDepth) return node

  const children = Array.from(element.children)
  if (children.length === 0) return node

  const nextChildren: DomTreeNode[] = []
  for (const child of children.slice(0, options.maxChildren)) {
    const parsed = buildTree(child, options, depth + 1, context)
    if (parsed) nextChildren.push(parsed)
  }

  if (nextChildren.length > 0) {
    node.children = nextChildren
  }
  if (children.length > options.maxChildren) {
    node.truncatedChildren = true
  }

  return node
}

type DomTreeResult = DomTreeNode | { tree: DomTreeNode; markdown: string }

export function getDomTree(selector?: string, options: DomTreeOptions = {}): DomTreeResult {
  const normalized = normalizeOptions(options)
  const root = selector
    ? document.querySelector(selector)
    : document.body || document.documentElement

  if (!root) {
    throw new Error('未找到 DOM 根节点')
  }

  const context = createTraversalContext()
  const tree = buildTree(root, normalized, 0, context)
  if (!tree) {
    throw new Error('未找到可用 DOM 节点')
  }

  if (normalized.includeMarkdown) {
    return { tree, markdown: getDomMarkdown(root, normalized, context) }
  }

  return tree
}

export function getDomTreeAtPoint(
  x: number,
  y: number,
  options: DomTreeOptions = {}
): DomTreeResult {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error('坐标必须是有效数字')
  }

  const element = document.elementFromPoint(x, y)
  if (!element) {
    throw new Error('未找到坐标对应元素')
  }

  const normalized = normalizeOptions(options)
  const context = createTraversalContext()
  const tree = buildTree(element, normalized, 0, context)
  if (!tree) {
    throw new Error('未找到可用 DOM 节点')
  }

  if (normalized.includeMarkdown) {
    return { tree, markdown: getDomMarkdown(element, normalized, context) }
  }

  return tree
}
