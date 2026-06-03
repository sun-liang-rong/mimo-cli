# MiMo CLI 全面优化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全面优化 MiMo CLI 的交互体验和对话功能，严格对齐 Claude Code 的交互模式。

**Architecture:** 将现有单体 `tui/` 目录重构为模块化的 `ui/` 架构，引入对话管理核心（ConversationManager, MessageHistory），分离关注点，提升可维护性和扩展性。

**Tech Stack:** React 18 + Ink 4 + TypeScript 5 + OpenAI SDK + chalk + cli-highlight

---

## 文件结构映射

### 新增文件
- `src/conversation/types.ts` — 对话相关类型定义
- `src/conversation/ConversationManager.ts` — 会话管理器
- `src/conversation/MessageHistory.ts` — 消息历史管理
- `src/conversation/persistence.ts` — 会话持久化
- `src/ui/components/ChatArea.tsx` — 聊天区域（消息列表 + 流式输出）
- `src/ui/components/InputBar.tsx` — 底部输入栏（Claude 风格）
- `src/ui/components/StatusLine.tsx` — 顶部状态栏
- `src/ui/components/ToolPanel.tsx` — 工具调用展示
- `src/ui/components/DiffViewer.tsx` — 代码 diff 预览
- `src/ui/components/ThinkingIndicator.tsx` — 思考中动画
- `src/ui/components/SessionSwitcher.tsx` — 会话切换
- `src/ui/hooks/useConversation.ts` — 对话管理 hook
- `src/ui/hooks/useStreaming.ts` — 流式输出 hook
- `src/ui/hooks/useToolApproval.ts` — 工具审批 hook
- `src/ui/App.tsx` — 重构后的主应用组件

### 修改文件
- `src/index.ts` — 更新入口文件引用
- `src/agent/loop.ts` — 适配新的对话管理接口
- `src/api/client.ts` — 适配新的流式处理
- `src/tui/` — 逐步迁移到 `src/ui/`

### 删除文件
- `src/tui/App.tsx` — 被 `src/ui/App.tsx` 替代
- `src/tui/UserInput.tsx` — 被 `src/ui/components/InputBar.tsx` 替代
- `src/tui/MessageList.tsx` — 被 `src/ui/components/ChatArea.tsx` 替代
- `src/tui/StatusBar.tsx` — 被 `src/ui/components/StatusLine.tsx` 替代
- `src/tui/blocks.ts` — 功能整合到 ChatArea
- `src/tui/commands.ts` — 功能整合到 InputBar

---

## Phase 1: 对话管理核心（Conversation Core）

### Task 1: 对话类型定义

**Files:**
- Create: `src/conversation/types.ts`

- [ ] **Step 1: 定义核心类型**

```typescript
// 对话核心类型定义

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool'

export type MessageStatus = 'pending' | 'streaming' | 'complete' | 'error'

export interface Message {
  id: string
  role: MessageRole
  content: string | null
  status: MessageStatus
  timestamp: number
  toolCalls?: ToolCall[]
  toolCallId?: string
  name?: string
  // 支持分支回溯
  parentId?: string
  branchId?: string
}

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface Conversation {
  id: string
  name: string
  messages: Message[]
  createdAt: number
  updatedAt: number
  model: string
  // 分支管理
  branches: Map<string, Message[]> // branchId -> messages
  currentBranch: string
}

export interface ConversationSession {
  conversations: Conversation[]
  activeConversationId: string | null
}

export type ConversationEvent =
  | { type: 'messageAdded'; message: Message }
  | { type: 'messageUpdated'; message: Message }
  | { type: 'messageDeleted'; messageId: string }
  | { type: 'conversationCreated'; conversation: Conversation }
  | { type: 'conversationSwitched'; conversationId: string }
  | { type: 'branchCreated'; branchId: string; parentMessageId: string }
```

- [ ] **Step 2: 验证类型定义**

Run: `npx tsc --noEmit src/conversation/types.ts`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/conversation/types.ts
git commit -m "feat(conversation): add core conversation types"
```

---

### Task 2: 消息历史管理

**Files:**
- Create: `src/conversation/MessageHistory.ts`
- Test: `src/conversation/__tests__/MessageHistory.test.ts`

- [ ] **Step 1: 实现 MessageHistory 类**

```typescript
import { Message, MessageRole, MessageStatus, ToolCall } from './types.js'
import { v4 as uuidv4 } from 'uuid'

export class MessageHistory {
  private messages: Message[] = []
  private listeners: Set<(event: { type: string; message?: Message; messageId?: string }) => void> = new Set()

  addMessage(role: MessageRole, content: string, options?: {
    toolCalls?: ToolCall[]
    toolCallId?: string
    name?: string
    parentId?: string
  }): Message {
    const message: Message = {
      id: uuidv4(),
      role,
      content,
      status: 'complete',
      timestamp: Date.now(),
      ...options,
    }
    this.messages.push(message)
    this.emit('messageAdded', message)
    return message
  }

  updateMessage(id: string, updates: Partial<Message>): Message | null {
    const index = this.messages.findIndex(m => m.id === id)
    if (index === -1) return null
    
    this.messages[index] = { ...this.messages[index], ...updates }
    this.emit('messageUpdated', this.messages[index])
    return this.messages[index]
  }

  deleteMessage(id: string): boolean {
    const index = this.messages.findIndex(m => m.id === id)
    if (index === -1) return false
    
    this.messages.splice(index, 1)
    this.emit('messageDeleted', undefined, id)
    return true
  }

  getMessages(): Message[] {
    return [...this.messages]
  }

  getMessage(id: string): Message | undefined {
    return this.messages.find(m => m.id === id)
  }

