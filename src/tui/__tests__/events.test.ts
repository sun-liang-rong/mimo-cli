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
