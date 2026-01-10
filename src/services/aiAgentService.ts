/**
 * AI Agent Service - Claude API Integration for Browser Automation
 * Uses Claude's computer use capabilities to control the browser
 */

import Anthropic from '@anthropic-ai/sdk'

import { createLogger } from '@/utils/logger'
import * as browserAutomation from '@/utils/browserAutomation'

const log = createLogger('AIAgentService')

export interface AgentConfig {
  apiKey: string
  baseUrl: string
  model: string
}

export interface AgentMessage {
  role: 'user' | 'assistant'
  content: string | AgentContentBlock[]
}

export interface AgentContentBlock {
  type: 'text' | 'image' | 'tool_use' | 'tool_result'
  text?: string
  source?: {
    type: 'base64'
    media_type: string
    data: string
  }
  id?: string
  name?: string
  input?: Record<string, unknown>
  tool_use_id?: string
  content?: string
  is_error?: boolean
}

export interface ToolDefinition {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, { type: string; description: string; enum?: string[] }>
    required?: string[]
  }
}

export interface AgentAction {
  type:
    | 'screenshot'
    | 'click'
    | 'double_click'
    | 'right_click'
    | 'click_element'
    | 'hover'
    | 'drag'
    | 'scroll'
    | 'type'
    | 'clear_input'
    | 'key'
    | 'navigate'
    | 'wait'
    | 'wait_for_element'
    | 'focus'
    | 'select_text'
    | 'get_selected_text'
    | 'get_input_value'
    | 'get_page_info'
    | 'get_elements'
    | 'execute_script'
    | 'get_element_text'
    | 'get_element_html'
    | 'get_element_attribute'
    | 'get_all_attributes'
    | 'get_computed_styles'
    | 'get_element_rect'
    | 'query_elements'
    | 'set_attribute'
    | 'remove_attribute'
    | 'add_class'
    | 'remove_class'
    | 'toggle_class'
    | 'set_style'
    | 'scroll_into_view'
    | 'element_exists'
    | 'get_element_count'
    | 'get_parent_element'
    | 'get_child_elements'
    | 'set_property'
    | 'get_property'
    | 'done'
  params?: Record<string, unknown>
}

export interface AgentStep {
  thinking?: string
  action?: AgentAction
  result?: string
  screenshot?: string
  error?: string
}

export type AgentStatusCallback = (status: {
  step: number
  message: string
  thinking?: string
  action?: AgentAction
  screenshot?: string
}) => void