  clear(): void {
    this.messages = []
    this.emit('cleared')
  }

  onChange(listener: (event: { type: string; message?: Message; messageId?: string }) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(type: string, message?: Message, messageId?: string): void {
    this.listeners.forEach(listener => listener({ type, message, messageId }))
  }
}
```

- [ ] **Step 2: 编写测试**

```typescript
import { MessageHistory } from '../MessageHistory.js'

describe('MessageHistory', () => {
  let history: MessageHistory

  beforeEach(() => {
    history = new MessageHistory()
  })

  test('adds message', () => {
    const message = history.addMessage('user', 'Hello')
    expect(message.content).toBe('Hello')
    expect(message.role).toBe('user')
    expect(history.getMessages()).toHaveLength(1)
  })

  test('updates message', () => {
    const message = history.addMessage('user', 'Hello')
    const updated = history.updateMessage(message.id, { content: 'Updated' })
    expect(updated?.content).toBe('Updated')
  })

  test('deletes message', () => {
    const message = history.addMessage('user', 'Hello')
    const deleted = history.deleteMessage(message.id)
    expect(deleted).toBe(true)
    expect(history.getMessages()).toHaveLength(0)
  })

  test('clears all messages', () => {
    history.addMessage('user', 'Hello')
    history.clear()
    expect(history.getMessages()).toHaveLength(0)
  })
})
```

- [ ] **Step 3: 运行测试**

Run: `npm test -- src/conversation/__tests__/MessageHistory.test.ts`
Expected: 所有测试通过

- [ ] **Step 4: Commit**

```bash
git add src/conversation/MessageHistory.ts src/conversation/__tests__/MessageHistory.test.ts
git commit -m "feat(conversation): add MessageHistory manager"
```

---

### Task 3: 会话管理器

**Files:**
- Create: `src/conversation/ConversationManager.ts`
- Test: `src/conversation/__tests__/ConversationManager.test.ts`

- [ ] **Step 1: 实现 ConversationManager**

```typescript
import { Conversation, Message, ConversationSession } from './types.js'
import { MessageHistory } from './MessageHistory.js'
import { v4 as uuidv4 } from 'uuid'

export class ConversationManager {
  private conversations: Map<string, Conversation> = new Map()
  private activeConversationId: string | null = null
  private listeners: Set<(event: { type: string; conversationId?: string }) => void> = new Set()

  createConversation(name: string, model: string): Conversation {
    const conversation: Conversation = {
      id: uuidv4(),
      name,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model,
      branches: new Map(),
      currentBranch: 'main',
    }
    this.conversations.set(conversation.id, conversation)
    this.emit('conversationCreated', conversation.id)
    return conversation
  }

  getConversation(id: string): Conversation | undefined {
    return this.conversations.get(id)
  }

  getAllConversations(): Conversation[] {
    return Array.from(this.conversations.values())
  }

  switchConversation(id: string): boolean {
    if (!this.conversations.has(id)) return false
    this.activeConversationId = id
    this.emit('conversationSwitched', id)
    return true
  }

  getActiveConversation(): Conversation | undefined {
    if (!this.activeConversationId) return undefined
    return this.conversations.get(this.activeConversationId)
  }

  deleteConversation(id: string): boolean {
    const deleted = this.conversations.delete(id)
    if (deleted && this.activeConversationId === id) {
      this.activeConversationId = null
    }
    this.emit('conversationDeleted', id)
    return deleted
  }

  renameConversation(id: string, newName: string): boolean {
    const conversation = this.conversations.get(id)
    if (!conversation) return false
    conversation.name = newName
    conversation.updatedAt = Date.now()
    this.emit('conversationRenamed', id)
    return true
  }

  // 分支管理
  createBranch(conversationId: string, parentMessageId: string, branchName: string): string | null {
    const conversation = this.conversations.get(conversationId)
    if (!conversation) return null

    const branchId = uuidv4()
    const parentMessage = conversation.messages.find(m => m.id === parentMessageId)
    if (!parentMessage) return null

    const branchMessages = conversation.messages.slice(0, conversation.messages.indexOf(parentMessage) + 1)
    conversation.branches.set(branchId, branchMessages)
    conversation.currentBranch = branchId

    this.emit('branchCreated', conversationId)
    return branchId
  }

