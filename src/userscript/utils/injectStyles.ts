export function ensureStyleInjected(id: string, css: string): void {
  if (!document) return
  if (document.getElementById(id)) return
  const style = document.createElement('style')
  style.id = id
  style.textContent = css
  document.head ? document.head.appendChild(style) : document.documentElement.appendChild(style)
}

export function removeInjectedStyle(id: string): void {
  const el = document.getElementById(id)
  if (el && el.parentNode) el.parentNode.removeChild(el)
}
