/**
 * AI Agent Service - Claude API Integration for Browser Automation
 * Uses Claude's computer use capabilities to control the browser
 */

import Anthropic from '@anthropic-ai/sdk'

import { createLogger } from '@/utils/logger'
import * as browserAutomation from '@/utils/browserAutomation'
import type { McpServerConfig } from '@/types/type'

const log = createLogger('AIAgentService')

export interface AgentConfig {
  apiKey: string
  baseUrl: string
  model: string
  imageModel?: string
  maxTokens?: number
  mcpServers?: McpServerConfig[]
  targetTabId?: number // Target tab ID for popup window mode
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
    // Tab Management
    | 'get_all_tabs'
    | 'get_active_tab'
    | 'create_tab'
    | 'close_tab'
    | 'switch_tab'
    | 'duplicate_tab'
    | 'reload_tab'
    | 'go_back'
    | 'go_forward'
    | 'pin_tab'
    | 'mute_tab'
    // Window Management
    | 'get_all_windows'
    | 'create_window'
    | 'close_window'
    | 'focus_window'
    // Storage
    | 'get_local_storage'
    | 'set_local_storage'
    | 'remove_local_storage'
    | 'get_local_storage_keys'
    | 'clear_local_storage'
    | 'get_session_storage'
    | 'set_session_storage'
    // Cookies
    | 'get_cookies'
    | 'set_cookie'
    | 'delete_cookie'
    // Clipboard
    | 'copy_to_clipboard'
    | 'read_clipboard'
    // Console
    | 'get_console_logs'
    | 'start_console_capture'
    // Performance
    | 'get_performance_timing'
    | 'get_resource_timing'
    // Forms
    | 'get_form_data'
    | 'fill_form'
    | 'submit_form'
    // Other
    | 'dismiss_dialog'
    | 'get_zoom'
    | 'set_zoom'
    | 'trigger_print'
    | 'done'
    | 'spawn_subagent'
    | 'wait_for_subagents'
  params?: Record<string, unknown>
}

export interface AgentStep {
  thinking?: string
  action?: AgentAction
  result?: string
  screenshot?: string
  error?: string
  subagentId?: string // For subagent steps
  subagentTask?: string // Task description for subagent
}

export interface SubagentStatus {
  id: string
  task: string
  status: 'running' | 'completed' | 'failed'
  steps: AgentStep[]
  result?: string
  error?: string
}

