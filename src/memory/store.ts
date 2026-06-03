// Memory 系统 - 分层记忆 (user/feedback/project/reference)

import fs from 'fs/promises'
import path from 'path'
import os from 'os'

export type MemoryType = 'user' | 'feedback' | 'project' | 'reference'

export interface MemoryEntry {
  name: string
  type: MemoryType
  description: string
  content: string
  createdAt: string
  updatedAt: string
  tags: string[]
}

export interface MemoryIndex {
  entries: Array<{
    name: string
    type: MemoryType
    description: string
    file: string
  }>
}

const MEMORY_DIR = path.join(os.homedir(), '.mimo', 'memory')

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

export class MemoryStore {
  private memoryDir: string
  private indexFile: string
  private cache: Map<string, MemoryEntry> = new Map()
  private loaded = false

  constructor(memoryDir?: string) {
    this.memoryDir = memoryDir || MEMORY_DIR
    this.indexFile = path.join(this.memoryDir, 'MEMORY.md')
  }

  /** 初始化存储目录 */
  async init(): Promise<void> {
    await fs.mkdir(this.memoryDir, { recursive: true })
    await this.loadIndex()
  }

  /** 加载索引 */
  private async loadIndex(): Promise<void> {
    try {
      const indexContent = await fs.readFile(this.indexFile, 'utf-8')
      const entries = this.parseIndex(indexContent)
      for (const entry of entries) {
        const filePath = path.join(this.memoryDir, entry.file)
        try {
          const content = await fs.readFile(filePath, 'utf-8')
          const parsed = this.parseMemoryFile(content)
          this.cache.set(this.cacheKey(entry.name, entry.type), {
            name: entry.name,
            type: entry.type,
            description: entry.description,
            content: parsed.content,
            createdAt: parsed.createdAt,
            updatedAt: parsed.updatedAt,
            tags: parsed.tags,
          })
        } catch {
          // 文件损坏，跳过
        }
      }
    } catch {
      // 索引文件不存在
    }
    this.loaded = true
  }