const BROWSER_TOOLS: ToolDefinition[] = [
  {
    name: 'screenshot',
    description: 'Capture a screenshot of the current browser tab to see what is on screen',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'click',
    description:
      'Click at specific coordinates (x, y) on the page. Coordinates are absolute page coordinates.',
    input_schema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'X coordinate to click' },
        y: { type: 'number', description: 'Y coordinate to click' }
      },
      required: ['x', 'y']
    }
  },
  {
    name: 'double_click',
    description: 'Double click at specific coordinates (x, y) on the page',
    input_schema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'X coordinate to double click' },
        y: { type: 'number', description: 'Y coordinate to double click' }
      },
      required: ['x', 'y']
    }
  },
  {
    name: 'right_click',
    description: 'Right click at specific coordinates to open context menu',
    input_schema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'X coordinate to right click' },
        y: { type: 'number', description: 'Y coordinate to right click' }
      },
      required: ['x', 'y']
    }
  },
  {
    name: 'click_element',
    description: 'Click on an element by CSS selector',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the element to click' }
      },
      required: ['selector']
    }
  },
  {
    name: 'hover',
    description: 'Hover over specific coordinates to trigger hover effects',
    input_schema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'X coordinate to hover' },
        y: { type: 'number', description: 'Y coordinate to hover' }
      },
      required: ['x', 'y']
    }
  },
  {
    name: 'drag',
    description: 'Drag from one point to another (for drag-and-drop operations)',
    input_schema: {
      type: 'object',
      properties: {
        start_x: { type: 'number', description: 'Starting X coordinate' },
        start_y: { type: 'number', description: 'Starting Y coordinate' },
        end_x: { type: 'number', description: 'Ending X coordinate' },
        end_y: { type: 'number', description: 'Ending Y coordinate' }
      },
      required: ['start_x', 'start_y', 'end_x', 'end_y']
    }
  },
  {
    name: 'scroll',
    description: 'Scroll the page by a relative amount',
    input_schema: {
      type: 'object',
      properties: {
        direction: {
          type: 'string',
          description: 'Direction to scroll',
          enum: ['up', 'down', 'left', 'right']
        },
        amount: { type: 'number', description: 'Amount to scroll in pixels (default: 500)' }
      },
      required: ['direction']
    }
  },
  {
    name: 'type',
    description: 'Type text into the currently focused element or a specific element',
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to type' },
        selector: {
          type: 'string',
          description: 'Optional CSS selector of the element to type into'
        }
      },
      required: ['text']
    }
  },
  {
    name: 'clear_input',
    description: 'Clear the content of an input field',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the input to clear' }
      },
      required: ['selector']
    }
  },
  {
    name: 'key',
    description: 'Press a keyboard key (e.g., Enter, Tab, Escape, ArrowDown)',
    input_schema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Key to press (e.g., Enter, Tab, Escape, ArrowDown)' },
        ctrl: { type: 'boolean', description: 'Hold Ctrl key' },
        shift: { type: 'boolean', description: 'Hold Shift key' },
        alt: { type: 'boolean', description: 'Hold Alt key' }
      },
      required: ['key']
    }
  },
  {
    name: 'navigate',
    description: 'Navigate to a URL',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to navigate to' }
      },
      required: ['url']
    }
  },
  {
    name: 'wait',
    description: 'Wait for a specified duration in milliseconds',
    input_schema: {
      type: 'object',
      properties: {
        ms: { type: 'number', description: 'Duration to wait in milliseconds' }
      },
      required: ['ms']
    }
  },
  {
    name: 'wait_for_element',
    description: 'Wait for an element to appear on the page',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the element to wait for' },
        timeout: { type: 'number', description: 'Maximum wait time in milliseconds (default: 10000)' }
      },
      required: ['selector']
    }
  },
  {
    name: 'focus',
    description: 'Focus on an element by CSS selector',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the element to focus' }
      },
      required: ['selector']
    }
  },
  {
    name: 'select_text',
    description: 'Select all text within an element',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the element to select text from' }
      },
      required: ['selector']
    }
  },
  {
    name: 'get_selected_text',
    description: 'Get the currently selected text on the page',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_input_value',
    description: 'Get the current value of an input element',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the input element' }
      },
      required: ['selector']
    }
  },
  {
    name: 'get_page_info',
    description:
      'Get information about the current page (URL, title, scroll position, viewport size)',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_elements',
    description: 'Get interactive DOM elements on the page (buttons, links, inputs, etc.)',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'Optional CSS selector to filter elements' }
      },
      required: []
    }
  },
  {
    name: 'execute_script',
    description: 'Execute custom JavaScript code in the page context (use with caution)',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'JavaScript code to execute' }
      },
      required: ['code']
    }
  },
  // DOM Reading Tools
  {
    name: 'get_element_text',
    description: 'Get the text content of an element by CSS selector',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the element' }
      },
      required: ['selector']
    }
  },
  {
    name: 'get_element_html',
    description: 'Get the HTML content of an element (inner or outer HTML)',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the element' },
        outer: { type: 'boolean', description: 'If true, get outerHTML instead of innerHTML' }
      },
      required: ['selector']
    }
  },
  {
    name: 'get_element_attribute',
    description: 'Get a specific attribute value of an element',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the element' },
        attribute: { type: 'string', description: 'Name of the attribute to get' }
      },
      required: ['selector', 'attribute']
    }
  },
  {
    name: 'get_all_attributes',
    description: 'Get all attributes of an element as a key-value object',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the element' }
      },
      required: ['selector']
    }
  },
  {
    name: 'get_computed_styles',
    description: 'Get computed CSS styles of an element',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the element' },
        properties: {
          type: 'string',
          description:
            'Comma-separated list of CSS properties to get (e.g., "color,font-size"). If empty, returns common properties.'
        }
      },
      required: ['selector']
    }
  },
  {
    name: 'get_element_rect',
    description: 'Get bounding rectangle and position of an element',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the element' }
      },
      required: ['selector']
    }
  },
  {
    name: 'query_elements',
    description: 'Query multiple elements by selector and get their basic info',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector to query' },
        limit: { type: 'number', description: 'Maximum number of elements to return (default: 20)' }
      },
      required: ['selector']
    }
  },
  {
    name: 'element_exists',
    description: 'Check if an element exists on the page',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector to check' }
      },
      required: ['selector']
    }
  },
  {
    name: 'get_element_count',
    description: 'Get the count of elements matching a selector',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector to count' }
      },
      required: ['selector']
    }
  },
  {
    name: 'get_parent_element',
    description: 'Get information about the parent element',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the child element' }
      },
      required: ['selector']
    }
  },
  {
    name: 'get_child_elements',
    description: 'Get information about child elements',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the parent element' },
        limit: { type: 'number', description: 'Maximum number of children to return (default: 10)' }
      },
      required: ['selector']
    }
  },
  {
    name: 'get_property',
    description: 'Get a JavaScript property value of an element (e.g., checked, disabled, value)',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the element' },
        property: { type: 'string', description: 'Property name to get (e.g., checked, disabled, value)' }
      },
      required: ['selector', 'property']
    }
  },
  // DOM Manipulation Tools
  {
    name: 'set_attribute',
    description: 'Set an attribute on an element',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the element' },
        attribute: { type: 'string', description: 'Attribute name to set' },
        value: { type: 'string', description: 'Value to set' }
      },
      required: ['selector', 'attribute', 'value']
    }
  },
  {
    name: 'remove_attribute',
    description: 'Remove an attribute from an element',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the element' },
        attribute: { type: 'string', description: 'Attribute name to remove' }
      },
      required: ['selector', 'attribute']
    }
  },
  {
    name: 'add_class',
    description: 'Add one or more CSS classes to an element',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the element' },
        class_name: { type: 'string', description: 'Class name(s) to add (space-separated for multiple)' }
      },
      required: ['selector', 'class_name']
    }
  },
  {
    name: 'remove_class',
    description: 'Remove one or more CSS classes from an element',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the element' },
        class_name: { type: 'string', description: 'Class name(s) to remove (space-separated for multiple)' }
      },
      required: ['selector', 'class_name']
    }
  },
  {
    name: 'toggle_class',
    description: 'Toggle a CSS class on an element',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the element' },
        class_name: { type: 'string', description: 'Class name to toggle' }
      },
      required: ['selector', 'class_name']
    }
  },
  {
    name: 'set_style',
    description: 'Set an inline CSS style property on an element',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the element' },
        property: { type: 'string', description: 'CSS property name (e.g., color, display, width)' },
        value: { type: 'string', description: 'CSS value to set' }
      },
      required: ['selector', 'property', 'value']
    }
  },
  {
    name: 'scroll_into_view',
    description: 'Scroll an element into the visible viewport',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the element' },
        behavior: { type: 'string', description: 'Scroll behavior: auto or smooth', enum: ['auto', 'smooth'] },
        block: {
          type: 'string',
          description: 'Vertical alignment: start, center, end, nearest',
          enum: ['start', 'center', 'end', 'nearest']
        }
      },
      required: ['selector']
    }
  },
  {
    name: 'set_property',
    description:
      'Set a JavaScript property on an element (e.g., checked=true for checkboxes, disabled=true)',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the element' },
        property: { type: 'string', description: 'Property name to set' },
        value: { type: 'string', description: 'Value to set (use "true"/"false" for booleans)' }
      },
      required: ['selector', 'property', 'value']
    }
  },
  {
    name: 'done',
    description: 'Mark the task as complete and provide a summary',
    input_schema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Summary of what was accomplished' }
      },
      required: ['summary']
    }
  }
]