  onChange(listener: (event: { type: string; conversationId?: string }) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(type: string, conversationId?: string): void {
    this.listeners.forEach(listener => listener({ type, conversationId }))
  }
}
```

- [ ] **Step 2: 编写测试**

```typescript
import { ConversationManager } from '../ConversationManager.js'

describe('ConversationManager', () => {
  let manager: ConversationManager

  beforeEach(() => {
    manager = new ConversationManager()
  })

  test('creates conversation', () => {
    const conversation = manager.createConversation('Test', 'MiMo-7B')
    expect(conversation.name).toBe('Test')
    expect(conversation.model).toBe('MiMo-7B')
    expect(manager.getAllConversations()).toHaveLength(1)
  })

  test('switches conversation', () => {
    const conversation = manager.createConversation('Test', 'MiMo-7B')
    const switched = manager.switchConversation(conversation.id)
    expect(switched).toBe(true)
    expect(manager.getActiveConversation()?.id).toBe(conversation.id)
  })

  test('deletes conversation', () => {
    const conversation = manager.createConversation('Test', 'MiMo-7B')
    manager.deleteConversation(conversation.id)
    expect(manager.getAllConversations()).toHaveLength(0)
  })

  test('renames conversation', () => {
    const conversation = manager.createConversation('Test', 'MiMo-7B')
    manager.renameConversation(conversation.id, 'New Name')
    expect(manager.getConversation(conversation.id)?.name).toBe('New Name')
  })
})
```

- [ ] **Step 3: 运行测试**

Run: `npm test -- src/conversation/__tests__/ConversationManager.test.ts`
Expected: 所有测试通过

- [ ] **Step 4: Commit**

```bash
git add src/conversation/ConversationManager.ts src/conversation/__tests__/ConversationManager.test.ts
git commit -m "feat(conversation): add ConversationManager"
```

---

### Task 4: 会话持久化

**Files:**
- Create: `src/conversation/persistence.ts`
- Test: `src/conversation/__tests__/persistence.test.ts`

- [ ] **Step 1: 实现持久化**

```typescript
import { Conversation, ConversationSession } from './types.js'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

const SESSIONS_DIR = path.join(os.homedir(), '.mimo', 'sessions')

export async function saveSession(session: ConversationSession): Promise<void> {
  await fs.mkdir(SESSIONS_DIR, { recursive: true })
  const filePath = path.join(SESSIONS_DIR, 'session.json')
  await fs.writeFile(filePath, JSON.stringify(session, null, 2))
}

export async function loadSession(): Promise<ConversationSession | null> {
  try {
    const filePath = path.join(SESSIONS_DIR, 'session.json')
    const data = await fs.readFile(filePath, 'utf-8')
    const session = JSON.parse(data)
    // 重建 Map
    session.conversations.forEach((conv: Conversation) => {
      conv.branches = new Map(Object.entries(conv.branches || {}))
    })
    return session
  } catch {
    return null
  }
}

export async function deleteSession(): Promise<void> {
  try {
    const filePath = path.join(SESSIONS_DIR, 'session.json')
    await fs.unlink(filePath)
  } catch {
    // 忽略错误
  }
}

export async function saveConversation(conversation: Conversation): Promise<void> {
  await fs.mkdir(SESSIONS_DIR, { recursive: true })
  const filePath = path.join(SESSIONS_DIR, `${conversation.id}.json`)
  const data = {
    ...conversation,
    branches: Object.fromEntries(conversation.branches),
  }
  await fs.writeFile(filePath, JSON.stringify(data, null, 2))
}
```

- [ ] **Step 2: 编写测试**

```typescript
import { saveSession, loadSession, deleteSession } from '../persistence.js'
import { ConversationSession } from '../types.js'

describe('persistence', () => {
  test('saves and loads session', async () => {
    const session: ConversationSession = {
      conversations: [],
      activeConversationId: null,
    }
    await saveSession(session)
    const loaded = await loadSession()
    expect(loaded).toEqual(session)
  })

  test('returns null for non-existent session', async () => {
    await deleteSession()
    const loaded = await loadSession()
    expect(loaded).toBeNull()
  })
})
```

- [ ] **Step 3: 运行测试**

Run: `npm test -- src/conversation/__tests__/persistence.test.ts`
Expected: 所有测试通过

- [ ] **Step 4: Commit**

```bash
git add src/conversation/persistence.ts src/conversation/__tests__/persistence.test.ts
git commit -m "feat(conversation): add session persistence"
```

---

## Phase 2: UI 组件重构

### Task 5: 聊天区域组件

**Files:**
- Create: `src/ui/components/ChatArea.tsx`

- [ ] **Step 1: 实现 ChatArea 组件**

```typescript
import React from 'react'
import { Box, Static, Text } from 'ink'
import type { Message, LiveToolCall, AgentStatus } from '../../conversation/types.js'

interface ChatAreaProps {
  history: Message[]
  streamingText: string
  liveTools: LiveToolCall[]
  status: AgentStatus
}

export function ChatArea({ history, streamingText, liveTools, status }: ChatAreaProps) {
  const isActive = status === 'thinking' || status === 'streaming' || status === 'running-tool'

  return (
    <Box flexDirection="column" flexGrow={1} overflow="hidden" paddingX={1}>
      <Static items={history}>
        {(item) => <MessageItem message={item} />}
      </Static>

      {liveTools.map((tool) => (
        <Box key={tool.id} paddingLeft={1}>
          <ToolCallItem tool={tool} />
        </Box>
      ))}

      {streamingText && (
        <Box flexDirection="column" marginY={1}>
          <Text bold color="green">
            MiMo
          </Text>
          <Box marginTop={0} flexDirection="column">
            <Text>{streamingText}</Text>
          </Box>
          <Text color="gray" dimColor>
            ▌
          </Text>
        </Box>
      )}

      {isActive && !streamingText && liveTools.length === 0 && (
        <Box marginY={1}>
          <Text color="yellow">MiMo is thinking...</Text>
        </Box>
      )}
    </Box>
  )
}

function MessageItem({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  return (
    <Box flexDirection="column" marginY={1}>
      <Text bold color={isUser ? 'blue' : 'green'}>
        {isUser ? 'You' : 'MiMo'}
      </Text>
      <Box marginTop={0} flexDirection="column">
        <Text>{message.content}</Text>
      </Box>
    </Box>
  )
}

function ToolCallItem({ tool }: { tool: LiveToolCall }) {
  return (
    <Box flexDirection="column" marginY={1}>
      <Text color="yellow">
        {tool.name} - {tool.status}
      </Text>
    </Box>
  )
}
```

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit src/ui/components/ChatArea.tsx`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/ChatArea.tsx
git commit -m "feat(ui): add ChatArea component"
```

---

### Task 6: 底部输入栏（Claude 风格）

**Files:**
- Create: `src/ui/components/InputBar.tsx`

- [ ] **Step 1: 实现 InputBar 组件**

```typescript
import React, { useState, useCallback } from 'react'
import { Box, Text, useInput, useStdout } from 'ink'

interface InputBarProps {
  onSubmit: (text: string) => void
  disabled?: boolean
  showPlaceholder?: boolean
  onCancel?: () => void
}

export function InputBar({ onSubmit, disabled = false, showPlaceholder = false, onCancel }: InputBarProps) {
  const { stdout } = useStdout()
  const width = stdout.columns || 80
  const [lines, setLines] = useState<string[]>([''])
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [draft, setDraft] = useState<string[] | null>(null)

  const currentLine = lines.length - 1
  const text = lines.join('\n')

  const updateCurrentLine = useCallback(
    (updater: (line: string) => string) => {
      setLines((prev) => {
        const next = [...prev]
        next[currentLine] = updater(next[currentLine] ?? '')
        return next
      })
    },
    [currentLine]
  )

  useInput(
    (input, key) => {
      if (disabled) {
        if (key.escape && onCancel) {
          onCancel()
        }
        return
      }

      if (key.escape && onCancel) {
        onCancel()
        return
      }

      if (key.return) {
        if (key.shift) {
          setLines((prev) => [...prev, ''])
          return
        }

        if (text.trim()) {
          const trimmed = text.trim()
          onSubmit(trimmed)
          setHistory((prev) =>
            prev[prev.length - 1] === trimmed ? prev : [...prev, trimmed]
          )
          setHistoryIndex(-1)
          setDraft(null)
          setLines([''])
        }
        return
      }

      if (key.upArrow) {
        if (history.length === 0) return
        if (historyIndex === -1) {
          setDraft(lines)
          setHistoryIndex(history.length - 1)
          setLines([history[history.length - 1]!])
        } else if (historyIndex > 0) {
          const nextIndex = historyIndex - 1
          setHistoryIndex(nextIndex)
          setLines([history[nextIndex]!])
        }
        return
      }

      if (key.downArrow) {
        if (historyIndex === -1) return
        if (historyIndex < history.length - 1) {
          const nextIndex = historyIndex + 1
          setHistoryIndex(nextIndex)
          setLines([history[nextIndex]!])
        } else {
          setHistoryIndex(-1)
          setLines(draft ?? [''])
          setDraft(null)
        }
        return
      }

      if (key.backspace || key.delete) {
        setLines((prev) => {
          const line = prev[currentLine] ?? ''
          if (line.length > 0) {
            const next = [...prev]
            next[currentLine] = line.slice(0, -1)
            return next
          }
          if (prev.length > 1) {
            const merged = [...prev]
            const prevLine = merged.pop()!
            merged[merged.length - 1] += prevLine
            return merged
          }
          return prev
        })
        return
      }

      if (key.ctrl && input === 'c') return

      if (input && !key.ctrl && !key.meta) {
        updateCurrentLine((line) => line + input)
      }
    },
    { isActive: !disabled || !!onCancel }
  )

  return (
    <Box flexDirection="column" flexShrink={0}>
      <Box>
        <Text color="gray">{'─'.repeat(Math.min(width - 2, 100))}</Text>
      </Box>

      <Box paddingX={1} flexDirection="column">
        {lines.map((line, i) => (
          <Box key={i}>
            <Text color="cyan" bold>
              {'❯ '}
            </Text>
            {line ? (
              <>
                <Text>{line}</Text>
                {i === currentLine && !disabled && <Text color="cyan">▌</Text>}
              </>
            ) : (
              i === currentLine &&
              !disabled && (
                <>
                  <Text color="cyan">▌</Text>
                  {showPlaceholder && (
                    <Text color="gray" dimColor>
                      {' '}
                      Ask MiMo anything...
                    </Text>
                  )}
                </>
              )
            )}
          </Box>
        ))}

        {disabled && (
          <Box marginTop={0}>
            <Text color="gray" dimColor>
              Esc to cancel · waiting for MiMo...
            </Text>
          </Box>
        )}
      </Box>

      <Box>
        <Text color="gray">{'─'.repeat(Math.min(width - 2, 100))}</Text>
      </Box>
    </Box>
  )
}
```

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit src/ui/components/InputBar.tsx`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/InputBar.tsx
git commit -m "feat(ui): add InputBar component with Claude style"
```

---

### Task 7: 顶部状态栏

**Files:**
- Create: `src/ui/components/StatusLine.tsx`

- [ ] **Step 1: 实现 StatusLine 组件**

```typescript
import React from 'react'
import { Box, Text, useStdout } from 'ink'
import type { AgentStatus } from '../../conversation/types.js'
import path from 'path'

interface StatusLineProps {
  model: string
  status: AgentStatus
  workingDir: string
  messageCount: number
}

function statusLabel(status: AgentStatus): { text: string; color: string } {
  switch (status) {
    case 'thinking':
      return { text: 'Thinking', color: 'yellow' }
    case 'streaming':
      return { text: 'Responding', color: 'green' }
    case 'running-tool':
      return { text: 'Running tool', color: 'cyan' }
    case 'awaiting-approval':
      return { text: 'Awaiting approval', color: 'yellow' }
    default:
      return { text: 'Ready', color: 'green' }
  }
}

function shortenDir(dir: string, maxLen: number): string {
  if (dir.length <= maxLen) return dir
  const base = path.basename(dir)
  const prefix = '…'
  const room = maxLen - prefix.length - base.length - 1
  if (room <= 0) return base.slice(0, maxLen)
  return prefix + dir.slice(-room) + path.sep + base
}

export function StatusLine({ model, status, workingDir, messageCount }: StatusLineProps) {
  const { stdout } = useStdout()
  const width = stdout.columns || 80
  const { text, color } = statusLabel(status)
  const dir = shortenDir(workingDir, Math.max(20, Math.floor(width * 0.35)))

  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      width="100%"
      paddingX={1}
      justifyContent="space-between"
    >
      <Box>
        <Text color="cyan" bold>
          {model}
        </Text>
        <Text color="gray"> · </Text>
        <Text color={color}>● {text}</Text>
        {messageCount > 0 && (
          <>
            <Text color="gray"> · </Text>
            <Text color="gray" dimColor>
              {messageCount} msgs
            </Text>
          </>
        )}
      </Box>
      <Box>
        <Text color="gray" dimColor>
          {dir}
        </Text>
        <Text color="gray"> · Ctrl+C exit</Text>
      </Box>
    </Box>
  )
}
```

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit src/ui/components/StatusLine.tsx`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/StatusLine.tsx
git commit -m "feat(ui): add StatusLine component"
```

---

### Task 8: 工具调用展示

**Files:**
- Create: `src/ui/components/ToolPanel.tsx`

- [ ] **Step 1: 实现 ToolPanel 组件**

```typescript
import React from 'react'
import { Box, Text } from 'ink'
import type { LiveToolCall, ToolStatus } from '../../conversation/types.js'

interface ToolPanelProps {
  tools: LiveToolCall[]
}

const TOOL_ICONS: Record<string, string> = {
  Read: '📖',
  Write: '✏️',
  Edit: '🔧',
  Bash: '⚡',
  Glob: '🔍',
  Grep: '🔎',
}

export function ToolPanel({ tools }: ToolPanelProps) {
  if (tools.length === 0) return null

  return (
    <Box flexDirection="column" marginY={1}>
      {tools.map((tool) => (
        <ToolItem key={tool.id} tool={tool} />
      ))}
    </Box>
  )
}

function ToolItem({ tool }: { tool: LiveToolCall }) {
  const icon = TOOL_ICONS[tool.name] || '🔧'
  const summary = formatToolSummary(tool.name, tool.args)

  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        <StatusIndicator status={tool.status} />
        <Text color="cyan">
          {' '}
          {icon} <Text bold>{tool.name}</Text>
        </Text>
        <Text color="gray"> {summary}</Text>
      </Box>
      {tool.result && tool.status !== 'running' && (
        <Box paddingLeft={4} marginTop={0}>
          <Text color={tool.status === 'error' ? 'red' : 'gray'} dimColor>
            {truncate(tool.result, 120)}
          </Text>
        </Box>
      )}
    </Box>
  )
}

function StatusIndicator({ status }: { status: ToolStatus }) {
  switch (status) {
    case 'running':
    case 'pending':
      return <Text color="yellow">⏳</Text>
    case 'success':
      return <Text color="green">✓</Text>
    case 'error':
      return <Text color="red">✗</Text>
    case 'denied':
      return <Text color="yellow">⊘</Text>
    default:
      return <Text color="gray">·</Text>
  }
}

function formatToolSummary(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'Read':
      return String(args.file_path || '')
    case 'Write':
      return String(args.file_path || '')
    case 'Edit':
      return String(args.file_path || '')
    case 'Bash':
      return truncate(String(args.command || ''), 60)
    case 'Glob':
      return String(args.pattern || '')
    case 'Grep':
      return `${args.pattern || ''} in ${args.path || '.'}`
    default:
      return truncate(JSON.stringify(args), 60)
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max) + '…'
}
```

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit src/ui/components/ToolPanel.tsx`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/ToolPanel.tsx
git commit -m "feat(ui): add ToolPanel component"
```

---

### Task 9: Diff 预览组件

**Files:**
- Create: `src/ui/components/DiffViewer.tsx`

- [ ] **Step 1: 实现 DiffViewer 组件**

```typescript
import React from 'react'
import { Box, Text } from 'ink'

