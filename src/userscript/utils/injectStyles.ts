export function ensureStyleInjected(id: string, css: string): void {
  if (!document) return
  if (document.getElementById(id)) return
  const style = document.createElement('style')
  style.id = id
  style.textContent = css
  document.head ? document.head.appendChild(style) : document.documentElement.appendChild(style)
}
