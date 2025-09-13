/* eslint-disable @typescript-eslint/no-explicit-any */
// Vite-based conditional compilation using environment variables
// These values are replaced at build time by Vite's define feature

declare global {
  const __ENABLE_LOGGING__: boolean
  const __ENABLE_INDEXEDDB__: boolean
}

// Direct Vite-based conditional compilation logger
// The conditions are evaluated at build time and dead code is eliminated
export const logger = {
  log: (...args: any[]) => {
    if (__ENABLE_LOGGING__) {
      console.log(...args)
    }
  },

  warn: (...args: any[]) => {
    if (__ENABLE_LOGGING__) {
      console.warn(...args)
    }
  },

  error: (...args: any[]) => {
    if (__ENABLE_LOGGING__) {
      console.error(...args)
    }
  },

  // Development mode logging (only in development environment)
  dev: (...args: any[]) => {
    if (__ENABLE_LOGGING__ && (import.meta as any).env?.DEV) {
      console.log('[DEV]', ...args)
    }
  }
}

// IndexedDB wrapper with Vite-based conditional compilation
export const indexedDBWrapper = {
  isEnabled: () => __ENABLE_INDEXEDDB__,

  // Check if IndexedDB operations should be skipped
  shouldSkip: () => !__ENABLE_INDEXEDDB__
}

// Legacy BUILD_FLAGS export for backward compatibility (will be removed in future)
// @deprecated Use direct __ENABLE_LOGGING__ and __ENABLE_INDEXEDDB__ instead
export const BUILD_FLAGS = {
  ENABLE_LOGGING: __ENABLE_LOGGING__,
  ENABLE_INDEXEDDB: __ENABLE_INDEXEDDB__
} as const
