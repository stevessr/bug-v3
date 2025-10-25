import { createE } from './createEl'

/**
 * Create and show a draggable iframe modal.
 *
 * @param initialUrl 初始 iframe src
 * @param closeWhenHref (optional) 回调：当 iframe 导航到某个 href 时返回 true 则自动关闭
 * @param opts 可选项：title, className, width/height 样式字符串
 * @returns 一个对象，包含 close() 方法
 */
export function createAndShowIframeModal(
  initialUrl: string,
  closeWhenHref?: (href: string) => boolean,
  opts?: {
    title?: string
    className?: string
    style?: string
    iframeSandbox?: string
  }
) {
  const titleText = opts?.title || 'iframe'
  const className = opts?.className || 'emoji-extension-iframe-modal'
  const style =
    opts?.style ||
    'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:80%;max-width:900px;height:80%;max-height:700px;border-radius:8px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.3);z-index:100000;cursor:move'

  const frameWrap = createE('div', {
    class: className,
    style
  }) as HTMLDivElement

  // Drag state
  let isDragging = false
  let currentX = 0
  let currentY = 0
  let initialX = 0
  let initialY = 0

  const titleBar = createE('div', {
    style:
      'position:absolute;top:0;left:0;width:100%;height:40px;border-bottom:1px solid #ccc;display:flex;align-items:center;justify-content:space-between;padding:0 10px;cursor:move;user-select:none',
    on: {
      mousedown: (e: MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) return
        isDragging = true
        initialX = e.clientX - currentX
        initialY = e.clientY - currentY
        frameWrap.style.cursor = 'grabbing'
      }
    }
  })

  const closeBtn = createE('button', {
    class: 'btn btn-sm',
    type: 'button',
    text: '✕',
    style:
      'background:transparent;border:none;font-size:20px;color:#666;cursor:pointer;padding:0;width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:4px'
  }) as HTMLButtonElement

  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.background = '#ff4444'
    closeBtn.style.color = '#fff'
  })
  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.background = 'transparent'
    closeBtn.style.color = '#666'
  })

  const titleSpan = createE('span', { text: titleText, style: 'font-weight:bold;color:#333' })
  titleBar.appendChild(titleSpan)
  titleBar.appendChild(closeBtn)

  const iframeContainer = createE('div', {
    style: 'position:absolute;top:40px;left:0;width:100%;height:calc(100% - 40px);overflow:hidden'
  })

  const iframe = createE('iframe', {
    src: initialUrl,
    style: 'width:100%;height:100%;border:0',
    attrs: {
      sandbox: opts?.iframeSandbox || 'allow-scripts allow-forms allow-same-origin allow-popups',
      referrerpolicy: 'no-referrer'
    }
  }) as HTMLIFrameElement

  // Close helper
  const closeModal = () => {
    try {
      if (frameWrap.parentElement) frameWrap.parentElement.removeChild(frameWrap)
    } catch {
      // ignore
    }
    // cleanup listeners
    document.removeEventListener('mousemove', drag)
    document.removeEventListener('mouseup', dragEnd)
  }

  // Drag handling
  const drag = (e: MouseEvent) => {
    if (!isDragging) return
    e.preventDefault()
    currentX = e.clientX - initialX
    currentY = e.clientY - initialY
    frameWrap.style.transform = `translate(calc(-50% + ${currentX}px), calc(-50% + ${currentY}px))`
  }

  const dragEnd = () => {
    isDragging = false
    frameWrap.style.cursor = 'move'
  }

  document.addEventListener('mousemove', drag)
  document.addEventListener('mouseup', dragEnd)

  // iframe load handler: try to read href, apply close condition
  iframe.addEventListener('load', () => {
    let href: string | null = null
    try {
      href =
        (iframe.contentWindow &&
          iframe.contentWindow.location &&
          iframe.contentWindow.location.href) ||
        null
    } catch {
      href = iframe.src || null
    }

    if (href && closeWhenHref) {
      try {
        if (closeWhenHref(href)) {
          closeModal()
        }
      } catch {
        // ignore errors from user-provided predicate
      }
    }
  })

  // Wire up close button
  closeBtn.addEventListener('click', () => {
    closeModal()
  })

  iframeContainer.appendChild(iframe)
  frameWrap.appendChild(titleBar)
  frameWrap.appendChild(iframeContainer)
  document.body.appendChild(frameWrap)

  return {
    close: closeModal,
    element: frameWrap,
    iframe
  }
}

/**
 * Create and show a side panel iframe that slides in from the right.
 * Occupies up to half the viewport width. Closing slides it out to the right then removes it.
 */
