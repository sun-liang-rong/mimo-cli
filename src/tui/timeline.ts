import type {
  Timeline, TimelineItem, UserMessageItem, AgentTaskItem,
  TaskStep, AgentPhase, StepStatus,
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

/**
 * Mark the most recent agent-task as completed and attach the given
 * `finalText` to it. Used by session restore, which loads assistant
 * messages from disk and needs to set their content as the task's
 * final answer (the streaming text is not replayed).
 */
export function finalizeLastTask(timeline: Timeline, finalText: string): Timeline {
  const items = [...timeline.items]
  const lastIdx = items.length - 1
  const last = items[lastIdx]
  if (!last || last.type !== 'agent-task') return timeline
  const now = Date.now()
  items[lastIdx] = {
    ...last,
    status: 'completed',
    phase: 'completed',
    finalText,
    completedAt: last.completedAt ?? now,
    duration: last.duration ?? (now - last.startedAt),
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
