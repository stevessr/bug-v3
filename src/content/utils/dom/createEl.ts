// Create element
export function createE<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts?: {
    wi?: string // shortened 'width' to 'wi' to avoid potential conflicts
    he?: string // shortened 'height' to 'he'
    class?: string
    text?: string
    ph?: string // shortened 'placeholder' to 'ph'
    type?: string
    val?: string // shortened 'value' to 'val'
    style?: string
    src?: string
    attrs?: Record<string, string>
    dataset?: Record<string, string>
    in?: string // shortened 'innerHTML' to 'in'
    ti?: string // shortened 'title' to 'ti'
    alt?: string
    id?: string
    accept?: string
    multiple?: boolean
    role?: string
    tabIndex?: number | string
    ld?: string // shortened 'loading' to 'ld'
    on?: Partial<{
      [K in keyof GlobalEventHandlersEventMap]: (ev: GlobalEventHandlersEventMap[K]) => any
    }> &
      Record<string, any>
    child?: HTMLElement[]
  }
) {
  const el = document.createElement(tag)
  if (opts) {
    if (opts.wi) el.style.width = opts.wi
    if (opts.he) el.style.height = opts.he
    if (opts.class) el.className = opts.class
    if (opts.text) el.textContent = opts.text
    if (opts.ph && 'placeholder' in el) (el as any).placeholder = opts.ph
    if (opts.type && 'type' in el) (el as any).type = opts.type
    if (opts.val !== undefined && 'value' in el) (el as any).value = opts.val
    if (opts.style) el.style.cssText = opts.style
    if (opts.src && 'src' in el) (el as any).src = opts.src
    if (opts.attrs) for (const k in opts.attrs) el.setAttribute(k, opts.attrs[k])

    if (opts.dataset) for (const k in opts.dataset) (el as any).dataset[k] = opts.dataset[k]

    if (opts.in) el.innerHTML = opts.in
    if (opts.ti) el.title = opts.ti
    if (opts.alt && 'alt' in el) (el as any).alt = opts.alt
    if (opts.id) el.id = opts.id
    if (opts.accept && 'accept' in el) (el as any).accept = opts.accept
    if (opts.multiple !== undefined && 'multiple' in el) (el as any).multiple = opts.multiple
    if (opts.role) el.setAttribute('role', opts.role)
    if (opts.tabIndex !== undefined) el.tabIndex = Number(opts.tabIndex)
    if (opts.ld && 'loading' in el) (el as any).loading = opts.ld
    if (opts.on)
      for (const [evt, handler] of Object.entries(opts.on)) el.addEventListener(evt, handler as any)
    if (opts.child) opts.child.forEach(child => el.appendChild(child))
  }
  return el
}

// Append element to document.body
// Bind DOM methods to their owners to avoid "Illegal invocation" when they're
// exported and called unbound elsewhere (e.g. const fn = document.querySelectorAll).
export const DOA = document.body.appendChild.bind(document.body)
export const DHA = document.head.appendChild.bind(document.head)
// Delete element by id, return null if not found, otherwise return the element itself.
export const DEBI = document.getElementById.bind(document)

export const DAEL = document.addEventListener.bind(document)

export const DQSA = document.querySelectorAll.bind(document) as typeof document.querySelectorAll

export const DQS = document.querySelector.bind(document) as typeof document.querySelector
