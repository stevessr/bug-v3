// Lightweight logger + indexedDBWrapper shim used during migration from buildFlags
// This file exports a `logger` object that forwards to console and an
// `indexedDBWrapper` that reads the build-time define `__ENABLE_INDEXEDDB__`.

declare const __ENABLE_INDEXEDDB__: boolean | undefined

export const logger = {
  log: (...args: any[]) => console.log(...args),
  warn: (...args: any[]) => console.warn(...args),
  error: (...args: any[]) => console.error(...args),
  dev: (...args: any[]) => console.debug(...args)
}

export const indexedDBWrapper = {
  isEnabled: () => (typeof __ENABLE_INDEXEDDB__ !== 'undefined' ? __ENABLE_INDEXEDDB__ : true),
  shouldSkip: () => !(typeof __ENABLE_INDEXEDDB__ !== 'undefined' ? __ENABLE_INDEXEDDB__ : true)
}
