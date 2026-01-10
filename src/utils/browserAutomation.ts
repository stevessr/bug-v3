/**
 * Browser Automation Utilities for AI Agent
 * Provides screenshot, click, scroll, and DOM interaction capabilities
 */

import { createLogger } from './logger'

const log = createLogger('BrowserAutomation')

export interface ScreenshotResult {
  base64: string
  width: number
  height: number
  format: 'png' | 'jpeg'
}

export interface DOMElement {
  tagName: string
  id?: string
  className?: string
  text?: string
  rect: {
    x: number
    y: number
    width: number
    height: number
  }
  attributes: Record<string, string>
  isVisible: boolean
  isInteractive: boolean
}

export interface ClickResult {
  success: boolean
  element?: DOMElement
  error?: string
}

export interface ScrollResult {
  success: boolean
  scrollX: number
  scrollY: number
  error?: string
}

export interface TypeResult {
  success: boolean
  error?: string
}

/**
 * Capture screenshot of the current tab
 */
export async function captureScreenshot(): Promise<ScreenshotResult> {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab({ format: 'png' }, dataUrl => {
      if (chrome.runtime.lastError) {
        log.error('Screenshot failed:', chrome.runtime.lastError)
        reject(new Error(chrome.runtime.lastError.message))
        return
      }

      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')

      const img = new Image()
      img.onload = () => {
        resolve({
          base64,
          width: img.width,
          height: img.height,
          format: 'png'
        })
      }
      img.onerror = () => {
        resolve({
          base64,
          width: 1920,
          height: 1080,
          format: 'png'
        })
      }
      img.src = dataUrl
    })
  })
}

/**
 * Execute script in content page to get DOM elements
 */
export async function getDOMElements(selector?: string): Promise<DOMElement[]> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    throw new Error('No active tab found')
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel?: string) => {
      const elements: any[] = []
      const els = sel
        ? document.querySelectorAll(sel)
        : document.querySelectorAll(
            'button, a, input, textarea, select, [role="button"], [onclick]'
          )

      els.forEach(el => {
        const rect = el.getBoundingClientRect()
        const style = window.getComputedStyle(el)
        const isVisible =
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0' &&
          rect.width > 0 &&
          rect.height > 0

        const isInteractive =
          el.tagName.toLowerCase() === 'button' ||
          el.tagName.toLowerCase() === 'a' ||
          el.tagName.toLowerCase() === 'input' ||
          el.tagName.toLowerCase() === 'textarea' ||
          el.tagName.toLowerCase() === 'select' ||
          el.getAttribute('role') === 'button' ||
          el.hasAttribute('onclick')

        const attrs: Record<string, string> = {}
        for (const attr of el.attributes) {
          attrs[attr.name] = attr.value
        }

        elements.push({
          tagName: el.tagName.toLowerCase(),
          id: el.id || undefined,
          className: el.className || undefined,
          text: (el.textContent || '').trim().slice(0, 100),
          rect: {
            x: rect.x + window.scrollX,
            y: rect.y + window.scrollY,
            width: rect.width,
            height: rect.height
          },
          attributes: attrs,
          isVisible,
          isInteractive
        })
      })

      return elements
    },
    args: [selector]
  })

  return results[0]?.result || []
}

/**
 * Click at specific coordinates or on an element
 */
export async function clickAt(x: number, y: number): Promise<ClickResult> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (clickX: number, clickY: number) => {
      const scrollX = window.scrollX
      const scrollY = window.scrollY
      const viewX = clickX - scrollX
      const viewY = clickY - scrollY

      const element = document.elementFromPoint(viewX, viewY)
      if (!element) {
        return { success: false, error: 'No element at coordinates' }
      }

      const rect = element.getBoundingClientRect()
      const elementInfo = {
        tagName: element.tagName.toLowerCase(),
        id: (element as HTMLElement).id || undefined,
        className: element.className || undefined,
        text: (element.textContent || '').trim().slice(0, 100),
        rect: {
          x: rect.x + scrollX,
          y: rect.y + scrollY,
          width: rect.width,
          height: rect.height
        },
        attributes: {} as Record<string, string>,
        isVisible: true,
        isInteractive: true
      }

      const mouseDown = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: viewX,
        clientY: viewY
      })
      const mouseUp = new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: viewX,
        clientY: viewY
      })
      const click = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: viewX,
        clientY: viewY
      })

      element.dispatchEvent(mouseDown)
      element.dispatchEvent(mouseUp)
      element.dispatchEvent(click)

      return { success: true, element: elementInfo }
    },
    args: [x, y]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Click on an element by selector
 */
