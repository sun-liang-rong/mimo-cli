import { describe, it, expect } from 'vitest'
import { gitTool } from '../git.js'

describe('GitTool', () => {
  it('should have correct name', () => {
    expect(gitTool.name).toBe('Git')
  })

  it('should have description', () => {
    expect(gitTool.description).toBeTruthy()
    expect(gitTool.description.length).toBeGreaterThan(10)
  })

  it('should have input schema', () => {
    expect(gitTool.input_schema).toBeDefined()
    expect(gitTool.input_schema.required).toContain('subcommand')
  })

  it('should not require approval', () => {
    expect(gitTool.requiresApproval).toBe(false)
  })

  it('should have subcommand enum', () => {
    const subcommand = gitTool.input_schema.properties.subcommand
    expect(subcommand.enum).toContain('status')
    expect(subcommand.enum).toContain('diff')
    expect(subcommand.enum).toContain('branch')
    expect(subcommand.enum).toContain('log')
    expect(subcommand.enum).toContain('commit')
    expect(subcommand.enum).toContain('add')
    expect(subcommand.enum).toContain('restore')
    expect(subcommand.enum).toContain('show')
  })

  it('should execute git status', async () => {
    const result = await gitTool.execute({ subcommand: 'status' })
    expect(result.success).toBe(true)
    expect(result.output).toBeTruthy()
  })

  it('should execute git log', async () => {
    const result = await gitTool.execute({ subcommand: 'log', args: '--oneline -5' })
    expect(result.success).toBe(true)
  })

  it('should execute git branch', async () => {
    const result = await gitTool.execute({ subcommand: 'branch' })
    expect(result.success).toBe(true)
  })

  it('should return error for commit without message', async () => {
    const result = await gitTool.execute({ subcommand: 'commit' })
    expect(result.success).toBe(false)
    expect(result.error).toContain('required')
  })

  it('should return error for add without paths', async () => {
    const result = await gitTool.execute({ subcommand: 'add' })
    expect(result.success).toBe(false)
    expect(result.error).toContain('required')
  })

  it('should return error for restore without paths', async () => {
    const result = await gitTool.execute({ subcommand: 'restore' })
    expect(result.success).toBe(false)
    expect(result.error).toContain('required')
  })

  it('should handle unknown subcommand', async () => {
    const result = await gitTool.execute({ subcommand: 'unknown' })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Unknown')
  })

  it('should handle git diff', async () => {
    const result = await gitTool.execute({ subcommand: 'diff' })
    expect(result.success).toBe(true)
  })

  it('should handle git show', async () => {
    const result = await gitTool.execute({ subcommand: 'show', args: 'HEAD --stat' })
    expect(result.success).toBe(true)
  })

  it('should handle cwd parameter', async () => {
    const result = await gitTool.execute({ subcommand: 'status', cwd: process.cwd() })
    expect(result.success).toBe(true)
  })

  it('should handle empty args', async () => {
    const result = await gitTool.execute({ subcommand: 'status', args: '' })
    expect(result.success).toBe(true)
  })

  it('should handle git log with custom format', async () => {
    const result = await gitTool.execute({ subcommand: 'log', args: '--oneline -3' })
    expect(result.success).toBe(true)
  })

  it('should handle git branch with list', async () => {
    const result = await gitTool.execute({ subcommand: 'branch', args: '-a' })
    expect(result.success).toBe(true)
  })
})