const SYSTEM_PROMPT = `You are a browser automation agent. You can control a web browser to complete tasks.

You have access to the following tools:

**Screen & Navigation:**
- screenshot: Capture what's currently visible on the screen
- navigate: Go to a URL
- get_page_info: Get page URL, title, and dimensions

**Mouse & Keyboard:**
- click: Click at specific x,y coordinates
- double_click: Double click at specific x,y coordinates
- right_click: Right click to open context menu
- click_element: Click on an element by CSS selector
- hover: Hover over specific coordinates to trigger hover effects
- drag: Drag from one point to another
- scroll: Scroll the page in a direction
- type: Type text into input fields
- clear_input: Clear an input field
- key: Press keyboard keys (Enter, Tab, Escape, etc.)

**Element Interaction:**
- focus: Focus on an element by selector
- select_text: Select all text in an element
- get_selected_text: Get the currently selected text
- get_input_value: Get the value of an input element
- scroll_into_view: Scroll an element into the visible viewport

**DOM Reading (for understanding page structure):**
- get_elements: Get interactive elements on the page
- get_element_text: Get the text content of an element
- get_element_html: Get the HTML content of an element
- get_element_attribute: Get a specific attribute value
- get_all_attributes: Get all attributes of an element
- get_computed_styles: Get computed CSS styles
- get_element_rect: Get bounding rectangle and position
- query_elements: Query multiple elements by selector
- element_exists: Check if an element exists
- get_element_count: Count elements matching a selector
- get_parent_element: Get parent element info
- get_child_elements: Get child elements info
- get_property: Get a JavaScript property (e.g., checked, disabled)

**DOM Manipulation (for modifying elements):**
- set_attribute: Set an attribute on an element
- remove_attribute: Remove an attribute
- add_class: Add CSS class(es) to an element
- remove_class: Remove CSS class(es) from an element
- toggle_class: Toggle a CSS class
- set_style: Set inline CSS style
- set_property: Set a JavaScript property (e.g., checked, disabled)

**Timing & Control:**
- wait: Wait for a duration
- wait_for_element: Wait for an element to appear
- execute_script: Execute custom JavaScript (use with caution)
- done: Complete the task with a summary

Workflow:
1. First take a screenshot to see the current state
2. Use DOM reading tools to understand the page structure if needed
3. Execute actions step by step
4. After important actions, take a screenshot to verify the result
5. When the task is complete, use the 'done' tool

Important:
- Always take a screenshot first to understand the current page state
- Use CSS selectors (e.g., "#id", ".class", "button[type='submit']") for reliable element targeting
- Click coordinates are relative to the page (not viewport), account for scroll position
- Be precise with coordinates - click in the center of buttons/links
- Use DOM reading tools to verify element presence before interacting
- If something doesn't work, try an alternative approach
- Provide clear thinking about what you're doing and why`

