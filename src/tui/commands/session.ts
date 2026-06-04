// 会话相关的斜杠命令处理

import { SessionStore } from '../../session/store.js'
import type { SessionData } from '../../session/store.js'

export interface SessionCommandResult {
  handled: boolean
  message?: string
  action?: 'resume' | 'clear' | 'none'
  sessionId?: string
}

/**
 * 处理 /session 命令 - 会话管理
 */
export async function handleSessionCommand(
  args: string = ''
): Promise<SessionCommandResult> {
  const store = new SessionStore()
  const subCommand = args.trim().split(' ')[0]

  switch (subCommand) {
    case 'list':
    case '':
      return await listSessions(store)
    
    case 'resume': {
      const sessionId = args.trim().split(' ')[1]
      if (!sessionId) {
        return {
          handled: true,
          message: 'Usage: /session resume <id>\nUse /session list to see available sessions.',
        }
      }
      return await resumeSession(store, sessionId)
    }
    
    case 'delete': {
      const sessionId = args.trim().split(' ')[1]
      if (!sessionId) {
        return {
          handled: true,
          message: 'Usage: /session delete <id>\nUse /session list to see available sessions.',
        }
      }
      return await deleteSession(store, sessionId)
    }
    
    case 'clear':
      return await clearAllSessions(store)
    
    default:
      return {
        handled: true,
        message: `Unknown session command: ${subCommand}\n\nAvailable commands:\n  /session list     - List all sessions\n  /session resume   - Resume a session\n  /session delete   - Delete a session\n  /session clear    - Clear all sessions`,
      }
  }
}

/**
 * 列出所有会话
 */
async function listSessions(store: SessionStore): Promise<SessionCommandResult> {
  const sessions = await store.list()
  
  if (sessions.length === 0) {
    return {
      handled: true,
      message: '📭 No saved sessions found.',
    }
  }

  const lines = [
    '📋 Saved Sessions',
    '─'.repeat(60),
    '',
  ]

  for (const session of sessions.slice(0, 10)) {
    const date = new Date(session.updatedAt).toLocaleString()
    const msgCount = session.messages.length
    const preview = getSessionPreview(session)
    
    lines.push(`  ID: ${session.id}`)
    lines.push(`  Model: ${session.model} | Messages: ${msgCount} | Updated: ${date}`)
    if (preview) {
      lines.push(`  Preview: ${preview}`)
    }
    lines.push('')
  }

  if (sessions.length > 10) {
    lines.push(`... and ${sessions.length - 10} more sessions`)
  }

  lines.push('─'.repeat(60))
  lines.push('Commands: /session resume <id> | /session delete <id> | /session clear')

  return {
    handled: true,
    message: lines.join('\n'),
  }
}

/**
 * 恢复会话
 */
async function resumeSession(
  store: SessionStore,
  sessionId: string
): Promise<SessionCommandResult> {
  // 尝试精确匹配
  let session = await store.load(sessionId)
  
  // 如果没找到，尝试模糊匹配
  if (!session) {
    const sessions = await store.list()
    session = sessions.find(s => s.id.startsWith(sessionId)) || null
  }

  if (!session) {
    return {
      handled: true,
      message: `Session not found: ${sessionId}\nUse /session list to see available sessions.`,
    }
  }

  return {
    handled: true,
    message: `Resuming session: ${session.id}`,
    action: 'resume',
    sessionId: session.id,
  }
}

/**
 * 删除会话
 */
async function deleteSession(
  store: SessionStore,
  sessionId: string
): Promise<SessionCommandResult> {
  // 尝试模糊匹配
  const sessions = await store.list()
  const match = sessions.find(s => s.id.startsWith(sessionId))
  
  if (!match) {
    return {
      handled: true,
      message: `Session not found: ${sessionId}`,
    }
  }

  await store.delete(match.id)
  
  return {
    handled: true,
    message: `Deleted session: ${match.id}`,
  }
}

/**
 * 清除所有会话
 */
async function clearAllSessions(store: SessionStore): Promise<SessionCommandResult> {
  const sessions = await store.list()
  const count = sessions.length
  
  if (count === 0) {
    return {
      handled: true,
      message: 'No sessions to clear.',
    }
  }

  await store.clearAll()
  
  return {
    handled: true,
    message: `Cleared ${count} session(s).`,
  }
}

/**
 * 获取会话预览
 */
function getSessionPreview(session: SessionData): string {
  // 找到第一条用户消息作为预览
  const userMsg = session.messages.find(m => m.role === 'user')
  if (!userMsg || !userMsg.content) return ''
  
  const preview = userMsg.content.replace(/\n/g, ' ').slice(0, 60)
  return preview.length < userMsg.content.length ? preview + '...' : preview
}
