import type { Element, Parent, Root, Node, Properties } from 'hast'

export type Ancestors = Element[]

export const isElement = (node: Node | null | undefined): node is Element => {
  return !!node && node.type === 'element'
}

export const isParent = (node: Node | null | undefined): node is Parent => {
  return !!node && Array.isArray((node as Parent).children)
}

export const getProperties = (node: Element): Properties => {
  return node.properties || {}
}

const toCamelCase = (value: string) => {
  return value.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
}

export const getPropString = (node: Element, name: string): string | undefined => {
  const props = getProperties(node)
  const direct = props[name as keyof Properties]
  if (typeof direct === 'string') return direct
  if (typeof direct === 'number') return String(direct)
  const camel = toCamelCase(name)
  const camelValue = props[camel as keyof Properties]
  if (typeof camelValue === 'string') return camelValue
  if (typeof camelValue === 'number') return String(camelValue)
  return undefined
}

export const getClassList = (node: Element): string[] => {
  const props = getProperties(node)
  const className = props.className
  if (Array.isArray(className)) return className.filter(Boolean).map(String)
  if (typeof className === 'string') return className.split(/\s+/).filter(Boolean)
  return []
}

export const hasClass = (node: Element, className: string): boolean => {
  return getClassList(node).includes(className)
}

export const createTextNode = (value: string): Node => {
  return { type: 'text', value }
}

export const replaceNodeWithText = (parent: Parent, index: number, marker: string) => {
  parent.children.splice(index, 1, createTextNode(marker))
}

export const removeNode = (parent: Parent, index: number) => {
  parent.children.splice(index, 1)
}

export const findFirst = (node: Node, predicate: (el: Element) => boolean): Element | null => {
  let result: Element | null = null
  const walk = (current: Node) => {
    if (result) return
    if (isElement(current) && predicate(current)) {
      result = current
      return
    }
    if (isParent(current)) {
      current.children.forEach(child => walk(child as Node))
    }
  }
  walk(node)
  return result
}

export const findAll = (node: Node, predicate: (el: Element) => boolean): Element[] => {
  const results: Element[] = []
  const walk = (current: Node) => {
    if (isElement(current) && predicate(current)) {
      results.push(current)
    }
    if (isParent(current)) {
      current.children.forEach(child => walk(child as Node))
    }
  }
  walk(node)
  return results
}

export const stringifyChildren = (
  processor: { stringify: (node: unknown) => string },
  node: Parent
) => {
  const fragment = { type: 'root', children: node.children } as Root
  return String(processor.stringify(fragment))
}
