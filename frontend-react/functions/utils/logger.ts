/**
 * Production-safe logging utility
 *
 * Only logs in development mode to avoid performance overhead
 * and information leakage in production.
 */

type LogLevel = 'log' | 'info' | 'warn' | 'error'

interface Env {
  ENVIRONMENT?: string
}

/**
 * Logger for Cloudflare Workers/Pages Functions
 */
export class Logger {
  private isDevelopment: boolean
  private context: string

  constructor(context: string, env?: Env) {
    this.context = context
    this.isDevelopment = env?.ENVIRONMENT === 'development' || !env?.ENVIRONMENT
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString()
    return `[${timestamp}] [${level.toUpperCase()}] [${this.context}] ${message}`
  }

  log(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.log(this.formatMessage('log', message), ...args)
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.info(this.formatMessage('info', message), ...args)
    }
  }

  warn(message: string, ...args: any[]): void {
    // Always log warnings
    console.warn(this.formatMessage('warn', message), ...args)
  }

  error(message: string, ...args: any[]): void {
    // Always log errors
    console.error(this.formatMessage('error', message), ...args)
  }

  debug(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.log(this.formatMessage('log', `[DEBUG] ${message}`), ...args)
    }
  }
}

/**
 * Create a logger instance for a specific context
 */
export function createLogger(context: string, env?: Env): Logger {
  return new Logger(context, env)
}

/**
 * Browser-safe logger for frontend code
 */
export class BrowserLogger {
  private isDevelopment: boolean
  private context: string

  constructor(context: string) {
    this.context = context
    // Check if we're in development mode
    this.isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development'
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString()
    return `[${timestamp}] [${level.toUpperCase()}] [${this.context}] ${message}`
  }

  log(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.log(this.formatMessage('log', message), ...args)
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.info(this.formatMessage('info', message), ...args)
    }
  }

  warn(message: string, ...args: any[]): void {
    // Always log warnings
    console.warn(this.formatMessage('warn', message), ...args)
  }

  error(message: string, ...args: any[]): void {
    // Always log errors
    console.error(this.formatMessage('error', message), ...args)
  }

  debug(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.log(this.formatMessage('log', `[DEBUG] ${message}`), ...args)
    }
  }
}

/**
 * Create a browser logger instance
 */
export function createBrowserLogger(context: string): BrowserLogger {
  return new BrowserLogger(context)
}
