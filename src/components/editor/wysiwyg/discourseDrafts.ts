/**
 * Rich-text helpers can show a semantic preview while retaining the syntax a
 * Discourse server expects for plugin-backed blocks such as polls and math.
 * The encoded value is safe to carry in a data attribute and is unwrapped only
 * at submit time by the normal Composer surface.
 */
export function encodeDiscourseDraftSource(value: string): string {
  return encodeURIComponent(value)
}

export function decodeDiscourseDraftSource(value: string | null): string {
  if (!value) return ''
  try {
    return decodeURIComponent(value)
  } catch {
    return ''
  }
}

export function serializeWysiwygDiscourseDrafts(value: string): string {
  if (!value || !value.includes('data-discourse-source')) return value
  if (typeof document === 'undefined') return value

  const container = document.createElement('div')
  container.innerHTML = value
  const draftNodes = Array.from(
    container.querySelectorAll<HTMLElement>('[data-discourse-source]')
  ).sort(
    (left, right) =>
      right.querySelectorAll('[data-discourse-source]').length -
      left.querySelectorAll('[data-discourse-source]').length
  )
  draftNodes.forEach(node => {
    let source = decodeDiscourseDraftSource(node.dataset.discourseSource || null)
    if (!source) return
    const nestedSources = Array.from(node.querySelectorAll<HTMLElement>('[data-discourse-source]'))
      .map(child => decodeDiscourseDraftSource(child.dataset.discourseSource || null))
      .filter(childSource => childSource && !source.includes(childSource))
    if (nestedSources.length) {
      const closingTag = source.match(/\n(\[\/[a-z]+\])\s*$/i)
      if (closingTag && closingTag.index !== undefined) {
        source = `${source.slice(0, closingTag.index)}\n${nestedSources.join('\n')}\n${source.slice(closingTag.index)}`
      } else {
        source = `${source}\n${nestedSources.join('\n')}`
      }
    }
    node.replaceWith(document.createTextNode(source))
  })
  return container.innerHTML
}
