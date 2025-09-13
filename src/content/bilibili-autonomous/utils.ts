/**
 * Bilibili Autonomous Content Script Utilities
 * 提供基础工具函数和错误处理
 */

import { CONSTANTS } from './config'
import type { LogLevel } from './types'

// 统一的日志记录系统
export const logger = {
  debug: (message: string, ...args: any[]) => log('debug', message, ...args),
  info: (message: string, ...args: any[]) => log('info', message, ...args),
  warn: (message: string, ...args: any[]) => log('warn', message, ...args),
  error: (message: string, ...args: any[]) => log('error', message, ...args)
}

function log(level: LogLevel, message: string, ...args: any[]): void {
  const timestamp = new Date().toISOString().slice(11, 23)
  const prefix = `${CONSTANTS.LOG_PREFIX} [${timestamp}]`
  
  switch (level) {
    case 'debug':
      console.debug(prefix, message, ...args)
      break
    case 'info':
      console.info(prefix, message, ...args)
      break
    case 'warn':
      console.warn(prefix, message, ...args)
      break
    case 'error':
      console.error(prefix, message, ...args)
      break
  }
}

// 防抖函数
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    
    timeout = setTimeout(() => {
      func(...args)
      timeout = null
    }, wait)
  }
}

// 节流函数
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}

// 安全执行包装器
export function safeExecute<T>(
  operation: () => T,
  fallback: T,
  errorMessage?: string
): T {
  try {
    return operation()
  } catch (error) {
    if (errorMessage) {
      logger.error(errorMessage, error)
    }
    return fallback
  }
}

// 异步安全执行包装器
export async function safeExecuteAsync<T>(
  operation: () => Promise<T>,
  fallback: T,
  errorMessage?: string
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (errorMessage) {
      logger.error(errorMessage, error)
    }
    return fallback
  }
}

// 延迟执行
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// 检查元素是否可见
export function isElementVisible(element: Element): boolean {
  if (!element) return false
  
  const rect = element.getBoundingClientRect()
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= window.innerHeight &&
    rect.right <= window.innerWidth
  )
}

// 确保元素有相对定位
export function ensureRelativePositioning(element: Element): void {
  const htmlElement = element as HTMLElement
  const computedStyle = window.getComputedStyle(htmlElement)
  
  if (computedStyle.position === 'static' || !computedStyle.position) {
    htmlElement.style.position = 'relative'
  }
}

// 检查Chrome扩展API是否可用
export function isChromeApiAvailable(): boolean {
  return !!(
    (window as any).chrome?.runtime?.sendMessage &&
    typeof (window as any).chrome.runtime.sendMessage === 'function'
  )
}

// 发送消息到后台脚本
export async function sendMessageToBackground(message: any): Promise<any> {
  if (!isChromeApiAvailable()) {
    throw new Error('Chrome扩展API不可用')
  }
  
  return new Promise((resolve, reject) => {
    try {
      (window as any).chrome.runtime.sendMessage(message, (response: any) => {
        if ((window as any).chrome.runtime.lastError) {
          reject(new Error((window as any).chrome.runtime.lastError.message))
        } else {
          resolve(response)
        }
      })
    } catch (error) {
      reject(error)
    }
  })
}

// 生成随机ID
export function generateRandomId(prefix: string = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