export function createAndShowSideIframeModal(
  initialUrl: string,
  closeWhenHref?: (href: string) => boolean,
  opts?: {
    title?: string
    className?: string
    maxWidth?: string // e.g. '600px'
    iframeSandbox?: string
  }
) {
  const titleText = opts?.title || 'iframe'
  const className = opts?.className || 'emoji-extension-side-iframe'
  const maxWidth = opts?.maxWidth || '50vw'

  const panel = createE('div', {
    class: className,
    style: `position:fixed;top:0;right:0;height:100%;width:${maxWidth};max-width:60%;transform:translateX(100%);transition:transform 300ms ease;z-index:100000;display:flex;flex-direction:column;background:#fff;box-shadow:-10px 0 30px rgba(0,0,0,0.2);`
  }) as HTMLDivElement

  const header = createE('div', {
    style:
      'height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;border-bottom:1px solid #e6e6e6;flex:0 0 48px;'
  })
  const titleSpan = createE('span', { text: titleText, style: 'font-weight:600;color:#222' })
  const openBtn = createE('button', {
    class: 'btn btn-sm',
    type: 'button',
    in: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 3h7v7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 14L21 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 21H3V3h7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    style:
      'background:transparent;border:none;padding:6px;margin-right:6px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer',
    attrs: { 'aria-label': '在新窗口打开' }
  }) as HTMLButtonElement

  const closeBtn = createE('button', {
    class: 'btn btn-sm',
    type: 'button',
    text: '✕',
    style:
      'background:transparent;border:none;font-size:18px;color:#666;cursor:pointer;padding:6px;border-radius:4px'
  }) as HTMLButtonElement

  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.background = '#ff4444'
    closeBtn.style.color = '#fff'
  })
  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.background = 'transparent'
    closeBtn.style.color = '#666'
  })

  header.appendChild(titleSpan)
  // Add aria attributes for accessibility
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-modal', 'true')
  panel.setAttribute('aria-label', titleText)

  header.appendChild(openBtn)
  header.appendChild(closeBtn)

  const iframeContainer = createE('div', {
    style: 'flex:1 1 auto;overflow:hidden;position:relative'
  })

  const iframe = createE('iframe', {
    src: initialUrl,
    style: 'width:100%;height:100%;border:0',
    attrs: {
      sandbox: opts?.iframeSandbox || 'allow-scripts allow-forms allow-same-origin allow-popups',
      referrerpolicy: 'no-referrer'
    }
  }) as HTMLIFrameElement

  iframeContainer.appendChild(iframe)
  panel.appendChild(header)
  panel.appendChild(iframeContainer)

  // Append hidden (off-screen) then trigger slide-in
  document.body.appendChild(panel)
  // allow style to apply
  requestAnimationFrame(() => {
    panel.style.transform = 'translateX(0)'
  })

  let removed = false

  const cleanup = () => {
    if (removed) return
    removed = true
    try {
      if (panel.parentElement) panel.parentElement.removeChild(panel)
    } catch {
      /* ignore */
    }
    iframe.removeEventListener('load', onLoad)
    closeBtn.removeEventListener('click', onClose)
    openBtn.removeEventListener('click', onOpenInNew)
    document.removeEventListener('keydown', onKeyDown)
    panel.removeEventListener('transitionend', onTransitionEnd)
  }

  const onClose = () => {
    // slide out to right
    panel.style.transform = 'translateX(100%)'
    // wait for transitionend to remove element
  }

  const onOpenInNew = () => {
    const href = iframe.src || initialUrl
    try {
      window.open(href, '_blank')
    } catch {
      try {
        window.location.href = href
      } catch {
        // ignore
      }
    }
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
      onClose()
    }
  }

  const onTransitionEnd = (e: TransitionEvent) => {
    if (e.target === panel && panel.style.transform.includes('100%')) {
      cleanup()
    }
  }

  const onLoad = () => {
    let href: string | null = null
    try {
      href =
        (iframe.contentWindow &&
          iframe.contentWindow.location &&
          iframe.contentWindow.location.href) ||
        null
    } catch {
      href = iframe.src || null
    }

    if (href && closeWhenHref) {
      try {
        if (closeWhenHref(href)) onClose()
      } catch {
        // ignore
      }
    }
  }

  closeBtn.addEventListener('click', onClose)
  openBtn.addEventListener('click', onOpenInNew)
  document.addEventListener('keydown', onKeyDown)
  iframe.addEventListener('load', onLoad)
  panel.addEventListener('transitionend', onTransitionEnd)

  return {
    close: () => {
      onClose()
    },
    element: panel,
    iframe
  }
}
