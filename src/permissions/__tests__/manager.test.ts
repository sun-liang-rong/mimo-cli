import { describe, it, expect, beforeEach } from 'vitest'
import { PermissionManager } from '../manager.js'

describe('PermissionManager', () => {
  let pm: PermissionManager

  beforeEach(() => {
    pm = new PermissionManager()
  })

  it('should allow safe bash commands by default', () => {
    expect(pm.check('Bash', { command: 'git status' })).toBe('allow')
  })

  it('should allow git diff by default', () => {
    expect(pm.check('Bash', { command: 'git diff' })).toBe('allow')
  })

  it('should allow git log by default', () => {
    expect(pm.check('Bash', { command: 'git log --oneline' })).toBe('allow')
  })

  it('should allow ls commands by default', () => {
    expect(pm.check('Bash', { command: 'ls -la' })).toBe('allow')
  })

  it('should allow pwd by default', () => {
    expect(pm.check('Bash', { command: 'pwd' })).toBe('allow')
  })

  it('should ask for unknown bash commands', () => {
    expect(pm.check('Bash', { command: 'rm -rf /' })).toBe('ask')
  })

  it('should ask for Write tool', () => {
    expect(pm.check('Write', { file_path: 'test.txt' })).toBe('ask')
  })

  it('should ask for Edit tool', () => {
    expect(pm.check('Edit', { file_path: 'test.txt' })).toBe('ask')
  })

  it('should allow Read tool', () => {
    expect(pm.check('Read', { file_path: 'test.txt' })).toBe('allow')
  })

  it('should allow Glob tool', () => {
    expect(pm.check('Glob', { pattern: '**/*.ts' })).toBe('allow')
  })

  it('should allow Grep tool', () => {
    expect(pm.check('Grep', { pattern: 'test' })).toBe('allow')
  })

  it('should respect session-level allow', () => {
    pm.allowForSession('Bash', 'npm test')
    expect(pm.check('Bash', { command: 'npm test' })).toBe('allow')
  })

  it('should respect session-level deny', () => {
    pm.denyForSession('Bash', 'git status')
    expect(pm.check('Bash', { command: 'git status' })).toBe('deny')
  })

  it('should prioritize session deny over builtin allow', () => {
    pm.denyForSession('Bash', 'git status')
    expect(pm.check('Bash', { command: 'git status' })).toBe('deny')
  })

  it('should add and check custom rules', () => {
    pm.addRule({ pattern: 'npm test*', level: 'allow', source: 'config' })
    expect(pm.check('Bash', { command: 'npm test' })).toBe('allow')
  })

  it('should add deny rules', () => {
    pm.addRule({ pattern: 'rm *', level: 'deny', source: 'config' })
    expect(pm.check('Bash', { command: 'rm -rf /' })).toBe('deny')
  })

  it('should reset session permissions', () => {
    pm.allowForSession('Bash', 'npm test')
    pm.resetSession()
    expect(pm.check('Bash', { command: 'npm test' })).toBe('ask')
  })

  it('should return all rules', () => {
    const rules = pm.getRules()
    expect(rules.length).toBeGreaterThan(0)
  })

  it('should handle wildcard patterns', () => {
    pm.addRule({ pattern: 'echo *', level: 'allow', source: 'session' })
    expect(pm.check('Bash', { command: 'echo hello world' })).toBe('allow')
  })

  it('should default to allow for unknown non-bash tools', () => {
    expect(pm.check('CustomTool', { data: 'test' })).toBe('allow')
  })
})