  /** 解析 MEMORY.md 索引 */
  private parseIndex(content: string): Array<{ name: string; type: MemoryType; description: string; file: string }> {
    const entries: Array<{ name: string; type: MemoryType; description: string; file: string }> = []
    const lines = content.split('\n')

    for (const line of lines) {
      // 格式: - [Title](file.md) — description
      const match = line.match(/^- \[([^\]]+)\]\(([^)]+)\)\s*[—–-]\s*(.+)$/)
      if (match) {
        const [, name, file, description] = match
        // 从文件名推断类型
        const type = this.inferType(file)
        entries.push({ name, type, description: description.trim(), file })
      }
    }

    return entries
  }

  /** 从文件名推断记忆类型 */
  private inferType(filename: string): MemoryType {
    if (filename.startsWith('user_')) return 'user'
    if (filename.startsWith('feedback_')) return 'feedback'
    if (filename.startsWith('reference_')) return 'reference'
    if (filename.startsWith('project_')) return 'project'
    return 'project'
  }

  /** 解析记忆文件 */
  private parseMemoryFile(content: string): {
    content: string
    createdAt: string
    updatedAt: string
    tags: string[]
  } {
    let parsedContent = content
    let createdAt = new Date().toISOString()
    let updatedAt = createdAt
    const tags: string[] = []

    // 解析 frontmatter
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
    if (fmMatch) {
      const fm = fmMatch[1]
      parsedContent = fmMatch[2].trim()

      const nameMatch = fm.match(/^name:\s*(.+)$/m)
      const descMatch = fm.match(/^description:\s*(.+)$/m)
      const typeMatch = fm.match(/^type:\s*(.+)$/m)

      const createdMatch = fm.match(/^created:\s*(.+)$/m)
      if (createdMatch) createdAt = createdMatch[1].trim()

      const updatedMatch = fm.match(/^updated:\s*(.+)$/m)
      if (updatedMatch) updatedAt = updatedMatch[1].trim()

      const tagsMatch = fm.match(/^tags:\s*(.+)$/m)
      if (tagsMatch) {
        tags.push(...tagsMatch[1].split(',').map(t => t.trim()))
      }
    }

    return { content: parsedContent, createdAt, updatedAt, tags }
  }

  /** 生成缓存键 */
  private cacheKey(name: string, type: MemoryType): string {
    return `${type}:${name}`
  }

  /** 保存记忆 */
  async save(entry: Omit<MemoryEntry, 'createdAt' | 'updatedAt'>): Promise<MemoryEntry> {
    await this.init()

    const now = new Date().toISOString()
    const key = this.cacheKey(entry.name, entry.type)
    const existing = this.cache.get(key)
    const fullEntry: MemoryEntry = {
      ...entry,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    }

    // 写入文件
    const filename = `${entry.type}_${entry.name}.md`
    const filePath = path.join(this.memoryDir, filename)
    const fileContent = `---
name: ${entry.name}
description: ${entry.description}
type: ${entry.type}
created: ${fullEntry.createdAt}
updated: ${fullEntry.updatedAt}
tags: ${entry.tags.join(', ')}
---

${entry.content}`

    await fs.writeFile(filePath, fileContent, 'utf-8')
    this.cache.set(key, fullEntry)

    // 更新索引
    await this.updateIndex()

    return fullEntry
  }

  /** 读取记忆 */
  async get(name: string): Promise<MemoryEntry | null> {
    await this.init()
    // 搜索所有匹配名称的条目
    for (const entry of this.cache.values()) {
      if (entry.name === name) return entry
    }
    return null
  }

  /** 按类型查询 */
  async getByType(type: MemoryType): Promise<MemoryEntry[]> {
    await this.init()
    return Array.from(this.cache.values()).filter(e => e.type === type)
  }

  /** 搜索记忆 */
  async search(query: string): Promise<MemoryEntry[]> {
    await this.init()
    const lowerQuery = query.toLowerCase()
    return Array.from(this.cache.values()).filter(e =>
      e.name.toLowerCase().includes(lowerQuery) ||
      e.description.toLowerCase().includes(lowerQuery) ||
      e.content.toLowerCase().includes(lowerQuery) ||
      e.tags.some(t => t.toLowerCase().includes(lowerQuery))
    )
  }

  /** 列出所有记忆 */
  async list(): Promise<MemoryEntry[]> {
    await this.init()
    return Array.from(this.cache.values())
  }

  /** 删除记忆 */
  async delete(name: string): Promise<boolean> {
    await this.init()
    // 找到匹配的条目
    let foundEntry: MemoryEntry | null = null
    let foundKey = ''
    for (const [key, entry] of this.cache.entries()) {
      if (entry.name === name) {
        foundEntry = entry
        foundKey = key
        break
      }
    }
    if (!foundEntry) return false

    const filename = `${foundEntry.type}_${foundEntry.name}.md`
    try {
      await fs.unlink(path.join(this.memoryDir, filename))
    } catch {
      // 文件可能已删除
    }

    this.cache.delete(foundKey)
    await this.updateIndex()
    return true
  }

  /** 更新 MEMORY.md 索引 */
  private async updateIndex(): Promise<void> {
    const lines = ['# MiMo Memory Index', '']

    for (const entry of this.cache.values()) {
      const filename = `${entry.type}_${entry.name}.md`
      lines.push(`- [${entry.name}](${filename}) — ${entry.description}`)
    }

    await fs.writeFile(this.indexFile, lines.join('\n'), 'utf-8')
  }

  /** 导出为系统 prompt 注入格式 */
  toPromptContext(): string {
    const entries = Array.from(this.cache.values())
    if (entries.length === 0) return ''

    const sections: string[] = ['[Memory Context]']

    const byType = {
      user: entries.filter(e => e.type === 'user'),
      feedback: entries.filter(e => e.type === 'feedback'),
      project: entries.filter(e => e.type === 'project'),
      reference: entries.filter(e => e.type === 'reference'),
    }

    if (byType.user.length > 0) {
      sections.push('\nUser Profile:')
      for (const e of byType.user) sections.push(`- ${e.description}: ${e.content.slice(0, 200)}`)
    }
    if (byType.feedback.length > 0) {
      sections.push('\nFeedback:')
      for (const e of byType.feedback) sections.push(`- ${e.content.slice(0, 200)}`)
    }
    if (byType.project.length > 0) {
      sections.push('\nProject Context:')
      for (const e of byType.project) sections.push(`- ${e.description}: ${e.content.slice(0, 200)}`)
    }
    if (byType.reference.length > 0) {
      sections.push('\nReferences:')
      for (const e of byType.reference) sections.push(`- ${e.description}`)
    }

    return sections.join('\n')
  }
}
