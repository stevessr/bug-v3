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

  // 按用户要求：未找到可添加的监听时每 1s 重试，首次添加成功后立即停止
  const interval = opts.interval || 1000
  const removers: Array<() => void> = []
  let stopped = false

  function externalClickHandler(this: Element, ev: Event) {
    // 调用外部函数（这里用一条 log 代替）
    // TODO: replace with actual external callback if needed
    // eslint-disable-next-line no-console
    console.log('external listener triggered for', this)

    const btn = document.querySelector(`.${opts.emojiButtonClass}`) as HTMLElement | null
    if (btn) {
      setTimeout(() => btn.click(), 0)
    } else {
      const ta = document.querySelector(opts.textAreaSelector) as HTMLTextAreaElement | null
      if (ta) ta.focus()
    }
  }

  function scanAndAttach() {
    if (stopped) return 0
    let added = 0
    try {
      selectors.forEach((sel) => {
        const nodes = Array.from(document.querySelectorAll(sel)) as Element[]
        nodes.forEach((n) => {
          if (!n.getAttribute('data-nacho-listener')) {
            n.addEventListener('click', externalClickHandler)
            n.setAttribute('data-nacho-listener', '1')
            removers.push(() => n.removeEventListener('click', externalClickHandler))
            added += 1
          }
        })
      })
    } catch (err) {
      // ignore
    }
    return added
  }

  // initial scan: 若首次找到并添加任一监听则停止重试；否则按 interval 重试
  const firstAdded = scanAndAttach()
  if (firstAdded > 0) {
    // immediate stop: we successfully attached listeners
    return () => {
      stopped = true
      removers.forEach((r) => {
        try {
          r()
        } catch (_) {}
      })
    }
  }

  const id = window.setInterval(() => {
    const added = scanAndAttach()
    if (added > 0) {
      // stop interval and leave cleanup closure to caller
      window.clearInterval(id)
      stopped = true
    }
  }, interval)

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