interface DiffViewerProps {
  oldContent: string
  newContent: string
  filePath: string
}

export function DiffViewer({ oldContent, newContent, filePath }: DiffViewerProps) {
  const diff = computeDiff(oldContent, newContent)

  return (
    <Box flexDirection="column" marginY={1} borderStyle="round" borderColor="gray" paddingX={1}>
      <Text bold color="cyan">
        Diff: {filePath}
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {diff.map((line, index) => (
          <DiffLine key={index} line={line} />
        ))}
      </Box>
    </Box>
  )
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  content: string
  lineNumber: number
}

function DiffLine({ line }: { line: DiffLine }) {
  const color = line.type === 'added' ? 'green' : line.type === 'removed' ? 'red' : 'gray'
  const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '

  return (
    <Box>
      <Text color={color} dimColor>
        {prefix}
      </Text>
      <Text color={color}>{line.content}</Text>
    </Box>
  )
}

function computeDiff(oldContent: string, newContent: string): DiffLine[] {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')
  const result: DiffLine[] = []

  // 简化的 diff 算法
  const maxLen = Math.max(oldLines.length, newLines.length)
  for (let i = 0; i < maxLen; i++) {
    if (i >= oldLines.length) {
      result.push({ type: 'added', content: newLines[i], lineNumber: i + 1 })
    } else if (i >= newLines.length) {
      result.push({ type: 'removed', content: oldLines[i], lineNumber: i + 1 })
    } else if (oldLines[i] !== newLines[i]) {
      result.push({ type: 'removed', content: oldLines[i], lineNumber: i + 1 })
      result.push({ type: 'added', content: newLines[i], lineNumber: i + 1 })
    } else {
      result.push({ type: 'unchanged', content: oldLines[i], lineNumber: i + 1 })
    }
  }

  return result
}
```

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit src/ui/components/DiffViewer.tsx`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/DiffViewer.tsx
git commit -m "feat(ui): add DiffViewer component"
```

---

### Task 10: 思考中动画

**Files:**
- Create: `src/ui/components/ThinkingIndicator.tsx`

- [ ] **Step 1: 实现 ThinkingIndicator 组件**

```typescript
import React, { useState, useEffect } from 'react'
import { Box, Text } from 'ink'

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

