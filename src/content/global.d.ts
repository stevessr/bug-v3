/**
 * Global type declarations for content scripts
 * Extends the Window interface with custom properties
 */

import type { PostTimingsBinder } from './discourse/utils/timingsBinder'

declare global {
  interface Window {
    /** Exposed postTimings function for linux.do pages */
    postTimings?: PostTimingsBinder

    /** Exposed autoReadAllReplies function for linux.do pages */
    autoReadAllReplies?: () => Promise<void>

    /** Exposed autoReadAllRepliesV2 function for linux.do pages */
    autoReadAllRepliesV2?: () => Promise<void>

    /** Chrome API (may not be available in all contexts) */
    chrome?: typeof globalThis.chrome

    /** EyeDropper API（屏幕取色，Chrome 95+；不支持的浏览器上相关按钮隐藏） */
    EyeDropper?: new () => {
      open: () => Promise<{ sRGBHex: string }>
    }
  }
}

export {}
