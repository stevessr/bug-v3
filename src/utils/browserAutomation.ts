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

/**
 * Get text content of an element
 */
export async function getElementText(
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
      return { success: true, text: element.textContent?.trim() || '' }
    },
    args: [selector]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Get inner HTML of an element
 */
export async function getElementHTML(
  selector: string,
  outer: boolean = false
): Promise<{ success: boolean; html?: string; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel: string, getOuter: boolean) => {
      const element = document.querySelector(sel)
      if (!element) {
        return { success: false, error: `Element not found: ${sel}` }
      }
      return {
        success: true,
        html: getOuter ? element.outerHTML : element.innerHTML
      }
    },
    args: [selector, outer]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Get attribute of an element
 */
export async function getElementAttribute(
  selector: string,
  attribute: string
): Promise<{ success: boolean; value?: string | null; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel: string, attr: string) => {
      const element = document.querySelector(sel)
      if (!element) {
        return { success: false, error: `Element not found: ${sel}` }
      }
      return { success: true, value: element.getAttribute(attr) }
    },
    args: [selector, attribute]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Get all attributes of an element
 */
export async function getAllAttributes(
  selector: string
): Promise<{ success: boolean; attributes?: Record<string, string>; error?: string }> {
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
      const attrs: Record<string, string> = {}
      for (const attr of element.attributes) {
        attrs[attr.name] = attr.value
      }
      return { success: true, attributes: attrs }
    },
    args: [selector]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Get computed CSS styles of an element
 */
export async function getComputedStyles(
  selector: string,
  properties?: string[]
): Promise<{ success: boolean; styles?: Record<string, string>; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel: string, props?: string[]) => {
      const element = document.querySelector(sel)
      if (!element) {
        return { success: false, error: `Element not found: ${sel}` }
      }

      const computed = window.getComputedStyle(element)
      const styles: Record<string, string> = {}

      if (props && props.length > 0) {
        for (const prop of props) {
          styles[prop] = computed.getPropertyValue(prop)
        }
      } else {
        // Return common useful properties
        const commonProps = [
          'display',
          'visibility',
          'opacity',
          'width',
          'height',
          'color',
          'background-color',
          'font-size',
          'font-weight',
          'position',
          'top',
          'left',
          'right',
          'bottom',
          'margin',
          'padding',
          'border',
          'z-index'
        ]
        for (const prop of commonProps) {
          styles[prop] = computed.getPropertyValue(prop)
        }
      }

      return { success: true, styles }
    },
    args: [selector, properties]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Get bounding rect and position info of an element
 */
export async function getElementRect(
  selector: string
): Promise<{
  success: boolean
  rect?: { x: number; y: number; width: number; height: number; top: number; left: number; bottom: number; right: number }
  error?: string
}> {
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
      return {
        success: true,
        rect: {
          x: rect.x + window.scrollX,
          y: rect.y + window.scrollY,
          width: rect.width,
          height: rect.height,
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          bottom: rect.bottom + window.scrollY,
          right: rect.right + window.scrollX
        }
      }
    },
    args: [selector]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Query elements by selector and return basic info
 */
export async function queryElements(
  selector: string,
  limit: number = 20
): Promise<{
  success: boolean
  elements?: Array<{
    index: number
    tagName: string
    id?: string
    className?: string
    text?: string
    rect: { x: number; y: number; width: number; height: number }
  }>
  error?: string
}> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel: string, max: number) => {
      const elements = document.querySelectorAll(sel)
      const result: Array<{
        index: number
        tagName: string
        id?: string
        className?: string
        text?: string
        rect: { x: number; y: number; width: number; height: number }
      }> = []

      const count = Math.min(elements.length, max)
      for (let i = 0; i < count; i++) {
        const el = elements[i]
        const rect = el.getBoundingClientRect()
        result.push({
          index: i,
          tagName: el.tagName.toLowerCase(),
          id: el.id || undefined,
          className: el.className?.toString() || undefined,
          text: el.textContent?.trim().slice(0, 100) || undefined,
          rect: {
            x: rect.x + window.scrollX,
            y: rect.y + window.scrollY,
            width: rect.width,
            height: rect.height
          }
        })
      }

      return { success: true, elements: result }
    },
    args: [selector, limit]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Set attribute on an element
 */