interface ThinkingIndicatorProps {
  label?: string
  color?: string
}

export function ThinkingIndicator({ label = 'MiMo is thinking...', color = 'yellow' }: ThinkingIndicatorProps) {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % FRAMES.length)
    }, 80)
    return () => clearInterval(timer)
  }, [])

  return (
    <Box marginY={1}>
      <Text color={color}>
        {FRAMES[frame]} {label}
      </Text>
    </Box>
  )
}
```

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit src/ui/components/ThinkingIndicator.tsx`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/ThinkingIndicator.tsx
git commit -m "feat(ui): add ThinkingIndicator component"
```

---

### Task 11: 会话切换组件

**Files:**
- Create: `src/ui/components/SessionSwitcher.tsx`

- [ ] **Step 1: 实现 SessionSwitcher 组件**

```typescript
import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import type { Conversation } from '../../conversation/types.js'

interface SessionSwitcherProps {
  conversations: Conversation[]
  activeConversationId: string | null
  onSwitch: (conversationId: string) => void
  onCreate: () => void
  onClose: () => void
}

export function SessionSwitcher({
  conversations,
  activeConversationId,
  onSwitch,
  onCreate,
  onClose,
}: SessionSwitcherProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1))
    } else if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(conversations.length, prev + 1))
    } else if (key.return) {
      if (selectedIndex === conversations.length) {
        onCreate()
      } else {
        onSwitch(conversations[selectedIndex].id)
      }
    } else if (key.escape) {
      onClose()
    }
  })

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      marginY={1}
    >
      <Text bold color="cyan">
        Sessions
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {conversations.map((conversation, index) => (
          <Box key={conversation.id}>
            <Text color={index === selectedIndex ? 'cyan' : 'gray'}>
              {index === selectedIndex ? '❯ ' : '  '}
              {conversation.id === activeConversationId ? '● ' : '  '}
              {conversation.name}
            </Text>
          </Box>
        ))}
        <Box>
          <Text color={selectedIndex === conversations.length ? 'cyan' : 'gray'}>
            {selectedIndex === conversations.length ? '❯ ' : '  '}+ New Session
          </Text>
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          ↑↓ navigate · Enter select · Esc close
        </Text>
      </Box>
    </Box>
  )
}
```

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit src/ui/components/SessionSwitcher.tsx`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/SessionSwitcher.tsx
git commit -m "feat(ui): add SessionSwitcher component"
```

---

## Phase 3: Hooks

### Task 12: 对话管理 Hook

**Files:**
- Create: `src/ui/hooks/useConversation.ts`

- [ ] **Step 1: 实现 useConversation hook**

```typescript
import { useState, useCallback, useEffect } from 'react'
import { ConversationManager } from '../../conversation/ConversationManager.js'
import { MessageHistory } from '../../conversation/MessageHistory.js'
import type { Conversation, Message } from '../../conversation/types.js'

