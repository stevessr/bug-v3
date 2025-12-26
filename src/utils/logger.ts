/**
 * Unified logging service for the emoji extension
 * Provides consistent logging across all contexts (background, content scripts, popup, options)
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

interface LogEntry {
  level: LogLevel
  timestamp: string
  context: string
  message: string
  data?: unknown[]
}

class Logger {
  private logLevel: LogLevel = this.getLogLevel()
  private logBuffer: LogEntry[] = []
  private maxBufferSize = 100

  private getLogLevel(): LogLevel {
    // In development, log everything
    if (process.env.NODE_ENV === 'development') {
      return LogLevel.DEBUG
    }
    // In production, only log warnings and errors
    return LogLevel.WARN
  }

  private formatMessage(level: string, context: string, message: string, data?: unknown[]): string {
    const timestamp = new Date().toISOString()
    const dataStr = data && data.length > 0 ? ` ${JSON.stringify(data)}` : ''
    return `[${timestamp}] [${level}] [${context}] ${message}${dataStr}`
  }

  private log(
    level: LogLevel,
    levelName: string,
    context: string,
    message: string,
    ...data: unknown[]
  ): void {
    if (level < this.logLevel) return

    const entry: LogEntry = {
      level,
      timestamp: new Date().toISOString(),
      context,
      message,
      data: data.length > 0 ? data : undefined
    }

    // Add to buffer
    this.logBuffer.push(entry)
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift()
    }

    // Console output
    const formattedMessage = this.formatMessage(levelName, context, message, data)

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage)
        break
      case LogLevel.INFO:
        console.log(formattedMessage)
        break
      case LogLevel.WARN:
        console.warn(formattedMessage)
        break
      case LogLevel.ERROR:
        console.error(formattedMessage)
        break
    }
  }

  debug(context: string, message: string, ...data: unknown[]): void {
    this.log(LogLevel.DEBUG, 'DEBUG', context, message, ...data)
  }

  info(context: string, message: string, ...data: unknown[]): void {
    this.log(LogLevel.INFO, 'INFO', context, message, ...data)
  }

  warn(context: string, message: string, ...data: unknown[]): void {
    this.log(LogLevel.WARN, 'WARN', context, message, ...data)
  }

  error(context: string, message: string, ...data: unknown[]): void {
    this.log(LogLevel.ERROR, 'ERROR', context, message, ...data)
  }

  /**
   * Get recent log entries
   */
  getLogs(count = 50): LogEntry[] {
    return this.logBuffer.slice(-count)
  }

  /**
   * Clear the log buffer
   */
  clearLogs(): void {
    this.logBuffer = []
  }

  /**
   * Export logs as text
   */
  exportLogs(): string {
    return this.logBuffer
      .map(entry => {
        const levelName = LogLevel[entry.level]
        const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : ''
        return `[${entry.timestamp}] [${levelName}] [${entry.context}] ${entry.message}${dataStr}`
      })
      .join('\n')
  }
}

// Singleton instance
export const logger = new Logger()

// Convenience functions with context binding
export const createLogger = (context: string) => ({
  debug: (message: string, ...data: unknown[]) => logger.debug(context, message, ...data),
  info: (message: string, ...data: unknown[]) => logger.info(context, message, ...data),
  warn: (message: string, ...data: unknown[]) => logger.warn(context, message, ...data),
  error: (message: string, ...data: unknown[]) => logger.error(context, message, ...data)
})

// Type for context-bound logger
export type ContextLogger = ReturnType<typeof createLogger>
