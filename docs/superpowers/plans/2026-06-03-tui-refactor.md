# TUI Refactor: Chat Interface → Agent Workbench

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat ChatEntry[] message list with a structured Timeline/AgentTask/TaskStep architecture, making every tool call persistent, every execution phase visible, and the status bar rich with metrics.

**Architecture:** Event-driven Timeline model replacing dual entries/messages state. AgentLoop emits typed events → App subscribes → Timeline store updates → React components render. Completed items are immutable; only the active task mutates.

**Tech Stack:** TypeScript, React (Ink), Vitest, OpenAI SDK

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/tui/timeline.ts` | Timeline state management (pure functions) |
| `src/tui/events.ts` | Typed event emitter for agent events |
| `src/tui/Timeline.tsx` | Main timeline container component |
| `src/tui/AgentTask.tsx` | Agent task block with steps |
| `src/tui/TaskStep.tsx` | Individual step (collapsible) |
| `src/tui/ToolDetail.tsx` | Expanded tool view with input/output/duration |
| `src/tui/PhaseIndicator.tsx` | Phase progress visualization |
| `src/tui/ToolTimeline.tsx` | Compact tool timeline view |
| `src/tui/__tests__/timeline.test.ts` | Timeline pure function tests |
| `src/tui/__tests__/events.test.ts` | Event emitter tests |
| `src/tui/__tests__/Timeline.test.tsx` | Timeline component tests |
| `src/tui/__tests__/AgentTask.test.tsx` | AgentTask component tests |
| `src/tui/__tests__/TaskStep.test.tsx` | TaskStep component tests |
| `src/tui/__tests__/ToolDetail.test.tsx` | ToolDetail component tests |
| `src/tui/__tests__/StatusBar.test.tsx` | StatusBar component tests |
| `src/agent/__tests__/loop-events.test.ts` | AgentLoop event emission tests |

### Modified Files
| File | Changes |
|------|---------|
| `src/tui/types.ts` | Add Timeline, AgentTaskItem, TaskStep, ToolCallDetail, AgentPhase types |
| `src/agent/loop.ts` | Add event emission, phase tracking, iteration counting |
| `src/tui/App.tsx` | Replace entries/messages with timeline, subscribe to events |
| `src/tui/StatusBar.tsx` | Rewrite with 7 fields and metrics |
| `src/tui/entries.ts` | Remove (replaced by timeline.ts) |
| `src/tui/MessageList.tsx` | Remove (replaced by Timeline.tsx) |
| `src/tui/ToolCallBlock.tsx` | Remove (replaced by ToolDetail.tsx) |

---

## Task 1: Type Definitions

**Files:**
- Modify: `src/tui/types.ts`
- Test: `src/tui/__tests__/types.test.ts`

- [ ] **Step 1: Write type tests**

```typescript
// src/tui/__tests__/types.test.ts
import { describe, it, expect } from 'vitest'
import type {
  AgentPhase, TaskStatus, StepType, StepStatus,
  TimelineItem, UserMessageItem, AgentTaskItem, TaskStep, ToolCallDetail,
  AgentEvent, SessionMetrics,
} from '../types.js'

