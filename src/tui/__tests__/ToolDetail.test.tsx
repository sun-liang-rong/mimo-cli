import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { ToolDetail, formatToolSummary } from '../ToolDetail.js'
import type { ToolCallDetail } from '../types.js'

function makeTool(overrides: Partial<ToolCallDetail> = {}): ToolCallDetail {
  return {
    id: 'tc-1',
    name: 'Read',
    args: { file_path: 'src/index.ts' },
    summary: 'src/index.ts',
    success: true,
    duration: 300,
    ...overrides,
  }
}

describe('ToolDetail', () => {
  it('should render tool name and summary', () => {
    const { lastFrame } = render(
      <ToolDetail tool={makeTool()} status="completed" expanded={false} />
    )
    const output = lastFrame()
    expect(output).toContain('Read')
    expect(output).toContain('src/index.ts')
  })

  it('should render running spinner', () => {
    const { lastFrame } = render(
      <ToolDetail tool={makeTool()} status="running" expanded={false} />
    )
    expect(lastFrame()).toContain('Read')
  })

  it('should render success checkmark', () => {
    const { lastFrame } = render(
      <ToolDetail tool={makeTool({ success: true })} status="completed" expanded={false} />
    )
    expect(lastFrame()).toContain('✓')
  })

  it('should render error cross', () => {
    const { lastFrame } = render(
      <ToolDetail tool={makeTool({ success: false })} status="error" expanded={false} />
    )
    expect(lastFrame()).toContain('✗')
  })

  it('should render duration when completed', () => {
    const { lastFrame } = render(
      <ToolDetail tool={makeTool({ duration: 1234 })} status="completed" expanded={false} />
    )
    expect(lastFrame()).toContain('1.2s')
  })

  it('should render expanded view with args', () => {
    const { lastFrame } = render(
      <ToolDetail
        tool={makeTool({ args: { file_path: 'src/index.ts', content: 'hello' } })}
        status="completed"
        expanded={true}
      />
    )
    const output = lastFrame()
    expect(output).toContain('Input:')
    expect(output).toContain('file_path')
  })

  it('should render result preview when expanded', () => {
    const { lastFrame } = render(
      <ToolDetail
        tool={makeTool({ result: 'line 1\nline 2\nline 3' })}
        status="completed"
        expanded={true}
      />
    )
    const output = lastFrame()
    expect(output).toContain('Output:')
    expect(output).toContain('line 1')
  })

  it('should render denied status', () => {
    const { lastFrame } = render(
      <ToolDetail tool={makeTool()} status="denied" expanded={false} />
    )
    expect(lastFrame()).toContain('⊘')
  })

  it('should render reasoning when provided', () => {
    const { lastFrame } = render(
      <ToolDetail
        tool={makeTool()}
        status="completed"
        expanded={false}
        reasoning="Let me check this file first"
      />
    )
    expect(lastFrame()).toContain('Let me check this file first')
  })
})

describe('formatToolSummary', () => {
  it('should format Read tool', () => {
    expect(formatToolSummary('Read', { file_path: 'src/index.ts' })).toBe('src/index.ts')
  })

  it('should format Write tool', () => {
    expect(formatToolSummary('Write', { file_path: 'out.ts' })).toBe('out.ts')
  })

  it('should format Edit tool', () => {
    expect(formatToolSummary('Edit', { file_path: 'a.ts' })).toBe('a.ts')
  })

  it('should format Bash tool', () => {
    expect(formatToolSummary('Bash', { command: 'npm test' })).toBe('npm test')
  })

  it('should truncate long Bash commands', () => {
    const longCmd = 'a'.repeat(80)
    expect(formatToolSummary('Bash', { command: longCmd }).length).toBeLessThanOrEqual(63)
  })

  it('should format Glob tool', () => {
    expect(formatToolSummary('Glob', { pattern: 'src/**/*.ts' })).toBe('src/**/*.ts')
  })

  it('should format Grep tool', () => {
    expect(formatToolSummary('Grep', { pattern: 'foo', path: 'src/' })).toBe('foo in src/')
  })

  it('should handle unknown tool', () => {
    const result = formatToolSummary('Unknown', { key: 'value' })
    expect(result).toContain('key')
  })
})
