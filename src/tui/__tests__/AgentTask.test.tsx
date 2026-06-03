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
      <AgentTaskView
        task={makeTask({ status: 'running', phase: 'thinking' })}
        expandedSteps={new Set()}
        onToggleStep={() => {}}
      />
    )
    expect(lastFrame()).toContain('Thinking')
  })

  it('should render completed status', () => {
    const { lastFrame } = render(
      <AgentTaskView
        task={makeTask({ status: 'completed', phase: 'completed', finalText: 'Done!' })}
        expandedSteps={new Set()}
        onToggleStep={() => {}}
      />
    )
    expect(lastFrame()).toContain('Completed')
  })

  it('should render steps', () => {
    const { lastFrame } = render(
      <AgentTaskView
        task={makeTask({
          steps: [{
            id: 's1', type: 'tool-call', status: 'completed', label: 'Read file',
            startedAt: 1, completedAt: 2, duration: 1,
            toolCall: { id: 'tc1', name: 'Read', args: {}, summary: 'file.ts', success: true, duration: 1 },
          }],
        })}
        expandedSteps={new Set()}
        onToggleStep={() => {}}
      />
    )
    expect(lastFrame()).toContain('Read')
  })

  it('should render streaming text', () => {
    const { lastFrame } = render(
      <AgentTaskView
        task={makeTask({ streamingText: 'Hello world...' })}
        expandedSteps={new Set()}
        onToggleStep={() => {}}
      />
    )
    expect(lastFrame()).toContain('Hello world...')
  })

  it('should render iteration count', () => {
    const { lastFrame } = render(
      <AgentTaskView
        task={makeTask({ iterationCount: 3, maxIterations: 50 })}
        expandedSteps={new Set()}
        onToggleStep={() => {}}
      />
    )
    expect(lastFrame()).toContain('3/50')
  })

  it('should render error status', () => {
    const { lastFrame } = render(
      <AgentTaskView
        task={makeTask({ status: 'error', phase: 'error' })}
        expandedSteps={new Set()}
        onToggleStep={() => {}}
      />
    )
    expect(lastFrame()).toContain('Error')
  })

  it('should render cancelled status', () => {
    const { lastFrame } = render(
      <AgentTaskView
        task={makeTask({ status: 'cancelled' })}
        expandedSteps={new Set()}
        onToggleStep={() => {}}
      />
    )
    expect(lastFrame()).toContain('Cancelled')
  })

  it('should render executing-tools phase', () => {
    const { lastFrame } = render(
      <AgentTaskView
        task={makeTask({ status: 'running', phase: 'executing-tools' })}
        expandedSteps={new Set()}
        onToggleStep={() => {}}
      />
    )
    expect(lastFrame()).toContain('Running')
  })

  it('should render streaming-text phase', () => {
    const { lastFrame } = render(
      <AgentTaskView
        task={makeTask({ status: 'running', phase: 'streaming-text', streamingText: 'text' })}
        expandedSteps={new Set()}
        onToggleStep={() => {}}
      />
    )
    expect(lastFrame()).toContain('Streaming')
  })
})
