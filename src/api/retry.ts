// API 重试机制 - 指数退避 + 最大重试次数

export interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  retryableErrors: string[]
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ECONNREFUSED',
    'rate_limit',
    'Rate limit',
    '429',
    '500',
    '502',
    '503',
    '504',
  ],
}

/** 判断错误是否可重试 */
export function isRetryableError(error: Error, config: RetryConfig = DEFAULT_RETRY_CONFIG): boolean {
  const message = error.message || ''
  const code = (error as any).code || ''
  return config.retryableErrors.some(
    pattern => message.includes(pattern) || code.includes(pattern)
  )
}

/** 计算指数退避延迟 */
export function getBackoffDelay(attempt: number, config: RetryConfig = DEFAULT_RETRY_CONFIG): number {
  const delay = config.baseDelayMs * Math.pow(2, attempt)
  // 添加 jitter (±25%)
  const jitter = delay * 0.25 * (Math.random() * 2 - 1)
  return Math.min(delay + jitter, config.maxDelayMs)
}

/**
 * 带重试的函数执行器
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  onRetry?: (attempt: number, error: Error, delayMs: number) => void
): Promise<T> {
  const fullConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error

      if (attempt >= fullConfig.maxRetries) break
      if (!isRetryableError(error, fullConfig)) break

      const delay = getBackoffDelay(attempt, fullConfig)
      onRetry?.(attempt + 1, error, delay)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}
