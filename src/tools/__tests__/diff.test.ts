import { describe, it, expect } from 'vitest'
import { createUnifiedDiff, formatDiff, formatDiffPlainText } from '../diff.js'

describe('createUnifiedDiff', () => {
  it('should detect no changes', () => {
    const result = createUnifiedDiff('hello', 'hello')
    expect(result.added).toBe(0)
    expect(result.removed).toBe(0)
  })

  it('should detect additions', () => {
    const result = createUnifiedDiff('hello', 'hello\nworld')
    expect(result.added).toBe(1)
    expect(result.removed).toBe(0)
  })

  it('should detect removals', () => {
    const result = createUnifiedDiff('hello\nworld', 'hello')
    expect(result.removed).toBe(1)
    expect(result.added).toBe(0)
  })

  it('should detect modifications', () => {
    const result = createUnifiedDiff('hello', 'world')
    expect(result.added).toBe(1)
    expect(result.removed).toBe(1)
  })

  it('should handle empty old content', () => {
    const result = createUnifiedDiff('', 'hello\nworld')
    expect(result.added).toBe(2)
  })

  it('should handle empty new content', () => {
    const result = createUnifiedDiff('hello\nworld', '')
    expect(result.removed).toBe(2)
  })

  it('should handle both empty', () => {
    const result = createUnifiedDiff('', '')
    expect(result.added).toBe(0)
    expect(result.removed).toBe(0)
  })

  it('should include filename in header', () => {
    const result = createUnifiedDiff('a', 'b', 'test.txt')
    expect(result.filename).toBe('test.txt')
    expect(result.lines.some(l => l.content.includes('test.txt'))).toBe(true)
  })

  it('should generate correct line numbers', () => {
    const result = createUnifiedDiff('a\nb\nc', 'a\nx\nc')
    const contextLines = result.lines.filter(l => l.type === 'context')
    expect(contextLines.length).toBeGreaterThan(0)
  })

  it('should handle multi-line changes', () => {
    const old = 'line1\nline2\nline3\nline4\nline5'
    const newline = 'line1\nmodified2\nmodified3\nline4\nline5'
    const result = createUnifiedDiff(old, newline)
    expect(result.removed).toBe(2)
    expect(result.added).toBe(2)
  })

  it('should handle completely different content', () => {
    const result = createUnifiedDiff('abc', 'xyz')
    expect(result.lines.length).toBeGreaterThan(0)
  })
})

describe('formatDiffPlainText', () => {
  it('should format diff as text', () => {
    const result = createUnifiedDiff('hello', 'world')
    const text = formatDiffPlainText(result)
    expect(text).toContain('@@')
    expect(text).toContain('+')
    expect(text).toContain('-')
  })

  it('should show context lines', () => {
    const result = createUnifiedDiff('a\nb\nc', 'a\nx\nc')
    const text = formatDiffPlainText(result)
    expect(text).toContain('  ')
  })

  it('should handle empty diff', () => {
    const result = createUnifiedDiff('same', 'same')
    const text = formatDiffPlainText(result)
    expect(text).toContain('@@')
  })
})

describe('formatDiff', () => {
  it('should format diff with ANSI colors', () => {
    const result = createUnifiedDiff('hello', 'world')
    const text = formatDiff(result)
    expect(text).toContain('\x1b[')
  })

  it('should color additions green', () => {
    const result = createUnifiedDiff('', 'new line')
    const text = formatDiff(result)
    expect(text).toContain('\x1b[32m')
  })

  it('should color removals red', () => {
    const result = createUnifiedDiff('old line', '')
    const text = formatDiff(result)
    expect(text).toContain('\x1b[31m')
  })
})
