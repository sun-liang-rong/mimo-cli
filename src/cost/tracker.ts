// 成本追踪器 - 监控 token 用量和 API 成本
import { getModelPricing, getModelConfig } from '../config/models.js'

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
}

export interface CostBreakdown {
  model: string
  inputCost: number
  outputCost: number
  cacheCost: number
  totalCost: number
}

export interface CostSummary {
  totalTokens: TokenUsage
  totalCost: number
  breakdowns: CostBreakdown[]
  requestCount: number
  duration: number
}

export class CostTracker {
  private usage: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
  }
  
  private requestCount = 0
  private startTime = Date.now()
  private model: string

  constructor(model: string = 'MiMo-7B-RL') {
    this.model = model
  }

  /**
   * 追踪一次 API 调用的 token 使用
   */
  track(usage: Partial<TokenUsage>): void {
    this.usage.inputTokens += usage.inputTokens || 0
    this.usage.outputTokens += usage.outputTokens || 0
    this.usage.cacheCreationTokens += usage.cacheCreationTokens || 0
    this.usage.cacheReadTokens += usage.cacheReadTokens || 0
    this.requestCount++
  }

  /**
   * 从 API 响应中提取 token 使用
   */
  trackFromResponse(response: {
    usage?: {
      prompt_tokens?: number
      completion_tokens?: number
      prompt_tokens_details?: { cache_creation_input_tokens?: number; cached_tokens?: number }
    }
  }): void {
    if (!response.usage) return

    this.track({
      inputTokens: response.usage.prompt_tokens || 0,
      outputTokens: response.usage.completion_tokens || 0,
      cacheCreationTokens: response.usage.prompt_tokens_details?.cache_creation_input_tokens || 0,
      cacheReadTokens: response.usage.prompt_tokens_details?.cached_tokens || 0,
    })
  }

  /**
   * 计算成本
   */
  calculateCost(): CostBreakdown {
    const pricing = getModelPricing(this.model)
    
    const inputCost = (this.usage.inputTokens / 1_000_000) * pricing.input
    const outputCost = (this.usage.outputTokens / 1_000_000) * pricing.output
    const cacheCost = (this.usage.cacheReadTokens / 1_000_000) * pricing.cacheRead
    
    return {
      model: this.model,
      inputCost,
      outputCost,
      cacheCost,
      totalCost: inputCost + outputCost + cacheCost,
    }
  }

  /**
   * 获取完整的成本摘要
   */
  getSummary(): CostSummary {
    const breakdown = this.calculateCost()
    
    return {
      totalTokens: { ...this.usage },
      totalCost: breakdown.totalCost,
      breakdowns: [breakdown],
      requestCount: this.requestCount,
      duration: Date.now() - this.startTime,
    }
  }

  /**
   * 获取总 token 数
   */
  getTotalTokens(): number {
    return this.usage.inputTokens + this.usage.outputTokens
  }

  /**
   * 重置追踪器
   */
  reset(): void {
    this.usage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    }
    this.requestCount = 0
    this.startTime = Date.now()
  }

  /**
   * 渲染状态栏文本
   */
  renderStatusBar(): string {
    const total = this.getTotalTokens()
    const cost = this.calculateCost()
    
    // 格式化 token 数量
    let tokenStr: string
    if (total >= 1_000_000) {
      tokenStr = `${(total / 1_000_000).toFixed(1)}M`
    } else if (total >= 1_000) {
      tokenStr = `${(total / 1_000).toFixed(1)}K`
    } else {
      tokenStr = total.toString()
    }

    // 格式化成本
    let costStr: string
    if (cost.totalCost >= 1.0) {
      costStr = `$${cost.totalCost.toFixed(2)}`
    } else if (cost.totalCost >= 0.01) {
      costStr = `$${cost.totalCost.toFixed(3)}`
    } else {
      costStr = `$${cost.totalCost.toFixed(4)}`
    }

    return `Tokens: ${tokenStr} | Cost: ${costStr}`
  }

  /**
   * 渲染详细的成本报告
   */
  renderDetailedReport(): string {
    const summary = this.getSummary()
    const breakdown = summary.breakdowns[0]
    
    const durationSec = Math.round(summary.duration / 1000)
    const durationMin = Math.floor(durationSec / 60)
    const durationStr = durationMin > 0 
      ? `${durationMin}m ${durationSec % 60}s`
      : `${durationSec}s`

    const lines = [
      '💰 Cost Report',
      '─'.repeat(40),
      `Model: ${breakdown.model}`,
      `Context Window: ${getModelConfig(this.model).contextWindow.toLocaleString()} tokens`,
      `Requests: ${summary.requestCount}`,
      `Duration: ${durationStr}`,
      '',
      'Token Usage:',
      `  Input:          ${summary.totalTokens.inputTokens.toLocaleString()}`,
      `  Output:         ${summary.totalTokens.outputTokens.toLocaleString()}`,
      `  Cache Read:     ${summary.totalTokens.cacheReadTokens.toLocaleString()}`,
      `  Cache Creation: ${summary.totalTokens.cacheCreationTokens.toLocaleString()}`,
      '',
      'Cost Breakdown:',
      `  Input:    $${breakdown.inputCost.toFixed(4)}`,
      `  Output:   $${breakdown.outputCost.toFixed(4)}`,
      `  Cache:    $${breakdown.cacheCost.toFixed(4)}`,
      `  ─────────────────`,
      `  Total:    $${breakdown.totalCost.toFixed(4)}`,
    ]

    return lines.join('\n')
  }
}
