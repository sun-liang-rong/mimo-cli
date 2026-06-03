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

  const tokens = trimmed.slice(1).split(/\s+/)
  const command = (tokens[0] || '').toLowerCase()
  const rest = tokens.slice(1).join(' ').trim()
  const arg = rest

  switch (command) {
    case 'help':
    case 'h':
    case '?':
      return {
        handled: true,
        message: `Available commands:
  /help, /h, /?  Show this help
  /clear         Clear conversation history
  /exit, /quit   Exit MiMo CLI
  /model         Show current model and API endpoint
  /status        Show session metrics (tokens, tool calls, duration)
  /compact       Summarize the current conversation to free context
  /vim           Toggle vim-style input editing
  /mcp           List configured MCP servers
  /init          Create or update the project memory file
  /memory        Open or edit persistent memory
  /setup         Re-run configuration wizard (restart required)`,
      }

    case 'clear':
    case 'reset':
      return { handled: true, message: '__CLEAR__' }

    case 'exit':
    case 'quit':
    case 'q':
      return { handled: true, message: '__EXIT__' }

    case 'model':
      return { handled: true, message: '__MODEL__' }

    case 'status':
      return { handled: true, message: '__STATUS__' }

    case 'compact':
      return {
        handled: true,
        message: 'Compaction is not yet implemented. (/compact is a stub for parity with Claude Code.)',
      }

    case 'vim':
      return {
        handled: true,
        message: 'Vim mode is not yet implemented. (/vim is a stub for parity with Claude Code.)',
      }

    case 'mcp':
      return {
        handled: true,
        message: 'No MCP servers configured. (/mcp is a stub for parity with Claude Code.)',
      }

    case 'init':
      return {
        handled: true,
        message: 'Project memory initialization is not yet implemented. (/init is a stub for parity with Claude Code.)',
      }

    case 'memory':
      return {
        handled: true,
        message: 'Persistent memory editor is not yet implemented. (/memory is a stub for parity with Claude Code.)',
      }

    case 'setup':
      return {
        handled: true,
        message:
          'Run `mimo --setup` from your shell to reconfigure API settings.',
      }

    default:
      if (arg) {
        return {
          handled: true,
          message: `Unknown command: /${command}. Type /help for available commands.`,
        }
      }
      return {
        handled: true,
        message: `Unknown command: /${command}. Type /help for available commands.`,
      }
  }
}