export function useConversation() {
  const [manager] = useState(() => new ConversationManager())
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null)
  const [messageHistory, setMessageHistory] = useState<MessageHistory | null>(null)

  const createConversation = useCallback((name: string, model: string) => {
    const conversation = manager.createConversation(name, model)
    manager.switchConversation(conversation.id)
    setActiveConversation(conversation)
    setMessageHistory(new MessageHistory())
    return conversation
  }, [manager])

  const switchConversation = useCallback((id: string) => {
    const switched = manager.switchConversation(id)
    if (switched) {
      setActiveConversation(manager.getActiveConversation() || null)
      setMessageHistory(new MessageHistory())
    }
    return switched
  }, [manager])

  const renameConversation = useCallback((id: string, newName: string) => {
    return manager.renameConversation(id, newName)
  }, [manager])

  const deleteConversation = useCallback((id: string) => {
    return manager.deleteConversation(id)
  }, [manager])

  return {
    conversations: manager.getAllConversations(),
    activeConversation,
    messageHistory,
    createConversation,
    switchConversation,
    renameConversation,
    deleteConversation,
  }
}
```

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit src/ui/hooks/useConversation.ts`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/ui/hooks/useConversation.ts
git commit -m "feat(ui): add useConversation hook"
```

---

### Task 13: 流式输出 Hook

**Files:**
- Create: `src/ui/hooks/useStreaming.ts`

- [ ] **Step 1: 实现 useStreaming hook**

```typescript
import { useState, useCallback, useRef } from 'react'

