// 智能上下文压缩器 - 保留关键信息 + 生成摘要

import type { Message } from '../api/types.js'

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

const DEFAULT_CONFIG: CompressorConfig = {
  targetTokens: 16000,
  preserveRecent: 6,
  preserveSystem: true,
  preserveToolResults: true,
  maxSummaryLength: 500,
}

/**
 * 估算消息的 token 数
 */
function estimateMessageTokens(msg: Message): number {
  let tokens = 4 // 基础开销
  if (msg.content) {
    // 粗略估算: 1 token ≈ 4 字符 (英文) 或 2 字符 (中文)
    const cjkChars = (msg.content.match(/[\u4e00-\u9fff]/g) || []).length
    const otherChars = msg.content.length - cjkChars
    tokens += Math.ceil(cjkChars * 0.5 + otherChars * 0.25)
  }
  if (msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      tokens += 10 + Math.ceil((tc.function.arguments?.length || 0) * 0.25)
    }
  }
  return tokens
}

/**
 * 从消息中提取关键信息
 */
function extractKeyInfo(msg: Message): string {
  if (msg.role === 'user') {
    return msg.content?.slice(0, 100) || ''
  }
  
  if (msg.role === 'assistant') {
    // 提取工具调用名称
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

/**
 * 生成消息摘要
 */
function generateSummary(messages: Message[], maxLength: number): string {
  const keyPoints: string[] = []
  
  // 提取用户请求
  const userMessages = messages.filter(m => m.role === 'user')
  if (userMessages.length > 0) {
    const firstUser = userMessages[0].content || ''
    keyPoints.push(`User asked: ${firstUser.slice(0, 100)}`)
  }
  
  // 提取使用的工具
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
  
  // 提取错误
  const errors = messages.filter(m => 
    m.role === 'tool' && m.content?.startsWith('Error:')
  )
  if (errors.length > 0) {
    keyPoints.push(`Errors: ${errors.length} tool errors occurred`)
  }
  
  // 合并并截断
  let summary = keyPoints.join('. ')
  if (summary.length > maxLength) {
    summary = summary.slice(0, maxLength - 3) + '...'
  }
  
  return summary || 'Previous conversation context'
}

/**
 * 智能压缩消息列表
 */
export function compressMessages(
  messages: Message[],
  config: Partial<CompressorConfig> = {}
): CompressionResult {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  
  // 计算当前 token 数
  const tokensBefore = messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0)
  
  // 如果已经在目标范围内，不需要压缩
  if (tokensBefore <= cfg.targetTokens) {
    return {
      messages,
      summary: '',
      tokensSaved: 0,
      tokensBefore,
      tokensAfter: tokensBefore,
    }
  }
  
  // 分离消息类型
  const systemMessages = messages.filter(m => m.role === 'system')
  const recentMessages = messages.slice(-cfg.preserveRecent)
  const middleMessages = messages.slice(
    systemMessages.length,
    messages.length - cfg.preserveRecent
  )
  
  // 计算需要保留的消息的 token 数
  const systemTokens = systemMessages.reduce((sum, m) => sum + estimateMessageTokens(m), 0)
  const recentTokens = recentMessages.reduce((sum, m) => sum + estimateMessageTokens(m), 0)
  const reservedTokens = systemTokens + recentTokens
  
  // 如果只保留系统和最近消息就已经超预算
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
  
  // 计算中间消息的预算
  const middleBudget = cfg.targetTokens - reservedTokens
  
  // 从最新的中间消息开始保留
  const keptMiddle: Message[] = []
  let usedTokens = 0
  
  for (let i = middleMessages.length - 1; i >= 0; i--) {
    const msg = middleMessages[i]
    const msgTokens = estimateMessageTokens(msg)
    
    // 检查是否需要保留此消息
    const shouldPreserve = cfg.preserveSystem && msg.role === 'system'
      || cfg.preserveToolResults && msg.role === 'tool'
    
    if (shouldPreserve || usedTokens + msgTokens <= middleBudget) {
      keptMiddle.unshift(msg)
      usedTokens += msgTokens
    }
    
    if (usedTokens >= middleBudget) break
  }
  
  // 生成摘要
  const compressedMessages = middleMessages.filter(m => !keptMiddle.includes(m))
  const summary = generateSummary(compressedMessages, cfg.maxSummaryLength)
  
  // 构建最终消息列表
  const result: Message[] = [
    ...systemMessages,
    // 如果有压缩，添加摘要消息
    ...(compressedMessages.length > 0 ? [{
      role: 'system' as const,
      content: `[Context compressed: ${summary}]`,
    }] : []),
    ...keptMiddle,
    ...recentMessages,
  ]
  
  const tokensAfter = result.reduce((sum, m) => sum + estimateMessageTokens(m), 0)
  
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
  threshold: number = 0.8
): boolean {
  const totalTokens = messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0)
  // 假设 32K 上下文窗口
  const maxTokens = 32000
  return totalTokens >= maxTokens * threshold
}
