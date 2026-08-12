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
  container.querySelectorAll<HTMLElement>('[data-discourse-source]').forEach(node => {
    const source = decodeDiscourseDraftSource(node.dataset.discourseSource || null)
    if (!source) return
    node.replaceWith(document.createTextNode(source))
  })
  return container.innerHTML
}
