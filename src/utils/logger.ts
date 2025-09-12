// Enhanced Logging System with Compile-time Log Level Control
// Provides comprehensive logging for message passing and communication debugging

// Ambient declarations for extension APIs
declare const chrome: any

// Compile-time log level configuration
// This will be replaced by Vite's define plugin during build
const COMPILE_TIME_LOG_LEVEL = (globalThis as any).__LOG_LEVEL__ || 'INFO'

// Log levels (higher number = more verbose)
export enum LogLevel {
  ERROR = 0, // Only critical errors
  WARN = 1, // Warnings and errors
  INFO = 2, // General information, warnings, and errors
  DEBUG = 3, // Detailed debugging information
  TRACE = 4, // Very detailed tracing (message contents, etc.)
}

// Convert string log level to enum
function getLogLevelFromString(level: string): LogLevel {
  switch (level.toUpperCase()) {
    case 'ERROR':
      return LogLevel.ERROR
    case 'WARN':
      return LogLevel.WARN
    case 'INFO':
      return LogLevel.INFO
    case 'DEBUG':
      return LogLevel.DEBUG
    case 'TRACE':
      return LogLevel.TRACE
    default:
      return LogLevel.INFO
  }
}

const CURRENT_LOG_LEVEL = getLogLevelFromString(COMPILE_TIME_LOG_LEVEL)

// Logger class with context-aware logging
export class Logger {
  private context: string
  private startTime: number

  constructor(context: string) {
    this.context = context
    this.startTime = Date.now()
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= CURRENT_LOG_LEVEL
  }

  private formatMessage(level: string, message: string, ...args: any[]): [string, ...any[]] {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
    const elapsed = Date.now() - this.startTime
    const prefix = `[${timestamp}][${elapsed}ms][${this.context}][${level}]`
    return [prefix + ' ' + message, ...args]
  }

  // Error level logging (always shown unless completely disabled)
  error(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(...this.formatMessage('ERROR', message, ...args))
    }
  }

  // Warning level logging
  warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(...this.formatMessage('WARN', message, ...args))
    }
  }

  // Info level logging (general information)
  info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(...this.formatMessage('INFO', message, ...args))
    }
  }

  // Debug level logging (detailed debugging)
  debug(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(...this.formatMessage('DEBUG', message, ...args))
    }
  }

  // Trace level logging (very detailed, includes message contents)
  trace(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.TRACE)) {
      console.log(...this.formatMessage('TRACE', message, ...args))
    }
  }

  // Specialized logging methods for message passing

  // Log message sending
  messageSent(type: string, payload?: any, to?: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.debug(`📤 Sending message: ${type}`, {
        to,
        payload: this.shouldLog(LogLevel.TRACE) ? payload : '[payload hidden]',
      })
    }
  }

  // Log message receiving
  messageReceived(type: string, payload?: any, from?: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.debug(`📨 Received message: ${type}`, {
        from,
        payload: this.shouldLog(LogLevel.TRACE) ? payload : '[payload hidden]',
      })
    }
  }

  // Log message acknowledgment
  messageAcknowledged(messageId: string, success: boolean): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const status = success ? '✅' : '❌'
      this.debug(`${status} Message acknowledged: ${messageId}`)
    }
  }

  // Log storage operations
  storageOperation(operation: string, key: string, success: boolean, data?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const status = success ? '✅' : '❌'
      this.debug(
        `${status} Storage ${operation}: ${key}`,
        this.shouldLog(LogLevel.TRACE) ? data : '[data hidden]',
      )
    }
  }

  // Log connection status changes
  connectionStatus(connected: boolean, details?: string): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const status = connected ? '🟢 Connected' : '🔴 Disconnected'
      this.info(`${status}${details ? ': ' + details : ''}`)
    }
  }

  // Log performance metrics
  performance(operation: string, duration: number, details?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.debug(`⏱️ ${operation} took ${duration}ms`, details)
    }
  }

  // Log emoji operations specifically
  emojiOperation(
    operation: string,
    emojiId: string,
    groupId?: string,
    success: boolean = true,
  ): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const status = success ? '✅' : '❌'
      this.debug(`${status} Emoji ${operation}: ${emojiId}${groupId ? ` in group ${groupId}` : ''}`)
    }
  }

  // Log common emoji group operations (critical for debugging)
  commonEmojiOperation(operation: string, emojiCount?: number, success: boolean = true): void {
    if (this.shouldLog(LogLevel.INFO)) {
      // Always log common emoji operations at INFO level
      const status = success ? '✅' : '❌'
      this.info(
        `${status} Common emoji ${operation}${emojiCount !== undefined ? ` (${emojiCount} emojis)` : ''}`,
      )
    }
  }

  // Log synchronization events
  syncEvent(event: string, context: string, success: boolean = true): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const status = success ? '🔄' : '⚠️'
      this.info(`${status} Sync ${event} in ${context}`)
    }
  }

  // Create a child logger with additional context
  child(additionalContext: string): Logger {
    return new Logger(`${this.context}:${additionalContext}`)
  }
}

// Factory function to create loggers
export function createLogger(context: string): Logger {
  return new Logger(context)
}

// Global logger instances for common contexts
export const backgroundLogger = createLogger('Background')
export const popupLogger = createLogger('Popup')
export const optionsLogger = createLogger('Options')
export const contentLogger = createLogger('Content')
export const communicationLogger = createLogger('Communication')
export const storageLogger = createLogger('Storage')

// Utility function to log system information
export function logSystemInfo(): void {
  const logger = createLogger('System')
  logger.info('🚀 Enhanced Message Passing System Initialized')
  logger.info(`📊 Log Level: ${LogLevel[CURRENT_LOG_LEVEL]} (${CURRENT_LOG_LEVEL})`)
  logger.info(`🌐 User Agent: ${navigator.userAgent}`)
  logger.info(`⏰ Timestamp: ${new Date().toISOString()}`)

  // Log extension context information
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      logger.info(`🔧 Extension ID: ${chrome.runtime.id}`)
      const manifest = chrome.runtime.getManifest()
      if (manifest) {
        logger.info(`📦 Manifest Version: ${manifest.manifest_version}`)
      }
    }
  } catch (error) {
    // Ignore chrome API errors in logger
  }
}

// Export log level for conditional compilation
export { CURRENT_LOG_LEVEL, LogLevel as LOG_LEVELS }