/**
 * Execute a browser tool and return the result
 */
async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<{ result: string; screenshot?: string }> {
  log.info(`Executing tool: ${toolName}`, toolInput)

  switch (toolName) {
    case 'screenshot': {
      const screenshot = await browserAutomation.captureScreenshot()
      return {
        result: `Screenshot captured (${screenshot.width}x${screenshot.height})`,
        screenshot: screenshot.base64
      }
    }

    case 'click': {
      const x = toolInput.x as number
      const y = toolInput.y as number
      const result = await browserAutomation.clickAt(x, y)
      if (result.success) {
        return {
          result: `Clicked at (${x}, ${y}) on element: ${result.element?.tagName || 'unknown'}`
        }
      }
      return { result: `Click failed: ${result.error}` }
    }

    case 'double_click': {
      const x = toolInput.x as number
      const y = toolInput.y as number
      const result = await browserAutomation.doubleClickAt(x, y)
      if (result.success) {
        return { result: `Double clicked at (${x}, ${y})` }
      }
      return { result: `Double click failed: ${result.error}` }
    }

    case 'right_click': {
      const x = toolInput.x as number
      const y = toolInput.y as number
      const result = await browserAutomation.rightClickAt(x, y)
      if (result.success) {
        return { result: `Right clicked at (${x}, ${y})` }
      }
      return { result: `Right click failed: ${result.error}` }
    }

    case 'click_element': {
      const selector = toolInput.selector as string
      const result = await browserAutomation.clickElement(selector)
      if (result.success) {
        return { result: `Clicked element: ${selector}` }
      }
      return { result: `Click failed: ${result.error}` }
    }

    case 'hover': {
      const x = toolInput.x as number
      const y = toolInput.y as number
      const result = await browserAutomation.hoverAt(x, y)
      if (result.success) {
        return { result: `Hovered at (${x}, ${y})` }
      }
      return { result: `Hover failed: ${result.error}` }
    }

    case 'drag': {
      const startX = toolInput.start_x as number
      const startY = toolInput.start_y as number
      const endX = toolInput.end_x as number
      const endY = toolInput.end_y as number
      const result = await browserAutomation.drag(startX, startY, endX, endY)
      if (result.success) {
        return { result: `Dragged from (${startX}, ${startY}) to (${endX}, ${endY})` }
      }
      return { result: `Drag failed: ${result.error}` }
    }

    case 'scroll': {
      const direction = toolInput.direction as string
      const amount = (toolInput.amount as number) || 500
      let deltaX = 0
      let deltaY = 0

      switch (direction) {
        case 'up':
          deltaY = -amount
          break
        case 'down':
          deltaY = amount
          break
        case 'left':
          deltaX = -amount
          break
        case 'right':
          deltaX = amount
          break
      }

      const result = await browserAutomation.scroll(deltaX, deltaY)
      if (result.success) {
        return {
          result: `Scrolled ${direction} by ${amount}px. New position: (${result.scrollX}, ${result.scrollY})`
        }
      }
      return { result: `Scroll failed: ${result.error}` }
    }

    case 'type': {
      const text = toolInput.text as string
      const selector = toolInput.selector as string | undefined
      const result = await browserAutomation.typeText(text, selector)
      if (result.success) {
        return { result: `Typed text: "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"` }
      }
      return { result: `Type failed: ${result.error}` }
    }

    case 'clear_input': {
      const selector = toolInput.selector as string
      const result = await browserAutomation.clearInput(selector)
      if (result.success) {
        return { result: `Cleared input: ${selector}` }
      }
      return { result: `Clear failed: ${result.error}` }
    }

    case 'key': {
      const key = toolInput.key as string
      const modifiers = {
        ctrl: toolInput.ctrl as boolean,
        shift: toolInput.shift as boolean,
        alt: toolInput.alt as boolean
      }
      const result = await browserAutomation.pressKey(key, modifiers)
      if (result.success) {
        return { result: `Pressed key: ${key}` }
      }
      return { result: `Key press failed: ${result.error}` }
    }

    case 'navigate': {
      const url = toolInput.url as string
      const result = await browserAutomation.navigateTo(url)
      if (result.success) {
        await browserAutomation.wait(1000)
        return { result: `Navigated to: ${url}` }
      }
      return { result: `Navigation failed: ${result.error}` }
    }

    case 'wait': {
      const ms = toolInput.ms as number
      await browserAutomation.wait(ms)
      return { result: `Waited ${ms}ms` }
    }

    case 'wait_for_element': {
      const selector = toolInput.selector as string
      const timeout = (toolInput.timeout as number) || 10000
      const result = await browserAutomation.waitForElement(selector, timeout)
      if (result.success && result.found) {
        return { result: `Element found: ${selector}` }
      } else if (result.success && !result.found) {
        return { result: `Element not found within timeout: ${selector}` }
      }
      return { result: `Wait failed: ${result.error}` }
    }

    case 'focus': {
      const selector = toolInput.selector as string
      const result = await browserAutomation.focusElement(selector)
      if (result.success) {
        return { result: `Focused element: ${selector}` }
      }
      return { result: `Focus failed: ${result.error}` }
    }

    case 'select_text': {
      const selector = toolInput.selector as string
      const result = await browserAutomation.selectText(selector)
      if (result.success) {
        return { result: `Selected text: "${result.text?.slice(0, 50)}${(result.text?.length || 0) > 50 ? '...' : ''}"` }
      }
      return { result: `Select failed: ${result.error}` }
    }

    case 'get_selected_text': {
      const result = await browserAutomation.getSelectedText()
      if (result.success) {
        return { result: `Selected text: "${result.text || '(empty)'}"` }
      }
      return { result: `Get selected text failed: ${result.error}` }
    }

    case 'get_input_value': {
      const selector = toolInput.selector as string
      const result = await browserAutomation.getInputValue(selector)
      if (result.success) {
        return { result: `Input value: "${result.value || ''}"` }
      }
      return { result: `Get input value failed: ${result.error}` }
    }

    case 'get_page_info': {
      const info = await browserAutomation.getPageInfo()
      return {
        result: JSON.stringify(info, null, 2)
      }
    }

    case 'get_elements': {
      const selector = toolInput.selector as string | undefined
      const elements = await browserAutomation.getDOMElements(selector)
      const visibleElements = elements.filter(el => el.isVisible).slice(0, 50)
      return {
        result: `Found ${visibleElements.length} visible elements:\n${JSON.stringify(
          visibleElements.map(el => ({
            tag: el.tagName,
            id: el.id,
            class: el.className?.toString().slice(0, 50),
            text: el.text?.slice(0, 30),
            x: Math.round(el.rect.x),
            y: Math.round(el.rect.y),
            w: Math.round(el.rect.width),
            h: Math.round(el.rect.height)
          })),
          null,
          2
        )}`
      }
    }

    case 'execute_script': {
      const code = toolInput.code as string
      const result = await browserAutomation.executeScript(code)
      if (result.success) {
        const resultStr = typeof result.result === 'string'
          ? result.result
          : JSON.stringify(result.result, null, 2)
        return { result: `Script executed. Result: ${resultStr?.slice(0, 500) || '(no output)'}` }
      }
      return { result: `Script execution failed: ${result.error}` }
    }

    case 'done': {
      const summary = toolInput.summary as string
      return { result: `Task completed: ${summary}` }
    }

    // DOM Reading Tools
    case 'get_element_text': {
      const selector = toolInput.selector as string
      const result = await browserAutomation.getElementText(selector)
      if (result.success) {
        return { result: `Text content: "${result.text?.slice(0, 500) || '(empty)'}"` }
      }
      return { result: `Get text failed: ${result.error}` }
    }

    case 'get_element_html': {
      const selector = toolInput.selector as string
      const outer = (toolInput.outer as boolean) || false
      const result = await browserAutomation.getElementHTML(selector, outer)
      if (result.success) {
        return { result: `HTML content:\n${result.html?.slice(0, 1000) || '(empty)'}${(result.html?.length || 0) > 1000 ? '...' : ''}` }
      }
      return { result: `Get HTML failed: ${result.error}` }
    }

    case 'get_element_attribute': {
      const selector = toolInput.selector as string
      const attribute = toolInput.attribute as string
      const result = await browserAutomation.getElementAttribute(selector, attribute)
      if (result.success) {
        return { result: `Attribute "${attribute}": ${result.value === null ? '(not set)' : `"${result.value}"`}` }
      }
      return { result: `Get attribute failed: ${result.error}` }
    }

    case 'get_all_attributes': {
      const selector = toolInput.selector as string
      const result = await browserAutomation.getAllAttributes(selector)
      if (result.success) {
        return { result: `Attributes:\n${JSON.stringify(result.attributes, null, 2)}` }
      }
      return { result: `Get attributes failed: ${result.error}` }
    }

    case 'get_computed_styles': {
      const selector = toolInput.selector as string
      const propsString = toolInput.properties as string | undefined
      const properties = propsString ? propsString.split(',').map(p => p.trim()) : undefined
      const result = await browserAutomation.getComputedStyles(selector, properties)
      if (result.success) {
        return { result: `Computed styles:\n${JSON.stringify(result.styles, null, 2)}` }
      }
      return { result: `Get styles failed: ${result.error}` }
    }

    case 'get_element_rect': {
      const selector = toolInput.selector as string
      const result = await browserAutomation.getElementRect(selector)
      if (result.success) {
        return { result: `Element rect:\n${JSON.stringify(result.rect, null, 2)}` }
      }
      return { result: `Get rect failed: ${result.error}` }
    }

    case 'query_elements': {
      const selector = toolInput.selector as string
      const limit = (toolInput.limit as number) || 20
      const result = await browserAutomation.queryElements(selector, limit)
      if (result.success) {
        return { result: `Found ${result.elements?.length || 0} elements:\n${JSON.stringify(result.elements, null, 2)}` }
      }
      return { result: `Query elements failed: ${result.error}` }
    }

    case 'element_exists': {
      const selector = toolInput.selector as string
      const result = await browserAutomation.elementExists(selector)
      if (result.success) {
        return { result: `Element "${selector}" ${result.exists ? 'exists' : 'does not exist'}` }
      }
      return { result: `Check failed: ${result.error}` }
    }

    case 'get_element_count': {
      const selector = toolInput.selector as string
      const result = await browserAutomation.getElementCount(selector)
      if (result.success) {
        return { result: `Found ${result.count} element(s) matching "${selector}"` }
      }
      return { result: `Count failed: ${result.error}` }
    }

    case 'get_parent_element': {
      const selector = toolInput.selector as string
      const result = await browserAutomation.getParentElement(selector)
      if (result.success) {
        if (result.parent) {
          return { result: `Parent element:\n${JSON.stringify(result.parent, null, 2)}` }
        }
        return { result: 'No parent element found' }
      }
      return { result: `Get parent failed: ${result.error}` }
    }

    case 'get_child_elements': {
      const selector = toolInput.selector as string
      const limit = (toolInput.limit as number) || 10
      const result = await browserAutomation.getChildElements(selector, limit)
      if (result.success) {
        return { result: `Found ${result.children?.length || 0} child elements:\n${JSON.stringify(result.children, null, 2)}` }
      }
      return { result: `Get children failed: ${result.error}` }
    }

    case 'get_property': {
      const selector = toolInput.selector as string
      const property = toolInput.property as string
      const result = await browserAutomation.getProperty(selector, property)
      if (result.success) {
        return { result: `Property "${property}": ${JSON.stringify(result.value)}` }
      }
      return { result: `Get property failed: ${result.error}` }
    }

    // DOM Manipulation Tools
    case 'set_attribute': {
      const selector = toolInput.selector as string
      const attribute = toolInput.attribute as string
      const value = toolInput.value as string
      const result = await browserAutomation.setAttribute(selector, attribute, value)
      if (result.success) {
        return { result: `Set attribute "${attribute}" = "${value}" on ${selector}` }
      }
      return { result: `Set attribute failed: ${result.error}` }
    }

    case 'remove_attribute': {
      const selector = toolInput.selector as string
      const attribute = toolInput.attribute as string
      const result = await browserAutomation.removeAttribute(selector, attribute)
      if (result.success) {
        return { result: `Removed attribute "${attribute}" from ${selector}` }
      }
      return { result: `Remove attribute failed: ${result.error}` }
    }

    case 'add_class': {
      const selector = toolInput.selector as string
      const className = toolInput.class_name as string
      const result = await browserAutomation.addClass(selector, className)
      if (result.success) {
        return { result: `Added class "${className}" to ${selector}` }
      }
      return { result: `Add class failed: ${result.error}` }
    }

    case 'remove_class': {
      const selector = toolInput.selector as string
      const className = toolInput.class_name as string
      const result = await browserAutomation.removeClass(selector, className)
      if (result.success) {
        return { result: `Removed class "${className}" from ${selector}` }
      }
      return { result: `Remove class failed: ${result.error}` }
    }

    case 'toggle_class': {
      const selector = toolInput.selector as string
      const className = toolInput.class_name as string
      const result = await browserAutomation.toggleClass(selector, className)
      if (result.success) {
        return { result: `Toggled class "${className}" on ${selector}. Has class: ${result.hasClass}` }
      }
      return { result: `Toggle class failed: ${result.error}` }
    }

    case 'set_style': {
      const selector = toolInput.selector as string
      const property = toolInput.property as string
      const value = toolInput.value as string
      const result = await browserAutomation.setStyle(selector, property, value)
      if (result.success) {
        return { result: `Set style "${property}: ${value}" on ${selector}` }
      }
      return { result: `Set style failed: ${result.error}` }
    }

    case 'scroll_into_view': {
      const selector = toolInput.selector as string
      const behavior = toolInput.behavior as 'auto' | 'smooth' | undefined
      const block = toolInput.block as 'start' | 'center' | 'end' | 'nearest' | undefined
      const result = await browserAutomation.scrollIntoView(selector, { behavior, block })
      if (result.success) {
        return { result: `Scrolled element "${selector}" into view` }
      }
      return { result: `Scroll into view failed: ${result.error}` }
    }

    case 'set_property': {
      const selector = toolInput.selector as string
      const property = toolInput.property as string
      const valueStr = toolInput.value as string
      // Parse value: handle booleans and numbers
      let value: unknown = valueStr
      if (valueStr === 'true') value = true
      else if (valueStr === 'false') value = false
      else if (!isNaN(Number(valueStr)) && valueStr !== '') value = Number(valueStr)
      const result = await browserAutomation.setProperty(selector, property, value)
      if (result.success) {
        return { result: `Set property "${property}" = ${JSON.stringify(value)} on ${selector}` }
      }
      return { result: `Set property failed: ${result.error}` }
    }

    default:
      return { result: `Unknown tool: ${toolName}` }
  }
}

