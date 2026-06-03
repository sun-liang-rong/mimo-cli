import { describe, it, expect, vi } from 'vitest'
import { isRetryableError, getBackoffDelay, withRetry } from '../retry.js'

describe('isRetryableError', () => {
  it('should identify ECONNRESET as retryable', () => {
    const error = new Error('socket hang up')
    ;(error as any).code = 'ECONNRESET'
    expect(isRetryableError(error)).toBe(true)
  })

  it('should identify ETIMEDOUT as retryable', () => {
    const error = new Error('connect ETIMEDOUT')
    expect(isRetryableError(error)).toBe(true)
  })

  it('should identify rate limit as retryable', () => {
    const error = new Error('Rate limit exceeded')
    expect(isRetryableError(error)).toBe(true)
  })

  it('should identify 429 as retryable', () => {
    const error = new Error('429 Too Many Requests')
    expect(isRetryableError(error)).toBe(true)
  })

  it('should identify 500 as retryable', () => {
    const error = new Error('500 Internal Server Error')
    expect(isRetryableError(error)).toBe(true)
  })

  it('should identify 502 as retryable', () => {
    const error = new Error('502 Bad Gateway')
    expect(isRetryableError(error)).toBe(true)
  })

  it('should identify 503 as retryable', () => {
    const error = new Error('503 Service Unavailable')
    expect(isRetryableError(error)).toBe(true)
  })

  it('should identify 504 as retryable', () => {
    const error = new Error('504 Gateway Timeout')
    expect(isRetryableError(error)).toBe(true)
  })

  it('should not identify auth errors as retryable', () => {
    const error = new Error('401 Unauthorized')
    expect(isRetryableError(error)).toBe(false)
  })

  it('should not identify validation errors as retryable', () => {
    const error = new Error('Invalid input')
    expect(isRetryableError(error)).toBe(false)
  })
})

describe('getBackoffDelay', () => {
  it('should return base delay for first attempt', () => {
    const delay = getBackoffDelay(0, { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 30000, retryableErrors: [] })
    expect(delay).toBeGreaterThanOrEqual(750) // 1000 - 25% jitter
    expect(delay).toBeLessThanOrEqual(1250) // 1000 + 25% jitter
  })

  it('should increase delay exponentially', () => {
    const delays = Array.from({ length: 3 }, (_, i) =>
      getBackoffDelay(i, { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 30000, retryableErrors: [] })
    )
    // Each delay should be roughly double the previous
    expect(delays[1]).toBeGreaterThan(delays[0] * 0.5)
    expect(delays[2]).toBeGreaterThan(delays[1] * 0.5)
  })

  it('should respect max delay', () => {
    const delay = getBackoffDelay(10, { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 5000, retryableErrors: [] })
    expect(delay).toBeLessThanOrEqual(5250) // 5000 + 25% jitter
  })
})

describe('withRetry', () => {
  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should retry on retryable error', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValue('ok')
    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 100, retryableErrors: ['ECONNRESET'] })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('should not retry on non-retryable error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('401 Unauthorized'))
    await expect(withRetry(fn, { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 100, retryableErrors: ['ECONNRESET'] })).rejects.toThrow('401 Unauthorized')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should throw after max retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('ECONNRESET'))
    await expect(
      withRetry(fn, { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 100, retryableErrors: ['ECONNRESET'] })
    ).rejects.toThrow('ECONNRESET')
    expect(fn).toHaveBeenCalledTimes(3) // initial + 2 retries
  })

  it('should call onRetry callback', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValue('ok')
    const onRetry = vi.fn()
    await withRetry(fn, { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 100, retryableErrors: ['ECONNRESET'] }, onRetry)
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number))
  })

  it('should work with default config', async () => {
    const fn = vi.fn().mockResolvedValue(42)
    const result = await withRetry(fn)
    expect(result).toBe(42)
  })

  it('should handle async functions', async () => {
    const fn = vi.fn().mockImplementation(async () => {
      await new Promise(r => setTimeout(r, 10))
      return 'async result'
    })
    const result = await withRetry(fn)
    expect(result).toBe('async result')
  })

  it('should handle 0 retries config', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('ECONNRESET'))
    await expect(
      withRetry(fn, { maxRetries: 0, baseDelayMs: 10, maxDelayMs: 100, retryableErrors: ['ECONNRESET'] })
    ).rejects.toThrow('ECONNRESET')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should retry on ENOTFOUND', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND'))
      .mockResolvedValue('ok')
    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 100, retryableErrors: ['ENOTFOUND'] })
    expect(result).toBe('ok')
  })

  it('should retry on 503', async () => {
    const error = new Error('503 Service Unavailable')
    const fn = vi.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue('ok')
    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 100, retryableErrors: ['503'] })
    expect(result).toBe('ok')
  })
})