export async function clickElement(selector: string): Promise<ClickResult> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel: string) => {
      const element = document.querySelector(sel)
      if (!element) {
        return { success: false, error: `Element not found: ${sel}` }
      }

      const rect = element.getBoundingClientRect()
      const elementInfo = {
        tagName: element.tagName.toLowerCase(),
        id: (element as HTMLElement).id || undefined,
        className: element.className || undefined,
        text: (element.textContent || '').trim().slice(0, 100),
        rect: {
          x: rect.x + window.scrollX,
          y: rect.y + window.scrollY,
          width: rect.width,
          height: rect.height
        },
        attributes: {} as Record<string, string>,
        isVisible: true,
        isInteractive: true
      }

      if (element instanceof HTMLElement) {
        element.click()
      } else {
        const click = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        })
        element.dispatchEvent(click)
      }

      return { success: true, element: elementInfo }
    },
    args: [selector]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Scroll the page
 */
export async function scroll(deltaX: number, deltaY: number): Promise<ScrollResult> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, scrollX: 0, scrollY: 0, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (dx: number, dy: number) => {
      window.scrollBy(dx, dy)
      return {
        success: true,
        scrollX: window.scrollX,
        scrollY: window.scrollY
      }
    },
    args: [deltaX, deltaY]
  })

  return (
    results[0]?.result || {
      success: false,
      scrollX: 0,
      scrollY: 0,
      error: 'Script execution failed'
    }
  )
}

/**
 * Scroll to specific position
 */
export async function scrollTo(x: number, y: number): Promise<ScrollResult> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, scrollX: 0, scrollY: 0, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (targetX: number, targetY: number) => {
      window.scrollTo(targetX, targetY)
      return {
        success: true,
        scrollX: window.scrollX,
        scrollY: window.scrollY
      }
    },
    args: [x, y]
  })

  return (
    results[0]?.result || {
      success: false,
      scrollX: 0,
      scrollY: 0,
      error: 'Script execution failed'
    }
  )
}

/**
 * Type text into the focused element or a specific element
 */
export async function typeText(text: string, selector?: string): Promise<TypeResult> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (inputText: string, sel?: string) => {
      let element: Element | null = null

      if (sel) {
        element = document.querySelector(sel)
        if (!element) {
          return { success: false, error: `Element not found: ${sel}` }
        }
        if (element instanceof HTMLElement) {
          element.focus()
        }
      } else {
        element = document.activeElement
      }

      if (!element) {
        return { success: false, error: 'No element focused' }
      }

      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.value = inputText
        element.dispatchEvent(new Event('input', { bubbles: true }))
        element.dispatchEvent(new Event('change', { bubbles: true }))
        return { success: true }
      }

      if (element.getAttribute('contenteditable') === 'true') {
        element.textContent = inputText
        element.dispatchEvent(new Event('input', { bubbles: true }))
        return { success: true }
      }

      return { success: false, error: 'Element is not editable' }
    },
    args: [text, selector]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Press a keyboard key
 */
export async function pressKey(
  key: string,
  modifiers?: { ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean }
): Promise<TypeResult> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (
      keyName: string,
      mods?: { ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean }
    ) => {
      const target = document.activeElement || document.body

      const keyDown = new KeyboardEvent('keydown', {
        key: keyName,
        code: keyName,
        bubbles: true,
        cancelable: true,
        ctrlKey: mods?.ctrl || false,
        shiftKey: mods?.shift || false,
        altKey: mods?.alt || false,
        metaKey: mods?.meta || false
      })

      const keyUp = new KeyboardEvent('keyup', {
        key: keyName,
        code: keyName,
        bubbles: true,
        cancelable: true,
        ctrlKey: mods?.ctrl || false,
        shiftKey: mods?.shift || false,
        altKey: mods?.alt || false,
        metaKey: mods?.meta || false
      })

      target.dispatchEvent(keyDown)
      target.dispatchEvent(keyUp)

      return { success: true }
    },
    args: [key, modifiers]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Get page information (URL, title, scroll position, viewport size)
 */