export async function setAttribute(
  selector: string,
  attribute: string,
  value: string
): Promise<{ success: boolean; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel: string, attr: string, val: string) => {
      const element = document.querySelector(sel)
      if (!element) {
        return { success: false, error: `Element not found: ${sel}` }
      }
      element.setAttribute(attr, val)
      return { success: true }
    },
    args: [selector, attribute, value]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Remove attribute from an element
 */
export async function removeAttribute(
  selector: string,
  attribute: string
): Promise<{ success: boolean; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel: string, attr: string) => {
      const element = document.querySelector(sel)
      if (!element) {
        return { success: false, error: `Element not found: ${sel}` }
      }
      element.removeAttribute(attr)
      return { success: true }
    },
    args: [selector, attribute]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Add CSS class to an element
 */
export async function addClass(
  selector: string,
  className: string
): Promise<{ success: boolean; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel: string, cls: string) => {
      const element = document.querySelector(sel)
      if (!element) {
        return { success: false, error: `Element not found: ${sel}` }
      }
      element.classList.add(...cls.split(/\s+/).filter(Boolean))
      return { success: true }
    },
    args: [selector, className]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Remove CSS class from an element
 */
export async function removeClass(
  selector: string,
  className: string
): Promise<{ success: boolean; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel: string, cls: string) => {
      const element = document.querySelector(sel)
      if (!element) {
        return { success: false, error: `Element not found: ${sel}` }
      }
      element.classList.remove(...cls.split(/\s+/).filter(Boolean))
      return { success: true }
    },
    args: [selector, className]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Toggle CSS class on an element
 */
export async function toggleClass(
  selector: string,
  className: string
): Promise<{ success: boolean; hasClass?: boolean; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel: string, cls: string) => {
      const element = document.querySelector(sel)
      if (!element) {
        return { success: false, error: `Element not found: ${sel}` }
      }
      const result = element.classList.toggle(cls)
      return { success: true, hasClass: result }
    },
    args: [selector, className]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Set inline style on an element
 */
export async function setStyle(
  selector: string,
  property: string,
  value: string
): Promise<{ success: boolean; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel: string, prop: string, val: string) => {
      const element = document.querySelector(sel) as HTMLElement
      if (!element) {
        return { success: false, error: `Element not found: ${sel}` }
      }
      element.style.setProperty(prop, val)
      return { success: true }
    },
    args: [selector, property, value]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Scroll an element into view
 */
export async function scrollIntoView(
  selector: string,
  options?: { behavior?: 'auto' | 'smooth'; block?: 'start' | 'center' | 'end' | 'nearest' }
): Promise<{ success: boolean; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel: string, opts?: { behavior?: 'auto' | 'smooth'; block?: 'start' | 'center' | 'end' | 'nearest' }) => {
      const element = document.querySelector(sel)
      if (!element) {
        return { success: false, error: `Element not found: ${sel}` }
      }
      element.scrollIntoView(opts || { behavior: 'smooth', block: 'center' })
      return { success: true }
    },
    args: [selector, options]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Check if element exists on the page
 */
export async function elementExists(
  selector: string
): Promise<{ success: boolean; exists?: boolean; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel: string) => {
      const element = document.querySelector(sel)
      return { success: true, exists: element !== null }
    },
    args: [selector]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Get element count for a selector
 */
export async function getElementCount(
  selector: string
): Promise<{ success: boolean; count?: number; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel: string) => {
      const elements = document.querySelectorAll(sel)
      return { success: true, count: elements.length }
    },
    args: [selector]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Get parent element info
 */
export async function getParentElement(
  selector: string
): Promise<{
  success: boolean
  parent?: { tagName: string; id?: string; className?: string }
  error?: string
}> {
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
      const parent = element.parentElement
      if (!parent) {
        return { success: true, parent: undefined }
      }
      return {
        success: true,
        parent: {
          tagName: parent.tagName.toLowerCase(),
          id: parent.id || undefined,
          className: parent.className?.toString() || undefined
        }
      }
    },
    args: [selector]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Get child elements info
 */
