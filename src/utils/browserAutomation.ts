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
