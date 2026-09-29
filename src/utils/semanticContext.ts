/**
 * Limit automatic suggestions to the end of the active draft, never prior messages.
 * A standalone punctuation mark, URL, markdown link, or code fragment is not a query.
 */
export function extractSemanticContext(value: string): string {
  if (typeof value !== 'string') return ''
  const tail = value.slice(-2000).split(/[\n。！？!?;；]/).pop()?.trim() || ''
  if (!tail || /(?:https?:\/\/|www\.|\`|\[.+\]\()/i.test(tail)) return ''
  const text = tail.replace(/\s+/g, ' ').slice(-80).trim()
  return text.length >= 2 ? text : ''
}
