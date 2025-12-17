/**
 * Browser-safe logging utility
 *
 * Only logs info/debug messages in development mode to prevent
 * console spam and potential information leakage in production.
 *
 * Warnings and errors are always logged for debugging production issues.
 */

const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development'

export class Logger {
  private context: string

  constructor(context: string) {
    this.context = context
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString()
    return `[${timestamp}] [${level.toUpperCase()}] [${this.context}] ${message}`
  }

  /**
   * Log info message (development only)
   */
  log(message: string, ...args: any[]): void {
    if (isDevelopment) {
      console.log(this.formatMessage('info', message), ...args)
    }
  }

  /**
   * Log debug message (development only)
   */
  debug(message: string, ...args: any[]): void {
    if (isDevelopment) {
      console.log(this.formatMessage('debug', message), ...args)
    }
  }

  /**
   * Log info message (development only)
   * Alias for log()
   */
  info(message: string, ...args: any[]): void {
    this.log(message, ...args)
  }

  /**
   * Log warning message (always logged)
   */
  warn(message: string, ...args: any[]): void {
    console.warn(this.formatMessage('warn', message), ...args)
  }

  /**
   * Log error message (always logged)
   */
  error(message: string, ...args: any[]): void {
    console.error(this.formatMessage('error', message), ...args)
  }
}

/**
 * Create a logger instance with a context name
 *
 * @param context - The context name (e.g., component name, module name)
 * @returns Logger instance
 *
 * @example
 * const logger = createLogger('AuthStore')
 * logger.log('User logged in')
 * logger.error('Login failed', error)
 */
export function createLogger(context: string): Logger {
  return new Logger(context)
}

/**
 * Default logger for quick use
 */
export const logger = createLogger('App')
