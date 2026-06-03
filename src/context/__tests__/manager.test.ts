import { describe, it, expect } from 'vitest'
import { estimateTokens, messageTokens, totalTokens, ContextManager } from '../manager.js'
import type { Message } from '../../api/types.js'

describe('estimateTokens', () => {
  it('should return 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('should return 0 for null/undefined-like', () => {
    expect(estimateTokens(null as any)).toBe(0)
    expect(estimateTokens(undefined as any)).toBe(0)
  })

  it('should estimate ASCII text correctly', () => {
    const tokens = estimateTokens('hello world')
    expect(tokens).toBeGreaterThan(0)
    expect(tokens).toBeLessThan(10)
  })

  it('should estimate CJK text with higher token cost', () => {
    const ascii = estimateTokens('abcd')
    const cjk = estimateTokens('你好世界')
    expect(cjk).toBeGreaterThan(0)
    // CJK chars cost more tokens
    expect(cjk).toBeGreaterThanOrEqual(ascii)
  })

  it('should handle mixed ASCII and CJK', () => {
    const tokens = estimateTokens('hello 你好')
    expect(tokens).toBeGreaterThan(0)
  })

  it('should handle single character', () => {
    expect(estimateTokens('a')).toBeGreaterThan(0)
  })

  it('should handle long text', () => {
    const longText = 'a'.repeat(10000)
    const tokens = estimateTokens(longText)
    expect(tokens).toBeGreaterThan(1000)
  })

  it('should handle special characters', () => {
    const tokens = estimateTokens('!@#$%^&*()')
    expect(tokens).toBeGreaterThan(0)
  })

  it('should handle newlines', () => {
    const tokens = estimateTokens('line1\nline2\nline3')
    expect(tokens).toBeGreaterThan(0)
  })

  it('should handle tabs', () => {
    const tokens = estimateTokens('col1\tcol2\tcol3')
    expect(tokens).toBeGreaterThan(0)
  })

  it('should handle numbers', () => {
    const tokens = estimateTokens('1234567890')
    expect(tokens).toBeGreaterThan(0)
  })

  it('should handle unicode emoji', () => {
    const tokens = estimateTokens('👍🎉')
    expect(tokens).toBeGreaterThan(0)
  })
})

describe('messageTokens', () => {
  it('should count base tokens for a simple message', () => {
    const msg: Message = { role: 'user', content: 'hello' }
    const tokens = messageTokens(msg)
    expect(tokens).toBeGreaterThanOrEqual(4) // base overhead
  })

  it('should add tokens for content', () => {
    const short: Message = { role: 'user', content: 'hi' }
    const long: Message = { role: 'user', content: 'hello world this is a longer message' }
    expect(messageTokens(long)).toBeGreaterThan(messageTokens(short))
  })

  it('should handle null content', () => {
    const msg: Message = { role: 'assistant', content: null }
    const tokens = messageTokens(msg)
    expect(tokens).toBeGreaterThanOrEqual(4)
  })

  it('should count tool_calls tokens', () => {
    const msg: Message = {
      role: 'assistant',
      content: null,
      tool_calls: [{ id: 'tc1', type: 'function', function: { name: 'Read', arguments: '{}' } }],
    }
    const tokens = messageTokens(msg)
    expect(tokens).toBeGreaterThan(4)
  })

  it('should count tool_call_id tokens', () => {
    const msg: Message = { role: 'tool', content: 'result', tool_call_id: 'tc1' }
    const tokens = messageTokens(msg)
    expect(tokens).toBeGreaterThan(4)
  })

  it('should count name tokens', () => {
    const msg: Message = { role: 'tool', content: 'result', tool_call_id: 'tc1', name: 'Read' }
    const tokens = messageTokens(msg)
    expect(tokens).toBeGreaterThan(4)
  })

  it('should handle system message', () => {
    const msg: Message = { role: 'system', content: 'You are a helpful assistant' }
    expect(messageTokens(msg)).toBeGreaterThan(4)
  })

  it('should handle multiple tool_calls', () => {
    const msg: Message = {
      role: 'assistant',
      content: null,
      tool_calls: [
        { id: 'tc1', type: 'function', function: { name: 'Read', arguments: '{}' } },
        { id: 'tc2', type: 'function', function: { name: 'Write', arguments: '{}' } },
      ],
    }
    const single: Message = {
      role: 'assistant',
      content: null,
      tool_calls: [{ id: 'tc1', type: 'function', function: { name: 'Read', arguments: '{}' } }],
    }
    expect(messageTokens(msg)).toBeGreaterThan(messageTokens(single))
  })
})

describe('totalTokens', () => {
  it('should return 0 for empty array', () => {
    expect(totalTokens([])).toBe(0)
  })

  it('should sum all message tokens', () => {
    const messages: Message[] = [
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
    ]
    const total = totalTokens(messages)
    expect(total).toBeGreaterThan(0)
  })
})

