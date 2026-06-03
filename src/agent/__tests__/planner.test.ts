import { describe, it, expect, beforeEach } from 'vitest'
import { Planner } from '../planner.js'

describe('Planner', () => {
  let planner: Planner

  beforeEach(() => {
    planner = new Planner()
  })

  it('should create a plan', () => {
    const plan = planner.createPlan('Fix bug', [
      { description: 'Read file' },
      { description: 'Edit code' },
      { description: 'Run tests' },
    ])
    expect(plan.goal).toBe('Fix bug')
    expect(plan.steps).toHaveLength(3)
    expect(plan.currentStep).toBe(0)
  })

  it('should get current step', () => {
    planner.createPlan('Goal', [{ description: 'Step 1' }, { description: 'Step 2' }])
    const step = planner.getCurrentStep()
    expect(step).not.toBeNull()
    expect(step!.description).toBe('Step 1')
    expect(step!.status).toBe('pending')
  })

  it('should return null when no plan', () => {
    expect(planner.getCurrentStep()).toBeNull()
  })

  it('should complete current step', () => {
    planner.createPlan('Goal', [{ description: 'Step 1' }, { description: 'Step 2' }])
    planner.completeCurrentStep('done')
    expect(planner.getCurrentStep()!.description).toBe('Step 2')
    expect(planner.getPlan()!.steps[0].status).toBe('completed')
    expect(planner.getPlan()!.steps[0].result).toBe('done')
  })

  it('should fail current step', () => {
    planner.createPlan('Goal', [{ description: 'Step 1' }])
    planner.failCurrentStep('error occurred')
    expect(planner.getPlan()!.steps[0].status).toBe('failed')
    expect(planner.getPlan()!.steps[0].error).toBe('error occurred')
  })

  it('should skip current step', () => {
    planner.createPlan('Goal', [{ description: 'Step 1' }, { description: 'Step 2' }])
    planner.skipCurrentStep()
    expect(planner.getPlan()!.steps[0].status).toBe('skipped')
    expect(planner.getCurrentStep()!.description).toBe('Step 2')
  })

  it('should detect more steps', () => {
    planner.createPlan('Goal', [{ description: 'Step 1' }, { description: 'Step 2' }])
    expect(planner.hasMoreSteps()).toBe(true)
    planner.completeCurrentStep()
    expect(planner.hasMoreSteps()).toBe(true)
    planner.completeCurrentStep()
    expect(planner.hasMoreSteps()).toBe(false)
  })

  it('should return false for more steps when no plan', () => {
    expect(planner.hasMoreSteps()).toBe(false)
  })

  it('should track progress', () => {
    planner.createPlan('Goal', [{ description: 'Step 1' }, { description: 'Step 2' }, { description: 'Step 3' }])
    let progress = planner.getProgress()
    expect(progress.completed).toBe(0)
    expect(progress.total).toBe(3)
    expect(progress.percentage).toBe(0)

    planner.completeCurrentStep()
    progress = planner.getProgress()
    expect(progress.completed).toBe(1)
    expect(progress.percentage).toBe(33)
  })

  it('should return zero progress when no plan', () => {
    const progress = planner.getProgress()
    expect(progress.completed).toBe(0)
    expect(progress.total).toBe(0)
    expect(progress.percentage).toBe(0)
  })

  it('should format plan', () => {
    planner.createPlan('Fix bug', [{ description: 'Read file' }, { description: 'Edit code' }])
    const formatted = planner.formatPlan()
    expect(formatted).toContain('Fix bug')
    expect(formatted).toContain('Read file')
    expect(formatted).toContain('Edit code')
    expect(formatted).toContain('Progress:')
  })

  it('should show no active plan message', () => {
    expect(planner.formatPlan()).toBe('No active plan')
  })

  it('should reset planner', () => {
    planner.createPlan('Goal', [{ description: 'Step 1' }])
    planner.reset()
    expect(planner.getPlan()).toBeNull()
    expect(planner.getCurrentStep()).toBeNull()
  })

  it('should parse plan from response', () => {
    const response = `Here's the plan:
1. Read the file
2. Edit the code
3. Run tests`
    const plan = planner.parsePlanFromResponse(response)
    expect(plan).not.toBeNull()
    expect(plan!.steps).toHaveLength(3)
  })

  it('should return null for response without steps', () => {
    const plan = planner.parsePlanFromResponse('No plan here')
    expect(plan).toBeNull()
  })

  it('should handle plan with tools', () => {
    const plan = planner.createPlan('Goal', [
      { description: 'Read', tools: ['Read'] },
      { description: 'Edit', tools: ['Edit'] },
    ])
    expect(plan.steps[0].toolCalls).toContain('Read')
    expect(plan.steps[1].toolCalls).toContain('Edit')
  })

  it('should format completed steps with checkmark', () => {
    planner.createPlan('Goal', [{ description: 'Step 1' }, { description: 'Step 2' }])
    planner.completeCurrentStep()
    const formatted = planner.formatPlan()
    expect(formatted).toContain('✓')
  })

  it('should format failed steps with cross', () => {
    planner.createPlan('Goal', [{ description: 'Step 1' }])
    planner.failCurrentStep('error')
    const formatted = planner.formatPlan()
    expect(formatted).toContain('✗')
  })

  it('should format skipped steps', () => {
    planner.createPlan('Goal', [{ description: 'Step 1' }, { description: 'Step 2' }])
    planner.skipCurrentStep()
    const formatted = planner.formatPlan()
    expect(formatted).toContain('⊘')
  })
})
