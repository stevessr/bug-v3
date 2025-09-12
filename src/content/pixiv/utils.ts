import { LogLevel } from './types'
import { CONSTANTS } from './config'

// 日志记录类
class Logger {
  private prefix: string

  constructor(prefix: string = CONSTANTS.LOG_PREFIX) {
    this.prefix = prefix
  }

  private log(level: LogLevel, message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString()
    const formattedMessage = `${this.prefix} [${timestamp}] ${message}`

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage, ...args)
        break
      case LogLevel.INFO:
        console.log(formattedMessage, ...args)
        break
      case LogLevel.WARN:
        console.warn(formattedMessage, ...args)
        break
      case LogLevel.ERROR:
        console.error(formattedMessage, ...args)
        break
    }
  }

  debug(message: string, ...args: any[]): void {
    this.log(LogLevel.DEBUG, message, ...args)
  }

  info(message: string, ...args: any[]): void {
    this.log(LogLevel.INFO, message, ...args)
  }

  warn(message: string, ...args: any[]): void {
    this.log(LogLevel.WARN, message, ...args)
  }

  error(message: string, ...args: any[]): void {
    this.log(LogLevel.ERROR, message, ...args)
  }
}

// 创建默认日志实例
export const logger = new Logger()

// 错误处理工具函数
export class PixivError extends Error {
  public readonly code: string
  public readonly details?: any

  constructor(message: string, code: string = 'UNKNOWN_ERROR', details?: any) {
    super(message)
    this.name = 'PixivError'
    this.code = code
    this.details = details
  }
}

// 安全执行函数，捕获错误并记录
export async function safeExecute<T>(
  fn: () => Promise<T>,
  context: string,
  fallback?: T
): Promise<T | undefined> {
  try {
    return await fn()
  } catch (error) {
    logger.error(`${context} failed:`, error)
    return fallback
  }
}

// 同步版本的安全执行
export function safeExecuteSync<T>(fn: () => T, context: string, fallback?: T): T | undefined {
  try {
    return fn()
  } catch (error) {
    logger.error(`${context} failed:`, error)
    return fallback
  }
}

// 创建错误响应
export function createErrorResponse(
  message: string,
  details?: any,
  code?: string
): { success: false; error: string; details?: any; code?: string } {
  return {
    success: false,
    error: message,
    details,
    code
  }
}

// 重试执行函数
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000,
  context: string = 'Operation'
): Promise<T> {
  let lastError: any

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      logger.warn(`${context} attempt ${attempt}/${maxAttempts} failed:`, error)

      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delay))
        delay *= 2 // 指数退避
      }
    }
  }

  throw lastError
}

// 防抖函数
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// 节流函数
export function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}
