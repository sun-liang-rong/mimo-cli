import { describe, it, expect } from 'vitest'
import type {
  AgentPhase, TaskStatus, StepType, StepStatus,
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
