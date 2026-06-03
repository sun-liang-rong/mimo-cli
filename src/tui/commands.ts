// 斜杠命令处理

export interface SlashCommandResult {
  handled: boolean
  message?: string
}

export function handleSlashCommand(input: string): SlashCommandResult {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) {
    return { handled: false }
  }

  const [command, ...rest] = trimmed.slice(1).split(/\s+/)
  const arg = rest.join(' ').trim()

  switch (command.toLowerCase()) {
    case 'help':
    case 'h':
      return {
        handled: true,
        message: `Available commands:
  /help, /h       Show this help
  /clear          Clear conversation history
  /exit, /quit    Exit MiMo CLI
  /model          Show current model info
  /setup          Re-run configuration wizard (restart required)`,
      }

    case 'clear':
      return { handled: true, message: '__CLEAR__' }

    case 'exit':
    case 'quit':
      return { handled: true, message: '__EXIT__' }

    case 'model':
      return { handled: true, message: '__MODEL__' }

    case 'setup':
      return {
        handled: true,
        message:
          'Run `mimo --setup` from your shell to reconfigure API settings.',
      }

    default:
      return {
        handled: true,
        message: `Unknown command: /${command}. Type /help for available commands.`,
      }
  }
}
