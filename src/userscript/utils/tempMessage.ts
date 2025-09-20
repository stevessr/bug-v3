import { createEl } from './createEl'

export function showTemporaryMessage(message: string, duration = 2000) {
  const messageEl = createEl('div', {
    style: `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--emoji-modal-primary-bg);
      color: white;
      padding: 12px 24px;
      border-radius: 6px;
      z-index: 9999999;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      animation: fadeInOut 2s ease-in-out;
    `,
    text: message
  }) as HTMLElement

  // Add CSS animation if not already present
  if (!document.querySelector('#tempMessageStyles')) {
    const style = createEl('style', {
      id: 'tempMessageStyles',
      text: `
      @keyframes fadeInOut {
        0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
        20%, 80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      }
    `
    }) as HTMLStyleElement
    document.head.appendChild(style)
  }

  document.body.appendChild(messageEl)

  setTimeout(() => {
    try {
      messageEl.remove()
    } catch {}
  }, duration)
}
