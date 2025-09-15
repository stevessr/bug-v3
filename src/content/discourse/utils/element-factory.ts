// Map known DOM event names to their handler types, allow arbitrary custom event names as well.
type DOMEventMap = GlobalEventHandlersEventMap

export type CreateElOptions = {
  className?: string
  attrs?: Record<string, string>
  props?: Record<string, any>
  style?: string | Record<string, string>
  dataset?: Record<string, string>
  children?: Array<HTMLElement | string>
  html?: string
  // Typed map for known DOM events (e.g. 'keydown' -> KeyboardEvent). Also allow arbitrary event names.
  // Use a permissive index signature to avoid incompatibility between narrow typed handlers and
  // the general EventListener type; runtime will cast handlers when attaching.
  on?: Partial<{ [K in keyof DOMEventMap]: (e: DOMEventMap[K]) => any }> & Record<string, any>
  // Special helper for mapping specific key values to handlers on 'keydown'
  keydown?: Record<string, (e: KeyboardEvent) => void>
  attr?: Record<string, string>
  innerHTML?: string
  title?: string
  src?: string
  alt?: string
  width?: string
  height?: string
  // allow extra properties (e.g. tabIndex, loading, etc.) commonly passed in usage
  [key: string]: any
}

/**
 * 简单的元素创建工厂，减少模板样板代码
 */
export function createEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: CreateElOptions = {}
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag) as HTMLElementTagNameMap[K]
  if (options.className) el.className = options.className
  if (options.attrs) {
    for (const [k, v] of Object.entries(options.attrs)) {
      el.setAttribute(k, v)
    }
  }
  if (options.props) {
    for (const [k, v] of Object.entries(options.props)) {
      try {
        ;(el as any)[k] = v
      } catch (_e) {
        // ignore
      }
    }
  }
  if (options.style) {
    if (typeof options.style === 'string') el.style.cssText = options.style
    else {
      for (const [k, v] of Object.entries(options.style)) {
        ;(el.style as any)[k] = v
      }
    }
  }
  if (options.dataset) {
    for (const [k, v] of Object.entries(options.dataset)) {
      ;(el.dataset as any)[k] = v
    }
  }
  if (options.children) {
    for (const child of options.children) {
      if (typeof child === 'string') el.appendChild(document.createTextNode(child))
      else el.appendChild(child)
    }
  }
  if (options.html) el.innerHTML = options.html
  if (options.on) {
    for (const [evt, handler] of Object.entries(options.on)) {
      // handler may be typed as a specific event handler (e.g. (e: KeyboardEvent) => void)
      // but addEventListener expects EventListenerOrEventListenerObject. Cast to satisfy runtime.
      el.addEventListener(evt, handler as EventListenerOrEventListenerObject)
    }
  }
  if (options.keydown) {
    for (const [key, handler] of Object.entries(options.keydown)) {
      el.addEventListener('keydown', (ev: Event) => {
        const e = ev as KeyboardEvent
        if (e.key === key) {
          handler(e)
        }
      })
    }
  }
  if (options.attr) {
    for (const [k, v] of Object.entries(options.attr)) {
      el.setAttribute(k, v)
    }
  }
  if (options.innerHTML) el.innerHTML = options.innerHTML
  if (options.title) el.title = options.title
  if (options.src && 'src' in el) (el as any).src = options.src
  if (options.alt && 'alt' in el) (el as any).alt = options.alt
  if (options.width && 'width' in el) (el as any).width = options.width
  if (options.height && 'height' in el) (el as any).height = options.height
  return el
}
