// 权限管理器 - 命令白名单 + 会话级允许 + 细粒度控制

export type PermissionLevel = 'allow' | 'deny' | 'ask'

export interface PermissionRule {
  /** 匹配模式 (支持通配符) */
  pattern: string
  /** 权限级别 */
  level: PermissionLevel
  /** 规则来源 */
  source: 'config' | 'session' | 'builtin'
  /** 描述 */
  description?: string
}

export interface ToolPermissionRequest {
  toolName: string
  input: Record<string, unknown>
}

// 通配符匹配
function matchPattern(pattern: string, text: string): boolean {
  if (pattern === '*') return true
  const regex = new RegExp(
    '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
  )
  return regex.test(text)
}

// 安全的 Bash 命令白名单 (不需要审批)
const BUILTIN_SAFE_COMMANDS: PermissionRule[] = [
  { pattern: 'git status*', level: 'allow', source: 'builtin', description: 'Git status' },
  { pattern: 'git log*', level: 'allow', source: 'builtin', description: 'Git log' },
  { pattern: 'git diff*', level: 'allow', source: 'builtin', description: 'Git diff' },
  { pattern: 'git branch*', level: 'allow', source: 'builtin', description: 'Git branch' },
  { pattern: 'git show*', level: 'allow', source: 'builtin', description: 'Git show' },
  { pattern: 'git remote*', level: 'allow', source: 'builtin', description: 'Git remote' },
  { pattern: 'ls*', level: 'allow', source: 'builtin', description: 'List files' },
  { pattern: 'dir*', level: 'allow', source: 'builtin', description: 'List files (Windows)' },
  { pattern: 'pwd', level: 'allow', source: 'builtin', description: 'Print working directory' },
  { pattern: 'echo*', level: 'allow', source: 'builtin', description: 'Echo' },
  { pattern: 'cat*', level: 'allow', source: 'builtin', description: 'Read file' },
  { pattern: 'head*', level: 'allow', source: 'builtin', description: 'Read file head' },
  { pattern: 'tail*', level: 'allow', source: 'builtin', description: 'Read file tail' },
  { pattern: 'wc*', level: 'allow', source: 'builtin', description: 'Word count' },
  { pattern: 'which*', level: 'allow', source: 'builtin', description: 'Which command' },
  { pattern: 'type*', level: 'allow', source: 'builtin', description: 'Type command' },
  { pattern: 'node --version*', level: 'allow', source: 'builtin', description: 'Node version' },
  { pattern: 'npm --version*', level: 'allow', source: 'builtin', description: 'NPM version' },
  { pattern: 'python --version*', level: 'allow', source: 'builtin', description: 'Python version' },
]

export class PermissionManager {
  private rules: PermissionRule[] = [...BUILTIN_SAFE_COMMANDS]
  private sessionAllowed: Set<string> = new Set()
  private sessionDenied: Set<string> = new Set()

  /** 添加配置规则 */
  addRule(rule: PermissionRule): void {
    this.rules.push(rule)
  }

  /** 添加会话级允许 (单个命令) */
  allowForSession(toolName: string, commandKey: string): void {
    this.sessionAllowed.add(`${toolName}:${commandKey}`)
  }

  /** 添加会话级拒绝 */
  denyForSession(toolName: string, commandKey: string): void {
    this.sessionDenied.add(`${toolName}:${commandKey}`)
  }

  /** 检查权限 */
  check(toolName: string, input: Record<string, unknown>): PermissionLevel {
    const commandKey = this.getCommandKey(toolName, input)

    // 1. 检查会话级拒绝
    if (this.sessionDenied.has(`${toolName}:${commandKey}`)) return 'deny'

    // 2. 检查会话级允许
    if (this.sessionAllowed.has(`${toolName}:${commandKey}`)) return 'allow'

    // 3. 检查规则匹配 (后添加的优先)
    const textToMatch = toolName === 'Bash' ? (input.command as string || '') : commandKey

    for (let i = this.rules.length - 1; i >= 0; i--) {
      const rule = this.rules[i]
      if (matchPattern(rule.pattern, textToMatch)) {
        return rule.level
      }
    }

    // 4. 默认: 写操作和 Bash 需要审批
    if (['Write', 'Edit', 'Bash'].includes(toolName)) return 'ask'
    return 'allow'
  }

  /** 生成命令的唯一键 */
  private getCommandKey(toolName: string, input: Record<string, unknown>): string {
    switch (toolName) {
      case 'Bash':
        return (input.command as string) || ''
      case 'Write':
        return (input.file_path as string) || ''
      case 'Edit':
        return (input.file_path as string) || ''
      default:
        return toolName
    }
  }

  /** 获取当前规则列表 */
  getRules(): PermissionRule[] {
    return [...this.rules]
  }

  /** 重置会话级权限 */
  resetSession(): void {
    this.sessionAllowed.clear()
    this.sessionDenied.clear()
  }
}
