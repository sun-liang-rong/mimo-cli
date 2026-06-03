import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { loadProjectContext, buildSystemPrompt } from '../loader.js'

describe('buildSystemPrompt', () => {
  it('should include environment info', () => {
    const prompt = buildSystemPrompt('', { cwd: '/test', platform: 'linux', date: '2024-01-01' })
    expect(prompt).toContain('/test')
    expect(prompt).toContain('linux')
    expect(prompt).toContain('2024-01-01')
  })

  it('should include project context', () => {
    const prompt = buildSystemPrompt('Use TypeScript', { cwd: '/test', platform: 'linux', date: '2024-01-01' })
    expect(prompt).toContain('Use TypeScript')
  })

  it('should include behavior instructions', () => {
    const prompt = buildSystemPrompt('', { cwd: '/test', platform: 'linux', date: '2024-01-01' })
    expect(prompt).toContain('Be direct and helpful')
  })

  it('should include safety instructions', () => {
    const prompt = buildSystemPrompt('', { cwd: '/test', platform: 'linux', date: '2024-01-01' })
    expect(prompt).toContain('Do not run destructive commands')
  })

  it('should use defaults when no options provided', () => {
    const prompt = buildSystemPrompt('')
    expect(prompt).toContain('MiMo CLI')
    expect(prompt).toContain(process.platform)
  })

  it('should handle empty project context', () => {
    const prompt = buildSystemPrompt('', { cwd: '/test', platform: 'linux', date: '2024-01-01' })
    expect(prompt).not.toContain('Project Context:')
  })

  it('should include project context section when provided', () => {
    const prompt = buildSystemPrompt('Project rules here', { cwd: '/test', platform: 'linux', date: '2024-01-01' })
    expect(prompt).toContain('Project Context:')
    expect(prompt).toContain('Project rules here')
  })

  it('should handle multiline project context', () => {
    const context = 'Rule 1\nRule 2\nRule 3'
    const prompt = buildSystemPrompt(context, { cwd: '/test', platform: 'linux', date: '2024-01-01' })
    expect(prompt).toContain('Rule 1')
    expect(prompt).toContain('Rule 2')
    expect(prompt).toContain('Rule 3')
  })
})

describe('loadProjectContext', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `mimo-prompt-test-${Date.now()}`)
    await fs.mkdir(tmpDir, { recursive: true })
    // Create .git dir to mark as project root
    await fs.mkdir(path.join(tmpDir, '.git'), { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  })

  it('should return empty context when no files exist', async () => {
    const ctx = await loadProjectContext(tmpDir)
    expect(ctx.rootInstructions).toBe('')
    expect(ctx.mimoInstructions).toBe('')
    expect(ctx.fullContext).toBe('')
  })

  it('should load CLAUDE.md from project root', async () => {
    await fs.writeFile(path.join(tmpDir, 'CLAUDE.md'), 'Use TypeScript')
    const ctx = await loadProjectContext(tmpDir)
    expect(ctx.rootInstructions).toContain('Use TypeScript')
  })

  it('should load CLAUDE.local.md from project root', async () => {
    await fs.writeFile(path.join(tmpDir, 'CLAUDE.local.md'), 'Local rules')
    const ctx = await loadProjectContext(tmpDir)
    expect(ctx.rootInstructions).toContain('Local rules')
  })

  it('should load from .mimo/ directory', async () => {
    await fs.mkdir(path.join(tmpDir, '.mimo'), { recursive: true })
    await fs.writeFile(path.join(tmpDir, '.mimo', 'CLAUDE.md'), 'MiMo specific rules')
    const ctx = await loadProjectContext(tmpDir)
    expect(ctx.mimoInstructions).toContain('MiMo specific rules')
  })

  it('should combine root and .mimo instructions', async () => {
    await fs.writeFile(path.join(tmpDir, 'CLAUDE.md'), 'Root rules')
    await fs.mkdir(path.join(tmpDir, '.mimo'), { recursive: true })
    await fs.writeFile(path.join(tmpDir, '.mimo', 'CLAUDE.md'), 'MiMo rules')
    const ctx = await loadProjectContext(tmpDir)
    expect(ctx.fullContext).toContain('Root rules')
    expect(ctx.fullContext).toContain('MiMo rules')
  })

  it('should handle missing .mimo directory', async () => {
    await fs.writeFile(path.join(tmpDir, 'CLAUDE.md'), 'Root rules')
    const ctx = await loadProjectContext(tmpDir)
    expect(ctx.rootInstructions).toContain('Root rules')
    expect(ctx.mimoInstructions).toBe('')
  })

  it('should find project root by .git directory', async () => {
    const subDir = path.join(tmpDir, 'src', 'deep')
    await fs.mkdir(subDir, { recursive: true })
    await fs.writeFile(path.join(tmpDir, 'CLAUDE.md'), 'Project rules')
    const ctx = await loadProjectContext(subDir)
    expect(ctx.rootInstructions).toContain('Project rules')
  })

  it('should handle empty CLAUDE.md', async () => {
    await fs.writeFile(path.join(tmpDir, 'CLAUDE.md'), '')
    const ctx = await loadProjectContext(tmpDir)
    expect(ctx.rootInstructions).toBe('')
  })

  it('should handle whitespace-only CLAUDE.md', async () => {
    await fs.writeFile(path.join(tmpDir, 'CLAUDE.md'), '   \n  \n  ')
    const ctx = await loadProjectContext(tmpDir)
    expect(ctx.rootInstructions).toBe('')
  })

  it('should handle multiple context files', async () => {
    await fs.writeFile(path.join(tmpDir, 'CLAUDE.md'), 'Main rules')
    await fs.writeFile(path.join(tmpDir, 'CLAUDE.local.md'), 'Local overrides')
    const ctx = await loadProjectContext(tmpDir)
    expect(ctx.rootInstructions).toContain('Main rules')
    expect(ctx.rootInstructions).toContain('Local overrides')
  })

  it('should handle cwd without .git gracefully', async () => {
    const noGitDir = path.join(os.tmpdir(), `mimo-no-git-${Date.now()}`)
    await fs.mkdir(noGitDir, { recursive: true })
    const ctx = await loadProjectContext(noGitDir)
    expect(ctx.fullContext).toBe('')
    await fs.rm(noGitDir, { recursive: true, force: true }).catch(() => {})
  })
})