export function useStreaming() {
  const [streamingText, setStreamingText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const streamingTextRef = useRef('')

  const startStreaming = useCallback(() => {
    setStreamingText('')
    streamingTextRef.current = ''
    setIsStreaming(true)
  }, [])

  const appendText = useCallback((text: string) => {
    streamingTextRef.current += text
    setStreamingText(streamingTextRef.current)
  }, [])

  const stopStreaming = useCallback(() => {
    setIsStreaming(false)
    const finalText = streamingTextRef.current
    setStreamingText('')
    streamingTextRef.current = ''
    return finalText
  }, [])

  return {
    streamingText,
    isStreaming,
    startStreaming,
    appendText,
    stopStreaming,
  }
}
```

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit src/ui/hooks/useStreaming.ts`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/ui/hooks/useStreaming.ts
git commit -m "feat(ui): add useStreaming hook"
```

---

### Task 14: 工具审批 Hook

**Files:**
- Create: `src/ui/hooks/useToolApproval.ts`

- [ ] **Step 1: 实现 useToolApproval hook**

```typescript
import { useState, useCallback } from 'react'

interface ApprovalRequest {
  toolName: string
  input: Record<string, unknown>
  resolve: (approved: boolean) => void
}

export function useToolApproval() {
  const [approval, setApproval] = useState<ApprovalRequest | null>(null)

  const requestApproval = useCallback(
    (toolName: string, input: Record<string, unknown>): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        setApproval({ toolName, input, resolve })
      })
    },
    []
  )

  const handleApproval = useCallback(
    (approved: boolean) => {
      if (approval) {
        approval.resolve(approved)
        setApproval(null)
      }
    },
    [approval]
  )

  return {
    approval,
    requestApproval,
    handleApproval,
  }
}
```

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit src/ui/hooks/useToolApproval.ts`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/ui/hooks/useToolApproval.ts
git commit -m "feat(ui): add useToolApproval hook"
```

---

## Phase 4: 主应用组件

### Task 15: 重构 App.tsx

**Files:**
- Create: `src/ui/App.tsx`
- Delete: `src/tui/App.tsx`

- [ ] **Step 1: 实现新的 App.tsx**

```typescript
import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Box, useApp, useInput, useStdout } from 'ink'
import { AgentLoop } from '../agent/loop.js'
import type { Message, Config } from '../api/types.js'
import { ChatArea } from './components/ChatArea.js'
import { InputBar } from './components/InputBar.js'
import { StatusLine } from './components/StatusLine.js'
import { ToolPanel } from './components/ToolPanel.js'
import { SessionSwitcher } from './components/SessionSwitcher.js'
import { useConversation } from './hooks/useConversation.js'
import { useStreaming } from './hooks/useStreaming.js'
import { useToolApproval } from './hooks/useToolApproval.js'
import type { AgentStatus, LiveToolCall } from '../conversation/types.js'

interface AppProps {
  config: Config
}

export function App({ config }: AppProps) {
  const { exit } = useApp()
  const { stdout } = useStdout()

  const [showWelcome, setShowWelcome] = useState(true)
  const [showSessionSwitcher, setShowSessionSwitcher] = useState(false)
  const [history, setHistory] = useState<Message[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [liveTools, setLiveTools] = useState<LiveToolCall[]>([])
  const [status, setStatus] = useState<AgentStatus>('idle')

  const agentRef = useRef<AgentLoop | null>(null)
  const messagesRef = useRef<Message[]>([])
  const cancelledRef = useRef(false)
  const busyRef = useRef(false)

  const { streamingText, isStreaming, startStreaming, appendText, stopStreaming } = useStreaming()
  const { approval, requestApproval, handleApproval } = useToolApproval()
  const {
    conversations,
    activeConversation,
    createConversation,
    switchConversation,
    renameConversation,
    deleteConversation,
  } = useConversation()

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    agentRef.current = new AgentLoop(config, buildSystemPrompt())
  }, [config])

  const appendHistory = useCallback((message: Message) => {
    setHistory((prev) => [...prev, message])
  }, [])

  const handleCancel = useCallback(() => {
    if (!busyRef.current) return
    cancelledRef.current = true
    agentRef.current?.cancel()
  }, [])

  const handleUserMessage = useCallback(
    async (text: string) => {
      if (busyRef.current) return

      if (showWelcome) setShowWelcome(false)

      const userMsg: Message = { role: 'user', content: text }
      const updatedHistory = [...messagesRef.current, userMsg]

      setMessages(updatedHistory)
      appendHistory(userMsg)

      startStreaming()
      setLiveTools([])
      setStatus('thinking')
      busyRef.current = true
      cancelledRef.current = false

      const newMessages = await agentRef.current!.sendMessage(
        text,
        updatedHistory,
        {
          onText: (chunk: string) => {
            setStatus('streaming')
            appendText(chunk)
          },
          onToolCall: (toolCall: any, args: Record<string, unknown>) => {
            setStatus('running-tool')
            setLiveTools((prev) => [
              ...prev,
              {
                id: toolCall.id,
                name: toolCall.function.name,
                args,
                status: 'running',
              },
            ])
          },
          onToolResult: (toolCallId: string, _toolName: string, result: string, success: boolean) => {
            setLiveTools((prev) =>
              prev.map((t) =>
                t.id === toolCallId
                  ? {
                      ...t,
                      status: success
                        ? 'success'
                        : result.includes('denied')
                          ? 'denied'
                          : 'error',
                      result,
                    }
                  : t
              )
            )
          },
          onError: (error: string) => {
            if (streamingText.trim()) {
              appendHistory({ role: 'assistant', content: streamingText })
            }
            appendHistory({ role: 'system', content: `Error: ${error}` })
            stopStreaming()
            setLiveTools([])
            setStatus('idle')
            busyRef.current = false
          },
          onDone: () => {
            setStatus('idle')
          },
          onThinking: () => {
            setStatus('thinking')
          },
          requestApproval: (toolName: string, input: Record<string, unknown>) => {
            setStatus('awaiting-approval')
            return requestApproval(toolName, input)
          },
          isCancelled: () => cancelledRef.current,
        }
      )

      const finalText = stopStreaming()
      if (finalText) {
        appendHistory({ role: 'assistant', content: finalText })
      }

      if (newMessages.length > 0) {
        setMessages((prev) => [...prev, ...newMessages])
      }

      setLiveTools([])
      setStatus('idle')
      busyRef.current = false
    },
    [appendHistory, startStreaming, appendText, stopStreaming, streamingText, requestApproval, showWelcome]
  )

  const handleApproval = useCallback(
    (approved: boolean) => {
      handleApproval(approved)
      setStatus('running-tool')
    },
    [handleApproval]
  )

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      if (busyRef.current) {
        handleCancel()
      } else {
        exit()
      }
    }
  })

  const busy = status !== 'idle' && status !== 'awaiting-approval'
  const inputDisabled = busy || !!approval

  return (
    <Box flexDirection="column" height={stdout.rows}>
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {showWelcome ? (
          <WelcomeScreen model={config.model || 'MiMo-7B-RL'} />
        ) : (
          <ChatArea
            history={history}
            streamingText={streamingText}
            liveTools={liveTools}
            status={status}
          />
        )}
      </Box>

      <Box flexDirection="column" flexShrink={0}>
        {showSessionSwitcher && (
          <SessionSwitcher
            conversations={conversations}
            activeConversationId={activeConversation?.id || null}
            onSwitch={(id) => {
              switchConversation(id)
              setShowSessionSwitcher(false)
            }}
            onCreate={() => {
              createConversation('New Session', config.model || 'MiMo-7B-RL')
              setShowSessionSwitcher(false)
            }}
            onClose={() => setShowSessionSwitcher(false)}
          />
        )}
        <InputBar
          onSubmit={handleUserMessage}
          disabled={inputDisabled}
          showPlaceholder={showWelcome}
          onCancel={handleCancel}
        />
      </Box>

      <Box flexShrink={0}>
        <StatusLine
          model={config.model || 'MiMo'}
          status={approval ? 'awaiting-approval' : status}
          workingDir={process.cwd()}
          messageCount={messages.length}
        />
      </Box>
    </Box>
  )
}

