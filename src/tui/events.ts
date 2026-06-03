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