export async function getChildElements(
  selector: string,
  limit: number = 10
): Promise<{
  success: boolean
  children?: Array<{ tagName: string; id?: string; className?: string; text?: string }>
  error?: string
}> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel: string, max: number) => {
      const element = document.querySelector(sel)
      if (!element) {
        return { success: false, error: `Element not found: ${sel}` }
      }
      const children: Array<{ tagName: string; id?: string; className?: string; text?: string }> = []
      const count = Math.min(element.children.length, max)
      for (let i = 0; i < count; i++) {
        const child = element.children[i]
        children.push({
          tagName: child.tagName.toLowerCase(),
          id: child.id || undefined,
          className: child.className?.toString() || undefined,
          text: child.textContent?.trim().slice(0, 50) || undefined
        })
      }
      return { success: true, children }
    },
    args: [selector, limit]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Set element property (for form elements like checked, disabled, etc.)
 */
export async function setProperty(
  selector: string,
  property: string,
  value: unknown
): Promise<{ success: boolean; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel: string, prop: string, val: unknown) => {
      const element = document.querySelector(sel) as any
      if (!element) {
        return { success: false, error: `Element not found: ${sel}` }
      }
      element[prop] = val
      return { success: true }
    },
    args: [selector, property, value]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Get element property value
 */
export async function getProperty(
  selector: string,
  property: string
): Promise<{ success: boolean; value?: unknown; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel: string, prop: string) => {
      const element = document.querySelector(sel) as any
      if (!element) {
        return { success: false, error: `Element not found: ${sel}` }
      }
      return { success: true, value: element[prop] }
    },
    args: [selector, property]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

// ============================================================================
// Chrome Tab Management
// ============================================================================

/**
 * Get all open tabs
 */
