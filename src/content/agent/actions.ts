import type { AgentAction } from '@/agent/types'

function getElement(selector?: string, x?: number, y?: number): HTMLElement | null {
  if (selector) {
    return document.querySelector(selector) as HTMLElement | null
  }
  if (typeof x === 'number' && typeof y === 'number') {
    return document.elementFromPoint(x, y) as HTMLElement | null
  }
  return null
}

function dispatchMouseClick(element: HTMLElement, x?: number, y?: number) {
  const rect = element.getBoundingClientRect()
  const clientX = x ?? rect.left + rect.width / 2
  const clientY = y ?? rect.top + rect.height / 2
  const event = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY
  })
  element.dispatchEvent(event)
}

function dispatchMouseEvent(
  element: HTMLElement,
  type: 'click' | 'dblclick' | 'contextmenu' | 'mousemove' | 'mouseover' | 'mouseenter',
  x?: number,
  y?: number,
  button = 0
) {
  const rect = element.getBoundingClientRect()
  const clientX = x ?? rect.left + rect.width / 2
  const clientY = y ?? rect.top + rect.height / 2
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    button
  })
  element.dispatchEvent(event)
}

function highlightElement(element: HTMLElement) {
  const rect = element.getBoundingClientRect()
  const overlay = document.createElement('div')
  overlay.style.position = 'fixed'
  overlay.style.left = `${rect.left}px`
  overlay.style.top = `${rect.top}px`
  overlay.style.width = `${rect.width}px`
  overlay.style.height = `${rect.height}px`
  overlay.style.border = '2px solid #ff6b00'
  overlay.style.background = 'rgba(255, 107, 0, 0.12)'
  overlay.style.zIndex = '2147483647'
  overlay.style.pointerEvents = 'none'
  overlay.style.boxSizing = 'border-box'
  document.documentElement.appendChild(overlay)
  setTimeout(() => overlay.remove(), 500)
}

function dispatchTouch(element: HTMLElement, x?: number, y?: number) {
  const rect = element.getBoundingClientRect()
  const clientX = x ?? rect.left + rect.width / 2
  const clientY = y ?? rect.top + rect.height / 2

  if (typeof TouchEvent === 'undefined') {
    dispatchMouseClick(element, clientX, clientY)
    return
  }

  const touch = new Touch({
    identifier: Date.now(),
    target: element,
    clientX,
    clientY,
    radiusX: 2,
    radiusY: 2,
    rotationAngle: 0,
    force: 1
  })

  element.dispatchEvent(
    new TouchEvent('touchstart', {
      bubbles: true,
      cancelable: true,
      touches: [touch],
      targetTouches: [touch],
      changedTouches: [touch]
    })
  )

  element.dispatchEvent(
    new TouchEvent('touchend', {
      bubbles: true,
      cancelable: true,
      touches: [],
      targetTouches: [],
      changedTouches: [touch]
    })
  )
}

function dispatchKeyboardEvent(
  element: HTMLElement,
  type: 'keydown' | 'keypress' | 'keyup',
  key: string,
  options?: Partial<KeyboardEventInit>
) {
  const event = new KeyboardEvent(type, {
    bubbles: true,
    cancelable: true,
    key,
    code: options?.code || key,
    ctrlKey: options?.ctrlKey,
    altKey: options?.altKey,
    shiftKey: options?.shiftKey,
    metaKey: options?.metaKey,
    repeat: options?.repeat
  })
  element.dispatchEvent(event)
}

async function sleep(ms: number) {
  if (!ms) return
  await new Promise(resolve => setTimeout(resolve, ms))
}

function updateEditableValue(
  element: HTMLElement,
  text: string,
  clear?: boolean
): void {
  const input = element as HTMLInputElement | HTMLTextAreaElement
  if ('value' in input) {
    if (clear) input.value = ''
    input.value = input.value + text
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return
  }
  if (element.isContentEditable) {
    if (clear) element.textContent = ''
    element.textContent = (element.textContent || '') + text
    element.dispatchEvent(new Event('input', { bubbles: true }))
  }
}

function getPointFromElement(element: HTMLElement) {
  const rect = element.getBoundingClientRect()
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  }
}

