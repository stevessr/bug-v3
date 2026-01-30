/**
 * Shared constants for content scripts
 * Centralizes magic numbers and repeated values
 */

/**
 * Z-index hierarchy for content script UI elements
 * Higher values appear above lower values
 */
export const Z_INDEX = {
  /** Floating buttons on page (add emoji, etc.) */
  FLOATING_BUTTON: 100000,
  /** Modals and dialogs */
  MODAL: 100001,
  /** Modal backdrop/overlay */
  MODAL_BACKDROP: 100000,
  /** Resize handles for draggable elements */
  RESIZE_HANDLE: 100002,
  /** Notification toasts */
  NOTIFICATION: 2147483647,
  /** Agent overlay (highest priority) */
  AGENT_OVERLAY: 2147483647,
  /** Dialog components */
  DIALOG: 2147483646,
  /** Picker UI */
  PICKER: 10000,
  /** Picker overlay */
  PICKER_OVERLAY: 10001,
  /** Context menus */
  MENU: 10000
} as const

/**
 * Common timing constants (in milliseconds)
 */
export const TIMING = {
  /** Debounce for DOM scanning after mutations */
  SCAN_DEBOUNCE: 120,
  /** Delay before initial scan on page load */
  INITIAL_SCAN_DELAY: 100,
  /** Feedback message display duration */
  FEEDBACK_DURATION: 1500,
  /** Extended feedback duration for errors */
  FEEDBACK_DURATION_LONG: 3000
} as const

/**
 * Common button styles
 */
export const BUTTON_STYLES = {
  /** Base style for floating add-emoji buttons */
  ADD_EMOJI_BASE: `
    cursor: pointer;
    border-radius: 6px;
    padding: 6px 8px;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    border: none;
    font-weight: 700;
    transition: opacity 0.2s;
  `
    .replace(/\s+/g, ' ')
    .trim()
} as const
