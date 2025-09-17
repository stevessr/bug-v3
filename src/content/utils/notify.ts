// Lightweight toast notification utility for content scripts
export function notify(
  message: string,
  type: 'info' | 'success' | 'error' = 'info',
  timeout = 4000
) {
  try {
    let container = document.getElementById('emoji-ext-toast-container') as HTMLElement | null
    if (!container) {
      container = document.createElement('div')
      container.id = 'emoji-ext-toast-container'
      container.style.position = 'fixed'
      container.style.right = '12px'
      container.style.bottom = '12px'
      container.style.zIndex = '2147483647'
      container.style.display = 'flex'
      container.style.flexDirection = 'column'
      container.style.gap = '8px'
      document.body.appendChild(container)
    }

    const el = document.createElement('div')
    el.textContent = message
    el.style.padding = '8px 12px'
    el.style.borderRadius = '6px'
    el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)'
    el.style.color = '#ffffff'
    el.style.fontSize = '13px'
    el.style.maxWidth = '320px'
    el.style.wordBreak = 'break-word'

    if (type === 'success') el.style.background = '#16a34a'
    else if (type === 'error') el.style.background = '#dc2626'
    else el.style.background = '#0369a1'

    container.appendChild(el)

    const id = setTimeout(() => {
      el.remove()
      clearTimeout(id)
    }, timeout)

    return () => {
      el.remove()
      clearTimeout(id)
    }
  } catch (e) {
    // Fallback to alert if DOM manipulation fails
    try {
      // eslint-disable-next-line no-alert
      alert(message)
    } catch (_e) {
      // ignore
    }
    return () => {}
  }
}
