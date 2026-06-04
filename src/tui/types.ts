// TUI 显示层类型

import type { ReactNode } from 'react'

export type ToolStatus = 'pending' | 'running' | 'success' | 'error' | 'denied'

export interface LiveToolCall {
  id: string
  name: string
  args: Record<string, unknown>
  status: ToolStatus
  result?: string
}

export type AgentStatus =
  | 'idle'
  | 'thinking'
  | 'streaming'
  | 'awaiting-approval'
  | 'running-tool'

export type ChatEntryKind = 'user' | 'assistant' | 'tool' | 'system' | 'error'

export interface ChatEntry {
  id: string
  kind: ChatEntryKind
  content: string
  tool?: LiveToolCall
}

/** @deprecated use ChatEntry */
export interface StaticBlock {
  id: string
  node: ReactNode
}

// === Agent Phase ===
export type AgentPhase =
  | 'thinking'
  | 'streaming-text'
  | 'executing-tools'
  | 'awaiting-approval'
  | 'planning'
  | 'completed'
  | 'error'

// === Task Status ===
export type TaskStatus = 'pending' | 'running' | 'completed' | 'error' | 'cancelled'

// === Step Types ===
export type StepType = 'thinking' | 'tool-call' | 'text' | 'error' | 'retry' | 'phase-change'
export type StepStatus = 'pending' | 'running' | 'completed' | 'error' | 'denied'

// === Tool Call Detail ===
export interface ToolCallDetail {
  id: string
  name: string
  args: Record<string, unknown>
  result?: string
  success?: boolean
  duration?: number
  summary: string
  preview?: string
}

// === Task Step ===
export interface TaskStep {
  id: string
  type: StepType
  status: StepStatus
  label: string
  reasoning?: string
  toolCall?: ToolCallDetail
  startedAt: number
  completedAt?: number
  duration?: number
}

// === Agent Task Item ===
export interface AgentTaskItem {
  type: 'agent-task'
  id: string
  status: TaskStatus
  phase: AgentPhase
  steps: TaskStep[]
  streamingText: string
  finalText?: string
  startedAt: number
  completedAt?: number
  duration?: number
  iterationCount: number
  maxIterations: number
  error?: string
}

// === User Message Item ===
export interface UserMessageItem {
  type: 'user-message'
  id: string
  content: string
  timestamp: number
}

// === Timeline Item ===
export type TimelineItem = UserMessageItem | AgentTaskItem

// === Timeline ===
export interface Timeline {
  items: TimelineItem[]
  scrollOffset: number
}

// === Session Metrics ===
export interface SessionMetrics {
  totalToolCalls: number
  totalTokens: number
  sessionDuration: number
  taskCount: number
  errorCount: number
}

// === Agent Events ===
export type AgentEvent =
  | { type: 'agent:start'; taskId: string }
  | { type: 'agent:thinking'; taskId: string }
  | { type: 'agent:text-chunk'; taskId: string; chunk: string }
  | { type: 'agent:tool-call'; taskId: string; toolCall: { id: string; type: 'function'; function: { name: string; arguments: string } }; args: Record<string, unknown> }
  | { type: 'agent:tool-result'; taskId: string; toolCallId: string; result: string; success: boolean; duration: number }
  | { type: 'agent:iteration'; taskId: string; iteration: number }
  | { type: 'agent:error'; taskId: string; error: string }
  | { type: 'agent:complete'; taskId: string }
  | { type: 'agent:cancel'; taskId: string }
  | { type: 'agent:retry'; taskId: string; attempt: number; delayMs: number }