export async function handleAgentAction(action: AgentAction): Promise<any> {
  switch (action.type) {
    case 'click':
    case 'click-dom': {
      const element = getElement(action.selector, action.x, action.y)
      if (!element) throw new Error('未找到目标元素')
      highlightElement(element)
      dispatchMouseClick(element, action.x, action.y)
      return { success: true }
    }
    case 'scroll': {
      window.scrollBy({
        left: action.x ?? 0,
        top: action.y ?? 0,
        behavior: action.behavior || 'smooth'
      })
      return { success: true }
    }
    case 'touch': {
      const element = getElement(action.selector, action.x, action.y)
      if (!element) throw new Error('未找到目标元素')
      highlightElement(element)
      dispatchTouch(element, action.x, action.y)
      return { success: true }
    }
    case 'input': {
      const element = getElement(action.selector) as HTMLInputElement | HTMLTextAreaElement | null
      if (!element) throw new Error('未找到输入框')
      highlightElement(element)
      if (action.clear) element.value = ''
      element.focus()
      element.value = element.value + action.text
      element.dispatchEvent(new Event('input', { bubbles: true }))
      return { success: true }
    }
    case 'double-click': {
      const element = getElement(action.selector, action.x, action.y)
      if (!element) throw new Error('未找到目标元素')
      highlightElement(element)
      dispatchMouseEvent(element, 'dblclick', action.x, action.y, action.button ?? 0)
      return { success: true }
    }
    case 'right-click': {
      const element = getElement(action.selector, action.x, action.y)
      if (!element) throw new Error('未找到目标元素')
      highlightElement(element)
      dispatchMouseEvent(element, 'contextmenu', action.x, action.y, 2)
      return { success: true }
    }
    case 'hover': {
      const element = getElement(action.selector, action.x, action.y)
      if (!element) throw new Error('未找到目标元素')
      highlightElement(element)
      dispatchMouseEvent(element, 'mouseover', action.x, action.y, action.button ?? 0)
      dispatchMouseEvent(element, 'mouseenter', action.x, action.y, action.button ?? 0)
      dispatchMouseEvent(element, 'mousemove', action.x, action.y, action.button ?? 0)
      return { success: true }
    }
    case 'focus': {
      const element = getElement(action.selector, action.x, action.y)
      if (!element) throw new Error('未找到目标元素')
      highlightElement(element)
      element.focus()
      return { success: true }
    }
    case 'blur': {
      const element = getElement(action.selector, action.x, action.y)
      if (!element) throw new Error('未找到目标元素')
      highlightElement(element)
      element.blur()
      return { success: true }
    }
    case 'key': {
      const element = (document.activeElement as HTMLElement | null) || document.body
      if (!element) throw new Error('未找到活动元素')
      dispatchKeyboardEvent(element, 'keydown', action.key, action)
      dispatchKeyboardEvent(element, 'keypress', action.key, action)
      dispatchKeyboardEvent(element, 'keyup', action.key, action)
      return { success: true }
    }
    case 'type': {
      const element =
        (action.selector ? getElement(action.selector) : (document.activeElement as HTMLElement | null)) ||
        null
      if (!element) throw new Error('未找到输入目标')
      highlightElement(element)
      element.focus()
      if (action.clear) updateEditableValue(element, '', true)
      for (const ch of action.text || '') {
        dispatchKeyboardEvent(element, 'keydown', ch, {})
        dispatchKeyboardEvent(element, 'keypress', ch, {})
        updateEditableValue(element, ch, false)
        dispatchKeyboardEvent(element, 'keyup', ch, {})
        if (action.delayMs) await sleep(action.delayMs)
      }
      return { success: true }
    }
    case 'drag': {
      const source = getElement(action.selector, action.x, action.y)
      if (!source) throw new Error('未找到拖拽起点')
      highlightElement(source)
      const target = action.targetSelector
        ? getElement(action.targetSelector)
        : action.toX !== undefined && action.toY !== undefined
          ? (document.elementFromPoint(action.toX, action.toY) as HTMLElement | null)
          : null
      const start = action.x !== undefined && action.y !== undefined ? { x: action.x, y: action.y } : getPointFromElement(source)
      const end = target ? getPointFromElement(target) : action.toX !== undefined && action.toY !== undefined ? { x: action.toX, y: action.toY } : start
      const dataTransfer = typeof DataTransfer !== 'undefined' ? new DataTransfer() : undefined
      source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, clientX: start.x, clientY: start.y, dataTransfer }))
      if (target) {
        highlightElement(target)
        target.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, clientX: end.x, clientY: end.y, dataTransfer }))
        target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientX: end.x, clientY: end.y, dataTransfer }))
        target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientX: end.x, clientY: end.y, dataTransfer }))
      }
      source.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, clientX: end.x, clientY: end.y, dataTransfer }))
      return { success: true }
    }
    case 'select': {
      const element = getElement(action.selector) as HTMLSelectElement | null
      if (!element) throw new Error('未找到选择框')
      highlightElement(element)
      if (action.value) {
        element.value = action.value
      } else if (action.label) {
        const option = Array.from(element.options).find(opt => opt.label === action.label || opt.text === action.label)
        if (option) element.value = option.value
      }
      element.dispatchEvent(new Event('input', { bubbles: true }))
      element.dispatchEvent(new Event('change', { bubbles: true }))
      return { success: true }
    }
    default:
      throw new Error('不支持的动作')
  }
}
