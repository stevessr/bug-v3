export const logger = {
  log: (...args: any[]) => {
    try {
      console.log(...args)
    } catch (_) {}
  },
  error: (...args: any[]) => {
    try {
      console.error(...args)
    } catch (_) {}
  },
  warn: (...args: any[]) => {
    try {
      console.warn(...args)
    } catch (_) {}
  },
}
