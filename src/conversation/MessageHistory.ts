import type { Message, MessageRole } from './types.js';

/** Events emitted by the MessageHistory class. */
export type MessageHistoryEvent =
  | { type: 'messageAdded'; message: Message }
  | { type: 'messageUpdated'; message: Message }
  | { type: 'messageDeleted'; messageId: string }
  | { type: 'cleared' };

/** Listener function for MessageHistory events. */
export type MessageHistoryListener = (event: MessageHistoryEvent) => void;

/** Options for adding a new message. */
export interface AddMessageOptions {
  status?: Message['status'];
  toolCalls?: Message['toolCalls'];
  toolCallId?: Message['toolCallId'];
  name?: Message['name'];
  parentId?: Message['parentId'];
  branchId?: Message['branchId'];
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/** Manages an array of Message objects with event subscriptions. */
export class MessageHistory {
  private messages: Message[] = [];
  private listeners: Set<MessageHistoryListener> = new Set();

  /** Subscribe to changes. Returns an unsubscribe function. */
  onChange(listener: MessageHistoryListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: MessageHistoryEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  /** Add a new message with auto-generated id and timestamp. */
  addMessage(role: MessageRole, content: string, options: AddMessageOptions = {}): Message {
    const message: Message = {
      id: generateId(),
      role,
      content,
      status: options.status ?? 'complete',
      timestamp: new Date().toISOString(),
      toolCalls: options.toolCalls,
      toolCallId: options.toolCallId,
      name: options.name,
      parentId: options.parentId,
      branchId: options.branchId,
    };
    this.messages.push(message);
    this.emit({ type: 'messageAdded', message });
    return message;
  }

  /** Update a message by id. */
  updateMessage(id: string, updates: Partial<Omit<Message, 'id'>>): Message | null {
    const index = this.messages.findIndex((m) => m.id === id);
    if (index === -1) {
      return null;
    }
    const updated = { ...this.messages[index], ...updates };
    this.messages[index] = updated;
    this.emit({ type: 'messageUpdated', message: updated });
    return updated;
  }

  /** Delete a message by id. */
  deleteMessage(id: string): boolean {
    const index = this.messages.findIndex((m) => m.id === id);
    if (index === -1) {
      return false;
    }
    this.messages.splice(index, 1);
    this.emit({ type: 'messageDeleted', messageId: id });
    return true;
  }

  /** Get all messages. */
  getMessages(): Message[] {
    return [...this.messages];
  }

  /** Get a single message by id. */
  getMessage(id: string): Message | undefined {
    return this.messages.find((m) => m.id === id);
  }

  /** Clear all messages. */
  clear(): void {
    this.messages = [];
    this.emit({ type: 'cleared' });
  }
}
