// Utilities for background scripts
import { logger } from '../config/buildFlags'

export const getChromeAPI = () => {
  try {
    return (globalThis as any).chrome || (self as any).chrome
  } catch (e) {
    logger.error('Chrome API not available:', e)
    return null
  }
}
