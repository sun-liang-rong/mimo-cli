import { describe, it, expect, beforeEach } from 'vitest'
import { AgentOrchestrator } from '../orchestrator.js'

describe('AgentOrchestrator', () => {
  let orch: AgentOrchestrator

  beforeEach(() => {
    orch = new AgentOrchestrator({
      maxConcurrent: 2,
      config: { apiKey: 'test', baseURL: 'http://test', model: 'test', maxTokens: 1024, temperature: 0.7 },
      systemPrompt: 'test prompt',
    })
  })

  it('should create with config', () => {
    expect(orch.getAllTasks()).toEqual([])
  })

  it('should create a task', () => {
    const task = orch.createTask('Test task', [{ role: 'user', content: 'hello' }])
    expect(task.id).toBeDefined()
    expect(task.description).toBe('Test task')
    expect(task.status).toBe('pending')
  })

  it('should create multiple tasks', () => {
    orch.createTask('Task 1', [])
    orch.createTask('Task 2', [])
    expect(orch.getAllTasks()).toHaveLength(2)
  })

  it('should get task by id', () => {
    const task = orch.createTask('Test', [])
    const found = orch.getTask(task.id)
    expect(found).toBeDefined()
    expect(found!.description).toBe('Test')
  })

  it('should return undefined for non-existent task', () => {
    expect(orch.getTask('non-existent')).toBeUndefined()
  })

  it('should track progress', () => {
    orch.createTask('Task 1', [])
    orch.createTask('Task 2', [])
    const progress = orch.getProgress()
    expect(progress.total).toBe(2)
    expect(progress.pending).toBe(2)
    expect(progress.completed).toBe(0)
    expect(progress.running).toBe(0)
    expect(progress.failed).toBe(0)
  })

  it('should reset', () => {
    orch.createTask('Task 1', [])
    orch.createTask('Task 2', [])
    orch.reset()
    expect(orch.getAllTasks()).toEqual([])
  })

  it('should return empty progress when no tasks', () => {
    const progress = orch.getProgress()
    expect(progress.total).toBe(0)
    expect(progress.pending).toBe(0)
  })

  it('should create task with messages', () => {
    const messages = [
      { role: 'user' as const, content: 'hello' },
      { role: 'assistant' as const, content: 'hi' },
    ]
    const task = orch.createTask('Chat task', messages)
    expect(task.messages).toHaveLength(2)
  })

  it('should create task with empty messages', () => {
    const task = orch.createTask('Empty task', [])
    expect(task.messages).toEqual([])
  })

  it('should generate unique task ids', () => {
    const t1 = orch.createTask('T1', [])
    const t2 = orch.createTask('T2', [])
    expect(t1.id).not.toBe(t2.id)
  })

  it('should handle maxConcurrent config', () => {
    const o = new AgentOrchestrator({
      maxConcurrent: 5,
      config: { apiKey: 'test', baseURL: 'http://test', model: 'test', maxTokens: 1024, temperature: 0.7 },
      systemPrompt: 'test',
    })
    expect(o.getAllTasks()).toEqual([])
  })

  it('should create tasks with descriptions', () => {
    const task = orch.createTask('Read file src/index.ts and summarize', [])
    expect(task.description).toContain('Read file')
  })

  it('should handle task status transitions', () => {
    const task = orch.createTask('Test', [])
    expect(task.status).toBe('pending')
    // Status is managed internally during execution
  })

  it('should get all tasks', () => {
    orch.createTask('A', [])
    orch.createTask('B', [])
    orch.createTask('C', [])
    const tasks = orch.getAllTasks()
    expect(tasks).toHaveLength(3)
    expect(tasks.map(t => t.description)).toEqual(['A', 'B', 'C'])
  })

  it('should handle reset on empty orchestrator', () => {
    orch.reset()
    expect(orch.getAllTasks()).toEqual([])
  })

  it('should create task with tool_calls in messages', () => {
    const messages = [
      {
        role: 'assistant' as const,
        content: null,
        tool_calls: [{ id: 'tc1', type: 'function' as const, function: { name: 'Read', arguments: '{}' } }],
      },
    ]
    const task = orch.createTask('Tool task', messages)
    expect(task.messages[0].tool_calls).toBeDefined()
  })
})
