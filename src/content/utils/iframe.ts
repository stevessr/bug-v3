import { createE, DOA, DAEL } from './createEl'

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
    'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:80%;max-width:900px;height:80%;max-height:700px;border-radius:8px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.3);z-index:100000;cursor:move;background: transparent;'

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
      'position:absolute;top:0;left:0;width:100%;height:40px;border-bottom:1px solid #ccc;display:flex;align-items:center;justify-content:space-between;padding:0 10px;cursor:move;user-select:none;-webkit-user-select:none',
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

  DAEL('mousemove', drag)
  DAEL('mouseup', dragEnd)

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
  DOA(frameWrap)

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
    icon?: string
  }
) {
  const titleText = opts?.title || 'iframe'
  const className = opts?.className || 'emoji-extension-side-iframe'
  const maxWidth = opts?.maxWidth || '50vw'

  const panel = createE('div', {
    class: className,
    style: `
    position:fixed;
    top:0;
    right:0;
    height:100%;
    width:${maxWidth};
    transform:translateX(100%);
    transition:transform 300ms ease, width 300ms ease;
    z-index:100000;
    display:flex;
    flex-direction:column;
    background:transparent;
    box-shadow:-10px 0 30px rgba(0,0,0,0.2);
    overflow:hidden;`
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

  // 新增：最小化/恢复 按钮（隐藏到侧边）
  const hideBtn = createE('button', {
    class: 'btn btn-sm',
    type: 'button',
    text: '—',
    style:
      'background:transparent;border:none;font-size:16px;color:#666;cursor:pointer;padding:6px;border-radius:4px',
    attrs: { 'aria-label': '最小化到侧边' }
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

  // 按钮顺序：打开新窗口、最小化/恢复、关闭
  header.appendChild(openBtn)
  header.appendChild(hideBtn)
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

  // add a resize handle on the left edge to allow adjusting width (when expanded)
  let resizeHandle: HTMLDivElement | null = null
  // save original transition so we can temporarily disable width transition while resizing
  let savedTransition = panel.style.transition
  const rh = createE('div', {
    class: 'emoji-extension-resize-handle',
    style:
      'position:absolute;left:0;top:0;height:100%;width:8px;cursor:ew-resize;z-index:100002;background:transparent'
  }) as HTMLDivElement
  panel.appendChild(rh)
  // bind listeners (functions declared below are hoisted as function declarations)
  rh.addEventListener('mousedown', onResizeMouseDown as any)
  rh.addEventListener('touchstart', onResizeTouchStart as any, { passive: false } as any)
  resizeHandle = rh

  // Append hidden (off-screen) then trigger slide-in
  DOA(panel)
  // allow style to apply
  requestAnimationFrame(() => {
    panel.style.transform = 'translateX(0)'
  })

  let removed = false
  // 最小化状态相关
  let isMinimized = false
  let prevWidth = panel.style.width || maxWidth
  let isDocked = false
  let isClosing = false
  let floatingBtn: HTMLButtonElement | null = null
  // floating drag state
  let floatDragging = false
  let floatInitialY = 0
  let floatOffsetY = 0
  let floatMoved = false
  // resize state
  let isResizing = false
  let resizeStartX = 0
  let initialPanelWidth = 0
  const MIN_PANEL_WIDTH = 300
  const FLOAT_POS_KEY = 'emoji_extension_floating_btn_top'

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
    hideBtn.removeEventListener('click', onToggleHide)
    // remove floating button and its listeners
    if (floatingBtn) {
      floatingBtn.removeEventListener('mousedown', onFloatMouseDown)
      floatingBtn.removeEventListener('click', onFloatClick)
      floatingBtn.removeEventListener('touchstart', onFloatTouchStart)
      document.removeEventListener('mousemove', onFloatMouseMove)
      document.removeEventListener('mouseup', onFloatMouseUp)
      document.removeEventListener('touchmove', onFloatTouchMove)
      document.removeEventListener('touchend', onFloatTouchEnd)
      floatingBtn.remove()
      floatingBtn = null
    }
    if (resizeHandle) {
      resizeHandle.removeEventListener('mousedown', onResizeMouseDown)
      resizeHandle.removeEventListener('touchstart', onResizeTouchStart)
      document.removeEventListener('mousemove', onResizeMouseMove)
      document.removeEventListener('mouseup', onResizeMouseUp)
      document.removeEventListener('touchmove', onResizeTouchMove)
      document.removeEventListener('touchend', onResizeTouchEnd)
      resizeHandle.remove()
      resizeHandle = null
    }
    document.removeEventListener('keydown', onKeyDown)
    panel.removeEventListener('transitionend', onTransitionEnd)
  }

  const onClose = () => {
    // slide out to right
    isClosing = true
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

  const onToggleHide = () => {
    // 点击隐藏：直接停靠到侧边（把整个面板滑出屏幕），再次点击从停靠恢复为展开
    try {
      if (!isDocked) {
        // remember expanded width if not already
        if (!isMinimized) prevWidth = panel.style.width || maxWidth
        isMinimized = false
        dockToSide()
      } else {
        undockFromSide()
      }
    } catch {
      // ignore safety errors
    }
  }

  const dockToSide = () => {
    if (isDocked) return
    try {
      // Restore panel width to previous expanded width so translateX(100%) will move it fully out
      panel.style.width = prevWidth
      panel.style.maxWidth = ''
      // allow width to take effect, then slide it fully out
      requestAnimationFrame(() => {
        panel.style.transform = 'translateX(100%)'
        panel.style.pointerEvents = 'none'
        panel.setAttribute('aria-hidden', 'true')
      })
      // create floating button
      floatingBtn = createE('button', {
        class: 'emoji-extension-floating-btn',
        type: 'button',
        text: '',
        style:
          'position:fixed;right:8px;top:50%;transform:translateY(-50%);width:40px;height:40px;border-radius:20px;display:flex;align-items:center;justify-content:center;z-index:100001;cursor:pointer;background:var(--d-button-default-bg-color);border:none;box-shadow:0 6px 16px rgba(0,0,0,0.2);'
      }) as HTMLButtonElement

      // small icon inside (using ›)
      floatingBtn.textContent = opts?.icon || '◀'

      // floating drag handlers (mouse + touch)
      floatingBtn.addEventListener('mousedown', onFloatMouseDown)
      floatingBtn.addEventListener('click', onFloatClick)
      floatingBtn.addEventListener('touchstart', onFloatTouchStart, { passive: false })
      DAEL('mousemove', onFloatMouseMove)
      DAEL('mouseup', onFloatMouseUp)
      DAEL('touchmove', onFloatTouchMove, { passive: false } as any)
      DAEL('touchend', onFloatTouchEnd, { passive: false } as any)
      // restore saved floating position
      restoreFloatingPos()

      DOA(floatingBtn)
      isDocked = true
    } catch {
      // ignore
    }
  }

  const undockFromSide = () => {
    if (!isDocked) return
    try {
      // remove floating button
      if (floatingBtn) {
        floatingBtn.removeEventListener('mousedown', onFloatMouseDown)
        floatingBtn.removeEventListener('click', onFloatClick)
        floatingBtn.removeEventListener('touchstart', onFloatTouchStart)
        document.removeEventListener('mousemove', onFloatMouseMove)
        document.removeEventListener('mouseup', onFloatMouseUp)
        document.removeEventListener('touchmove', onFloatTouchMove)
        document.removeEventListener('touchend', onFloatTouchEnd)
        floatingBtn.remove()
        floatingBtn = null
      }
      // restore panel to fully expanded and visible state (show iframe)
      panel.style.pointerEvents = ''
      panel.removeAttribute('aria-hidden')
      panel.style.transform = 'translateX(0)'
      panel.style.width = prevWidth
      panel.style.maxWidth = ''
      iframeContainer.style.display = ''
      titleSpan.style.display = ''
      hideBtn.textContent = '—'
      panel.setAttribute('aria-expanded', 'true')
      isMinimized = false
      isDocked = false
    } catch {
      // ignore
    }
  }

  // Floating drag handlers
  const onFloatMouseDown = (e: MouseEvent) => {
    floatDragging = true
    floatInitialY = e.clientY
    const rect = (floatingBtn as HTMLElement).getBoundingClientRect()
    floatOffsetY = rect.top
    // prevent click from also triggering restore
    e.stopPropagation()
    e.preventDefault()
  }

  // Resize handlers (mouse + touch) - function declarations are hoisted
  function onResizeMouseDown(e: MouseEvent) {
    isResizing = true
    resizeStartX = e.clientX
    initialPanelWidth = panel.getBoundingClientRect().width
    // temporarily remove width transition so width follows the pointer instantly
    try {
      if (!savedTransition) savedTransition = panel.style.transition
      // keep transform transition (for slide-in/out) but drop width transition for responsiveness
      panel.style.transition = 'transform 300ms ease'
      panel.style.willChange = 'width'
    } catch {
      /* ignore */
    }
    e.stopPropagation()
    e.preventDefault()
    DAEL('mousemove', onResizeMouseMove)
    DAEL('mouseup', onResizeMouseUp)
  }

  function onResizeTouchStart(e: TouchEvent) {
    if (!e.touches || e.touches.length === 0) return
    isResizing = true
    resizeStartX = e.touches[0].clientX
    initialPanelWidth = panel.getBoundingClientRect().width
    // temporarily remove width transition so width follows the touch instantly
    try {
      if (!savedTransition) savedTransition = panel.style.transition
      panel.style.transition = 'transform 300ms ease'
      panel.style.willChange = 'width'
    } catch {
      /* ignore */
    }
    e.stopPropagation()
    e.preventDefault()
    DAEL('touchmove', onResizeTouchMove, { passive: false } as any)
    DAEL('touchend', onResizeTouchEnd)
  }

  function onResizeMouseMove(e: MouseEvent) {
    if (!isResizing) return
    const delta = resizeStartX - e.clientX
    let newW = Math.round(initialPanelWidth + delta)
    if (newW < MIN_PANEL_WIDTH) newW = MIN_PANEL_WIDTH
    panel.style.width = `${newW}px`
    prevWidth = panel.style.width
  }

  function onResizeMouseUp(_e: MouseEvent) {
    if (!isResizing) return
    isResizing = false
    // restore transition
    try {
      panel.style.transition = savedTransition || ''
      panel.style.willChange = ''
    } catch {
      /* ignore */
    }
    document.removeEventListener('mousemove', onResizeMouseMove)
    document.removeEventListener('mouseup', onResizeMouseUp)
  }

  function onResizeTouchMove(e: TouchEvent) {
    if (!isResizing || !e.touches || e.touches.length === 0) return
    const delta = resizeStartX - e.touches[0].clientX
    let newW = Math.round(initialPanelWidth + delta)
    if (newW < MIN_PANEL_WIDTH) newW = MIN_PANEL_WIDTH
    panel.style.width = `${newW}px`
    prevWidth = panel.style.width
    e.stopPropagation()
    e.preventDefault()
  }

  function onResizeTouchEnd(_e: TouchEvent) {
    if (!isResizing) return
    isResizing = false
    // restore transition
    try {
      panel.style.transition = savedTransition || ''
      panel.style.willChange = ''
    } catch {
      /* ignore */
    }
    document.removeEventListener('touchmove', onResizeTouchMove as any)
    document.removeEventListener('touchend', onResizeTouchEnd as any)
  }

  // Persist floating button top position
  const saveFloatingPos = (top: number) => {
    try {
      localStorage.setItem(FLOAT_POS_KEY, String(Math.round(top)))
    } catch {
      /* ignore */
    }
  }

  const restoreFloatingPos = () => {
    try {
      const v = localStorage.getItem(FLOAT_POS_KEY)
      if (v && floatingBtn) {
        const top = Number(v)
        const btnH = floatingBtn.offsetHeight
        const minTop = 8
        const maxTop = window.innerHeight - btnH - 8
        let clamped = top
        if (clamped < minTop) clamped = minTop
        if (clamped > maxTop) clamped = maxTop
        floatingBtn.style.top = `${clamped}px`
        floatingBtn.style.transform = 'translateY(0)'
      }
    } catch {
      /* ignore */
    }
  }

  const onFloatTouchStart = (e: TouchEvent) => {
    if (!floatingBtn) return
    floatDragging = true
    floatMoved = false
    floatInitialY = e.touches[0].clientY
    const rect = (floatingBtn as HTMLElement).getBoundingClientRect()
    floatOffsetY = rect.top
    // prevent the browser from handling touch as scroll
    e.stopPropagation()
    e.preventDefault()
  }

  const onFloatMouseMove = (e: MouseEvent) => {
    if (!floatDragging || !floatingBtn) return
    const delta = e.clientY - floatInitialY
    let newTop = floatOffsetY + delta
    const btnH = floatingBtn.offsetHeight
    const minTop = 8
    const maxTop = window.innerHeight - btnH - 8
    if (newTop < minTop) newTop = minTop
    if (newTop > maxTop) newTop = maxTop
    floatingBtn.style.top = `${newTop}px`
    floatingBtn.style.transform = 'translateY(0)'
    // persist position while dragging
    saveFloatingPos(newTop)
  }

  const onFloatTouchMove = (e: TouchEvent) => {
    if (!floatDragging || !floatingBtn) return
    const touch = e.touches[0]
    if (!touch) return
    const delta = touch.clientY - floatInitialY
    if (Math.abs(delta) > 2) floatMoved = true
    let newTop = floatOffsetY + delta
    const btnH = floatingBtn.offsetHeight
    const minTop = 8
    const maxTop = window.innerHeight - btnH - 8
    if (newTop < minTop) newTop = minTop
    if (newTop > maxTop) newTop = maxTop
    floatingBtn.style.top = `${newTop}px`
    floatingBtn.style.transform = 'translateY(0)'
    e.stopPropagation()
    e.preventDefault()
    // persist position while dragging
    saveFloatingPos(newTop)
  }

  const onFloatMouseUp = (_e: MouseEvent) => {
    if (!floatDragging) return
    floatDragging = false
    // persist on release
    if (floatingBtn) saveFloatingPos(floatingBtn.getBoundingClientRect().top)
  }

  const onFloatTouchEnd = (e: TouchEvent) => {
    if (!floatDragging) return
    floatDragging = false
    // if touch didn't move much, treat as click -> restore
    if (!floatMoved) {
      undockFromSide()
    }
    e.stopPropagation()
    e.preventDefault()
    if (floatingBtn) saveFloatingPos(floatingBtn.getBoundingClientRect().top)
  }

  const onFloatClick = (e: MouseEvent) => {
    // restore panel
    e.stopPropagation()
    undockFromSide()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
      onClose()
    }
  }

  const onTransitionEnd = (e: TransitionEvent) => {
    if (e.target === panel && panel.style.transform.includes('100%') && isClosing) {
      // only cleanup when we intentionally closed the panel
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
  hideBtn.addEventListener('click', onToggleHide)
  DAEL('keydown', onKeyDown)
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
