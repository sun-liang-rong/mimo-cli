// 统一调试日志 - 替代散落各处的 fs.appendFileSync

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

class Logger {
  private enabled: boolean
  private level: LogLevel
  private logFile: string | null = null

  constructor() {
    this.enabled = !!process.env.DEBUG
    this.level = (process.env.DEBUG_LEVEL as LogLevel) || 'debug'
    
    if (this.enabled) {
      const logDir = path.join(os.homedir(), '.mimo', 'logs')
      try {
        fs.mkdirSync(logDir, { recursive: true })
        this.logFile = path.join(logDir, `mimo-${new Date().toISOString().split('T')[0]}.log`)
      } catch {
        // 回退到当前目录
        this.logFile = 'mimo-debug.log'
      }
    }
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.enabled || !this.logFile) return false
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level]
  }

  private write(level: LogLevel, message: string, data?: unknown): void {
    if (!this.shouldLog(level)) return

    const timestamp = new Date().toISOString()
    const dataStr = data !== undefined
      ? ` | ${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}`
      : ''
    const line = `[${timestamp}] [${level.toUpperCase()}] ${message}${dataStr}\n`

    try {
      fs.appendFileSync(this.logFile!, line)
    } catch {
      // 日志写入失败不应影响主流程
    }
  }

  debug(message: string, data?: unknown): void {
    this.write('debug', message, data)
  }

  info(message: string, data?: unknown): void {
    this.write('info', message, data)
  }

  warn(message: string, data?: unknown): void {
    this.write('warn', message, data)
  }

  error(message: string, data?: unknown): void {
    this.write('error', message, data)
  }

  /** 获取日志文件路径 */
  getLogFile(): string | null {
    return this.logFile
  }
}

export const logger = new Logger()
