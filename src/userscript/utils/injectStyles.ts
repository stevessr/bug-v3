export function ensureStyleInjected(id: string, css: string): void {
  const style = document.createElement('style')
  style.id = id
  style.textContent = css
  document.documentElement.appendChild(style)
}
