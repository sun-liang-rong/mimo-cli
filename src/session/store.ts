// 会话持久化 - JSON 文件存储

import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import type { Message } from '../api/types.js'

export interface SessionData {
  id: string
  messages: Message[]
  createdAt: string
  updatedAt: string
  model: string
  summary?: string
}

export interface SessionStoreConfig {
  sessionDir: string
  maxSessions: number
}

const DEFAULT_CONFIG: SessionStoreConfig = {
  sessionDir: path.join(os.homedir(), '.mimo', 'sessions'),
  maxSessions: 50,
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

export class SessionStore {
  private config: SessionStoreConfig

  constructor(config: Partial<SessionStoreConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  private getSessionPath(id: string): string {
    return path.join(this.config.sessionDir, `${id}.json`)
  }

  /** 保存会话 */
  async save(session: SessionData): Promise<void> {
    await fs.mkdir(this.config.sessionDir, { recursive: true })
    session.updatedAt = new Date().toISOString()
    const sessionPath = this.getSessionPath(session.id)
    const tmpPath = sessionPath + '.tmp'
    const lockPath = sessionPath + '.lock'

    await this.acquireLock(lockPath)
    try {
      await fs.writeFile(tmpPath, JSON.stringify(session, null, 2), 'utf-8')
      await fs.rename(tmpPath, sessionPath)
    } finally {
      await this.releaseLock(lockPath)
    }

    await this.pruneOldSessions()
  }

  /** 获取文件锁，最多等待 5 秒 */
  private async acquireLock(lockPath: string): Promise<void> {
    const maxWait = 5000
    const interval = 50
    const deadline = Date.now() + maxWait

    while (Date.now() < deadline) {
      try {
        // Exclusive create — fails if lock already exists
        const fd = await fs.open(lockPath, 'wx')
        await fd.close()
        return
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
          // Lock held by another writer — check if stale (>5s old)
          try {
            const stat = await fs.stat(lockPath)
            if (Date.now() - stat.mtimeMs > maxWait) {
              await fs.unlink(lockPath).catch(() => {})
              continue
            }
          } catch {
            // Lock disappeared — retry immediately
            continue
          }
          await new Promise(resolve => setTimeout(resolve, interval))
        } else {
          throw err
        }
      }
    }

    // Timed out — remove stale lock and proceed
    await fs.unlink(lockPath).catch(() => {})
  }

  /** 释放文件锁 */
  private async releaseLock(lockPath: string): Promise<void> {
    await fs.unlink(lockPath).catch(() => {})
  }

  /** 加载会话 */
  async load(id: string): Promise<SessionData | null> {
    try {
      const raw = await fs.readFile(this.getSessionPath(id), 'utf-8')
      return JSON.parse(raw) as SessionData
    } catch {
      return null
    }
  }

  /** 创建新会话 */
  async create(model: string): Promise<SessionData> {
    const session: SessionData = {
      id: generateId(),
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      model,
    }
    await this.save(session)
    return session
  }

  /** 列出所有会话 (按更新时间倒序) */
  async list(): Promise<SessionData[]> {
    try {
      await fs.mkdir(this.config.sessionDir, { recursive: true })
      const files = await fs.readdir(this.config.sessionDir)
      const sessions: SessionData[] = []

      for (const file of files) {
        if (!file.endsWith('.json')) continue
        try {
          const raw = await fs.readFile(path.join(this.config.sessionDir, file), 'utf-8')
          sessions.push(JSON.parse(raw))
        } catch {
          // 跳过损坏的文件
        }
      }

      return sessions.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
    } catch {
      return []
    }
  }

  /** 获取最近的会话 */
  async getLatest(): Promise<SessionData | null> {
    const sessions = await this.list()
    return sessions[0] || null
  }

  /** 删除会话 */
  async delete(id: string): Promise<boolean> {
    try {
      await fs.unlink(this.getSessionPath(id))
      return true
    } catch {
      return false
    }
  }

  /** 清除所有会话 */
  async clearAll(): Promise<void> {
    try {
      const sessions = await this.list()
      for (const session of sessions) {
        await this.delete(session.id)
      }
    } catch {
      // 目录可能不存在
    }
  }

  /** 裁剪旧会话，保留最新的 maxSessions 个 */
  private async pruneOldSessions(): Promise<void> {
    const sessions = await this.list()
    if (sessions.length <= this.config.maxSessions) return

    const toDelete = sessions.slice(this.config.maxSessions)
    for (const session of toDelete) {
      await this.delete(session.id)
    }
  }

  getConfig(): SessionStoreConfig {
    return { ...this.config }
  }
}
