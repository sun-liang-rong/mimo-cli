// 将 API 消息转为 UI 条目

import type { Message } from '../api/types.js'
import type { ChatEntry, LiveToolCall } from './types.js'

let entryId = 0

export function nextEntryId(prefix: string): string {
  return `${prefix}-${++entryId}`
}

export function userEntry(content: string): ChatEntry {
  return { id: nextEntryId('user'), kind: 'user', content }
}

export function assistantEntry(content: string): ChatEntry {
  return { id: nextEntryId('assistant'), kind: 'assistant', content }
}

export function systemEntry(content: string): ChatEntry {
  return { id: nextEntryId('system'), kind: 'system', content }
}

export function errorEntry(content: string): ChatEntry {
  return { id: nextEntryId('error'), kind: 'error', content }
}

export function toolEntryFromMessage(message: Message): ChatEntry | null {
  if (message.role !== 'tool') return null

  const name = message.name || 'tool'
  const isDenied = message.content?.includes('denied')
  const isError = message.content?.startsWith('Error:')

  const tool: LiveToolCall = {
    id: message.tool_call_id || nextEntryId('tool'),
    name,
    args: {},
    status: isDenied ? 'denied' : isError ? 'error' : 'success',
    result: message.content || undefined,
  }

  return {
    id: nextEntryId('tool'),
    kind: 'tool',
    content: message.content || '',
    tool,
  }
}

export function messagesToEntries(messages: Message[]): ChatEntry[] {
  const entries: ChatEntry[] = []

  for (const msg of messages) {
    if (msg.role === 'assistant' && msg.content?.trim()) {
      entries.push(assistantEntry(msg.content))
    } else if (msg.role === 'tool') {
      const entry = toolEntryFromMessage(msg)
      if (entry) entries.push(entry)
    }
  }

  return entries
}

export function resetEntryIds(): void {
  entryId = 0
}
