import { describe, it, expect } from 'vitest'
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
  finalizeLastTask,
  errorTask,
  cancelTask,
  getActiveTask,
  getTaskMetrics,
} from '../timeline.js'
import type { AgentTaskItem } from '../types.js'

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
    expect(updated.items[0]!.id).toBeDefined()
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
    expect(task.steps[0]!.id).toBe('step-1')
  })

  it('should append steps in order', () => {
    let timeline = createTimeline()
    timeline = createAgentTask(timeline, 50)
    timeline = addStep(timeline, { id: 'step-1', type: 'tool-call', status: 'running', label: 'Step 1', startedAt: 1 })
    timeline = addStep(timeline, { id: 'step-2', type: 'tool-call', status: 'running', label: 'Step 2', startedAt: 2 })
    const task = timeline.items[0] as AgentTaskItem
    expect(task.steps.map(s => s.id)).toEqual(['step-1', 'step-2'])
  })

  it('should return timeline unchanged if no active task', () => {
    const timeline = createTimeline()
    const result = addStep(timeline, { id: 'step-1', type: 'tool-call', status: 'running', label: 'X', startedAt: 1 })
    expect(result).toBe(timeline)
  })
})

describe('updateStep', () => {
  it('should update step fields', () => {
    let timeline = createTimeline()
    timeline = createAgentTask(timeline, 50)
    timeline = addStep(timeline, { id: 'step-1', type: 'tool-call', status: 'running', label: 'Read', startedAt: 1 })
    timeline = updateStep(timeline, 'step-1', { status: 'completed', duration: 300 })
    const task = timeline.items[0] as AgentTaskItem
    expect(task.steps[0]!.status).toBe('completed')
    expect(task.steps[0]!.duration).toBe(300)
  })
})

describe('completeStep', () => {
  it('should mark step as completed with duration', () => {
    let timeline = createTimeline()
    timeline = createAgentTask(timeline, 50)
    timeline = addStep(timeline, { id: 'step-1', type: 'tool-call', status: 'running', label: 'Read', startedAt: 1000 })
    timeline = completeStep(timeline, 'step-1', true, 1500)
    const task = timeline.items[0] as AgentTaskItem
    expect(task.steps[0]!.status).toBe('completed')
    expect(task.steps[0]!.completedAt).toBe(1500)
    expect(task.steps[0]!.duration).toBe(500)
  })

  it('should mark step as error on failure', () => {
    let timeline = createTimeline()
    timeline = createAgentTask(timeline, 50)
    timeline = addStep(timeline, { id: 'step-1', type: 'tool-call', status: 'running', label: 'Read', startedAt: 1000 })
    timeline = completeStep(timeline, 'step-1', false, 1500)
    const task = timeline.items[0] as AgentTaskItem
    expect(task.steps[0]!.status).toBe('error')
  })

  it('should mark step as denied', () => {
    let timeline = createTimeline()
    timeline = createAgentTask(timeline, 50)
    timeline = addStep(timeline, { id: 'step-1', type: 'tool-call', status: 'running', label: 'Bash', startedAt: 1000 })
    timeline = completeStep(timeline, 'step-1', false, 1500, 'denied')
    const task = timeline.items[0] as AgentTaskItem
    expect(task.steps[0]!.status).toBe('denied')
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

describe('incrementIteration', () => {
  it('should increment iteration count', () => {
    let timeline = createTimeline()
    timeline = createAgentTask(timeline, 50)
    timeline = incrementIteration(timeline)
    timeline = incrementIteration(timeline)
    const task = timeline.items[0] as AgentTaskItem
    expect(task.iterationCount).toBe(2)
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

describe('finalizeLastTask', () => {
  it('should finalize the last running task with final text', () => {
    let timeline = createTimeline()
    timeline = createAgentTask(timeline, 50)
    timeline = finalizeLastTask(timeline, 'Hello world')
    const task = timeline.items[0] as AgentTaskItem
    expect(task.status).toBe('completed')
    expect(task.phase).toBe('completed')
    expect(task.finalText).toBe('Hello world')
    expect(task.completedAt).toBeDefined()
  })

  it('should be idempotent on an already-completed task', () => {
    let timeline = createTimeline()
    timeline = createAgentTask(timeline, 50)
    timeline = completeTask(timeline)
    const before = timeline.items[0] as AgentTaskItem
    timeline = finalizeLastTask(timeline, 'overwritten')
    const after = timeline.items[0] as AgentTaskItem
    // Should not change the existing completion
    expect(after.completedAt).toBe(before.completedAt)
  })

  it('should be a no-op if the last item is not an agent task', () => {
    let timeline = createTimeline()
    timeline = addUserMessage(timeline, 'hi')
    const before = timeline
    timeline = finalizeLastTask(timeline, 'text')
    expect(timeline).toBe(before)
  })
})

describe('errorTask', () => {
  it('should mark task as error', () => {
    let timeline = createTimeline()
    timeline = createAgentTask(timeline, 50)
    timeline = errorTask(timeline, 'Something failed')
    const task = timeline.items[0] as AgentTaskItem
    expect(task.status).toBe('error')
    expect(task.phase).toBe('error')
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
    expect(metrics.errors).toBe(1)
  })

  it('should return zeros for empty timeline', () => {
    const metrics = getTaskMetrics(createTimeline())
    expect(metrics.toolCalls).toBe(0)
    expect(metrics.stepsCompleted).toBe(0)
    expect(metrics.stepsTotal).toBe(0)
    expect(metrics.errors).toBe(0)
  })
})
