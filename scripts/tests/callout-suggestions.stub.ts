// The production barrel pulls in the whole content-script graph (and its
// circular logger import); this spec only needs the CSS injection helper.
export function ESI(id: string, css: string): void {
  let style = document.getElementById(id) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = id
    document.head.appendChild(style)
  }
  style.textContent = css
}
