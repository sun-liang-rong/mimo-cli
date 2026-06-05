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
  it('should render step label for tool-call', () => {
    const { lastFrame } = render(
      <TaskStepView step={makeStep()} expanded={false} onToggle={() => {}} />
    )
    expect(lastFrame()).toContain('Read')
    expect(lastFrame()).toContain('src/index.ts')
  })

  it('should render completed checkmark', () => {
    const { lastFrame } = render(
      <TaskStepView step={makeStep({ status: 'completed' })} expanded={false} onToggle={() => {}} />
    )
    expect(lastFrame()).toMatch(/✓/)
  })

  it('should render running spinner', () => {
    const { lastFrame } = render(
      <TaskStepView step={makeStep({ status: 'running' })} expanded={false} onToggle={() => {}} />
    )
    expect(lastFrame()).toContain('Read')
  })

  it('should render error status', () => {
    const { lastFrame } = render(
      <TaskStepView step={makeStep({ status: 'error' })} expanded={false} onToggle={() => {}} />
    )
    expect(lastFrame()).toMatch(/✗/)
  })

  it('should render thinking step', () => {
    const { lastFrame } = render(
      <TaskStepView
        step={makeStep({ type: 'thinking', label: 'Analyzing...', toolCall: undefined })}
        expanded={false}
        onToggle={() => {}}
      />
    )
    expect(lastFrame()).toContain('Analyzing...')
  })

  it('should render text step', () => {
    const { lastFrame } = render(
      <TaskStepView
        step={makeStep({ type: 'text', label: 'Generating response...', toolCall: undefined })}
        expanded={false}
        onToggle={() => {}}
      />
    )
    expect(lastFrame()).toContain('Generating response...')
  })

  it('should render retry step', () => {
    const { lastFrame } = render(
      <TaskStepView
        step={makeStep({ type: 'retry', label: 'Retrying (attempt 2)', toolCall: undefined, duration: 1000 })}
        expanded={false}
        onToggle={() => {}}
      />
    )
    expect(lastFrame()).toContain('Retrying')
  })
})
