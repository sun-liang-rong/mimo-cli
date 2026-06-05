// Context Window Manager - token 计数 + 滑动窗口截断 + 智能压缩

import type { Message } from '../api/types.js'
import { estimateTokens, estimateMessageTokens, estimateTotalTokens } from '../utils/tokens.js'
import { getContextWindow } from '../config/models.js'

// Re-export token utilities for tests and convenience
export { estimateTokens, estimateMessageTokens as messageTokens, estimateTotalTokens as totalTokens } from '../utils/tokens.js'

// ── Types ────────────────────────────────────────────────────────────────────

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

export interface CompressionResult {
  /** 压缩后的消息 */
  messages: Message[]
  /** 生成的摘要 */
  summary: string
  /** 节省的 token 数 */
  tokensSaved: number
  /** 压缩前的 token 数 */
  tokensBefore: number
  /** 压缩后的 token 数 */
  tokensAfter: number
}

export interface CompressorConfig {
  /** 目标 token 数 (压缩到这个数量以下) */
  targetTokens: number
  /** 保留最近的消息数量 */
  preserveRecent: number
  /** 是否保留所有系统消息 */
  preserveSystem: boolean
  /** 是否保留工具调用结果 */
  preserveToolResults: boolean
  /** 摘要的最大长度 (字符) */
  maxSummaryLength: number
}

// ── Default configs ──────────────────────────────────────────────────────────

const DEFAULT_MANAGER_CONFIG: ContextManagerConfig = {
  maxContextTokens: 32000,
  systemPromptReserve: 2000,
  toolsReserve: 2000,
  minRecentMessages: 4,
}

const DEFAULT_COMPRESSOR_CONFIG: CompressorConfig = {
  targetTokens: 16000,
  preserveRecent: 6,
  preserveSystem: true,
  preserveToolResults: true,
  maxSummaryLength: 500,
}

// ── Compression helper functions (internal) ──────────────────────────────────

function extractKeyInfo(msg: Message): string {
  if (msg.role === 'user') {
    return msg.content?.slice(0, 100) || ''
  }

  if (msg.role === 'assistant') {
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      const tools = msg.tool_calls.map(tc => tc.function.name).join(', ')
      return `[Used tools: ${tools}]`
    }
    return msg.content?.slice(0, 100) || ''
  }

  if (msg.role === 'tool') {
    const result = msg.content || ''
    if (result.startsWith('Error:')) {
      return `[Tool error: ${result.slice(0, 80)}]`
    }
    return `[Tool result: ${result.slice(0, 80)}...]`
  }

  return ''
}

function generateSummary(messages: Message[], maxLength: number): string {
  const keyPoints: string[] = []

  const userMessages = messages.filter(m => m.role === 'user')
  if (userMessages.length > 0) {
    const firstUser = userMessages[0].content || ''
    keyPoints.push(`User asked: ${firstUser.slice(0, 100)}`)
  }

  const toolCalls = new Set<string>()
  for (const msg of messages) {
    if (msg.role === 'assistant' && msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        toolCalls.add(tc.function.name)
      }
    }
  }
  if (toolCalls.size > 0) {
    keyPoints.push(`Tools used: ${Array.from(toolCalls).join(', ')}`)
  }

  const errors = messages.filter(m =>
    m.role === 'tool' && m.content?.startsWith('Error:')
  )
  if (errors.length > 0) {
    keyPoints.push(`Errors: ${errors.length} tool errors occurred`)
  }

  let summary = keyPoints.join('. ')
  if (summary.length > maxLength) {
    summary = summary.slice(0, maxLength - 3) + '...'
  }

  return summary || 'Previous conversation context'
}

// ── Standalone compressMessages (compatible with old compression.ts API) ─────

/**
 * 智能压缩消息列表
 */
