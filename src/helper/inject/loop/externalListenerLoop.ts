export type ExternalListenerOptions = {
  selectors?: string[]
  emojiButtonClass: string
  textAreaSelector: string
  interval?: number
}

export function startExternalButtonListenerLoop(opts: ExternalListenerOptions) {
  const selectors = opts.selectors || [
    '#create-topic',
    '.topic-drafts-menu-trigger',
    'button.post-action-menu__reply',
    'button.reply.create',
    'button.create.reply-to-post',
    '.topic-footer-button',
  ]

  const interval = opts.interval || 500
  const removers: Array<() => void> = []
  let stopped = false

  function externalClickHandler(this: Element, ev: Event) {
    const btn = document.querySelector(`.${opts.emojiButtonClass}`) as HTMLElement | null
    if (btn) {
      setTimeout(() => btn.click(), 0)
    } else {
      const ta = document.querySelector(opts.textAreaSelector) as HTMLTextAreaElement | null
      if (ta) ta.focus()
    }
  }

  function scanAndAttach() {
    if (stopped) return
    try {
      selectors.forEach((sel) => {
        const nodes = Array.from(document.querySelectorAll(sel)) as Element[]
        nodes.forEach((n) => {
          if (!n.getAttribute('data-nacho-listener')) {
            n.addEventListener('click', externalClickHandler)
            n.setAttribute('data-nacho-listener', '1')
            removers.push(() => n.removeEventListener('click', externalClickHandler))
          }
        })
      })
    } catch (err) {
      // ignore
    }
  }

  // initial scan
  scanAndAttach()
  const id = window.setInterval(scanAndAttach, interval)

  function stop() {
    stopped = true
    window.clearInterval(id)
    removers.forEach((r) => {
      try {
        r()
      } catch (_) {}
    })
  }

  return stop
}

export default startExternalButtonListenerLoop
