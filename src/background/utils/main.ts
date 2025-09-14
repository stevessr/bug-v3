// Utilities for background scripts


export const getChromeAPI = () => {
  try {
    return (globalThis as any).chrome || (self as any).chrome
  } catch (e) {
    console.error('Chrome API not available:', e)
    return null
  }
}