describe('TUI Types', () => {
  it('AgentPhase should have all expected values', () => {
    const phases: AgentPhase[] = [
      'thinking', 'streaming-text', 'executing-tools',
      'awaiting-approval', 'planning', 'completed', 'error',
    ]
    expect(phases).toHaveLength(7)
  })

  it('TaskStatus should have all expected values', () => {
    const statuses: TaskStatus[] = ['pending', 'running', 'completed', 'error', 'cancelled']
    expect(statuses).toHaveLength(5)
  })

  it('StepType should have all expected values', () => {
    const types: StepType[] = ['thinking', 'tool-call', 'text', 'error', 'retry', 'phase-change']
    expect(types).toHaveLength(6)
  })

  it('StepStatus should have all expected values', () => {
    const statuses: StepStatus[] = ['pending', 'running', 'completed', 'error', 'denied']
    expect(statuses).toHaveLength(5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tui/__tests__/types.test.ts`
Expected: FAIL — types don't exist yet

- [ ] **Step 3: Add new types to types.ts**

```typescript
// Add to src/tui/types.ts (append, keep existing types for backward compat)

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tui/__tests__/types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tui/types.ts src/tui/__tests__/types.test.ts
git commit -m "feat(tui): add Timeline, AgentTask, TaskStep type definitions"
```

---

## Task 2: Timeline Pure Functions

**Files:**
- Create: `src/tui/timeline.ts`
- Test: `src/tui/__tests__/timeline.test.ts`

- [ ] **Step 1: Write timeline tests**

```typescript
// src/tui/__tests__/timeline.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  createTimeline,
  addUserMessage,
  createAgentTask,
  addStep,
  updateStep,
  completeStep,
  updateTaskPhase,
  appendStreamingText,
  completeTask,
  cancelTask,
  getActiveTask,
  getTaskMetrics,
} from '../timeline.js'
import type { Timeline, AgentTaskItem, TaskStep } from '../types.js'

describe('createTimeline', () => {
  it('should create an empty timeline', () => {
    const timeline = createTimeline()
    expect(timeline.items).toEqual([])
    expect(timeline.scrollOffset).toBe(0)
  })
})

describe('addUserMessage', () => {
  it('should add a user message to timeline', () => {
    const timeline = createTimeline()
    const updated = addUserMessage(timeline, 'Hello')
    expect(updated.items).toHaveLength(1)
    expect(updated.items[0]).toMatchObject({
      type: 'user-message',
      content: 'Hello',
    })
    expect(updated.items[0].id).toBeDefined()
    expect((updated.items[0] as any).timestamp).toBeDefined()
  })

  it('should not mutate the original timeline', () => {
    const timeline = createTimeline()
    const updated = addUserMessage(timeline, 'Hello')
    expect(timeline.items).toHaveLength(0)
    expect(updated.items).toHaveLength(1)
  })
})

describe('createAgentTask', () => {
  it('should create a running agent task', () => {
    const timeline = createTimeline()
    const updated = createAgentTask(timeline, 50)
    expect(updated.items).toHaveLength(1)
    const task = updated.items[0] as AgentTaskItem
    expect(task.type).toBe('agent-task')
    expect(task.status).toBe('running')
    expect(task.phase).toBe('thinking')
    expect(task.steps).toEqual([])
    expect(task.streamingText).toBe('')
    expect(task.iterationCount).toBe(0)
    expect(task.maxIterations).toBe(50)
  })
})

describe('addStep', () => {
  it('should add a step to the active task', () => {
    let timeline = createTimeline()
    timeline = createAgentTask(timeline, 50)
    timeline = addStep(timeline, {
      id: 'step-1',
      type: 'tool-call',
      status: 'running',
      label: 'Read file',
      startedAt: Date.now(),
    })
    const task = timeline.items[0] as AgentTaskItem
    expect(task.steps).toHaveLength(1)
    expect(task.steps[0].id).toBe('step-1')
  })

  it('should append steps in order', () => {
    let timeline = createTimeline()
    timeline = createAgentTask(timeline, 50)
    timeline = addStep(timeline, { id: 'step-1', type: 'tool-call', status: 'running', label: 'Step 1', startedAt: 1 })
    timeline = addStep(timeline, { id: 'step-2', type: 'tool-call', status: 'running', label: 'Step 2', startedAt: 2 })
    const task = timeline.items[0] as AgentTaskItem
    expect(task.steps.map(s => s.id)).toEqual(['step-1', 'step-2'])
  })
})

describe('updateStep', () => {
  it('should update step fields', () => {
    let timeline = createTimeline()
    timeline = createAgentTask(timeline, 50)
    timeline = addStep(timeline, { id: 'step-1', type: 'tool-call', status: 'running', label: 'Read', startedAt: 1 })
    timeline = updateStep(timeline, 'step-1', { status: 'completed', duration: 300 })
    const task = timeline.items[0] as AgentTaskItem
    expect(task.steps[0].status).toBe('completed')
    expect(task.steps[0].duration).toBe(300)
  })
})

describe('completeStep', () => {
  it('should mark step as completed with duration', () => {
    let timeline = createTimeline()
    timeline = createAgentTask(timeline, 50)
    timeline = addStep(timeline, { id: 'step-1', type: 'tool-call', status: 'running', label: 'Read', startedAt: 1000 })
    timeline = completeStep(timeline, 'step-1', true, 1500)
    const task = timeline.items[0] as AgentTaskItem
    expect(task.steps[0].status).toBe('completed')
    expect(task.steps[0].completedAt).toBe(1500)
    expect(task.steps[0].duration).toBe(500)
  })

  it('should mark step as error on failure', () => {
    let timeline = createTimeline()
    timeline = createAgentTask(timeline, 50)
    timeline = addStep(timeline, { id: 'step-1', type: 'tool-call', status: 'running', label: 'Read', startedAt: 1000 })
    timeline = completeStep(timeline, 'step-1', false, 1500)
    const task = timeline.items[0] as AgentTaskItem
    expect(task.steps[0].status).toBe('error')
  })

  it('should mark step as denied', () => {
    let timeline = createTimeline()
    timeline = createAgentTask(timeline, 50)
    timeline = addStep(timeline, { id: 'step-1', type: 'tool-call', status: 'running', label: 'Bash', startedAt: 1000 })
    timeline = completeStep(timeline, 'step-1', false, 1500, 'denied')
    const task = timeline.items[0] as AgentTaskItem
    expect(task.steps[0].status).toBe('denied')
  })
})

describe('updateTaskPhase', () => {
  it('should update the active task phase', () => {
    let timeline = createTimeline()
    timeline = createAgentTask(timeline, 50)
    timeline = updateTaskPhase(timeline, 'executing-tools')
    const task = timeline.items[0] as AgentTaskItem
    expect(task.phase).toBe('executing-tools')
  })
})

describe('appendStreamingText', () => {
  it('should append text to the active task', () => {
    let timeline = createTimeline()
    timeline = createAgentTask(timeline, 50)
    timeline = appendStreamingText(timeline, 'Hello ')
    timeline = appendStreamingText(timeline, 'world')
    const task = timeline.items[0] as AgentTaskItem
    expect(task.streamingText).toBe('Hello world')
  })
})

describe('completeTask', () => {
  it('should mark task as completed', () => {
    let timeline = createTimeline()
    timeline = createAgentTask(timeline, 50)
    timeline = appendStreamingText(timeline, 'Done!')
    timeline = completeTask(timeline)
    const task = timeline.items[0] as AgentTaskItem
    expect(task.status).toBe('completed')
    expect(task.phase).toBe('completed')
    expect(task.finalText).toBe('Done!')
    expect(task.completedAt).toBeDefined()
    expect(task.duration).toBeDefined()
  })
})

describe('cancelTask', () => {
  it('should mark task as cancelled', () => {
    let timeline = createTimeline()
    timeline = createAgentTask(timeline, 50)
    timeline = cancelTask(timeline)
    const task = timeline.items[0] as AgentTaskItem
    expect(task.status).toBe('cancelled')
    expect(task.completedAt).toBeDefined()
  })
})

describe('getActiveTask', () => {
  it('should return the last agent task if running', () => {
    let timeline = createTimeline()
    timeline = addUserMessage(timeline, 'Hello')
    timeline = createAgentTask(timeline, 50)
    const active = getActiveTask(timeline)
    expect(active).toBeDefined()
    expect(active!.type).toBe('agent-task')
  })

  it('should return null if no active task', () => {
    const timeline = createTimeline()
    expect(getActiveTask(timeline)).toBeNull()
  })

  it('should return null if last task is completed', () => {
    let timeline = createTimeline()
    timeline = createAgentTask(timeline, 50)
    timeline = completeTask(timeline)
    expect(getActiveTask(timeline)).toBeNull()
  })
})

describe('getTaskMetrics', () => {
  it('should count tool calls and compute duration', () => {
    let timeline = createTimeline()
    timeline = createAgentTask(timeline, 50)
    timeline = addStep(timeline, {
      id: 's1', type: 'tool-call', status: 'completed', label: 'Read',
      startedAt: 1000, completedAt: 1300, duration: 300,
      toolCall: { id: 'tc1', name: 'Read', args: {}, summary: 'file.ts', success: true },
    })
    timeline = addStep(timeline, {
      id: 's2', type: 'tool-call', status: 'completed', label: 'Write',
      startedAt: 1300, completedAt: 1800, duration: 500,
      toolCall: { id: 'tc2', name: 'Write', args: {}, summary: 'file.ts', success: true },
    })
    timeline = addStep(timeline, {
      id: 's3', type: 'error', status: 'error', label: 'Error',
      startedAt: 1800, completedAt: 1800, duration: 0,
    })
    const metrics = getTaskMetrics(timeline)
    expect(metrics.toolCalls).toBe(2)
    expect(metrics.stepsCompleted).toBe(2)
    expect(metrics.stepsTotal).toBe(3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tui/__tests__/timeline.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement timeline.ts**

```typescript
// src/tui/timeline.ts
import type {
  Timeline, TimelineItem, UserMessageItem, AgentTaskItem,
  TaskStep, AgentPhase, TaskStatus, StepStatus,
} from './types.js'

let idCounter = 0
function nextId(prefix: string): string {
  return `${prefix}-${++idCounter}`
}

export function resetTimelineIds(): void {
  idCounter = 0
}

export function createTimeline(): Timeline {
  return { items: [], scrollOffset: 0 }
}

export function addUserMessage(timeline: Timeline, content: string): Timeline {
  const item: UserMessageItem = {
    type: 'user-message',
    id: nextId('user'),
    content,
    timestamp: Date.now(),
  }
  return { ...timeline, items: [...timeline.items, item] }
}

export function createAgentTask(timeline: Timeline, maxIterations: number): Timeline {
  const task: AgentTaskItem = {
    type: 'agent-task',
    id: nextId('task'),
    status: 'running',
    phase: 'thinking',
    steps: [],
    streamingText: '',
    startedAt: Date.now(),
    iterationCount: 0,
    maxIterations,
  }
  return { ...timeline, items: [...timeline.items, task] }
}

export function addStep(timeline: Timeline, step: TaskStep): Timeline {
  const items = [...timeline.items]
  const lastIdx = items.length - 1
  const last = items[lastIdx]
  if (!last || last.type !== 'agent-task') return timeline
  items[lastIdx] = { ...last, steps: [...last.steps, step] }
  return { ...timeline, items }
}

export function updateStep(
  timeline: Timeline,
  stepId: string,
  updates: Partial<TaskStep>
): Timeline {
  const items = [...timeline.items]
  const lastIdx = items.length - 1
  const last = items[lastIdx]
  if (!last || last.type !== 'agent-task') return timeline
  items[lastIdx] = {
    ...last,
    steps: last.steps.map(s => s.id === stepId ? { ...s, ...updates } : s),
  }
  return { ...timeline, items }
}

export function completeStep(
  timeline: Timeline,
  stepId: string,
  success: boolean,
  completedAt: number,
  overrideStatus?: StepStatus
): Timeline {
  const items = [...timeline.items]
  const lastIdx = items.length - 1
  const last = items[lastIdx]
  if (!last || last.type !== 'agent-task') return timeline
  items[lastIdx] = {
    ...last,
    steps: last.steps.map(s => {
      if (s.id !== stepId) return s
      const status: StepStatus = overrideStatus ?? (success ? 'completed' : 'error')
      return {
        ...s,
        status,
        completedAt,
        duration: completedAt - s.startedAt,
      }
    }),
  }
  return { ...timeline, items }
}

export function updateTaskPhase(timeline: Timeline, phase: AgentPhase): Timeline {
  const items = [...timeline.items]
  const lastIdx = items.length - 1
  const last = items[lastIdx]
  if (!last || last.type !== 'agent-task') return timeline
  items[lastIdx] = { ...last, phase }
  return { ...timeline, items }
}

export function appendStreamingText(timeline: Timeline, chunk: string): Timeline {
  const items = [...timeline.items]
  const lastIdx = items.length - 1
  const last = items[lastIdx]
  if (!last || last.type !== 'agent-task') return timeline
  items[lastIdx] = { ...last, streamingText: last.streamingText + chunk }
  return { ...timeline, items }
}

export function incrementIteration(timeline: Timeline): Timeline {
  const items = [...timeline.items]
  const lastIdx = items.length - 1
  const last = items[lastIdx]
  if (!last || last.type !== 'agent-task') return timeline
  items[lastIdx] = { ...last, iterationCount: last.iterationCount + 1 }
  return { ...timeline, items }
}

export function completeTask(timeline: Timeline): Timeline {
  const items = [...timeline.items]
  const lastIdx = items.length - 1
  const last = items[lastIdx]
  if (!last || last.type !== 'agent-task') return timeline
  const now = Date.now()
  items[lastIdx] = {
    ...last,
    status: 'completed',
    phase: 'completed',
    finalText: last.streamingText,
    completedAt: now,
    duration: now - last.startedAt,
  }
  return { ...timeline, items }
}

export function errorTask(timeline: Timeline, _error: string): Timeline {
  const items = [...timeline.items]
  const lastIdx = items.length - 1
  const last = items[lastIdx]
  if (!last || last.type !== 'agent-task') return timeline
  const now = Date.now()
  items[lastIdx] = {
    ...last,
    status: 'error',
    phase: 'error',
    completedAt: now,
    duration: now - last.startedAt,
  }
  return { ...timeline, items }
}

export function cancelTask(timeline: Timeline): Timeline {
  const items = [...timeline.items]
  const lastIdx = items.length - 1
  const last = items[lastIdx]
  if (!last || last.type !== 'agent-task') return timeline
  const now = Date.now()
  items[lastIdx] = {
    ...last,
    status: 'cancelled',
    completedAt: now,
    duration: now - last.startedAt,
  }
  return { ...timeline, items }
}

export function getActiveTask(timeline: Timeline): AgentTaskItem | null {
  const last = timeline.items[timeline.items.length - 1]
  if (!last || last.type !== 'agent-task') return null
  if (last.status !== 'running') return null
  return last
}

export function getTaskMetrics(timeline: Timeline): {
  toolCalls: number
  stepsCompleted: number
  stepsTotal: number
  errors: number
} {
  const task = timeline.items[timeline.items.length - 1]
  if (!task || task.type !== 'agent-task') {
    return { toolCalls: 0, stepsCompleted: 0, stepsTotal: 0, errors: 0 }
  }
  return {
    toolCalls: task.steps.filter(s => s.type === 'tool-call').length,
    stepsCompleted: task.steps.filter(s => s.status === 'completed').length,
    stepsTotal: task.steps.length,
    errors: task.steps.filter(s => s.status === 'error').length,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tui/__tests__/timeline.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tui/timeline.ts src/tui/__tests__/timeline.test.ts
git commit -m "feat(tui): implement Timeline pure state management functions"
```

---

## Task 3: Event Emitter

**Files:**
- Create: `src/tui/events.ts`
- Test: `src/tui/__tests__/events.test.ts`

- [ ] **Step 1: Write event emitter tests**

```typescript
// src/tui/__tests__/events.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AgentEventEmitter } from '../events.js'
import type { AgentEvent } from '../types.js'

describe('AgentEventEmitter', () => {
  let emitter: AgentEventEmitter

  beforeEach(() => {
    emitter = new AgentEventEmitter()
  })

  it('should emit and receive events', () => {
    const handler = vi.fn()
    emitter.on('agent:start', handler)
    emitter.emit({ type: 'agent:start', taskId: 'task-1' })
    expect(handler).toHaveBeenCalledWith({ type: 'agent:start', taskId: 'task-1' })
  })

  it('should support multiple handlers for same event', () => {
    const handler1 = vi.fn()
    const handler2 = vi.fn()
    emitter.on('agent:start', handler1)
    emitter.on('agent:start', handler2)
    emitter.emit({ type: 'agent:start', taskId: 'task-1' })
    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(1)
  })

  it('should support unsubscribing', () => {
    const handler = vi.fn()
    const unsubscribe = emitter.on('agent:start', handler)
    unsubscribe()
    emitter.emit({ type: 'agent:start', taskId: 'task-1' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('should not call handler for different event type', () => {
    const handler = vi.fn()
    emitter.on('agent:start', handler)
    emitter.emit({ type: 'agent:complete', taskId: 'task-1' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('should handle all event types', () => {
    const handler = vi.fn()
    const events: AgentEvent[] = [
      { type: 'agent:start', taskId: 't1' },
      { type: 'agent:thinking', taskId: 't1' },
      { type: 'agent:text-chunk', taskId: 't1', chunk: 'hello' },
      { type: 'agent:tool-call', taskId: 't1', toolCall: { id: 'tc1', type: 'function', function: { name: 'Read', arguments: '{}' } }, args: {} },
      { type: 'agent:tool-result', taskId: 't1', toolCallId: 'tc1', result: 'ok', success: true, duration: 100 },
      { type: 'agent:iteration', taskId: 't1', iteration: 1 },
      { type: 'agent:error', taskId: 't1', error: 'fail' },
      { type: 'agent:complete', taskId: 't1' },
      { type: 'agent:cancel', taskId: 't1' },
      { type: 'agent:retry', taskId: 't1', attempt: 1, delayMs: 1000 },
    ]
    for (const event of events) {
      emitter.on(event.type as any, handler)
      emitter.emit(event)
    }
    expect(handler).toHaveBeenCalledTimes(events.length)
  })

  it('should support wildcard listener', () => {
    const handler = vi.fn()
    emitter.onAny(handler)
    emitter.emit({ type: 'agent:start', taskId: 't1' })
    emitter.emit({ type: 'agent:complete', taskId: 't1' })
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('should clear all listeners', () => {
    const handler = vi.fn()
    emitter.on('agent:start', handler)
    emitter.onAny(handler)
    emitter.clear()
    emitter.emit({ type: 'agent:start', taskId: 't1' })
    expect(handler).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tui/__tests__/events.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement events.ts**

```typescript
// src/tui/events.ts
import type { AgentEvent } from './types.js'

type EventHandler<T extends AgentEvent = AgentEvent> = (event: T) => void

export class AgentEventEmitter {
  private handlers = new Map<string, Set<EventHandler>>()
  private anyHandlers = new Set<EventHandler>()

  on<T extends AgentEvent['type']>(
    type: T,
    handler: EventHandler<Extract<AgentEvent, { type: T }>>
  ): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)!.add(handler as EventHandler)
    return () => {
      this.handlers.get(type)?.delete(handler as EventHandler)
    }
  }

  onAny(handler: EventHandler): () => void {
    this.anyHandlers.add(handler)
    return () => {
      this.anyHandlers.delete(handler)
    }
  }

  emit(event: AgentEvent): void {
    const handlers = this.handlers.get(event.type)
    if (handlers) {
      for (const handler of handlers) {
        handler(event)
      }
    }
    for (const handler of this.anyHandlers) {
      handler(event)
    }
  }

  clear(): void {
    this.handlers.clear()
    this.anyHandlers.clear()
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tui/__tests__/events.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tui/events.ts src/tui/__tests__/events.test.ts
git commit -m "feat(tui): implement typed AgentEventEmitter"
```

---

## Task 4: AgentLoop Event Integration

**Files:**
- Modify: `src/agent/loop.ts`
- Test: `src/agent/__tests__/loop-events.test.ts`

- [ ] **Step 1: Write event emission tests**

```typescript
// src/agent/__tests__/loop-events.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AgentEventEmitter } from '../../tui/events.js'
import type { AgentEvent } from '../../tui/types.js'

describe('AgentLoop event integration', () => {
  it('AgentEventEmitter should be importable from agent context', () => {
    const emitter = new AgentEventEmitter()
    expect(emitter).toBeDefined()
    expect(typeof emitter.emit).toBe('function')
    expect(typeof emitter.on).toBe('function')
  })

  it('should handle event lifecycle', () => {
    const emitter = new AgentEventEmitter()
    const events: AgentEvent[] = []
    emitter.onAny((e) => events.push(e))

    emitter.emit({ type: 'agent:start', taskId: 'task-1' })
    emitter.emit({ type: 'agent:thinking', taskId: 'task-1' })
    emitter.emit({ type: 'agent:tool-call', taskId: 'task-1', toolCall: { id: 'tc1', type: 'function', function: { name: 'Read', arguments: '{}' } }, args: { file_path: 'test.ts' } })
    emitter.emit({ type: 'agent:tool-result', taskId: 'task-1', toolCallId: 'tc1', result: 'content', success: true, duration: 100 })
    emitter.emit({ type: 'agent:complete', taskId: 'task-1' })

    expect(events).toHaveLength(5)
    expect(events.map(e => e.type)).toEqual([
      'agent:start', 'agent:thinking', 'agent:tool-call', 'agent:tool-result', 'agent:complete',
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run src/agent/__tests__/loop-events.test.ts`
Expected: PASS (tests only the emitter, not the full loop which needs API)

- [ ] **Step 3: Add event emitter to AgentLoop**

Add to `src/agent/loop.ts`:

```typescript
// Add import at top
import { AgentEventEmitter } from '../tui/events.js'

// Add to AgentLoop class:
// After line "private cancelled = false"
private eventEmitter = new AgentEventEmitter()

// New methods:
getEventEmitter(): AgentEventEmitter {
  return this.eventEmitter
}

// In sendMessage(), wrap existing callbacks with event emission:
// At the start of sendMessage, after this.resetCancel():
const taskId = `task-${Date.now()}`
this.eventEmitter.emit({ type: 'agent:start', taskId })

// In onThinking callback, add:
this.eventEmitter.emit({ type: 'agent:thinking', taskId })

// In onText callback, add:
this.eventEmitter.emit({ type: 'agent:text-chunk', taskId, chunk })

// In onToolCall callback, add:
this.eventEmitter.emit({ type: 'agent:tool-call', taskId, toolCall, args })

// In onToolResult callback, add:
this.eventEmitter.emit({ type: 'agent:tool-result', taskId, toolCallId, result, success, duration: 0 })

// In onDone callback, add:
this.eventEmitter.emit({ type: 'agent:complete', taskId })

// In onError callback, add:
this.eventEmitter.emit({ type: 'agent:error', taskId, error })

// At the start of each while loop iteration:
this.eventEmitter.emit({ type: 'agent:iteration', taskId, iteration })
```

- [ ] **Step 4: Run all existing tests to verify no regression**

Run: `npx vitest run`
Expected: All existing tests still pass

- [ ] **Step 5: Commit**

```bash
git add src/agent/loop.ts src/agent/__tests__/loop-events.test.ts
git commit -m "feat(agent): add event emission to AgentLoop"
```

---

## Task 5: StatusBar Rewrite

**Files:**
- Modify: `src/tui/StatusBar.tsx`
- Test: `src/tui/__tests__/StatusBar.test.tsx`

- [ ] **Step 1: Write StatusBar tests**

```typescript
// src/tui/__tests__/StatusBar.test.tsx
import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { StatusBar } from '../StatusBar.js'

describe('StatusBar', () => {
  it('should render model name', () => {
    const { lastFrame } = render(
      React.createElement(StatusBar, {
        model: 'MiMo-7B-RL',
        phase: 'thinking',
        iteration: 1,
        maxIterations: 50,
        toolCallsTotal: 0,
        toolCallsActive: 0,
        tokenCount: 0,
        duration: 0,
        workingDir: '/home/user/project',
      })
    )
    expect(lastFrame()).toContain('MiMo-7B-RL')
  })

  it('should render thinking phase', () => {
    const { lastFrame } = render(
      React.createElement(StatusBar, {
        model: 'MiMo',
        phase: 'thinking',
        iteration: 1,
        maxIterations: 50,
        toolCallsTotal: 0,
        toolCallsActive: 0,
        tokenCount: 0,
        duration: 3000,
        workingDir: '/project',
      })
    )
    expect(lastFrame()).toContain('Thinking')
  })

  it('should render executing-tools phase with tool count', () => {
    const { lastFrame } = render(
      React.createElement(StatusBar, {
        model: 'MiMo',
        phase: 'executing-tools',
        iteration: 3,
        maxIterations: 50,
        toolCallsTotal: 5,
        toolCallsActive: 2,
        tokenCount: 1234,
        duration: 60000,
        workingDir: '/project',
      })
    )
    const output = lastFrame()
    expect(output).toContain('5 tools')
    expect(output).toContain('Iter 3')
  })

  it('should render duration in mm:ss format', () => {
    const { lastFrame } = render(
      React.createElement(StatusBar, {
        model: 'MiMo',
        phase: 'streaming-text',
        iteration: 1,
        maxIterations: 50,
        toolCallsTotal: 0,
        toolCallsActive: 0,
        tokenCount: 500,
        duration: 125000,
        workingDir: '/project',
      })
    )
    expect(lastFrame()).toContain('2:05')
  })

  it('should render idle phase as Ready', () => {
    const { lastFrame } = render(
      React.createElement(StatusBar, {
        model: 'MiMo',
        phase: 'completed',
        iteration: 0,
        maxIterations: 50,
        toolCallsTotal: 3,
        toolCallsActive: 0,
        tokenCount: 1000,
        duration: 0,
        workingDir: '/project',
      })
    )
    expect(lastFrame()).toContain('Ready')
  })

  it('should render token count when > 0', () => {
    const { lastFrame } = render(
      React.createElement(StatusBar, {
        model: 'MiMo',
        phase: 'completed',
        iteration: 0,
        maxIterations: 50,
        toolCallsTotal: 0,
        toolCallsActive: 0,
        tokenCount: 45678,
        duration: 0,
        workingDir: '/project',
      })
    )
    expect(lastFrame()).toContain('45,678 tok')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tui/__tests__/StatusBar.test.tsx`
Expected: FAIL — props don't match

- [ ] **Step 3: Rewrite StatusBar**

```typescript
// src/tui/StatusBar.tsx
import React from 'react'
import { Box, Text, useStdout } from 'ink'
import type { AgentPhase } from './types.js'
import path from 'path'

interface StatusBarProps {
  model: string
  phase: AgentPhase | 'idle'
  iteration: number
  maxIterations: number
  toolCallsTotal: number
  toolCallsActive: number
  tokenCount: number
  duration: number
  workingDir: string
  error?: string
  approvalTool?: string
}

function phaseLabel(phase: AgentPhase | 'idle'): { text: string; color: string } {
  switch (phase) {
    case 'thinking':
      return { text: 'Thinking', color: 'yellow' }
    case 'streaming-text':
      return { text: 'Streaming', color: 'green' }
    case 'executing-tools':
      return { text: 'Running', color: 'cyan' }
    case 'awaiting-approval':
      return { text: 'Awaiting', color: 'yellow' }
    case 'planning':
      return { text: 'Planning', color: 'blue' }
    case 'completed':
      return { text: 'Ready', color: 'green' }
    case 'error':
      return { text: 'Error', color: 'red' }
    default:
      return { text: 'Ready', color: 'green' }
  }
}

function formatDuration(ms: number): string {
  if (ms <= 0) return ''
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function formatTokens(n: number): string {
  if (n <= 0) return ''
  return n.toLocaleString('en-US') + ' tok'
}

function shortenDir(dir: string, maxLen: number): string {
  if (dir.length <= maxLen) return dir
  const home = process.env.HOME || process.env.USERPROFILE || ''
  let display = dir
  if (home && dir.startsWith(home)) {
    display = '~' + dir.slice(home.length)
  }
  if (display.length <= maxLen) return display
  const base = path.basename(display)
  const prefix = '…'
  const room = maxLen - prefix.length - base.length - 1
  if (room <= 0) return base.slice(0, maxLen)
  return prefix + display.slice(-room) + path.sep + base
}

export function StatusBar({
  model,
  phase,
  iteration,
  maxIterations,
  toolCallsTotal,
  toolCallsActive,
  tokenCount,
  duration,
  workingDir,
  error,
  approvalTool,
}: StatusBarProps) {
  const { stdout } = useStdout()
  const width = stdout.columns || 80
  const { text: phaseText, color: phaseColor } = phaseLabel(phase)
  const dir = shortenDir(workingDir, Math.max(20, Math.floor(width * 0.25)))

  return (
    <Box
      borderStyle="single"
      borderColor={phase === 'error' ? 'red' : 'gray'}
      width="100%"
      paddingX={1}
      justifyContent="space-between"
    >
      <Box>
        <Text color="cyan" bold>{model}</Text>
        <Text color="gray"> │ </Text>
        <Text color={phaseColor}>● {phaseText}</Text>
        {iteration > 0 && (
          <>
            <Text color="gray"> │ </Text>
            <Text color="gray">Iter {iteration}/{maxIterations}</Text>
          </>
        )}
        {toolCallsTotal > 0 && (
          <>
            <Text color="gray"> │ </Text>
            <Text color="gray">{toolCallsTotal} tools</Text>
            {toolCallsActive > 0 && (
              <Text color="cyan"> ({toolCallsActive} active)</Text>
            )}
          </>
        )}
      </Box>
      <Box>
        {tokenCount > 0 && (
          <>
            <Text color="gray" dimColor>{formatTokens(tokenCount)}</Text>
            <Text color="gray"> │ </Text>
          </>
        )}
        {duration > 0 && (
          <>
            <Text color="gray" dimColor>{formatDuration(duration)}</Text>
            <Text color="gray"> │ </Text>
          </>
        )}
        <Text color="gray" dimColor>{dir}</Text>
      </Box>
    </Box>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tui/__tests__/StatusBar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tui/StatusBar.tsx src/tui/__tests__/StatusBar.test.tsx
git commit -m "feat(tui): rewrite StatusBar with rich metrics display"
```

---

## Task 6: ToolDetail Component

**Files:**
- Create: `src/tui/ToolDetail.tsx`
- Test: `src/tui/__tests__/ToolDetail.test.tsx`

- [ ] **Step 1: Write ToolDetail tests**

```typescript
// src/tui/__tests__/ToolDetail.test.tsx
import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { ToolDetail, formatToolSummary } from '../ToolDetail.js'
import type { ToolCallDetail, StepStatus } from '../types.js'

function makeTool(overrides: Partial<ToolCallDetail> = {}): ToolCallDetail {
  return {
    id: 'tc-1',
    name: 'Read',
    args: { file_path: 'src/index.ts' },
    summary: 'src/index.ts',
    success: true,
    duration: 300,
    ...overrides,
  }
}

describe('ToolDetail', () => {
  it('should render tool name and summary', () => {
    const { lastFrame } = render(
      React.createElement(ToolDetail, {
        tool: makeTool(),
        status: 'completed',
        expanded: false,
      })
    )
    const output = lastFrame()
    expect(output).toContain('Read')
    expect(output).toContain('src/index.ts')
  })

  it('should render running spinner', () => {
    const { lastFrame } = render(
      React.createElement(ToolDetail, {
        tool: makeTool(),
        status: 'running',
        expanded: false,
      })
    )
    expect(lastFrame()).toContain('Read')
  })

  it('should render success checkmark', () => {
    const { lastFrame } = render(
      React.createElement(ToolDetail, {
        tool: makeTool({ success: true }),
        status: 'completed',
        expanded: false,
      })
    )
    expect(lastFrame()).toContain('✓')
  })

  it('should render error cross', () => {
    const { lastFrame } = render(
      React.createElement(ToolDetail, {
        tool: makeTool({ success: false }),
        status: 'error',
        expanded: false,
      })
    )
    expect(lastFrame()).toContain('✗')
  })

  it('should render duration when completed', () => {
    const { lastFrame } = render(
      React.createElement(ToolDetail, {
        tool: makeTool({ duration: 1234 }),
        status: 'completed',
        expanded: false,
      })
    )
    expect(lastFrame()).toContain('1.2s')
  })

  it('should render expanded view with args', () => {
    const { lastFrame } = render(
      React.createElement(ToolDetail, {
        tool: makeTool({ args: { file_path: 'src/index.ts', content: 'hello' } }),
        status: 'completed',
        expanded: true,
      })
    )
    const output = lastFrame()
    expect(output).toContain('file_path')
  })

  it('should render result preview when expanded', () => {
    const { lastFrame } = render(
      React.createElement(ToolDetail, {
        tool: makeTool({ result: 'line 1\nline 2\nline 3', preview: 'line 1\nline 2' }),
        status: 'completed',
        expanded: true,
      })
    )
    const output = lastFrame()
    expect(output).toContain('line 1')
  })

  it('should render denied status', () => {
    const { lastFrame } = render(
      React.createElement(ToolDetail, {
        tool: makeTool(),
        status: 'denied',
        expanded: false,
      })
    )
    expect(lastFrame()).toContain('⊘')
  })
})

describe('formatToolSummary', () => {
  it('should format Read tool', () => {
    expect(formatToolSummary('Read', { file_path: 'src/index.ts' })).toBe('src/index.ts')
  })

  it('should format Write tool', () => {
    expect(formatToolSummary('Write', { file_path: 'out.ts' })).toBe('out.ts')
  })

  it('should format Edit tool', () => {
    expect(formatToolSummary('Edit', { file_path: 'a.ts' })).toBe('a.ts')
  })

  it('should format Bash tool', () => {
    expect(formatToolSummary('Bash', { command: 'npm test' })).toBe('npm test')
  })

  it('should truncate long Bash commands', () => {
    const longCmd = 'a'.repeat(80)
    expect(formatToolSummary('Bash', { command: longCmd }).length).toBeLessThanOrEqual(63)
  })

  it('should format Glob tool', () => {
    expect(formatToolSummary('Glob', { pattern: 'src/**/*.ts' })).toBe('src/**/*.ts')
  })

  it('should format Grep tool', () => {
    expect(formatToolSummary('Grep', { pattern: 'foo', path: 'src/' })).toBe('foo in src/')
  })

  it('should handle unknown tool', () => {
    const result = formatToolSummary('Unknown', { key: 'value' })
    expect(result).toContain('key')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tui/__tests__/ToolDetail.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement ToolDetail**

```typescript
// src/tui/ToolDetail.tsx
import React from 'react'
import { Box, Text } from 'ink'
import type { ToolCallDetail, StepStatus } from './types.js'
import { Spinner } from './Spinner.js'

interface ToolDetailProps {
  tool: ToolCallDetail
  status: StepStatus
  expanded: boolean
  reasoning?: string
}

const TOOL_ICONS: Record<string, string> = {
  Read: '📖',
  Write: '✏️',
  Edit: '🔧',
  Bash: '⚡',
  Glob: '🔍',
  Grep: '🔎',
}

function StatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'running':
      return React.createElement(Spinner, { color: 'yellow' })
    case 'completed':
      return React.createElement(Text, { color: 'green' }, '✓')
    case 'error':
      return React.createElement(Text, { color: 'red' }, '✗')
    case 'denied':
      return React.createElement(Text, { color: 'yellow' }, '⊘')
    default:
      return React.createElement(Text, { color: 'gray' }, '·')
  }
}

export function ToolDetail({ tool, status, expanded, reasoning }: ToolDetailProps) {
  const icon = TOOL_ICONS[tool.name] || '🔧'
  const durationStr = tool.duration != null ? formatDuration(tool.duration) : ''

  return React.createElement(Box, { flexDirection: 'column', marginY: 0 },
    // Reasoning context
    reasoning ? React.createElement(Box, { paddingLeft: 1 },
      React.createElement(Text, { color: 'gray', dimColor: true, italic: true }, reasoning)
    ) : null,
    // Main line
    React.createElement(Box, null,
      React.createElement(StatusIcon, { status }),
      React.createElement(Text, { color: 'cyan' }, ` ${icon} `),
      React.createElement(Text, { bold: true, color: 'cyan' }, tool.name),
      React.createElement(Text, { color: 'gray' }, ` ${tool.summary}`),
      durationStr ? React.createElement(Text, { color: 'gray', dimColor: true }, ` · ${durationStr}`) : null,
    ),
    // Expanded details
    expanded ? React.createElement(Box, { flexDirection: 'column', paddingLeft: 4, marginTop: 0 },
      // Args
      Object.keys(tool.args).length > 0 ? React.createElement(Box, { flexDirection: 'column' },
        React.createElement(Text, { color: 'gray', dimColor: true }, 'Input:'),
        ...Object.entries(tool.args).map(([key, value]) =>
          React.createElement(Text, { key, color: 'gray', dimColor: true },
            `  ${key}: ${truncate(String(value), 120)}`
          )
        )
      ) : null,
      // Result preview
      tool.result ? React.createElement(Box, { flexDirection: 'column', marginTop: 0 },
        React.createElement(Text, { color: 'gray', dimColor: true }, 'Output:'),
        React.createElement(Text, { color: status === 'error' ? 'red' : 'gray', dimColor: true },
          `  ${truncate(tool.result, 200)}`
        )
      ) : null,
    ) : null,
    // Collapsed result preview
    !expanded && tool.result && status !== 'running'
      ? React.createElement(Box, { paddingLeft: 4 },
          React.createElement(Text, {
            color: status === 'error' ? 'red' : 'gray',
            dimColor: true,
          }, truncate(tool.result, 120))
        )
      : null,
  )
}

export function formatToolSummary(name: string, args: Record<string, unknown>): string {
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

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max) + '…'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tui/__tests__/ToolDetail.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tui/ToolDetail.tsx src/tui/__tests__/ToolDetail.test.tsx
git commit -m "feat(tui): implement ToolDetail component with expanded/collapsed views"
```

---

## Task 7: TaskStep Component

**Files:**
- Create: `src/tui/TaskStep.tsx`
- Test: `src/tui/__tests__/TaskStep.test.tsx`

- [ ] **Step 1: Write TaskStep tests**

```typescript
// src/tui/__tests__/TaskStep.test.tsx
import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { TaskStepView } from '../TaskStep.js'
import type { TaskStep } from '../types.js'

function makeStep(overrides: Partial<TaskStep> = {}): TaskStep {
  return {
    id: 'step-1',
    type: 'tool-call',
    status: 'completed',
    label: 'Read src/index.ts',
    startedAt: 1000,
    completedAt: 1300,
    duration: 300,
    toolCall: {
      id: 'tc-1',
      name: 'Read',
      args: { file_path: 'src/index.ts' },
      summary: 'src/index.ts',
      success: true,
      duration: 300,
    },
    ...overrides,
  }
}

describe('TaskStepView', () => {
  it('should render step label', () => {
    const { lastFrame } = render(
      React.createElement(TaskStepView, {
        step: makeStep(),
        expanded: false,
        onToggle: () => {},
      })
    )
    expect(lastFrame()).toContain('Read src/index.ts')
  })

  it('should render completed checkmark', () => {
    const { lastFrame } = render(
      React.createElement(TaskStepView, {
        step: makeStep({ status: 'completed' }),
        expanded: false,
        onToggle: () => {},
      })
    )
    expect(lastFrame()).toContain('✓')
  })

  it('should render running spinner', () => {
    const { lastFrame } = render(
      React.createElement(TaskStepView, {
        step: makeStep({ status: 'running' }),
        expanded: false,
        onToggle: () => {},
      })
    )
    expect(lastFrame()).toContain('Read src/index.ts')
  })

  it('should render error status', () => {
    const { lastFrame } = render(
      React.createElement(TaskStepView, {
        step: makeStep({ status: 'error' }),
        expanded: false,
        onToggle: () => {},
      })
    )
    expect(lastFrame()).toContain('✗')
  })

  it('should render thinking step', () => {
    const { lastFrame } = render(
      React.createElement(TaskStepView, {
        step: makeStep({ type: 'thinking', label: 'Analyzing...', toolCall: undefined }),
        expanded: false,
        onToggle: () => {},
      })
    )
    expect(lastFrame()).toContain('Analyzing...')
  })

  it('should render text step', () => {
    const { lastFrame } = render(
      React.createElement(TaskStepView, {
        step: makeStep({ type: 'text', label: 'Generating response...', toolCall: undefined }),
        expanded: false,
        onToggle: () => {},
      })
    )
    expect(lastFrame()).toContain('Generating response...')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tui/__tests__/TaskStep.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement TaskStep**

```typescript
// src/tui/TaskStep.tsx
import React from 'react'
import { Box, Text } from 'ink'
import type { TaskStep } from './types.js'
import { ToolDetail } from './ToolDetail.js'
import { Spinner } from './Spinner.js'

interface TaskStepViewProps {
  step: TaskStep
  expanded: boolean
  onToggle: () => void
}

function StepIcon({ status }: { status: TaskStep['status'] }) {
  switch (status) {
    case 'running':
      return React.createElement(Spinner, { color: 'yellow' })
    case 'completed':
      return React.createElement(Text, { color: 'green' }, '✓')
    case 'error':
      return React.createElement(Text, { color: 'red' }, '✗')
    case 'denied':
      return React.createElement(Text, { color: 'yellow' }, '⊘')
    default:
      return React.createElement(Text, { color: 'gray' }, '○')
  }
}

export function TaskStepView({ step, expanded, onToggle }: TaskStepViewProps) {
  if (step.type === 'tool-call' && step.toolCall) {
    return React.createElement(Box, { flexDirection: 'column' },
      React.createElement(ToolDetail, {
        tool: step.toolCall,
        status: step.status,
        expanded,
        reasoning: step.reasoning,
      })
    )
  }

  // Non-tool steps (thinking, text, error, retry)
  return React.createElement(Box, null,
    React.createElement(StepIcon, { status: step.status }),
    React.createElement(Text, { color: step.status === 'error' ? 'red' : 'gray' },
      ` ${step.label}`
    ),
    step.duration != null && step.duration > 0
      ? React.createElement(Text, { color: 'gray', dimColor: true },
          ` · ${step.duration < 1000 ? step.duration + 'ms' : (step.duration / 1000).toFixed(1) + 's'}`
        )
      : null,
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tui/__tests__/TaskStep.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tui/TaskStep.tsx src/tui/__tests__/TaskStep.test.tsx
git commit -m "feat(tui): implement TaskStep component"
```

---

## Task 8: AgentTask Component

**Files:**
- Create: `src/tui/AgentTask.tsx`
- Test: `src/tui/__tests__/AgentTask.test.tsx`

- [ ] **Step 1: Write AgentTask tests**

```typescript
// src/tui/__tests__/AgentTask.test.tsx
import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { AgentTaskView } from '../AgentTask.js'
import type { AgentTaskItem } from '../types.js'

function makeTask(overrides: Partial<AgentTaskItem> = {}): AgentTaskItem {
  return {
    type: 'agent-task',
    id: 'task-1',
    status: 'running',
    phase: 'thinking',
    steps: [],
    streamingText: '',
    startedAt: Date.now(),
    iterationCount: 0,
    maxIterations: 50,
    ...overrides,
  }
}

describe('AgentTaskView', () => {
  it('should render running status', () => {
    const { lastFrame } = render(
      React.createElement(AgentTaskView, {
        task: makeTask({ status: 'running', phase: 'thinking' }),
        expandedSteps: new Set(),
        onToggleStep: () => {},
      })
    )
    expect(lastFrame()).toContain('Running')
  })

  it('should render completed status', () => {
    const { lastFrame } = render(
      React.createElement(AgentTaskView, {
        task: makeTask({ status: 'completed', phase: 'completed', finalText: 'Done!' }),
        expandedSteps: new Set(),
        onToggleStep: () => {},
      })
    )
    expect(lastFrame()).toContain('Completed')
  })

  it('should render steps', () => {
    const { lastFrame } = render(
      React.createElement(AgentTaskView, {
        task: makeTask({
          steps: [
            { id: 's1', type: 'tool-call', status: 'completed', label: 'Read file', startedAt: 1, completedAt: 2, duration: 1,
              toolCall: { id: 'tc1', name: 'Read', args: {}, summary: 'file.ts', success: true, duration: 1 } },
          ],
        }),
        expandedSteps: new Set(),
        onToggleStep: () => {},
      })
    )
    expect(lastFrame()).toContain('Read file')
  })

  it('should render streaming text', () => {
    const { lastFrame } = render(
      React.createElement(AgentTaskView, {
        task: makeTask({ streamingText: 'Hello world...' }),
        expandedSteps: new Set(),
        onToggleStep: () => {},
      })
    )
    expect(lastFrame()).toContain('Hello world...')
  })

  it('should render iteration count', () => {
    const { lastFrame } = render(
      React.createElement(AgentTaskView, {
        task: makeTask({ iterationCount: 3, maxIterations: 50 }),
        expandedSteps: new Set(),
        onToggleStep: () => {},
      })
    )
    expect(lastFrame()).toContain('3/50')
  })

  it('should render error status', () => {
    const { lastFrame } = render(
      React.createElement(AgentTaskView, {
        task: makeTask({ status: 'error', phase: 'error' }),
        expandedSteps: new Set(),
        onToggleStep: () => {},
      })
    )
    expect(lastFrame()).toContain('Error')
  })

  it('should render cancelled status', () => {
    const { lastFrame } = render(
      React.createElement(AgentTaskView, {
        task: makeTask({ status: 'cancelled' }),
        expandedSteps: new Set(),
        onToggleStep: () => {},
      })
    )
    expect(lastFrame()).toContain('Cancelled')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tui/__tests__/AgentTask.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement AgentTask**

```typescript
// src/tui/AgentTask.tsx
import React from 'react'
import { Box, Text } from 'ink'
import type { AgentTaskItem } from './types.js'
import { TaskStepView } from './TaskStep.js'
import { Spinner } from './Spinner.js'
import { Markdown } from './Markdown.js'

interface AgentTaskViewProps {
  task: AgentTaskItem
  expandedSteps: Set<string>
  onToggleStep: (stepId: string) => void
}

function statusLabel(status: AgentTaskItem['status'], phase: AgentTaskItem['phase']): { text: string; color: string } {
  switch (status) {
    case 'running': {
      switch (phase) {
        case 'thinking': return { text: 'Thinking', color: 'yellow' }
        case 'streaming-text': return { text: 'Streaming', color: 'green' }
        case 'executing-tools': return { text: 'Running', color: 'cyan' }
        case 'awaiting-approval': return { text: 'Awaiting', color: 'yellow' }
        case 'planning': return { text: 'Planning', color: 'blue' }
        default: return { text: 'Running', color: 'cyan' }
      }
    }
    case 'completed': return { text: 'Completed', color: 'green' }
    case 'error': return { text: 'Error', color: 'red' }
    case 'cancelled': return { text: 'Cancelled', color: 'yellow' }
    default: return { text: 'Pending', color: 'gray' }
  }
}

function formatDuration(ms: number): string {
  if (ms <= 0) return ''
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

export function AgentTaskView({ task, expandedSteps, onToggleStep }: AgentTaskViewProps) {
  const { text: statusText, color: statusColor } = statusLabel(task.status, task.phase)
  const elapsed = task.duration ?? (Date.now() - task.startedAt)

  return React.createElement(Box, {
    flexDirection: 'column',
    borderStyle: 'round',
    borderColor: task.status === 'error' ? 'red' : task.status === 'running' ? 'cyan' : 'gray',
    paddingX: 1,
    marginY: 1,
  },
    // Header
    React.createElement(Box, null,
      task.status === 'running'
        ? React.createElement(Spinner, { color: statusColor })
        : React.createElement(Text, { color: statusColor }, '●'),
      React.createElement(Text, { color: statusColor, bold: true }, ` ${statusText}`),
      task.iterationCount > 0 ? React.createElement(Text, { color: 'gray' },
        ` · Iter ${task.iterationCount}/${task.maxIterations}`
      ) : null,
      elapsed > 0 ? React.createElement(Text, { color: 'gray', dimColor: true },
        ` · ${formatDuration(elapsed)}`
      ) : null,
    ),

    // Steps
    task.steps.length > 0 ? React.createElement(Box, {
      flexDirection: 'column',
      marginTop: 1,
    },
      ...task.steps.map(step =>
        React.createElement(Box, { key: step.id, paddingLeft: 1 },
          React.createElement(TaskStepView, {
            step,
            expanded: expandedSteps.has(step.id),
            onToggle: () => onToggleStep(step.id),
          })
        )
      )
    ) : null,

    // Streaming text
    task.streamingText ? React.createElement(Box, {
      flexDirection: 'column',
      marginTop: 1,
    },
      React.createElement(Markdown, { content: task.streamingText }),
      task.status === 'running' ? React.createElement(Text, { color: 'gray', dimColor: true }, '▌') : null,
    ) : null,

    // Final text (if different from streaming)
    task.finalText && task.finalText !== task.streamingText ? React.createElement(Box, {
      flexDirection: 'column',
      marginTop: 1,
    },
      React.createElement(Markdown, { content: task.finalText }),
    ) : null,
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tui/__tests__/AgentTask.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tui/AgentTask.tsx src/tui/__tests__/AgentTask.test.tsx
git commit -m "feat(tui): implement AgentTask component with step rendering"
```

---

## Task 9: Timeline Component

**Files:**
- Create: `src/tui/TimelineView.tsx`
- Test: `src/tui/__tests__/TimelineView.test.tsx`

- [ ] **Step 1: Write TimelineView tests**

```typescript
// src/tui/__tests__/TimelineView.test.tsx
import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { TimelineView } from '../TimelineView.js'
import type { Timeline } from '../types.js'
import { createTimeline, addUserMessage, createAgentTask, completeTask } from '../timeline.js'

describe('TimelineView', () => {
  it('should render empty timeline', () => {
    const timeline = createTimeline()
    const { lastFrame } = render(
      React.createElement(TimelineView, {
        timeline,
        expandedSteps: new Set(),
        onToggleStep: () => {},
      })
    )
    // Should render without crashing
    expect(lastFrame()).toBeDefined()
  })

  it('should render user message', () => {
    let timeline = createTimeline()
    timeline = addUserMessage(timeline, 'Hello MiMo')
    const { lastFrame } = render(
      React.createElement(TimelineView, {
        timeline,
        expandedSteps: new Set(),
        onToggleStep: () => {},
      })
    )
    expect(lastFrame()).toContain('Hello MiMo')
  })

  it('should render user message and agent task', () => {
    let timeline = createTimeline()
    timeline = addUserMessage(timeline, 'Fix the bug')
    timeline = createAgentTask(timeline, 50)
    const { lastFrame } = render(
      React.createElement(TimelineView, {
        timeline,
        expandedSteps: new Set(),
        onToggleStep: () => {},
      })
    )
    const output = lastFrame()
    expect(output).toContain('Fix the bug')
    expect(output).toContain('Thinking')
  })

  it('should render multiple items', () => {
    let timeline = createTimeline()
    timeline = addUserMessage(timeline, 'First message')
    timeline = createAgentTask(timeline, 50)
    timeline = completeTask(timeline)
    timeline = addUserMessage(timeline, 'Second message')
    timeline = createAgentTask(timeline, 50)
    const { lastFrame } = render(
      React.createElement(TimelineView, {
        timeline,
        expandedSteps: new Set(),
        onToggleStep: () => {},
      })
    )
    const output = lastFrame()
    expect(output).toContain('First message')
    expect(output).toContain('Second message')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tui/__tests__/TimelineView.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement TimelineView**

```typescript
// src/tui/TimelineView.tsx
import React from 'react'
import { Box, Text } from 'ink'
import type { Timeline, TimelineItem } from './types.js'
import { AgentTaskView } from './AgentTask.js'

interface TimelineViewProps {
  timeline: Timeline
  expandedSteps: Set<string>
  onToggleStep: (stepId: string) => void
}

export function TimelineView({ timeline, expandedSteps, onToggleStep }: TimelineViewProps) {
  return React.createElement(Box, {
    flexDirection: 'column',
    flexGrow: 1,
    overflow: 'hidden',
    paddingX: 1,
  },
    ...timeline.items.map(item =>
      React.createElement(TimelineItemView, {
        key: item.id,
        item,
        expandedSteps,
        onToggleStep,
      })
    )
  )
}

function TimelineItemView({
  item,
  expandedSteps,
  onToggleStep,
}: {
  item: TimelineItem
  expandedSteps: Set<string>
  onToggleStep: (stepId: string) => void
}) {
  if (item.type === 'user-message') {
    return React.createElement(Box, {
      flexDirection: 'column',
      marginY: 1,
    },
      React.createElement(Text, { bold: true, color: 'blue' }, 'You'),
      React.createElement(Box, { marginTop: 0 },
        React.createElement(Text, { wrap: 'wrap' }, item.content)
      )
    )
  }

  if (item.type === 'agent-task') {
    return React.createElement(AgentTaskView, {
      task: item,
      expandedSteps,
      onToggleStep,
    })
  }

  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tui/__tests__/TimelineView.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tui/TimelineView.tsx src/tui/__tests__/TimelineView.test.tsx
git commit -m "feat(tui): implement TimelineView container component"
```

---

## Task 10: App.tsx Integration

**Files:**
- Modify: `src/tui/App.tsx`

- [ ] **Step 1: Rewrite App.tsx to use Timeline**

Replace the entire `App.tsx` with the new timeline-based architecture:

```typescript
// src/tui/App.tsx
import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Box, useApp, useInput, useStdout } from 'ink'
import { AgentLoop } from '../agent/loop.js'
import type { Message } from '../api/types.js'
import type { Config } from '../config/store.js'
import { SessionStore } from '../session/store.js'
import type { SessionData } from '../session/store.js'
import { Welcome } from './Welcome.js'
import { TimelineView } from './TimelineView.js'
import { UserInput } from './UserInput.js'
import { StatusBar } from './StatusBar.js'
import { ToolApproval } from './ToolApproval.js'
import { handleSlashCommand } from './commands.js'
import {
  createTimeline,
  addUserMessage,
  createAgentTask,
  addStep,
  updateStep,
  completeStep,
  updateTaskPhase,
  appendStreamingText,
  incrementIteration,
  completeTask,
  errorTask,
  cancelTask,
  getActiveTask,
  getTaskMetrics,
} from './timeline.js'
import type { Timeline, TaskStep, AgentPhase, ToolCallDetail } from './types.js'

interface AppProps {
  config: Config
}

type ApprovalRequest = {
  toolName: string
  input: Record<string, unknown>
  resolve: (approved: boolean) => void
}

const STREAM_FLUSH_MS = 50

export function App({ config }: AppProps) {
  const { exit } = useApp()
  const { stdout } = useStdout()

  const [showWelcome, setShowWelcome] = useState(true)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [timeline, setTimeline] = useState<Timeline>(createTimeline())
  const [approval, setApproval] = useState<ApprovalRequest | null>(null)
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const [tokenCount, setTokenCount] = useState(0)
  const [taskStartTime, setTaskStartTime] = useState(0)
  const [now, setNow] = useState(Date.now())

  const agentRef = useRef<AgentLoop | null>(null)
  const timelineRef = useRef(timeline)
  const streamFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelledRef = useRef(false)
  const busyRef = useRef(false)
  const sessionRef = useRef<SessionData | null>(null)
  const sessionStoreRef = useRef(new SessionStore())
  const pendingStepRef = useRef<string | null>(null)
  const toolStartRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    timelineRef.current = timeline
  }, [timeline])

  // Duration timer
  useEffect(() => {
    if (!taskStartTime) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [taskStartTime])

  // Initialize
  useEffect(() => {
    agentRef.current = new AgentLoop(config, buildSystemPrompt())
    const initSession = async () => {
      const store = sessionStoreRef.current
      const latest = await store.getLatest()
      if (latest && latest.messages.length > 0) {
        sessionRef.current = latest
        setShowWelcome(false)
      } else {
        sessionRef.current = await store.create(config.model || 'MiMo-7B-RL')
      }
    }
    initSession().catch(() => {})
  }, [config])

  const handleToggleStep = useCallback((stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev)
      if (next.has(stepId)) {
        next.delete(stepId)
      } else {
        next.add(stepId)
      }
      return next
    })
  }, [])

  const handleCancel = useCallback(() => {
    if (!busyRef.current) return
    cancelledRef.current = true
    agentRef.current?.cancel()
  }, [])

  const handleUserMessage = useCallback(
    async (text: string) => {
      if (busyRef.current) return

      const slash = handleSlashCommand(text)
      if (slash.handled) {
        if (slash.message === '__CLEAR__') {
          setTimeline(createTimeline())
          setExpandedSteps(new Set())
          setTokenCount(0)
          sessionRef.current = await sessionStoreRef.current.create(config.model || 'MiMo-7B-RL')
          return
        }
        if (slash.message === '__EXIT__') {
          exit()
          return
        }
        if (slash.message === '__MODEL__') {
          setTimeline(prev => addUserMessage(prev, `[System] Model: ${config.model}, API: ${config.baseURL}`))
          return
        }
        if (slash.message) {
          setTimeline(prev => addUserMessage(prev, `[System] ${slash.message}`))
        }
        return
      }

      busyRef.current = true
      if (showWelcome) setShowWelcome(false)
      setShowShortcuts(false)
      cancelledRef.current = false

      // Add user message and create agent task
      setTimeline(prev => {
        let next = addUserMessage(prev, text)
        next = createAgentTask(next, 50)
        return next
      })
      setTaskStartTime(Date.now())
      setExpandedSteps(new Set())

      const userMsg: Message = { role: 'user', content: text }
      const history = [...(sessionRef.current?.messages || []), userMsg]

      let hadError = false

      try {
        const newMessages = await agentRef.current!.sendMessage(
          text,
          history,
          {
            onText: (chunk) => {
              setTimeline(prev => {
                let next = updateTaskPhase(prev, 'streaming-text')
                next = appendStreamingText(next, chunk)
                return next
              })
            },
            onToolCall: (toolCall, args) => {
              const stepId = `step-${toolCall.id}`
              toolStartRef.current.set(toolCall.id, Date.now())
              const summary = formatToolSummary(toolCall.function.name, args)
              const step: TaskStep = {
                id: stepId,
                type: 'tool-call',
                status: 'running',
                label: `${toolCall.function.name} ${summary}`,
                startedAt: Date.now(),
                toolCall: {
                  id: toolCall.id,
                  name: toolCall.function.name,
                  args,
                  summary,
                },
              }
              setTimeline(prev => {
                let next = updateTaskPhase(prev, 'executing-tools')
                next = addStep(next, step)
                return next
              })
            },
            onToolResult: (toolCallId, toolName, result, success) => {
              const stepId = `step-${toolCallId}`
              const startedAt = toolStartRef.current.get(toolCallId) || Date.now()
              const completedAt = Date.now()
              const summary = formatToolResultSummary(toolName, result, success)
              setTimeline(prev => {
                let next = updateStep(prev, stepId, {
                  toolCall: {
                    id: toolCallId,
                    name: toolName,
                    args: {},
                    summary,
                    result: result.slice(0, 500),
                    success,
                    duration: completedAt - startedAt,
                  },
                })
                next = completeStep(next, stepId, success, completedAt)
                return next
              })
              toolStartRef.current.delete(toolCallId)
              setTokenCount(prev => prev + Math.floor(result.length / 4))
            },
            onError: (error) => {
              hadError = true
              setTimeline(prev => errorTask(prev, error))
            },
            onRetry: (_attempt, _error, _delayMs) => {
              setTimeline(prev => {
                const stepId = `retry-${Date.now()}`
                return addStep(prev, {
                  id: stepId,
                  type: 'retry',
                  status: 'completed',
                  label: `Retrying (attempt ${_attempt})`,
                  startedAt: Date.now(),
                  completedAt: Date.now(),
                  duration: _delayMs,
                })
              })
            },
            onDone: () => {
              setTimeline(prev => completeTask(prev))
            },
            onThinking: () => {
              setTimeline(prev => {
                const active = getActiveTask(prev)
                if (active && active.phase !== 'streaming-text') {
                  return updateTaskPhase(prev, 'thinking')
                }
                return prev
              })
            },
            requestApproval: (toolName, input) => {
              setTimeline(prev => updateTaskPhase(prev, 'awaiting-approval'))
              return new Promise<boolean>((resolve) => {
                setApproval({ toolName, input, resolve })
              })
            },
            isCancelled: () => cancelledRef.current,
          }
        )

        // Update session messages
        if (newMessages.length > 0) {
          const updatedHistory = [...history, ...newMessages]
          if (sessionRef.current) {
            sessionRef.current.messages = updatedHistory
            await sessionStoreRef.current.save(sessionRef.current).catch(() => {})
          }
        }
      } catch (err: any) {
        if (!hadError) {
          setTimeline(prev => errorTask(prev, err.message || 'Unknown error'))
        }
      }

      setTaskStartTime(0)
      busyRef.current = false
    },
    [config, showWelcome, exit]
  )

  const handleApproval = useCallback(
    (approved: boolean) => {
      if (approval) {
        approval.resolve(approved)
        setApproval(null)
        setTimeline(prev => updateTaskPhase(prev, 'executing-tools'))
      }
    },
    [approval]
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

  const busy = taskStartTime > 0
  const inputDisabled = busy || !!approval
  const activeTask = getActiveTask(timeline)
  const metrics = getTaskMetrics(timeline)
  const currentPhase: AgentPhase | 'idle' = activeTask?.phase ?? 'idle'
  const duration = taskStartTime ? now - taskStartTime : 0

  return (
    <Box flexDirection="column" height={stdout.rows}>
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {showWelcome && timeline.items.length === 0 ? (
          <Welcome
            model={config.model || 'MiMo-7B-RL'}
            workingDir={process.cwd()}
          />
        ) : (
          <TimelineView
            timeline={timeline}
            expandedSteps={expandedSteps}
            onToggleStep={handleToggleStep}
          />
        )}
      </Box>

      <Box flexDirection="column" flexShrink={0}>
        {approval && (
          <ToolApproval
            toolName={approval.toolName}
            input={approval.input}
            onApprove={() => handleApproval(true)}
            onDeny={() => handleApproval(false)}
          />
        )}
        <UserInput
          onSubmit={handleUserMessage}
          disabled={inputDisabled}
          showPlaceholder={showWelcome}
          showShortcuts={showShortcuts}
          onToggleShortcuts={() => setShowShortcuts((s) => !s)}
          onCancel={handleCancel}
        />
      </Box>

      <Box flexShrink={0}>
        <StatusBar
          model={config.model || 'MiMo'}
          phase={approval ? 'awaiting-approval' : currentPhase}
          iteration={activeTask?.iterationCount ?? 0}
          maxIterations={50}
          toolCallsTotal={metrics.toolCalls}
          toolCallsActive={activeTask?.steps.filter(s => s.status === 'running').length ?? 0}
          tokenCount={tokenCount}
          duration={duration}
          workingDir={process.cwd()}
        />
      </Box>
    </Box>
  )
}

function formatToolSummary(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'Read': return String(args.file_path || '')
    case 'Write': return String(args.file_path || '')
    case 'Edit': return String(args.file_path || '')
    case 'Bash': return String(args.command || '').slice(0, 60)
    case 'Glob': return String(args.pattern || '')
    case 'Grep': return `${args.pattern || ''} in ${args.path || '.'}`
    default: return JSON.stringify(args).slice(0, 60)
  }
}

function formatToolResultSummary(name: string, result: string, success: boolean): string {
  if (!success) return 'Failed'
  switch (name) {
    case 'Read': {
      const lines = result.split('\n').length
      return `${lines} lines`
    }
    case 'Write': return 'Written'
    case 'Edit': return 'Edited'
    case 'Bash': {
      const exitMatch = result.match(/exit[:\s]*(\d+)/i)
      return exitMatch ? `exit ${exitMatch[1]}` : success ? 'Done' : 'Failed'
    }
    case 'Glob': {
      const files = result.split('\n').filter(Boolean).length
      return `${files} files`
    }
    case 'Grep': {
      const matches = result.split('\n').filter(Boolean).length
      return `${matches} matches`
    }
    default: return success ? 'Done' : 'Failed'
  }
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

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/tui/App.tsx
git commit -m "feat(tui): rewrite App.tsx to use Timeline architecture"
```

---

## Task 11: Cleanup Old Files

**Files:**
- Remove: `src/tui/MessageList.tsx` (replaced by TimelineView.tsx)
- Remove: `src/tui/entries.ts` (replaced by timeline.ts)
- Keep: `src/tui/ToolCallBlock.tsx` (still used by ToolApproval for preview)

- [ ] **Step 1: Check for remaining references to old files**

Run: `grep -r "MessageList\|from.*entries" src/tui/ --include="*.tsx" --include="*.ts" | grep -v "__tests__" | grep -v "node_modules"`
Expected: Only the files being removed should reference these

- [ ] **Step 2: Remove old files**

Run: `rm src/tui/MessageList.tsx src/tui/entries.ts`

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(tui): remove old MessageList and entries modules"
```

---

## Task 12: Final Integration Test

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Verify app starts**

Run: `npx tsx src/index.ts --help`
Expected: Help text displayed

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(tui): complete TUI refactor from chat to agent workbench"
```
