import { createEl } from './createEl'

export function userscriptNotify(
  message: string,
  type: 'info' | 'success' | 'error' = 'info',
  timeout = 4000
) {
  try {
    let container = document.getElementById('emoji-ext-userscript-toast') as HTMLElement | null
    if (!container) {
      container = createEl('div', {
        attrs: { id: 'emoji-ext-userscript-toast', 'aria-live': 'polite' },
        style: `
        position: fixed;
        right: 12px; 
        bottom: 12px; 
        z-index: 2147483646; 
        display:flex; 
        flex-direction:column; 
        gap:8px;
        `
      }) as HTMLElement

      try {
        if (document.body) document.body.appendChild(container)
        else document.documentElement.appendChild(container)
      } catch (e) {
        document.documentElement.appendChild(container)
      }

      container.style.position = 'fixed'
      container.style.right = '12px'
      container.style.bottom = '12px'
      container.style.zIndex = String(2147483646)
      try {
        container.style.setProperty('z-index', String(2147483646), 'important')
      } catch (_e) {}
      container.style.display = 'flex'
      container.style.flexDirection = 'column'
      container.style.gap = '8px'
      container.style.pointerEvents = 'auto'
    }

    const el = createEl('div', {
      text: message,
      style: `padding:8px 12px; border-radius:6px; color:#fff; font-size:13px; max-width:320px; word-break:break-word; opacity:0; transform: translateY(8px); transition: all 220ms ease;`
    }) as HTMLElement

    if (type === 'success') el.style.setProperty('background', '#16a34a', 'important')
    else if (type === 'error') el.style.setProperty('background', '#dc2626', 'important')
    else el.style.setProperty('background', '#0369a1', 'important')

    container.appendChild(el)
    // force a paint then show (for transition)
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    el.offsetHeight
    el.style.opacity = '1'
    el.style.transform = 'translateY(0)'

    const id = setTimeout(() => {
      try {
        el.style.opacity = '0'
        el.style.transform = 'translateY(8px)'
        setTimeout(() => el.remove(), 250)
      } catch (_e) {}
      clearTimeout(id)
    }, timeout)

    try {
      console.log('[UserscriptNotify] shown:', message, 'type=', type)
    } catch (_e) {}

    return () => {
      try {
        el.remove()
      } catch (_e) {}
      clearTimeout(id)
    }
  } catch (_e) {
    return () => {}
  }
}
