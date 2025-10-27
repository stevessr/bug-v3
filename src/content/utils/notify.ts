import { createE, DOA, DEBI } from './createEl'
// Lightweight toast notification utility for content scripts
export function notify(
  message: string,
  type: 'info' | 'success' | 'error' | 'transparent' | 'rainbow' = 'info',
  timeout = 4000
) {
  try {
    let container = DEBI('emoji-ext-toast-container') as HTMLElement | null
    if (!container) {
      container = createE('div', {
        id: 'emoji-ext-toast-container',
        style: `
          position: fixed;
          right: 12px;
          bottom: 12px;
          z-index: 2147483647;
          display: flex;
          flex-direction: column;
          gap: 8px;
        `
      }) as HTMLElement
      DOA(container)
    }

    const el = createE('div', {
      text: message,
      style: `
        padding: 8px 12px;
        border-radius: 6px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        color: #ffffff;
        font-size: 13px;
        max-width: 320px;
        word-break: break-word;
        transform: translateY(20px);
      `
    }) as HTMLElement

    if (type === 'success') el.style.background = '#16a34a'
    else if (type === 'error') el.style.background = '#dc2626'
    else if (type === 'transparent') el.style.background = 'transparent'
    else if (type === 'rainbow') el.style.background = 'linear-gradient(90deg, red, orange, yellow, green, blue, indigo, violet)'
    else el.style.background = '#0369a1' // info

    container.appendChild(el)

    const id = setTimeout(() => {
      el.remove()
      clearTimeout(id)
    }, timeout)

    return () => {
      el.remove()
      clearTimeout(id)
    }
  } catch {
    // Fallback to alert if DOM manipulation fails
    try {
      // eslint-disable-next-line no-alert
      alert(message)
    } catch {
      // ignore
    }
    return () => {}
  }
}