function WelcomeScreen({ model }: { model: string }) {
  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          MiMo CLI
        </Text>
        <Text color="gray"> · AI coding assistant</Text>
      </Box>

      <Box
        borderStyle="round"
        borderColor="gray"
        paddingX={2}
        paddingY={1}
        flexDirection="column"
      >
        <Text bold color="green">
          Ready
        </Text>
        <Box marginTop={1} flexDirection="column">
          <Text color="gray">
            Model: <Text color="cyan">{model}</Text>
          </Text>
          <Text color="gray">
            CWD: <Text>{process.cwd()}</Text>
          </Text>
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text bold color="yellow">
            Getting started
          </Text>
          <Text> Ask questions or describe tasks in the input below.</Text>
          <Text color="gray">
            MiMo can read, edit, and search your codebase, and run shell
            commands (with your approval).
          </Text>
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text bold color="yellow">
            Shortcuts
          </Text>
          <Text color="gray"> ?  Show all shortcuts</Text>
          <Text color="gray"> /help  Commands · /clear  Reset chat</Text>
          <Text color="gray"> Shift+Enter  Multi-line input</Text>
        </Box>
      </Box>
    </Box>
  )
}

function buildSystemPrompt(): string {
  const cwd = process.cwd()
  const platform = process.platform
  const date = new Date().toISOString().split('T')[0]

  return `You are MiMo CLI, an expert AI coding assistant in the terminal (similar to Claude Code).

Environment:
- Working directory: ${cwd}
- Platform: ${platform}
- Date: ${date}

You have tools to read, write, and edit files, run shell commands, and search the codebase.

Behavior:
- Be direct and helpful. Prefer action over lengthy explanations.
- Use tools proactively to inspect code before making changes.
- When editing, read the file first unless you already have its contents.
- Prefer small, focused edits over rewriting entire files.
- Show concise summaries of what you did after using tools.
- Use markdown for code snippets and structured answers.
- Ask clarifying questions only when truly blocked.

Safety:
- Do not run destructive commands without explicit user request.
- Do not exfiltrate secrets or credentials.`
}
```

- [ ] **Step 2: 更新入口文件**

修改 `src/index.ts` 中的导入：

```typescript
import { App } from './ui/App.js'
```

- [ ] **Step 3: 验证编译**

Run: `npx tsc --noEmit src/ui/App.tsx`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add src/ui/App.tsx src/index.ts
git rm src/tui/App.tsx
git commit -m "feat(ui): refactor App component with new architecture"
```

---

## Phase 5: 清理旧代码

### Task 16: 删除旧 TUI 组件

**Files:**
- Delete: `src/tui/` 目录下所有文件

- [ ] **Step 1: 删除旧组件**

```bash
git rm -r src/tui/
git commit -m "chore: remove old tui components"
```

---

## Phase 6: 测试与验证

### Task 17: 运行完整测试

- [ ] **Step 1: 编译检查**

Run: `npm run build`
Expected: 无编译错误

- [ ] **Step 2: 运行测试**

Run: `npm test`
Expected: 所有测试通过

- [ ] **Step 3: 手动验证**

Run: `npm run dev`
Expected: 应用正常启动，交互流畅

---

## 总结

本计划将 MiMo CLI 从单体架构重构为模块化的对话管理架构，实现了：

1. **对话管理核心** - ConversationManager, MessageHistory, 持久化
2. **UI 组件重构** - ChatArea, InputBar, StatusLine, ToolPanel, DiffViewer, ThinkingIndicator, SessionSwitcher
3. **Hooks** - useConversation, useStreaming, useToolApproval
4. **视觉风格** - 严格对齐 Claude Code 的配色、布局、动画
5. **功能增强** - 消息编辑、会话管理、工具展示、diff 预览