export async function getPageInfo(): Promise<{
  url: string
  title: string
  scrollX: number
  scrollY: number
  viewportWidth: number
  viewportHeight: number
  pageWidth: number
  pageHeight: number
}> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    throw new Error('No active tab found')
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      return {
        url: window.location.href,
        title: document.title,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        pageWidth: document.documentElement.scrollWidth,
        pageHeight: document.documentElement.scrollHeight
      }
    }
  })

  return (
    results[0]?.result || {
      url: tab.url || '',
      title: tab.title || '',
      scrollX: 0,
      scrollY: 0,
      viewportWidth: 1920,
      viewportHeight: 1080,
      pageWidth: 1920,
      pageHeight: 1080
    }
  )
}

/**
 * Navigate to a URL
 */
export async function navigateTo(url: string): Promise<{ success: boolean; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  return new Promise(resolve => {
    chrome.tabs.update(tab.id!, { url }, () => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message })
      } else {
        resolve({ success: true })
      }
    })
  })
}

/**
 * Wait for page to load or for a specific duration
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Hover over an element at specific coordinates
 */
export async function hoverAt(x: number, y: number): Promise<{ success: boolean; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (hoverX: number, hoverY: number) => {
      const scrollX = window.scrollX
      const scrollY = window.scrollY
      const viewX = hoverX - scrollX
      const viewY = hoverY - scrollY

      const element = document.elementFromPoint(viewX, viewY)
      if (!element) {
        return { success: false, error: 'No element at coordinates' }
      }

      const mouseEnter = new MouseEvent('mouseenter', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: viewX,
        clientY: viewY
      })
      const mouseOver = new MouseEvent('mouseover', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: viewX,
        clientY: viewY
      })
      const mouseMove = new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: viewX,
        clientY: viewY
      })

      element.dispatchEvent(mouseEnter)
      element.dispatchEvent(mouseOver)
      element.dispatchEvent(mouseMove)

      return { success: true }
    },
    args: [x, y]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Drag from one point to another
 */
export async function drag(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): Promise<{ success: boolean; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sx: number, sy: number, ex: number, ey: number) => {
      const scrollX = window.scrollX
      const scrollY = window.scrollY
      const startViewX = sx - scrollX
      const startViewY = sy - scrollY
      const endViewX = ex - scrollX
      const endViewY = ey - scrollY

      const startElement = document.elementFromPoint(startViewX, startViewY)
      if (!startElement) {
        return { success: false, error: 'No element at start coordinates' }
      }

      // Mouse down at start
      const mouseDown = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: startViewX,
        clientY: startViewY,
        button: 0
      })
      startElement.dispatchEvent(mouseDown)

      // Mouse move to end (simulate drag)
      const steps = 10
      for (let i = 1; i <= steps; i++) {
        const currentX = startViewX + ((endViewX - startViewX) * i) / steps
        const currentY = startViewY + ((endViewY - startViewY) * i) / steps
        const mouseMove = new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: currentX,
          clientY: currentY,
          button: 0
        })
        document.dispatchEvent(mouseMove)
      }

      // Mouse up at end
      const endElement = document.elementFromPoint(endViewX, endViewY) || document.body
      const mouseUp = new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: endViewX,
        clientY: endViewY,
        button: 0
      })
      endElement.dispatchEvent(mouseUp)

      return { success: true }
    },
    args: [startX, startY, endX, endY]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Select text in an element
 */
export async function selectText(
  selector: string
): Promise<{ success: boolean; text?: string; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel: string) => {
      const element = document.querySelector(sel)
      if (!element) {
        return { success: false, error: `Element not found: ${sel}` }
      }

      const range = document.createRange()
      range.selectNodeContents(element)
      const selection = window.getSelection()
      if (selection) {
        selection.removeAllRanges()
        selection.addRange(range)
        return { success: true, text: selection.toString() }
      }

      return { success: false, error: 'Failed to create selection' }
    },
    args: [selector]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Get selected text on the page
 */