export async function getAllTabs(): Promise<{
  success: boolean
  tabs?: Array<{
    id: number
    url: string
    title: string
    active: boolean
    windowId: number
    index: number
    pinned: boolean
  }>
  error?: string
}> {
  try {
    const tabs = await chrome.tabs.query({})
    return {
      success: true,
      tabs: tabs.map(tab => ({
        id: tab.id!,
        url: tab.url || '',
        title: tab.title || '',
        active: tab.active,
        windowId: tab.windowId,
        index: tab.index,
        pinned: tab.pinned || false
      }))
    }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

/**
 * Get current active tab
 */
export async function getActiveTab(): Promise<{
  success: boolean
  tab?: { id: number; url: string; title: string; windowId: number }
  error?: string
}> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab) {
      return { success: false, error: 'No active tab found' }
    }
    return {
      success: true,
      tab: {
        id: tab.id!,
        url: tab.url || '',
        title: tab.title || '',
        windowId: tab.windowId
      }
    }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

/**
 * Create a new tab
 */
export async function createTab(
  url?: string,
  active: boolean = true
): Promise<{ success: boolean; tabId?: number; url?: string; title?: string; error?: string }> {
  try {
    const tab = await chrome.tabs.create({ url, active })
    return { success: true, tabId: tab.id, url: tab.url, title: tab.title }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

/**
 * Close a tab by ID
 */
export async function closeTab(tabId: number): Promise<{ success: boolean; error?: string }> {
  try {
    await chrome.tabs.remove(tabId)
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

/**
 * Switch to a tab by ID
 */
export async function switchToTab(tabId: number): Promise<{ success: boolean; error?: string }> {
  try {
    await chrome.tabs.update(tabId, { active: true })
    const tab = await chrome.tabs.get(tabId)
    await chrome.windows.update(tab.windowId, { focused: true })
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

/**
 * Duplicate a tab
 */
export async function duplicateTab(tabId: number): Promise<{ success: boolean; newTabId?: number; error?: string }> {
  try {
    const newTab = await chrome.tabs.duplicate(tabId)
    return { success: true, newTabId: newTab?.id }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

/**
 * Reload a tab
 */
export async function reloadTab(
  tabId?: number,
  bypassCache: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    if (tabId) {
      await chrome.tabs.reload(tabId, { bypassCache })
    } else {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.id) {
        await chrome.tabs.reload(tab.id, { bypassCache })
      }
    }
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

/**
 * Go back in history
 */
export async function goBack(): Promise<{ success: boolean; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  try {
    await chrome.tabs.goBack(tab.id)
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

/**
 * Go forward in history
 */
export async function goForward(): Promise<{ success: boolean; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  try {
    await chrome.tabs.goForward(tab.id)
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

/**
 * Pin/unpin a tab
 */
export async function pinTab(tabId: number, pinned: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    await chrome.tabs.update(tabId, { pinned })
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

/**
 * Mute/unmute a tab
 */
export async function muteTab(tabId: number, muted: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    await chrome.tabs.update(tabId, { muted })
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// ============================================================================
// Chrome Window Management
// ============================================================================

/**
 * Get all windows
 */
export async function getAllWindows(): Promise<{
  success: boolean
  windows?: Array<{ id: number; focused: boolean; type: string; tabCount: number }>
  error?: string
}> {
  try {
    const windows = await chrome.windows.getAll({ populate: true })
    return {
      success: true,
      windows: windows.map(w => ({
        id: w.id!,
        focused: w.focused || false,
        type: w.type || 'normal',
        tabCount: w.tabs?.length || 0
      }))
    }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

/**
 * Create a new window
 */
export async function createWindow(
  url?: string,
  type: 'normal' | 'popup' = 'normal',
  focused: boolean = true
): Promise<{ success: boolean; windowId?: number; tabId?: number; error?: string }> {
  try {
    const window = await chrome.windows.create({ url, type, focused })
    const tabId = window?.tabs?.[0]?.id
    return { success: true, windowId: window?.id, tabId }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

/**
 * Close a window
 */
export async function closeWindow(windowId: number): Promise<{ success: boolean; error?: string }> {
  try {
    await chrome.windows.remove(windowId)
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

/**
 * Focus a window
 */
export async function focusWindow(windowId: number): Promise<{ success: boolean; error?: string }> {
  try {
    await chrome.windows.update(windowId, { focused: true })
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// ============================================================================
// Chrome Storage (localStorage/sessionStorage)
// ============================================================================

/**
 * Get localStorage item
 */
export async function getLocalStorageItem(
  key: string
): Promise<{ success: boolean; value?: string | null; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (k: string) => {
      return { success: true, value: localStorage.getItem(k) }
    },
    args: [key]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Set localStorage item
 */
export async function setLocalStorageItem(
  key: string,
  value: string
): Promise<{ success: boolean; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (k: string, v: string) => {
      localStorage.setItem(k, v)
      return { success: true }
    },
    args: [key, value]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Remove localStorage item
 */
export async function removeLocalStorageItem(key: string): Promise<{ success: boolean; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (k: string) => {
      localStorage.removeItem(k)
      return { success: true }
    },
    args: [key]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Get all localStorage keys
 */
export async function getLocalStorageKeys(): Promise<{
  success: boolean
  keys?: string[]
  error?: string
}> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key) keys.push(key)
      }
      return { success: true, keys }
    }
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Clear localStorage
 */
export async function clearLocalStorage(): Promise<{ success: boolean; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      localStorage.clear()
      return { success: true }
    }
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Get sessionStorage item
 */
export async function getSessionStorageItem(
  key: string
): Promise<{ success: boolean; value?: string | null; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (k: string) => {
      return { success: true, value: sessionStorage.getItem(k) }
    },
    args: [key]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Set sessionStorage item
 */
export async function setSessionStorageItem(
  key: string,
  value: string
): Promise<{ success: boolean; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (k: string, v: string) => {
      sessionStorage.setItem(k, v)
      return { success: true }
    },
    args: [key, value]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

// ============================================================================
// Chrome Cookies
// ============================================================================

/**
 * Get cookies for current page
 */
export async function getCookies(
  url?: string
): Promise<{
  success: boolean
  cookies?: Array<{ name: string; value: string; domain: string; path: string; secure: boolean; httpOnly: boolean }>
  error?: string
}> {
  try {
    let targetUrl = url
    if (!targetUrl) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      targetUrl = tab?.url
    }
    if (!targetUrl) {
      return { success: false, error: 'No URL provided or active tab' }
    }

    const cookies = await chrome.cookies.getAll({ url: targetUrl })
    return {
      success: true,
      cookies: cookies.map(c => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        secure: c.secure,
        httpOnly: c.httpOnly
      }))
    }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

/**
 * Set a cookie
 */
export async function setCookie(
  name: string,
  value: string,
  options?: { domain?: string; path?: string; secure?: boolean; httpOnly?: boolean; expirationDate?: number }
): Promise<{ success: boolean; error?: string }> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.url) {
      return { success: false, error: 'No active tab URL' }
    }

    await chrome.cookies.set({
      url: tab.url,
      name,
      value,
      domain: options?.domain,
      path: options?.path || '/',
      secure: options?.secure,
      httpOnly: options?.httpOnly,
      expirationDate: options?.expirationDate
    })
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

/**
 * Delete a cookie
 */
export async function deleteCookie(
  name: string,
  url?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    let targetUrl = url
    if (!targetUrl) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      targetUrl = tab?.url
    }
    if (!targetUrl) {
      return { success: false, error: 'No URL provided or active tab' }
    }

    await chrome.cookies.remove({ url: targetUrl, name })
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// ============================================================================
// Clipboard Operations
// ============================================================================

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<{ success: boolean; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: async (t: string) => {
      try {
        await navigator.clipboard.writeText(t)
        return { success: true }
      } catch {
        // Fallback method
        const textarea = document.createElement('textarea')
        textarea.value = t
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
        return { success: true }
      }
    },
    args: [text]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Read text from clipboard
 */
export async function readFromClipboard(): Promise<{ success: boolean; text?: string; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: async () => {
      try {
        const text = await navigator.clipboard.readText()
        return { success: true, text }
      } catch {
        return { success: false, error: 'Clipboard access denied' }
      }
    }
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

// ============================================================================
// Console & Debugging
// ============================================================================

/**
 * Inject and capture console logs
 */
export async function getConsoleLogs(): Promise<{
  success: boolean
  logs?: Array<{ type: string; message: string; timestamp: number }>
  error?: string
}> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      // Get logs if we've captured them before
      const logs = (window as any).__capturedConsoleLogs || []
      return { success: true, logs }
    }
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Start capturing console logs
 */
export async function startConsoleCapture(): Promise<{ success: boolean; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      if ((window as any).__consoleCapturing) {
        return { success: true } // Already capturing
      }

      (window as any).__capturedConsoleLogs = [];
      (window as any).__consoleCapturing = true

      const methods = ['log', 'warn', 'error', 'info', 'debug'] as const
      const originalConsole: any = {}

      methods.forEach(method => {
        originalConsole[method] = console[method]
        console[method] = (...args: any[]) => {
          (window as any).__capturedConsoleLogs.push({
            type: method,
            message: args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '),
            timestamp: Date.now()
          })
          originalConsole[method](...args)
        }
      })

      return { success: true }
    }
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

// ============================================================================
// Network & Performance
// ============================================================================

/**
 * Get performance timing info
 */
export async function getPerformanceTiming(): Promise<{
  success: boolean
  timing?: {
    loadTime: number
    domContentLoaded: number
    firstPaint?: number
    firstContentfulPaint?: number
  }
  error?: string
}> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const timing = performance.timing
      const paintEntries = performance.getEntriesByType('paint')
      const fpEntry = paintEntries.find(e => e.name === 'first-paint')
      const fcpEntry = paintEntries.find(e => e.name === 'first-contentful-paint')

      return {
        success: true,
        timing: {
          loadTime: timing.loadEventEnd - timing.navigationStart,
          domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
          firstPaint: fpEntry?.startTime,
          firstContentfulPaint: fcpEntry?.startTime
        }
      }
    }
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Get resource timing entries
 */
export async function getResourceTiming(
  limit: number = 20
): Promise<{
  success: boolean
  resources?: Array<{ name: string; type: string; duration: number; size: number }>
  error?: string
}> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (max: number) => {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
      return {
        success: true,
        resources: entries.slice(0, max).map(e => ({
          name: e.name.split('/').pop() || e.name,
          type: e.initiatorType,
          duration: Math.round(e.duration),
          size: e.transferSize || 0
        }))
      }
    },
    args: [limit]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

// ============================================================================
// Form Handling
// ============================================================================

/**
 * Get all form data from a form element
 */
export async function getFormData(
  selector: string
): Promise<{
  success: boolean
  data?: Record<string, string>
  error?: string
}> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel: string) => {
      const form = document.querySelector(sel) as HTMLFormElement
      if (!form) {
        return { success: false, error: `Form not found: ${sel}` }
      }

      const formData = new FormData(form)
      const data: Record<string, string> = {}
      formData.forEach((value, key) => {
        data[key] = value.toString()
      })

      return { success: true, data }
    },
    args: [selector]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Fill a form with data
 */
export async function fillForm(
  selector: string,
  data: Record<string, string>
): Promise<{ success: boolean; filledFields?: string[]; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel: string, formData: Record<string, string>) => {
      const form = document.querySelector(sel) as HTMLFormElement
      if (!form) {
        return { success: false, error: `Form not found: ${sel}` }
      }

      const filledFields: string[] = []

      for (const [name, value] of Object.entries(formData)) {
        const field = form.querySelector(`[name="${name}"]`) as
          | HTMLInputElement
          | HTMLSelectElement
          | HTMLTextAreaElement
        if (field) {
          if (field instanceof HTMLSelectElement) {
            field.value = value
          } else if (field instanceof HTMLInputElement) {
            if (field.type === 'checkbox' || field.type === 'radio') {
              field.checked = value === 'true' || value === '1'
            } else {
              field.value = value
            }
          } else {
            field.value = value
          }
          field.dispatchEvent(new Event('input', { bubbles: true }))
          field.dispatchEvent(new Event('change', { bubbles: true }))
          filledFields.push(name)
        }
      }

      return { success: true, filledFields }
    },
    args: [selector, data]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

/**
 * Submit a form
 */
export async function submitForm(selector: string): Promise<{ success: boolean; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sel: string) => {
      const form = document.querySelector(sel) as HTMLFormElement
      if (!form) {
        return { success: false, error: `Form not found: ${sel}` }
      }

      form.submit()
      return { success: true }
    },
    args: [selector]
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

// ============================================================================
// Alert/Dialog Handling
// ============================================================================

/**
 * Dismiss any open alerts/confirms/prompts
 */
export async function dismissDialog(): Promise<{ success: boolean; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      // Override alert, confirm, prompt to auto-dismiss
      window.alert = () => {}
      window.confirm = () => true
      window.prompt = () => ''
      return { success: true }
    }
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}

// ============================================================================
// Zoom Control
// ============================================================================

/**
 * Get current zoom level
 */
export async function getZoom(): Promise<{ success: boolean; zoomFactor?: number; error?: string }> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) {
      return { success: false, error: 'No active tab found' }
    }

    const zoomFactor = await chrome.tabs.getZoom(tab.id)
    return { success: true, zoomFactor }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

/**
 * Set zoom level
 */
export async function setZoom(zoomFactor: number): Promise<{ success: boolean; error?: string }> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) {
      return { success: false, error: 'No active tab found' }
    }

    await chrome.tabs.setZoom(tab.id, zoomFactor)
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// ============================================================================
// Print
// ============================================================================

/**
 * Trigger print dialog
 */
export async function triggerPrint(): Promise<{ success: boolean; error?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    return { success: false, error: 'No active tab found' }
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      window.print()
      return { success: true }
    }
  })

  return results[0]?.result || { success: false, error: 'Script execution failed' }
}