export type AgentStatusCallback = (status: {
  step: number
  message: string
  thinking?: string
  action?: AgentAction
  screenshot?: string
  subagents?: SubagentStatus[]
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
        timeout: {
          type: 'number',
          description: 'Maximum wait time in milliseconds (default: 10000)'
        }
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
        property: {
          type: 'string',
          description: 'Property name to get (e.g., checked, disabled, value)'
        }
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
        class_name: {
          type: 'string',
          description: 'Class name(s) to add (space-separated for multiple)'
        }
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
        class_name: {
          type: 'string',
          description: 'Class name(s) to remove (space-separated for multiple)'
        }
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
        property: {
          type: 'string',
          description: 'CSS property name (e.g., color, display, width)'
        },
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
        behavior: {
          type: 'string',
          description: 'Scroll behavior: auto or smooth',
          enum: ['auto', 'smooth']
        },
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
  // Chrome Tab Management Tools
  {
    name: 'get_all_tabs',
    description: 'Get a list of all open browser tabs with their IDs, URLs, and titles',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_active_tab',
    description: 'Get information about the currently active tab',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'create_tab',
    description: 'Create a new browser tab',
    input_schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL to open in the new tab (optional, defaults to new tab page)'
        },
        active: {
          type: 'boolean',
          description: 'Whether to make the new tab active (default: false, opens in background)'
        }
      },
      required: []
    }
  },
  {
    name: 'close_tab',
    description: 'Close a browser tab by ID',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'number', description: 'ID of the tab to close' }
      },
      required: ['tab_id']
    }
  },
  {
    name: 'switch_tab',
    description: 'Switch to a specific tab by ID',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'number', description: 'ID of the tab to switch to' }
      },
      required: ['tab_id']
    }
  },
  {
    name: 'duplicate_tab',
    description: 'Duplicate the current active tab',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: {
          type: 'number',
          description: 'ID of the tab to duplicate (optional, defaults to active tab)'
        }
      },
      required: []
    }
  },
  {
    name: 'reload_tab',
    description: 'Reload a browser tab',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: {
          type: 'number',
          description: 'ID of the tab to reload (optional, defaults to active tab)'
        },
        bypass_cache: { type: 'boolean', description: 'Whether to bypass cache (default: false)' }
      },
      required: []
    }
  },
  {
    name: 'go_back',
    description: 'Navigate back in the current tab history',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'go_forward',
    description: 'Navigate forward in the current tab history',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'pin_tab',
    description: 'Pin or unpin a browser tab',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'number', description: 'ID of the tab to pin/unpin' },
        pinned: { type: 'boolean', description: 'Whether to pin (true) or unpin (false) the tab' }
      },
      required: ['tab_id', 'pinned']
    }
  },
  {
    name: 'mute_tab',
    description: 'Mute or unmute a browser tab',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'number', description: 'ID of the tab to mute/unmute' },
        muted: { type: 'boolean', description: 'Whether to mute (true) or unmute (false) the tab' }
      },
      required: ['tab_id', 'muted']
    }
  },
  // Chrome Window Management Tools
  {
    name: 'get_all_windows',
    description: 'Get a list of all browser windows',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'create_window',
    description: 'Create a new browser window',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to open in the new window (optional)' },
        incognito: { type: 'boolean', description: 'Create incognito window (default: false)' }
      },
      required: []
    }
  },
  {
    name: 'close_window',
    description: 'Close a browser window by ID',
    input_schema: {
      type: 'object',
      properties: {
        window_id: { type: 'number', description: 'ID of the window to close' }
      },
      required: ['window_id']
    }
  },
  {
    name: 'focus_window',
    description: 'Focus a browser window by ID',
    input_schema: {
      type: 'object',
      properties: {
        window_id: { type: 'number', description: 'ID of the window to focus' }
      },
      required: ['window_id']
    }
  },
  // Chrome Storage Tools
  {
    name: 'get_local_storage',
    description: 'Get a value from localStorage',
    input_schema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Key to get from localStorage' }
      },
      required: ['key']
    }
  },
  {
    name: 'set_local_storage',
    description: 'Set a value in localStorage',
    input_schema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Key to set in localStorage' },
        value: { type: 'string', description: 'Value to store' }
      },
      required: ['key', 'value']
    }
  },
  {
    name: 'remove_local_storage',
    description: 'Remove a key from localStorage',
    input_schema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Key to remove from localStorage' }
      },
      required: ['key']
    }
  },
  {
    name: 'get_local_storage_keys',
    description: 'Get all keys from localStorage',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'clear_local_storage',
    description: 'Clear all localStorage data',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_session_storage',
    description: 'Get a value from sessionStorage',
    input_schema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Key to get from sessionStorage' }
      },
      required: ['key']
    }
  },
  {
    name: 'set_session_storage',
    description: 'Set a value in sessionStorage',
    input_schema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Key to set in sessionStorage' },
        value: { type: 'string', description: 'Value to store' }
      },
      required: ['key', 'value']
    }
  },
  // Chrome Cookie Tools
  {
    name: 'get_cookies',
    description: 'Get cookies for a URL',
    input_schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL to get cookies for (optional, defaults to current page)'
        }
      },
      required: []
    }
  },
  {
    name: 'set_cookie',
    description: 'Set a cookie',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to set cookie for' },
        name: { type: 'string', description: 'Cookie name' },
        value: { type: 'string', description: 'Cookie value' },
        domain: { type: 'string', description: 'Cookie domain (optional)' },
        path: { type: 'string', description: 'Cookie path (optional, defaults to /)' },
        secure: { type: 'boolean', description: 'Secure cookie (optional)' },
        http_only: { type: 'boolean', description: 'HttpOnly cookie (optional)' }
      },
      required: ['url', 'name', 'value']
    }
  },
  {
    name: 'delete_cookie',
    description: 'Delete a cookie',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL the cookie is associated with' },
        name: { type: 'string', description: 'Name of the cookie to delete' }
      },
      required: ['url', 'name']
    }
  },
  // Clipboard Tools
  {
    name: 'copy_to_clipboard',
    description: 'Copy text to the clipboard',
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to copy to clipboard' }
      },
      required: ['text']
    }
  },
  {
    name: 'read_clipboard',
    description: 'Read text from the clipboard',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  // Console Tools
  {
    name: 'get_console_logs',
    description: 'Get captured console logs (must call start_console_capture first)',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'start_console_capture',
    description: 'Start capturing console logs on the page',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  // Performance Tools
  {
    name: 'get_performance_timing',
    description: 'Get page performance timing metrics',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_resource_timing',
    description: 'Get resource timing entries for loaded resources',
    input_schema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of resources to return (default: 50)'
        }
      },
      required: []
    }
  },
  // Form Tools
  {
    name: 'get_form_data',
    description: 'Get all form data from a form element',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the form element' }
      },
      required: ['selector']
    }
  },
  {
    name: 'fill_form',
    description: 'Fill a form with provided data',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the form element' },
        data: {
          type: 'string',
          description: 'JSON object with field names as keys and values to fill'
        }
      },
      required: ['selector', 'data']
    }
  },
  {
    name: 'submit_form',
    description: 'Submit a form',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the form element' }
      },
      required: ['selector']
    }
  },
  // Other Chrome Tools
  {
    name: 'dismiss_dialog',
    description: 'Dismiss a JavaScript dialog (alert, confirm, prompt)',
    input_schema: {
      type: 'object',
      properties: {
        accept: { type: 'boolean', description: 'Accept (true) or dismiss (false) the dialog' }
      },
      required: ['accept']
    }
  },
  {
    name: 'get_zoom',
    description: 'Get the current zoom level of the page',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'set_zoom',
    description: 'Set the zoom level of the current tab',
    input_schema: {
      type: 'object',
      properties: {
        zoom_factor: { type: 'number', description: 'Zoom factor (1.0 = 100%, 1.5 = 150%, etc.)' }
      },
      required: ['zoom_factor']
    }
  },
  {
    name: 'trigger_print',
    description: 'Trigger the browser print dialog',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
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
  },
  {
    name: 'spawn_subagent',
    description:
      'Spawn a subagent to perform a specific task in parallel. Multiple subagents can run simultaneously. Each subagent has its own browser tab context. Use this for tasks that can be parallelized.',
    input_schema: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'The specific task for the subagent to complete'
        },
        tab_id: {
          type: 'number',
          description: 'Optional: specific tab ID for the subagent to work in'
        },
        max_steps: {
          type: 'number',
          description: 'Maximum steps for the subagent (default: 10)'
        }
      },
      required: ['task']
    }
  },
  {
    name: 'wait_for_subagents',
    description: 'Wait for all running subagents to complete and get their results',
    input_schema: {
      type: 'object',
      properties: {
        subagent_ids: {
          type: 'string',
          description:
            'Optional: comma-separated list of subagent IDs to wait for. If not provided, waits for all.'
        }
      },
      required: []
    }
  }
]

/**
 * MCP Tool definition from server
 */