export async function getSelectedText(): Promise<{ success: boolean; text?: string; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const selection = window.getSelection()
      if (selection && selection.toString()) {
        return { success: true, text: selection.toString() }
      }
      return { success: true, text: '' }
    }
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Focus on an element by selector
 */
export async function focusElement(selector: string): Promise<{ success: boolean; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel: string) => {
      const element = document.querySelector(sel)
      if (!element) {
        return { success: false, error: `Element not found: ${sel}` }
      }

      if (element instanceof HTMLElement) {
        element.focus()
        return { success: true }
      }

      return { success: false, error: 'Element is not focusable' }
    },
    args: [selector]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Double click at specific coordinates
 */
export async function doubleClickAt(x: number, y: number): Promise<ClickResult> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (clickX: number, clickY: number) => {
      const scrollX = window.scrollX
      const scrollY = window.scrollY
      const viewX = clickX - scrollX
      const viewY = clickY - scrollY

      const element = document.elementFromPoint(viewX, viewY)
      if (!element) {
        return { success: false, error: 'No element at coordinates' }
      }

      const dblClick = new MouseEvent('dblclick', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: viewX,
        clientY: viewY
      })

      element.dispatchEvent(dblClick)

      return { success: true }
    },
    args: [x, y]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Right click at specific coordinates (context menu)
 */
export async function rightClickAt(x: number, y: number): Promise<ClickResult> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (clickX: number, clickY: number) => {
      const scrollX = window.scrollX
      const scrollY = window.scrollY
      const viewX = clickX - scrollX
      const viewY = clickY - scrollY

      const element = document.elementFromPoint(viewX, viewY)
      if (!element) {
        return { success: false, error: 'No element at coordinates' }
      }

      const contextMenu = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: viewX,
        clientY: viewY,
        button: 2
      })

      element.dispatchEvent(contextMenu)

      return { success: true }
    },
    args: [x, y]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Wait for an element to appear on the page
 */
export async function waitForElement(
  selector: string,
  timeout: number = 10000
): Promise<{ success: boolean; found: boolean; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, found: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: async (sel: string, timeoutMs: number) => {
      const startTime = Date.now()

      while (Date.now() - startTime < timeoutMs) {
        const element = document.querySelector(sel)
        if (element) {
          return { success: true, found: true }
        }
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      return { success: true, found: false }
    },
    args: [selector, timeout]
  })

  return results[0]?.result || { success: false, found: false, error: 'Script execution failed' }
}

/**
 * Get the value of an input element
 */
export async function getInputValue(
  selector: string
): Promise<{ success: boolean; value?: string; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel: string) => {
      const element = document.querySelector(sel)
      if (!element) {
        return { success: false, error: `Element not found: ${sel}` }
      }

      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        return { success: true, value: element.value }
      }

      if (element instanceof HTMLSelectElement) {
        return { success: true, value: element.value }
      }

      return { success: false, error: 'Element is not an input' }
    },
    args: [selector]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Clear input field
 */
export async function clearInput(selector: string): Promise<TypeResult> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel: string) => {
      const element = document.querySelector(sel)
      if (!element) {
        return { success: false, error: `Element not found: ${sel}` }
      }

      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.value = ''
        element.dispatchEvent(new Event('input', { bubbles: true }))
        element.dispatchEvent(new Event('change', { bubbles: true }))
        return { success: true }
      }

      if (element.getAttribute('contenteditable') === 'true') {
        element.textContent = ''
        element.dispatchEvent(new Event('input', { bubbles: true }))
        return { success: true }
      }

      return { success: false, error: 'Element is not clearable' }
    },
    args: [selector]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Execute custom JavaScript in the page context
 */
export async function executeScript(
  code: string
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (jsCode: string) => {
        try {
          // eslint-disable-next-line no-eval
          const result = eval(jsCode)
          return { success: true, result }
        } catch (e) {
          return { success: false, error: String(e) }
        }
      },
      args: [code]
    })

    return results[0]?.result || { success: false, error: 'Script execution failed' }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}
