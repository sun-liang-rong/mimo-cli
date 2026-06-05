// 统一 token 估算 - 替代 context/manager.ts 和 compression.ts 中的重复实现

export interface TokenEstimator {
  estimate(text: string): number
  estimateMessage(msg: { content?: string | null; tool_calls?: Array<{ function: { name: string; arguments: string } }>; tool_call_id?: string; name?: string }): number
}

/**
 * 基于字符的启发式 token 估算
 * - CJK 字符: ~0.5 token/字 (中文日文韩文)
 * - ASCII 字母数字: ~0.25 token/字 (英文约 4 字符/token)
 * - 标点/空格: ~0.25 token/字
 */
export function estimateTokens(text: string): number {
  if (!text) return 0
  let count = 0
  for (const ch of text) {
    count += ch.charCodeAt(0) > 0x7f ? 0.5 : 0.25
  }
  return Math.ceil(count)
}

/**
 * 估算单条消息的 token 数 (包含结构开销)
 */
export function estimateMessageTokens(msg: {
  content?: string | null
  tool_calls?: Array<{ function: { name: string; arguments: string } }>
  tool_call_id?: string
  name?: string
}): number {
  let tokens = 4 // role + formatting overhead

  if (msg.content) {
    tokens += estimateTokens(msg.content)
  }

  if (msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      tokens += estimateTokens(tc.function.name) + estimateTokens(tc.function.arguments) + 4
    }
  }

  if (msg.tool_call_id) {
    tokens += estimateTokens(msg.tool_call_id)
  }

  if (msg.name) {
    tokens += estimateTokens(msg.name)
  }

  return tokens
}

/**
 * 批量计算消息数组总 token 数
 */
export function estimateTotalTokens(messages: Array<Parameters<typeof estimateMessageTokens>[0]>): number {
  return messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0)
}

/**
 * 格式化 token 数量为人类可读字符串
 */
export function formatTokenCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`
  return count.toString()
}
