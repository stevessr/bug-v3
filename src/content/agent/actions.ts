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

export async function handleAgentAction(action: AgentAction): Promise<any> {
  switch (action.type) {
    case 'click':
    case 'click-dom': {
      const element = getElement(action.selector, action.x, action.y)
      if (!element) throw new Error('未找到目标元素')
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
      dispatchTouch(element, action.x, action.y)
      return { success: true }
    }
    case 'input': {
      const element = getElement(action.selector) as HTMLInputElement | HTMLTextAreaElement | null
      if (!element) throw new Error('未找到输入框')
      if (action.clear) element.value = ''
      element.focus()
      element.value = element.value + action.text
      element.dispatchEvent(new Event('input', { bubbles: true }))
      return { success: true }
    }
    default:
      throw new Error('不支持的动作')
  }
}