interface McpTool {
  name: string
  description?: string
  inputSchema: {
    type: 'object'
    properties?: Record<string, unknown>
    required?: string[]
  }
}

/**
 * MCP Client for SSE/Streamable HTTP connections
 */
class McpClient {
  private serverConfig: McpServerConfig
  private tools: McpTool[] = []

  constructor(config: McpServerConfig) {
    this.serverConfig = config
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream'
    }
    if (this.serverConfig.apiKey) {
      headers['Authorization'] = `Bearer ${this.serverConfig.apiKey}`
    }
    if (this.serverConfig.headers) {
      Object.assign(headers, this.serverConfig.headers)
    }
    return headers
  }

  /**
   * Initialize connection and fetch available tools
   */
  async initialize(): Promise<McpTool[]> {
    try {
      if (this.serverConfig.type === 'sse') {
        return await this.initializeSSE()
      } else {
        return await this.initializeStreamableHttp()
      }
    } catch (error) {
      log.error(`Failed to initialize MCP server ${this.serverConfig.name}:`, error)
      return []
    }
  }

  private async initializeSSE(): Promise<McpTool[]> {
    // For SSE, we need to establish a connection first, then send initialize
    const initResponse = await fetch(this.serverConfig.url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'bug-emoji-agent', version: '1.0.0' }
        }
      })
    })

    if (!initResponse.ok) {
      throw new Error(`Initialize failed: ${initResponse.status}`)
    }

    // Parse init result (we don't need sessionId for now, but verify response is valid)
    await initResponse.json()

    // Fetch tools list
    const toolsResponse = await fetch(this.serverConfig.url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      })
    })

    if (!toolsResponse.ok) {
      throw new Error(`Tools list failed: ${toolsResponse.status}`)
    }

    const toolsResult = await toolsResponse.json()
    this.tools = toolsResult.result?.tools || []
    return this.tools
  }

  private async initializeStreamableHttp(): Promise<McpTool[]> {
    // Streamable HTTP uses standard HTTP POST for all operations
    const initResponse = await fetch(this.serverConfig.url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'bug-emoji-agent', version: '1.0.0' }
        }
      })
    })

    if (!initResponse.ok) {
      throw new Error(`Initialize failed: ${initResponse.status}`)
    }

    // Parse init result (we don't need sessionId for now, but verify response is valid)
    await initResponse.json()

    // Fetch tools list
    const toolsResponse = await fetch(this.serverConfig.url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      })
    })

    if (!toolsResponse.ok) {
      throw new Error(`Tools list failed: ${toolsResponse.status}`)
    }

    const toolsResult = await toolsResponse.json()
    this.tools = toolsResult.result?.tools || []
    return this.tools
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<{ content: Array<{ type: string; text?: string }> }> {
    const response = await fetch(this.serverConfig.url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Tool call failed: ${response.status}`)
    }

    const result = await response.json()
    if (result.error) {
      throw new Error(result.error.message || 'Tool call failed')
    }

    return result.result
  }

  getTools(): McpTool[] {
    return this.tools
  }

  getServerName(): string {
    return this.serverConfig.name
  }
}

/**
 * Convert MCP tools to Anthropic tool format
 */
function convertMcpToolsToAnthropicFormat(
  mcpTools: McpTool[],
  serverName: string
): ToolDefinition[] {
  return mcpTools.map(tool => ({
    name: `mcp_${serverName}_${tool.name}`,
    description: tool.description || `MCP tool from ${serverName}`,
    input_schema: {
      type: 'object' as const,
      properties:
        (tool.inputSchema?.properties as Record<string, { type: string; description: string }>) ||
        {},
      required: tool.inputSchema?.required || []
    }
  }))
}

/**
 * Initialize MCP clients and fetch all tools
 */
async function initializeMcpClients(servers: McpServerConfig[]): Promise<Map<string, McpClient>> {
  const clients = new Map<string, McpClient>()

  const enabledServers = servers.filter(s => s.enabled)

  await Promise.all(
    enabledServers.map(async server => {
      try {
        const client = new McpClient(server)
        await client.initialize()
        clients.set(server.name, client)
        log.info(`MCP server ${server.name} initialized with ${client.getTools().length} tools`)
      } catch (error) {
        log.error(`Failed to initialize MCP server ${server.name}:`, error)
      }
    })
  )

  return clients
}

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

**Tab Management:**
- get_all_tabs: Get list of all open tabs
- get_active_tab: Get the currently active tab
- create_tab: Create a new tab (opens in background by default to avoid disrupting current workflow)
- close_tab: Close a tab by ID
- switch_tab: Switch to a specific tab
- duplicate_tab: Duplicate a tab
- reload_tab: Reload a tab
- go_back: Navigate back in history
- go_forward: Navigate forward in history
- pin_tab: Pin or unpin a tab
- mute_tab: Mute or unmute a tab

**Window Management:**
- get_all_windows: Get list of all windows
- create_window: Create a new window
- close_window: Close a window
- focus_window: Focus a window

**Storage (localStorage/sessionStorage):**
- get_local_storage: Get localStorage item
- set_local_storage: Set localStorage item
- remove_local_storage: Remove localStorage item
- get_local_storage_keys: Get all localStorage keys
- clear_local_storage: Clear localStorage
- get_session_storage: Get sessionStorage item
- set_session_storage: Set sessionStorage item

**Cookies:**
- get_cookies: Get cookies for a URL
- set_cookie: Set a cookie
- delete_cookie: Delete a cookie

**Clipboard:**
- copy_to_clipboard: Copy text to clipboard
- read_clipboard: Read from clipboard

**Console & Performance:**
- start_console_capture: Start capturing console logs
- get_console_logs: Get captured console logs
- get_performance_timing: Get page performance metrics
- get_resource_timing: Get resource loading timings

**Forms:**
- get_form_data: Get form data
- fill_form: Fill form fields
- submit_form: Submit a form

**Other:**
- dismiss_dialog: Dismiss JavaScript dialogs
- get_zoom: Get current zoom level
- set_zoom: Set zoom level
- trigger_print: Trigger print dialog

**Subagent (Parallel Execution):**
- spawn_subagent: Spawn a subagent to run a task in parallel. Useful for parallelizing work across multiple tabs.
- wait_for_subagents: Wait for all running subagents to complete and get their results.

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
  toolInput: Record<string, unknown>,
  targetTabId?: number
): Promise<{ result: string; screenshot?: string }> {
  log.info(`Executing tool: ${toolName}`, toolInput)

  // If targetTabId is specified, switch to that tab first for tab-affecting operations
  if (targetTabId !== undefined) {
    const needsTabSwitch = [
      'screenshot',
      'click',
      'double_click',
      'right_click',
      'click_element',
      'hover',
      'drag',
      'scroll',
      'type',
      'clear_input',
      'key',
      'navigate',
      'wait_for_element',
      'focus',
      'select_text',
      'get_selected_text',
      'get_input_value',
      'get_page_info',
      'get_elements',
      'execute_script',
      'get_element_text',
      'get_element_html',
      'get_element_attribute',
      'get_all_attributes',
      'set_element_attribute',
      'remove_element_attribute',
      'add_class',
      'remove_class',
      'toggle_class',
      'highlight_element',
      'inject_css',
      'get_form_data',
      'fill_form',
      'submit_form'
    ].includes(toolName)

    if (needsTabSwitch) {
      try {
        await browserAutomation.switchToTab(targetTabId)
      } catch (e) {
        log.warn(`Failed to switch to target tab ${targetTabId}:`, e)
      }
    }
  }

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
        return {
          result: `Selected text: "${result.text?.slice(0, 50)}${(result.text?.length || 0) > 50 ? '...' : ''}"`
        }
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
        const resultStr =
          typeof result.result === 'string' ? result.result : JSON.stringify(result.result, null, 2)
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
        return {
          result: `HTML content:\n${result.html?.slice(0, 1000) || '(empty)'}${(result.html?.length || 0) > 1000 ? '...' : ''}`
        }
      }
      return { result: `Get HTML failed: ${result.error}` }
    }

    case 'get_element_attribute': {
      const selector = toolInput.selector as string
      const attribute = toolInput.attribute as string
      const result = await browserAutomation.getElementAttribute(selector, attribute)
      if (result.success) {
        return {
          result: `Attribute "${attribute}": ${result.value === null ? '(not set)' : `"${result.value}"`}`
        }
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
        return {
          result: `Found ${result.elements?.length || 0} elements:\n${JSON.stringify(result.elements, null, 2)}`
        }
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
        return {
          result: `Found ${result.children?.length || 0} child elements:\n${JSON.stringify(result.children, null, 2)}`
        }
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
        return {
          result: `Toggled class "${className}" on ${selector}. Has class: ${result.hasClass}`
        }
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

    // Chrome Tab Management
    case 'get_all_tabs': {
      const result = await browserAutomation.getAllTabs()
      if (result.success) {
        return { result: `Tabs:\n${JSON.stringify(result.tabs, null, 2)}` }
      }
      return { result: `Get tabs failed: ${result.error}` }
    }

    case 'get_active_tab': {
      const result = await browserAutomation.getActiveTab()
      if (result.success) {
        return { result: `Active tab:\n${JSON.stringify(result.tab, null, 2)}` }
      }
      return { result: `Get active tab failed: ${result.error}` }
    }

    case 'create_tab': {
      const url = toolInput.url as string | undefined
      // Default to inactive to prevent sidebar reload when switching tabs
      const active = (toolInput.active as boolean) ?? false
      const result = await browserAutomation.createTab(url, active)
      if (result.success) {
        return {
          result: `Created new tab with ID: ${result.tabId}, URL: ${result.url || '(new tab)'}, Title: ${result.title || '(loading)'}`
        }
      }
      return { result: `Create tab failed: ${result.error}` }
    }

    case 'close_tab': {
      const tabId = toolInput.tab_id as number
      const result = await browserAutomation.closeTab(tabId)
      if (result.success) {
        return { result: `Closed tab: ${tabId}` }
      }
      return { result: `Close tab failed: ${result.error}` }
    }

    case 'switch_tab': {
      const tabId = toolInput.tab_id as number
      const result = await browserAutomation.switchToTab(tabId)
      if (result.success) {
        return { result: `Switched to tab: ${tabId}` }
      }
      return { result: `Switch tab failed: ${result.error}` }
    }

    case 'duplicate_tab': {
      const tabId = toolInput.tab_id as number | undefined
      // If no tabId provided, get active tab
      let targetTabId = tabId
      if (targetTabId === undefined) {
        const activeResult = await browserAutomation.getActiveTab()
        if (activeResult.success && activeResult.tab?.id) {
          targetTabId = activeResult.tab.id
        } else {
          return { result: 'Duplicate tab failed: No tab ID provided and could not get active tab' }
        }
      }
      const result = await browserAutomation.duplicateTab(targetTabId)
      if (result.success) {
        return { result: `Duplicated tab, new tab ID: ${result.newTabId}` }
      }
      return { result: `Duplicate tab failed: ${result.error}` }
    }

    case 'reload_tab': {
      const tabId = toolInput.tab_id as number | undefined
      const bypassCache = (toolInput.bypass_cache as boolean) || false
      const result = await browserAutomation.reloadTab(tabId, bypassCache)
      if (result.success) {
        return { result: `Reloaded tab${tabId ? ` ${tabId}` : ''}` }
      }
      return { result: `Reload tab failed: ${result.error}` }
    }

    case 'go_back': {
      const result = await browserAutomation.goBack()
      if (result.success) {
        return { result: 'Navigated back' }
      }
      return { result: `Go back failed: ${result.error}` }
    }

    case 'go_forward': {
      const result = await browserAutomation.goForward()
      if (result.success) {
        return { result: 'Navigated forward' }
      }
      return { result: `Go forward failed: ${result.error}` }
    }

    case 'pin_tab': {
      const tabId = toolInput.tab_id as number
      const pinned = toolInput.pinned as boolean
      const result = await browserAutomation.pinTab(tabId, pinned)
      if (result.success) {
        return { result: `${pinned ? 'Pinned' : 'Unpinned'} tab: ${tabId}` }
      }
      return { result: `Pin tab failed: ${result.error}` }
    }

    case 'mute_tab': {
      const tabId = toolInput.tab_id as number
      const muted = toolInput.muted as boolean
      const result = await browserAutomation.muteTab(tabId, muted)
      if (result.success) {
        return { result: `${muted ? 'Muted' : 'Unmuted'} tab: ${tabId}` }
      }
      return { result: `Mute tab failed: ${result.error}` }
    }

    // Chrome Window Management
    case 'get_all_windows': {
      const result = await browserAutomation.getAllWindows()
      if (result.success) {
        return { result: `Windows:\n${JSON.stringify(result.windows, null, 2)}` }
      }
      return { result: `Get windows failed: ${result.error}` }
    }

    case 'create_window': {
      const url = toolInput.url as string | undefined
      const incognito = toolInput.incognito as boolean | undefined
      // Use 'popup' type for incognito-like behavior, 'normal' otherwise
      const windowType = incognito ? 'popup' : 'normal'
      const result = await browserAutomation.createWindow(url, windowType)
      if (result.success) {
        return { result: `Created new window with ID: ${result.windowId}` }
      }
      return { result: `Create window failed: ${result.error}` }
    }

    case 'close_window': {
      const windowId = toolInput.window_id as number
      const result = await browserAutomation.closeWindow(windowId)
      if (result.success) {
        return { result: `Closed window: ${windowId}` }
      }
      return { result: `Close window failed: ${result.error}` }
    }

    case 'focus_window': {
      const windowId = toolInput.window_id as number
      const result = await browserAutomation.focusWindow(windowId)
      if (result.success) {
        return { result: `Focused window: ${windowId}` }
      }
      return { result: `Focus window failed: ${result.error}` }
    }

    // Chrome Storage
    case 'get_local_storage': {
      const key = toolInput.key as string
      const result = await browserAutomation.getLocalStorageItem(key)
      if (result.success) {
        return {
          result: `localStorage["${key}"]: ${result.value === null ? '(not set)' : JSON.stringify(result.value)}`
        }
      }
      return { result: `Get localStorage failed: ${result.error}` }
    }

    case 'set_local_storage': {
      const key = toolInput.key as string
      const value = toolInput.value as string
      const result = await browserAutomation.setLocalStorageItem(key, value)
      if (result.success) {
        return { result: `Set localStorage["${key}"] = ${JSON.stringify(value)}` }
      }
      return { result: `Set localStorage failed: ${result.error}` }
    }

    case 'remove_local_storage': {
      const key = toolInput.key as string
      const result = await browserAutomation.removeLocalStorageItem(key)
      if (result.success) {
        return { result: `Removed localStorage["${key}"]` }
      }
      return { result: `Remove localStorage failed: ${result.error}` }
    }

    case 'get_local_storage_keys': {
      const result = await browserAutomation.getLocalStorageKeys()
      if (result.success) {
        return { result: `localStorage keys: ${JSON.stringify(result.keys)}` }
      }
      return { result: `Get localStorage keys failed: ${result.error}` }
    }

    case 'clear_local_storage': {
      const result = await browserAutomation.clearLocalStorage()
      if (result.success) {
        return { result: 'Cleared localStorage' }
      }
      return { result: `Clear localStorage failed: ${result.error}` }
    }

    case 'get_session_storage': {
      const key = toolInput.key as string
      const result = await browserAutomation.getSessionStorageItem(key)
      if (result.success) {
        return {
          result: `sessionStorage["${key}"]: ${result.value === null ? '(not set)' : JSON.stringify(result.value)}`
        }
      }
      return { result: `Get sessionStorage failed: ${result.error}` }
    }

    case 'set_session_storage': {
      const key = toolInput.key as string
      const value = toolInput.value as string
      const result = await browserAutomation.setSessionStorageItem(key, value)
      if (result.success) {
        return { result: `Set sessionStorage["${key}"] = ${JSON.stringify(value)}` }
      }
      return { result: `Set sessionStorage failed: ${result.error}` }
    }

    // Chrome Cookies
    case 'get_cookies': {
      const url = toolInput.url as string | undefined
      const result = await browserAutomation.getCookies(url)
      if (result.success) {
        return { result: `Cookies:\n${JSON.stringify(result.cookies, null, 2)}` }
      }
      return { result: `Get cookies failed: ${result.error}` }
    }

    case 'set_cookie': {
      const url = toolInput.url as string
      const name = toolInput.name as string
      const value = toolInput.value as string
      const result = await browserAutomation.setCookie(name, value, {
        domain: toolInput.domain as string | undefined,
        path: toolInput.path as string | undefined,
        secure: toolInput.secure as boolean | undefined,
        httpOnly: toolInput.http_only as boolean | undefined
      })
      if (result.success) {
        return { result: `Set cookie "${name}" = "${value}" for ${url}` }
      }
      return { result: `Set cookie failed: ${result.error}` }
    }

    case 'delete_cookie': {
      const url = toolInput.url as string
      const name = toolInput.name as string
      const result = await browserAutomation.deleteCookie(url, name)
      if (result.success) {
        return { result: `Deleted cookie "${name}"` }
      }
      return { result: `Delete cookie failed: ${result.error}` }
    }

    // Clipboard
    case 'copy_to_clipboard': {
      const text = toolInput.text as string
      const result = await browserAutomation.copyToClipboard(text)
      if (result.success) {
        return {
          result: `Copied to clipboard: "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"`
        }
      }
      return { result: `Copy to clipboard failed: ${result.error}` }
    }

    case 'read_clipboard': {
      const result = await browserAutomation.readFromClipboard()
      if (result.success) {
        return { result: `Clipboard content: "${result.text || '(empty)'}"` }
      }
      return { result: `Read clipboard failed: ${result.error}` }
    }

    // Console
    case 'start_console_capture': {
      const result = await browserAutomation.startConsoleCapture()
      if (result.success) {
        return { result: 'Started capturing console logs' }
      }
      return { result: `Start console capture failed: ${result.error}` }
    }

    case 'get_console_logs': {
      const result = await browserAutomation.getConsoleLogs()
      if (result.success) {
        return {
          result: `Console logs (${result.logs?.length || 0}):\n${JSON.stringify(result.logs, null, 2)}`
        }
      }
      return { result: `Get console logs failed: ${result.error}` }
    }

    // Performance
    case 'get_performance_timing': {
      const result = await browserAutomation.getPerformanceTiming()
      if (result.success) {
        return { result: `Performance timing:\n${JSON.stringify(result.timing, null, 2)}` }
      }
      return { result: `Get performance timing failed: ${result.error}` }
    }

    case 'get_resource_timing': {
      const limit = (toolInput.limit as number) || 50
      const result = await browserAutomation.getResourceTiming(limit)
      if (result.success) {
        return {
          result: `Resource timing (${result.resources?.length || 0} entries):\n${JSON.stringify(result.resources, null, 2)}`
        }
      }
      return { result: `Get resource timing failed: ${result.error}` }
    }

    // Forms
    case 'get_form_data': {
      const selector = toolInput.selector as string
      const result = await browserAutomation.getFormData(selector)
      if (result.success) {
        return { result: `Form data:\n${JSON.stringify(result.data, null, 2)}` }
      }
      return { result: `Get form data failed: ${result.error}` }
    }

    case 'fill_form': {
      const selector = toolInput.selector as string
      const dataStr = toolInput.data as string
      let data: Record<string, string>
      try {
        data = JSON.parse(dataStr)
      } catch {
        return { result: 'Fill form failed: Invalid JSON data' }
      }
      const result = await browserAutomation.fillForm(selector, data)
      if (result.success) {
        return { result: `Filled form with ${Object.keys(data).length} fields` }
      }
      return { result: `Fill form failed: ${result.error}` }
    }

    case 'submit_form': {
      const selector = toolInput.selector as string
      const result = await browserAutomation.submitForm(selector)
      if (result.success) {
        return { result: `Submitted form: ${selector}` }
      }
      return { result: `Submit form failed: ${result.error}` }
    }

    // Other Chrome tools
    case 'dismiss_dialog': {
      const result = await browserAutomation.dismissDialog()
      if (result.success) {
        return { result: 'Dismissed dialog' }
      }
      return { result: `Dismiss dialog failed: ${result.error}` }
    }

    case 'get_zoom': {
      const result = await browserAutomation.getZoom()
      if (result.success) {
        return { result: `Current zoom level: ${(result.zoomFactor || 1) * 100}%` }
      }
      return { result: `Get zoom failed: ${result.error}` }
    }

    case 'set_zoom': {
      const zoomFactor = toolInput.zoom_factor as number
      const result = await browserAutomation.setZoom(zoomFactor)
      if (result.success) {
        return { result: `Set zoom to ${zoomFactor * 100}%` }
      }
      return { result: `Set zoom failed: ${result.error}` }
    }

    case 'trigger_print': {
      const result = await browserAutomation.triggerPrint()
      if (result.success) {
        return { result: 'Triggered print dialog' }
      }
      return { result: `Trigger print failed: ${result.error}` }
    }

    default:
      return { result: `Unknown tool: ${toolName}` }
  }
}

/**
 * Call Claude API with retry logic for 429 errors
 */
async function callClaudeAPI(
  config: AgentConfig,
  messages: AgentMessage[],
  tools: ToolDefinition[],
  maxRetries: number = 3
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

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.messages.create({
        model: config.model,
        max_tokens: config.maxTokens || 8192,
        system: SYSTEM_PROMPT,
        tools: tools as any,
        messages: messages as any
      })

      return {
        content: response.content as AgentContentBlock[],
        stop_reason: response.stop_reason || 'end_turn'
      }
    } catch (error) {
      lastError = error as Error

      // Check for 429 rate limit error
      const errorMessage = String(error)
      const is429 =
        errorMessage.includes('429') ||
        errorMessage.includes('rate_limit') ||
        errorMessage.includes('Rate limit') ||
        (error as any)?.status === 429

      if (is429 && attempt < maxRetries) {
        // Extract retry-after header if available, otherwise use exponential backoff
        let waitTime = Math.min(1000 * Math.pow(2, attempt), 60000) // max 60 seconds

        // Try to parse retry-after from error
        const retryAfterMatch = errorMessage.match(/retry[- ]?after[:\s]+(\d+)/i)
        if (retryAfterMatch) {
          waitTime = parseInt(retryAfterMatch[1], 10) * 1000
        }

        log.info(
          `Rate limited (429), waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`
        )
        await new Promise(resolve => setTimeout(resolve, waitTime))
        continue
      }

      // For non-429 errors or max retries reached, throw
      throw error
    }
  }

  // Should not reach here, but just in case
  throw lastError || new Error('Max retries reached')
}

/**
 * Image description prompt for screenshot analysis
 */
const IMAGE_DESCRIPTION_PROMPT = `You are analyzing a browser screenshot for an AI automation agent.

Describe what you see in the screenshot in a structured way:
1. **Page Type**: What kind of page is this? (login page, form, article, dashboard, etc.)
2. **Key Elements**: List important interactive elements (buttons, links, input fields, menus)
3. **Current State**: Describe any visible state (errors, loading, selected items, etc.)
4. **Layout**: Brief description of the page layout and structure
5. **Action Suggestions**: What actions might be relevant on this page?

Be concise but comprehensive. Focus on elements that would be useful for browser automation.`

/**
 * Describe a screenshot using the image model
 */
async function describeScreenshot(config: AgentConfig, screenshotBase64: string): Promise<string> {
  const imageModel = config.imageModel || config.model

  const client = new Anthropic({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    dangerouslyAllowBrowser: true,
    defaultHeaders: {
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    }
  })

  try {
    const response = await client.messages.create({
      model: imageModel,
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: screenshotBase64
              }
            },
            {
              type: 'text',
              text: IMAGE_DESCRIPTION_PROMPT
            }
          ]
        }
      ]
    })

    const textBlock = response.content.find(block => block.type === 'text')
    return textBlock && 'text' in textBlock ? textBlock.text : 'Unable to describe screenshot'
  } catch (error) {
    log.error('Failed to describe screenshot:', error)
    return 'Error describing screenshot'
  }
}

/**
 * Subagent runner - runs a task in a specific tab context
 */
async function runSubagent(
  config: AgentConfig,
  task: string,
  subagentId: string,
  tabId: number | undefined,
  maxSteps: number,
  allTools: ToolDefinition[],
  mcpClients: Map<string, McpClient>,
  abortSignal?: AbortSignal
): Promise<SubagentStatus> {
  const subagentStatus: SubagentStatus = {
    id: subagentId,
    task,
    status: 'running',
    steps: []
  }

  const messages: AgentMessage[] = []
  let stepCount = 0

  // If tabId specified, switch to that tab first
  if (tabId !== undefined) {
    await browserAutomation.switchToTab(tabId)
  }

  messages.push({
    role: 'user',
    content: `Subagent Task: ${task}\n\nYou are a subagent running in parallel. Complete this specific task and report back.\nStart by taking a screenshot to see the current state.`
  })

  try {
    while (stepCount < maxSteps) {
      if (abortSignal?.aborted) {
        subagentStatus.status = 'failed'
        subagentStatus.error = 'Cancelled'
        return subagentStatus
      }

      stepCount++

      const response = await callClaudeAPI(config, messages, allTools)
      const step: AgentStep = { subagentId }
      const assistantContent: AgentContentBlock[] = []

      for (const block of response.content) {
        if (block.type === 'text') {
          step.thinking = block.text
          assistantContent.push(block)
        } else if (block.type === 'tool_use') {
          assistantContent.push(block)

          const toolName = block.name!
          const toolInput = block.input as Record<string, unknown>

          step.action = {
            type: toolName as AgentAction['type'],
            params: toolInput
          }

          if (toolName === 'done') {
            step.result = toolInput.summary as string
            subagentStatus.steps.push(step)
            subagentStatus.status = 'completed'
            subagentStatus.result = toolInput.summary as string
            return subagentStatus
          }

          // Skip subagent spawning from within subagent
          if (toolName === 'spawn_subagent' || toolName === 'wait_for_subagents') {
            step.result = 'Subagents cannot spawn other subagents'
            messages.push({ role: 'assistant', content: assistantContent })
            messages.push({
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: block.id!,
                  content:
                    'Subagents cannot spawn other subagents. Please complete the task directly.'
                }
              ]
            })
            continue
          }

          try {
            let toolResult: { result: string; screenshot?: string }

            if (toolName.startsWith('mcp_')) {
              const parts = toolName.split('_')
              if (parts.length >= 3) {
                const serverName = parts[1]
                const mcpToolName = parts.slice(2).join('_')
                const client = mcpClients.get(serverName)

                if (client) {
                  const mcpResult = await client.callTool(mcpToolName, toolInput)
                  const textContent = mcpResult.content
                    .filter(c => c.type === 'text' && c.text)
                    .map(c => c.text)
                    .join('\n')
                  toolResult = { result: textContent || 'Tool executed successfully' }
                } else {
                  toolResult = { result: `MCP server ${serverName} not found` }
                }
              } else {
                toolResult = { result: `Invalid MCP tool name: ${toolName}` }
              }
            } else {
              toolResult = await executeTool(toolName, toolInput, tabId)
            }

            step.result = toolResult.result
            if (toolResult.screenshot) {
              step.screenshot = toolResult.screenshot
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

      subagentStatus.steps.push(step)
    }

    // Max steps reached
    subagentStatus.status = 'completed'
    subagentStatus.result = 'Max steps reached'
    return subagentStatus
  } catch (error) {
    subagentStatus.status = 'failed'
    subagentStatus.error = error instanceof Error ? error.message : String(error)
    return subagentStatus
  }
}

/**
 * Run the AI Agent to complete a task
 */
export async function runAgent(
  config: AgentConfig,
  task: string,
  onStatus: AgentStatusCallback,
  abortSignal?: AbortSignal,
  maxSteps: number = 30
): Promise<{ success: boolean; steps: AgentStep[]; error?: string }> {
  const steps: AgentStep[] = []
  const messages: AgentMessage[] = []
  let stepCount = 0

  // Initialize MCP clients if configured
  let mcpClients = new Map<string, McpClient>()
  let allTools: ToolDefinition[] = [...BROWSER_TOOLS]

  if (config.mcpServers && config.mcpServers.length > 0) {
    onStatus({ step: 0, message: 'Initializing MCP servers...' })
    try {
      mcpClients = await initializeMcpClients(config.mcpServers)

      // Add MCP tools to the tools list
      for (const [serverName, client] of mcpClients) {
        const mcpTools = convertMcpToolsToAnthropicFormat(client.getTools(), serverName)
        allTools = [...allTools, ...mcpTools]
        log.info(`Added ${mcpTools.length} tools from MCP server: ${serverName}`)
      }
    } catch (error) {
      log.error('Failed to initialize MCP clients:', error)
      // Continue without MCP tools
    }
  }

  messages.push({
    role: 'user',
    content: `Task: ${task}\n\nStart by taking a screenshot to see the current state of the browser.`
  })

  // Track running subagents
  const runningSubagents = new Map<string, Promise<SubagentStatus>>()
  const completedSubagents = new Map<string, SubagentStatus>()
  let subagentCounter = 0

  while (stepCount < maxSteps) {
    if (abortSignal?.aborted) {
      return { success: false, steps, error: 'Task was cancelled' }
    }

    stepCount++
    onStatus({ step: stepCount, message: 'Thinking...' })

    let response
    try {
      response = await callClaudeAPI(config, messages, allTools)
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
          let toolResult: { result: string; screenshot?: string }

          // Check if this is an MCP tool (prefixed with mcp_)
          if (toolName.startsWith('mcp_')) {
            // Parse MCP tool name: mcp_<serverName>_<toolName>
            const parts = toolName.split('_')
            if (parts.length >= 3) {
              const serverName = parts[1]
              const mcpToolName = parts.slice(2).join('_')
              const client = mcpClients.get(serverName)

              if (client) {
                const mcpResult = await client.callTool(mcpToolName, toolInput)
                // Convert MCP result to our format
                const textContent = mcpResult.content
                  .filter(c => c.type === 'text' && c.text)
                  .map(c => c.text)
                  .join('\n')
                toolResult = { result: textContent || 'Tool executed successfully' }
              } else {
                toolResult = { result: `MCP server ${serverName} not found` }
              }
            } else {
              toolResult = { result: `Invalid MCP tool name: ${toolName}` }
            }
          } else {
            // Execute built-in browser tool
            toolResult = await executeTool(toolName, toolInput, config.targetTabId)

            // If this is a screenshot and imageModel is configured, add description
            if (
              toolName === 'screenshot' &&
              toolResult.screenshot &&
              config.imageModel &&
              config.imageModel !== config.model
            ) {
              try {
                const description = await describeScreenshot(config, toolResult.screenshot)
                toolResult.result = `Screenshot captured.\n\n**Image Analysis:**\n${description}`
              } catch {
                // Keep original result if description fails
              }
            }
          }

          // Handle subagent tools
          if (toolName === 'spawn_subagent') {
            const subagentTask = toolInput.task as string
            const tabId = toolInput.tab_id as number | undefined
            const subagentMaxSteps = (toolInput.max_steps as number) || 10

            subagentCounter++
            const subagentId = `subagent_${subagentCounter}`

            // Spawn subagent in background
            const subagentPromise = runSubagent(
              config,
              subagentTask,
              subagentId,
              tabId,
              subagentMaxSteps,
              allTools,
              mcpClients,
              abortSignal
            )

            runningSubagents.set(subagentId, subagentPromise)

            step.subagentId = subagentId
            step.subagentTask = subagentTask

            toolResult = {
              result: `Spawned subagent ${subagentId} for task: "${subagentTask}". Use wait_for_subagents to get results.`
            }

            // Update status with subagent info
            const subagentStatuses = Array.from(completedSubagents.values())
            for (const [id] of runningSubagents) {
              subagentStatuses.push({
                id,
                task: id === subagentId ? subagentTask : 'Running...',
                status: 'running',
                steps: []
              })
            }
            onStatus({
              step: stepCount,
              message: `Spawned ${subagentId}`,
              thinking: step.thinking,
              action: step.action,
              subagents: subagentStatuses
            })
          } else if (toolName === 'wait_for_subagents') {
            const subagentIdsStr = toolInput.subagent_ids as string | undefined
            const idsToWait = subagentIdsStr
              ? subagentIdsStr.split(',').map(s => s.trim())
              : Array.from(runningSubagents.keys())

            const results: string[] = []

            for (const id of idsToWait) {
              const promise = runningSubagents.get(id)
              if (promise) {
                const result = await promise
                completedSubagents.set(id, result)
                runningSubagents.delete(id)
                results.push(
                  `${id}: ${result.status === 'completed' ? result.result : `Failed: ${result.error}`}`
                )
              } else {
                const completed = completedSubagents.get(id)
                if (completed) {
                  results.push(
                    `${id}: ${completed.status === 'completed' ? completed.result : `Failed: ${completed.error}`}`
                  )
                } else {
                  results.push(`${id}: Not found`)
                }
              }
            }

            toolResult = {
              result: `Subagent Results:\n${results.join('\n')}`
            }

            // Update status with completed subagents
            const subagentStatuses = Array.from(completedSubagents.values())
            for (const [id] of runningSubagents) {
              subagentStatuses.push({
                id,
                task: 'Running...',
                status: 'running',
                steps: []
              })
            }
            onStatus({
              step: stepCount,
              message: 'Subagents completed',
              thinking: step.thinking,
              action: step.action,
              subagents: subagentStatuses
            })
          }

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