/**
 * Call Claude API
 */
async function callClaudeAPI(
  config: AgentConfig,
  messages: AgentMessage[],
  tools: ToolDefinition[]
): Promise<{
  content: AgentContentBlock[]
  stop_reason: string
}> {
  const client = new Anthropic({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    dangerouslyAllowBrowser: true,
    defaultHeaders: {
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    }
  })

  const response = await client.messages.create({
    model: config.model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: tools as any,
    messages: messages as any
  })

  return {
    content: response.content as AgentContentBlock[],
    stop_reason: response.stop_reason || 'end_turn'
  }
}

/**
 * Run the AI Agent to complete a task
 */
export async function runAgent(
  config: AgentConfig,
  task: string,
  onStatus: AgentStatusCallback,
  abortSignal?: AbortSignal
): Promise<{ success: boolean; steps: AgentStep[]; error?: string }> {
  const steps: AgentStep[] = []
  const messages: AgentMessage[] = []
  let stepCount = 0
  const maxSteps = 30

  messages.push({
    role: 'user',
    content: `Task: ${task}\n\nStart by taking a screenshot to see the current state of the browser.`
  })

  while (stepCount < maxSteps) {
    if (abortSignal?.aborted) {
      return { success: false, steps, error: 'Task was cancelled' }
    }

    stepCount++
    onStatus({ step: stepCount, message: 'Thinking...' })

    let response
    try {
      response = await callClaudeAPI(config, messages, BROWSER_TOOLS)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      log.error('Claude API call failed:', errorMessage)
      return { success: false, steps, error: errorMessage }
    }

    const step: AgentStep = {}
    const assistantContent: AgentContentBlock[] = []

    for (const block of response.content) {
      if (block.type === 'text') {
        step.thinking = block.text
        assistantContent.push(block)
        onStatus({ step: stepCount, message: 'Thinking...', thinking: block.text })
      } else if (block.type === 'tool_use') {
        assistantContent.push(block)

        const toolName = block.name!
        const toolInput = block.input as Record<string, unknown>

        step.action = {
          type: toolName as AgentAction['type'],
          params: toolInput
        }

        onStatus({
          step: stepCount,
          message: `Executing: ${toolName}`,
          thinking: step.thinking,
          action: step.action
        })

        if (toolName === 'done') {
          step.result = toolInput.summary as string
          steps.push(step)
          messages.push({ role: 'assistant', content: assistantContent })
          return { success: true, steps }
        }

        try {
          const toolResult = await executeTool(toolName, toolInput)
          step.result = toolResult.result

          if (toolResult.screenshot) {
            step.screenshot = toolResult.screenshot
            onStatus({
              step: stepCount,
              message: `Completed: ${toolName}`,
              thinking: step.thinking,
              action: step.action,
              screenshot: toolResult.screenshot
            })
          }

          messages.push({ role: 'assistant', content: assistantContent })

          const toolResultContent: AgentContentBlock[] = [
            {
              type: 'tool_result',
              tool_use_id: block.id!,
              content: toolResult.result
            }
          ]

          if (toolResult.screenshot) {
            toolResultContent.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: toolResult.screenshot
              }
            })
          }

          messages.push({ role: 'user', content: toolResultContent })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          step.error = errorMessage
          log.error(`Tool ${toolName} failed:`, errorMessage)

          messages.push({ role: 'assistant', content: assistantContent })
          messages.push({
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: block.id!,
                content: `Error: ${errorMessage}`,
                is_error: true
              }
            ]
          })
        }
      }
    }

    steps.push(step)

    if (response.stop_reason === 'end_turn' && !response.content.some(b => b.type === 'tool_use')) {
      return { success: true, steps }
    }
  }

  return { success: false, steps, error: 'Maximum steps reached' }
}

/**
 * Validate agent configuration
 */
export function validateConfig(config: Partial<AgentConfig>): { valid: boolean; error?: string } {
  if (!config.apiKey || config.apiKey.trim() === '') {
    return { valid: false, error: 'API Key is required' }
  }

  if (!config.baseUrl || config.baseUrl.trim() === '') {
    return { valid: false, error: 'Base URL is required' }
  }

  try {
    new URL(config.baseUrl)
  } catch {
    return { valid: false, error: 'Invalid Base URL format' }
  }

  if (!config.model || config.model.trim() === '') {
    return { valid: false, error: 'Model is required' }
  }

  return { valid: true }
}
