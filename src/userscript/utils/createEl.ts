export function createEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts?: {
    className?: string
    text?: string
    placeholder?: string
    type?: string
    value?: string
    style?: string
    src?: string
    attrs?: Record<string, string>
    dataset?: Record<string, string>
    innerHTML?: string
  }
) {
  const el = document.createElement(tag)
  if (opts) {
    if (opts.className) el.className = opts.className
    if (opts.text) el.textContent = opts.text
  if (opts.placeholder && 'placeholder' in el) (el as any).placeholder = opts.placeholder
  if (opts.type && 'type' in el) (el as any).type = opts.type
  if (opts.value !== undefined && 'value' in el) (el as any).value = opts.value
    if (opts.style) el.style.cssText = opts.style
  if (opts.src && 'src' in el) (el as any).src = opts.src
    if (opts.attrs) {
      for (const k in opts.attrs) el.setAttribute(k, opts.attrs[k])
    }
    if (opts.dataset) {
      for (const k in opts.dataset) (el as any).dataset[k] = opts.dataset[k]
    }
    if (opts.innerHTML) el.innerHTML = opts.innerHTML
  }
  return el
}
