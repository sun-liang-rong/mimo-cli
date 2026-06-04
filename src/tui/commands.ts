// 斜杠命令处理

export interface SlashCommandResult {
  handled: boolean
  message?: string
}

/**
 * 处理斜杠命令
 */
export function handleSlashCommand(text: string): SlashCommandResult {
  const trimmed = text.trim()
  
  // 检查是否是斜杠命令
  if (!trimmed.startsWith('/')) {
    return { handled: false }
  }

  const [command, ...args] = trimmed.split(/\s+/)
  const commandLower = command.toLowerCase()

  switch (commandLower) {
    // 会话管理
    case '/clear':
      return { handled: true, message: '__CLEAR__' }
    
    case '/exit':
    case '/quit':
    case '/q':
      return { handled: true, message: '__EXIT__' }
    
    case '/model':
      return { handled: true, message: '__MODEL__' }
    
    // 成本和上下文
    case '/cost':
      return { handled: true, message: '__COST__' }
    
    case '/context':
      return { handled: true, message: '__CONTEXT__' }
    
    case '/compact':
      return { handled: true, message: '__COMPACT__' }
    
    // 会话恢复
    case '/session': {
      const subCommand = args[0] || 'list'
      if (subCommand === 'list') {
        return { handled: true, message: '__SESSIONS__' }
      }
      if (subCommand === 'resume' && args[1]) {
        return { handled: true, message: `__RESUME__${args[1]}` }
      }
      if (subCommand === 'clear') {
        return { handled: true, message: '__SESSIONS__' }
      }
      return { handled: true, message: 'Usage: /session [list|resume <id>|delete <id>|clear]' }
    }
    
    // 项目上下文
    case '/init':
      return { handled: true, message: '__INIT__' }
    
    case '/memory':
      return { handled: true, message: '__MEMORY__' }
    
    // 子代理
    case '/agents':
      return { handled: true, message: '__AGENTS__' }
    
    // 帮助
    case '/help':
    case '/h':
    case '/?':
      return { handled: true, message: '__HELP__' }
    
    // 未知命令
    default:
      return { 
        handled: true, 
        message: `Unknown command: ${command}\nType /help for available commands.` 
      }
  }
}

/**
 * 获取所有可用命令的描述
 */
export function getCommandDescriptions(): Array<{ command: string; description: string }> {
  return [
    { command: '/clear', description: 'Clear conversation history' },
    { command: '/compact', description: 'Compress conversation context' },
    { command: '/context', description: 'Show context window usage' },
    { command: '/cost', description: 'Show cost breakdown' },
    { command: '/exit', description: 'Exit MiMo CLI' },
    { command: '/help', description: 'Show help message' },
    { command: '/init', description: 'Create MIMO.md template' },
    { command: '/memory', description: 'Show project memory info' },
    { command: '/model', description: 'Show current model info' },
    { command: '/agents', description: 'List available sub-agents' },
    { command: '/session', description: 'Manage sessions (list/resume/delete/clear)' },
  ]
}