export function compressMessages(
  messages: Message[],
  config: Partial<CompressorConfig> = {}
): CompressionResult {
  const cfg = { ...DEFAULT_COMPRESSOR_CONFIG, ...config }

  const tokensBefore = estimateTotalTokens(messages)

  if (tokensBefore <= cfg.targetTokens) {
    return {
      messages,
      summary: '',
      tokensSaved: 0,
      tokensBefore,
      tokensAfter: tokensBefore,
    }
  }

  const systemMessages = messages.filter(m => m.role === 'system')
  const recentMessages = messages.slice(-cfg.preserveRecent)
  const middleMessages = messages.slice(
    systemMessages.length,
    messages.length - cfg.preserveRecent
  )

  const systemTokens = estimateTotalTokens(systemMessages)
  const recentTokens = estimateTotalTokens(recentMessages)
  const reservedTokens = systemTokens + recentTokens

  if (reservedTokens >= cfg.targetTokens) {
    const result = [...systemMessages, ...recentMessages]
    return {
      messages: result,
      summary: generateSummary(middleMessages, cfg.maxSummaryLength),
      tokensSaved: tokensBefore - reservedTokens,
      tokensBefore,
      tokensAfter: reservedTokens,
    }
  }

  const middleBudget = cfg.targetTokens - reservedTokens

  const keptMiddle: Message[] = []
  let usedTokens = 0

  for (let i = middleMessages.length - 1; i >= 0; i--) {
    const msg = middleMessages[i]
    const msgTokens = estimateMessageTokens(msg)

    const shouldPreserve = cfg.preserveSystem && msg.role === 'system'
      || cfg.preserveToolResults && msg.role === 'tool'

    if (shouldPreserve || usedTokens + msgTokens <= middleBudget) {
      keptMiddle.unshift(msg)
      usedTokens += msgTokens
    }

    if (usedTokens >= middleBudget) break
  }

  const compressedMessages = middleMessages.filter(m => !keptMiddle.includes(m))
  const summary = generateSummary(compressedMessages, cfg.maxSummaryLength)

  const result: Message[] = [
    ...systemMessages,
    ...(compressedMessages.length > 0 ? [{
      role: 'system' as const,
      content: `[Context compressed: ${summary}]`,
    }] : []),
    ...keptMiddle,
    ...recentMessages,
  ]

  const tokensAfter = estimateTotalTokens(result)

  return {
    messages: result,
    summary,
    tokensSaved: tokensBefore - tokensAfter,
    tokensBefore,
    tokensAfter,
  }
}

/**
 * 快速压缩 - 使用默认配置
 */
export function quickCompress(messages: Message[]): Message[] {
  return compressMessages(messages).messages
}

/**
 * 检查是否需要压缩
 */
export function needsCompression(
  messages: Message[],
  threshold: number = 0.8,
  maxTokens: number = 32000
): boolean {
  const total = estimateTotalTokens(messages)
  return total >= maxTokens * threshold
}

// ── ContextManager class ─────────────────────────────────────────────────────

export class ContextManager {
  private config: ContextManagerConfig

  constructor(modelOrConfig?: string | Partial<ContextManagerConfig>) {
    if (typeof modelOrConfig === 'string') {
      this.config = {
        ...DEFAULT_MANAGER_CONFIG,
        maxContextTokens: getContextWindow(modelOrConfig),
      }
    } else {
      this.config = { ...DEFAULT_MANAGER_CONFIG, ...modelOrConfig }
    }
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
    const current = estimateTotalTokens(messages)

    if (current <= budget) return messages

    // 分离系统消息和非系统消息
    const systemMessages = messages.filter(m => m.role === 'system')
    const nonSystemMessages = messages.filter(m => m.role !== 'system')

    // 保留最近的 minRecentMessages 条
    const recentCount = Math.min(this.config.minRecentMessages, nonSystemMessages.length)
    const recentMessages = nonSystemMessages.slice(-recentCount)
    const olderMessages = nonSystemMessages.slice(0, -recentCount)

    // 计算系统消息 + 最近消息的 token 数
    const systemTokens = estimateTotalTokens(systemMessages)
    const recentTokens = estimateTotalTokens(recentMessages)
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
      const msgTokens = estimateMessageTokens(olderMessages[i])
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
    const current = estimateTotalTokens(messages)
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

    // 提取关键主题 (用户消息的前40字符)
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
    const current = estimateTotalTokens(messages)

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

  /**
   * 检查是否需要压缩 (静态方法)
   */
  static needsCompression = needsCompression

  getConfig(): ContextManagerConfig {
    return { ...this.config }
  }
}