describe('ContextManager', () => {
  const createMessages = (count: number): Message[] =>
    Array.from({ length: count }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i}: ${'x'.repeat(100)}`,
    })) as Message[]

  it('should create with default config', () => {
    const cm = new ContextManager()
    expect(cm.getConfig().maxContextTokens).toBe(32000)
  })

  it('should create with custom config', () => {
    const cm = new ContextManager({ maxContextTokens: 16000 })
    expect(cm.getConfig().maxContextTokens).toBe(16000)
  })

  it('should calculate available tokens', () => {
    const cm = new ContextManager({ maxContextTokens: 32000, systemPromptReserve: 2000, toolsReserve: 2000 })
    expect(cm.availableTokens).toBe(28000)
  })

  it('should not truncate messages within budget', () => {
    const cm = new ContextManager({ maxContextTokens: 100000 })
    const messages = createMessages(5)
    const result = cm.truncateMessages(messages)
    expect(result.length).toBe(messages.length)
  })

  it('should truncate messages exceeding budget', () => {
    const cm = new ContextManager({ maxContextTokens: 1000, systemPromptReserve: 100, toolsReserve: 100 })
    const messages = createMessages(50)
    const result = cm.truncateMessages(messages)
    expect(result.length).toBeLessThan(messages.length)
  })

  it('should preserve system messages during truncation', () => {
    const cm = new ContextManager({ maxContextTokens: 500, systemPromptReserve: 50, toolsReserve: 50 })
    const messages: Message[] = [
      { role: 'system', content: 'system' },
      ...createMessages(20),
    ]
    const result = cm.truncateMessages(messages)
    const systemMsgs = result.filter(m => m.role === 'system')
    expect(systemMsgs.length).toBeGreaterThanOrEqual(1)
  })

  it('should preserve recent messages during truncation', () => {
    const cm = new ContextManager({ maxContextTokens: 1000, systemPromptReserve: 100, toolsReserve: 100, minRecentMessages: 2 })
    const messages = createMessages(30)
    const result = cm.truncateMessages(messages)
    const lastOrig = messages[messages.length - 1]
    const lastResult = result[result.length - 1]
    expect(lastResult.content).toBe(lastOrig.content)
  })

  it('should add truncation notice', () => {
    const cm = new ContextManager({ maxContextTokens: 500, systemPromptReserve: 50, toolsReserve: 50 })
    const messages = createMessages(30)
    const result = cm.truncateMessages(messages)
    const notice = result.find(m => m.content?.includes('truncated'))
    expect(notice).toBeDefined()
  })

  it('should truncate tool results', () => {
    const cm = new ContextManager()
    const longOutput = 'x'.repeat(100000)
    const result = cm.truncateToolResult(longOutput, 1000)
    expect(result.length).toBeLessThan(longOutput.length)
    expect(result).toContain('truncated')
  })

  it('should not truncate short tool results', () => {
    const cm = new ContextManager()
    const shortOutput = 'short output'
    const result = cm.truncateToolResult(shortOutput, 1000)
    expect(result).toBe(shortOutput)
  })

  it('should detect near-limit messages', () => {
    const cm = new ContextManager({ maxContextTokens: 1000, systemPromptReserve: 0, toolsReserve: 0 })
    const messages = createMessages(5)
    expect(cm.isNearLimit(messages, 0.1)).toBe(true)
  })

  it('should detect not-near-limit messages', () => {
    const cm = new ContextManager({ maxContextTokens: 100000 })
    const messages = createMessages(2)
    expect(cm.isNearLimit(messages, 0.9)).toBe(false)
  })

  it('should compress messages when over 80% budget', () => {
    const cm = new ContextManager({ maxContextTokens: 200, systemPromptReserve: 0, toolsReserve: 0 })
    const messages = createMessages(20)
    const result = cm.compressMessages(messages)
    expect(result.length).toBeLessThan(messages.length)
  })

  it('should include summary in compressed messages', () => {
    const cm = new ContextManager({ maxContextTokens: 200, systemPromptReserve: 0, toolsReserve: 0 })
    const messages = createMessages(20)
    const result = cm.compressMessages(messages)
    const summary = result.find(m => m.content?.includes('Conversation summary'))
    expect(summary).toBeDefined()
  })

  it('should not compress messages within budget', () => {
    const cm = new ContextManager({ maxContextTokens: 100000 })
    const messages = createMessages(5)
    const result = cm.compressMessages(messages)
    expect(result.length).toBe(messages.length)
  })

  it('should handle empty messages array', () => {
    const cm = new ContextManager()
    expect(cm.truncateMessages([])).toEqual([])
    expect(cm.compressMessages([])).toEqual([])
  })

  it('should handle single message', () => {
    const cm = new ContextManager()
    const messages: Message[] = [{ role: 'user', content: 'hello' }]
    expect(cm.truncateMessages(messages)).toEqual(messages)
  })
})
