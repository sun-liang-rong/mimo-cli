// Context Window Manager - token 计数 + 滑动窗口截断

import type { Message } from '../api/types.js'

/** 简单 token 估算: 1 token ≈ 4 字符 (英文) / 1 token ≈ 2 字符 (中文) */
export function estimateTokens(text: string): number {
  if (!text) return 0
  let count = 0
  for (const ch of text) {
    // CJK 字符算 0.5 token, 其他算 0.25 token
    count += ch.charCodeAt(0) > 0x7f ? 0.5 : 0.25
  }
  return Math.ceil(count)
}

/** 计算单条 message 的 token 数 */
export function messageTokens(msg: Message): number {
  let tokens = 4 // role + formatting overhead
  if (msg.content) tokens += estimateTokens(msg.content)
  if (msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      tokens += estimateTokens(tc.function.name) + estimateTokens(tc.function.arguments) + 4
    }
  }
  if (msg.tool_call_id) tokens += estimateTokens(msg.tool_call_id)
  if (msg.name) tokens += estimateTokens(msg.name)
  return tokens
}

/** 计算消息数组总 token 数 */
export function totalTokens(messages: Message[]): number {
  return messages.reduce((sum, msg) => sum + messageTokens(msg), 0)
}

export interface ContextManagerConfig {
  /** 最大上下文窗口 token 数 */
  maxContextTokens: number
  /** 系统 prompt 预留 token 数 */
  systemPromptReserve: number
  /** 工具定义预留 token 数 */
  toolsReserve: number
  /** 截断时保留的最近消息数 */
  minRecentMessages: number
}

const DEFAULT_CONFIG: ContextManagerConfig = {
  maxContextTokens: 32000,
  systemPromptReserve: 2000,
  toolsReserve: 2000,
  minRecentMessages: 4,
}

export class ContextManager {
  private config: ContextManagerConfig

  constructor(config: Partial<ContextManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /** 可用于历史消息的 token 预算 */
  get availableTokens(): number {
    return this.config.maxContextTokens - this.config.systemPromptReserve - this.config.toolsReserve
  }

  /**
   * 截断消息历史以适配上下文窗口。
   * 策略: 保留系统消息 + 最近 N 条消息，从中间截断旧消息。
   */
  truncateMessages(messages: Message[]): Message[] {
    const budget = this.availableTokens
    const current = totalTokens(messages)

    if (current <= budget) return messages

    // 分离系统消息和非系统消息
    const systemMessages = messages.filter(m => m.role === 'system')
    const nonSystemMessages = messages.filter(m => m.role !== 'system')

    // 保留最近的 minRecentMessages 条
    const recentCount = Math.min(this.config.minRecentMessages, nonSystemMessages.length)
    const recentMessages = nonSystemMessages.slice(-recentCount)
    const olderMessages = nonSystemMessages.slice(0, -recentCount)

    // 计算系统消息 + 最近消息的 token 数
    const systemTokens = totalTokens(systemMessages)
    const recentTokens = totalTokens(recentMessages)
    const reservedTokens = systemTokens + recentTokens

    if (reservedTokens >= budget) {
      // 即使只保留系统 + 最近消息也超预算，直接返回最近消息
      return [...systemMessages, ...recentMessages]
    }

    // 从旧消息中尽可能多地保留
    const remainingBudget = budget - reservedTokens
    const keptOlder: Message[] = []
    let usedTokens = 0

    // 从最新的旧消息开始保留 (滑动窗口)
    for (let i = olderMessages.length - 1; i >= 0; i--) {
      const msgTokens = messageTokens(olderMessages[i])
      if (usedTokens + msgTokens > remainingBudget) break
      keptOlder.unshift(olderMessages[i])
      usedTokens += msgTokens
    }

    // 如果截断了消息，在开头插入一条摘要提示
    const truncatedCount = olderMessages.length - keptOlder.length
    if (truncatedCount > 0) {
      const summaryMsg: Message = {
        role: 'system',
        content: `[Context truncated: ${truncatedCount} earlier messages omitted to fit context window]`,
      }
      return [...systemMessages, summaryMsg, ...keptOlder, ...recentMessages]
    }

    return [...systemMessages, ...keptOlder, ...recentMessages]
  }

  /**
   * 截断单条工具结果，避免超大输出占满 context
   */
  truncateToolResult(output: string, maxChars: number = 50000): string {
    if (output.length <= maxChars) return output
    const half = Math.floor(maxChars / 2)
    return output.slice(0, half) + '\n\n... [truncated] ...\n\n' + output.slice(-half)
  }

  /**
   * 检查消息是否接近上下文窗口限制
   */
  isNearLimit(messages: Message[], threshold: number = 0.9): boolean {
    const budget = this.availableTokens
    const current = totalTokens(messages)
    return current >= budget * threshold
  }

  /**
   * 生成被截断消息的摘要
   */
  summarizeTruncated(messages: Message[]): string {
    const userMessages = messages.filter(m => m.role === 'user')
    const toolNames = new Set<string>()
    let toolCount = 0

    for (const msg of messages) {
      if (msg.role === 'tool') {
        toolCount++
        if (msg.name) toolNames.add(msg.name)
      }
    }

    const parts: string[] = []
    parts.push(`${messages.length} messages (${userMessages.length} user messages)`)

    if (toolCount > 0) {
      parts.push(`${toolCount} tool calls using: ${Array.from(toolNames).join(', ')}`)
    }

    // 提取关键主题 (用户消息的前20字符)
    const topics = userMessages
      .map(m => (m.content || '').slice(0, 40).replace(/\n/g, ' '))
      .filter(Boolean)
      .slice(0, 3)

    if (topics.length > 0) {
      parts.push(`Topics: ${topics.join('; ')}`)
    }

    return parts.join('. ')
  }

  /**
   * 智能压缩: 用摘要替代截断的旧消息
   */
  compressMessages(messages: Message[]): Message[] {
    const budget = this.availableTokens
    const current = totalTokens(messages)

    if (current <= budget * 0.8) return messages

    const systemMessages = messages.filter(m => m.role === 'system')
    const nonSystemMessages = messages.filter(m => m.role !== 'system')

    // 保留最近 30% 的消息
    const recentCount = Math.max(this.config.minRecentMessages, Math.floor(nonSystemMessages.length * 0.3))
    const recentMessages = nonSystemMessages.slice(-recentCount)
    const olderMessages = nonSystemMessages.slice(0, -recentCount)

    if (olderMessages.length === 0) return messages

    // 生成摘要
    const summary = this.summarizeTruncated(olderMessages)
    const summaryMsg: Message = {
      role: 'system',
      content: `[Conversation summary: ${summary}. Earlier messages have been compressed to fit the context window.]`,
    }

    return [...systemMessages, summaryMsg, ...recentMessages]
  }

  getConfig(): ContextManagerConfig {
    return { ...this.config }
  }
}
