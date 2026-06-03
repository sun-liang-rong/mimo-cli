import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageHistory } from '../MessageHistory.js';
import type { Message, MessageRole } from '../types.js';

describe('MessageHistory', () => {
  let history: MessageHistory;

  beforeEach(() => {
    history = new MessageHistory();
  });

  describe('addMessage', () => {
    it('should add a message with auto-generated id and timestamp', () => {
      const message = history.addMessage('user', 'Hello');
      expect(message.id).toBeDefined();
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello');
      expect(message.timestamp).toBeDefined();
      expect(new Date(message.timestamp)).toBeInstanceOf(Date);
    });

    it('should default status to complete', () => {
      const message = history.addMessage('user', 'Hello');
      expect(message.status).toBe('complete');
    });

    it('should allow custom status via options', () => {
      const message = history.addMessage('user', 'Hello', { status: 'pending' });
      expect(message.status).toBe('pending');
    });

    it('should include optional fields from options', () => {
      const message = history.addMessage('assistant', 'Result', {
        status: 'complete',
        name: 'myTool',
        toolCallId: 'tc-1',
        parentId: 'parent-1',
        branchId: 'branch-1',
      });
      expect(message.name).toBe('myTool');
      expect(message.toolCallId).toBe('tc-1');
      expect(message.parentId).toBe('parent-1');
      expect(message.branchId).toBe('branch-1');
    });

    it('should emit messageAdded event', () => {
      const listener = vi.fn();
      history.onChange(listener);
      const message = history.addMessage('user', 'Hello');
      expect(listener).toHaveBeenCalledWith({ type: 'messageAdded', message });
    });
  });

  describe('getMessages', () => {
    it('should return all messages', () => {
      history.addMessage('user', 'Hello');
      history.addMessage('assistant', 'Hi there');
      const messages = history.getMessages();
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe('Hello');
      expect(messages[1].content).toBe('Hi there');
    });

    it('should return a copy of the messages array', () => {
      history.addMessage('user', 'Hello');
      const messages = history.getMessages();
      messages.pop();
      expect(history.getMessages()).toHaveLength(1);
    });
  });

  describe('getMessage', () => {
    it('should return a single message by id', () => {
      const message = history.addMessage('user', 'Hello');
      const found = history.getMessage(message.id);
      expect(found).toEqual(message);
    });

    it('should return undefined for non-existent id', () => {
      expect(history.getMessage('non-existent')).toBeUndefined();
    });
  });

  describe('updateMessage', () => {
    it('should update a message by id', () => {
      const message = history.addMessage('user', 'Hello');
      const updated = history.updateMessage(message.id, { content: 'Hello updated' });
      expect(updated).not.toBeNull();
      expect(updated!.content).toBe('Hello updated');
      expect(history.getMessage(message.id)!.content).toBe('Hello updated');
    });

    it('should not modify the id', () => {
      const message = history.addMessage('user', 'Hello');
      const originalId = message.id;
      const updated = history.updateMessage(originalId, { content: 'Updated' });
      expect(updated!.id).toBe(originalId);
    });

    it('should emit messageUpdated event', () => {
      const listener = vi.fn();
      history.onChange(listener);
      const message = history.addMessage('user', 'Hello');
      history.updateMessage(message.id, { content: 'Updated' });
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'messageUpdated' })
      );
    });

    it('should return null for non-existent id', () => {
      const result = history.updateMessage('non-existent', { content: 'Updated' });
      expect(result).toBeNull();
    });
  });

  describe('deleteMessage', () => {
    it('should delete a message by id', () => {
      const message = history.addMessage('user', 'Hello');
      const deleted = history.deleteMessage(message.id);
      expect(deleted).toBe(true);
      expect(history.getMessage(message.id)).toBeUndefined();
    });

    it('should emit messageDeleted event', () => {
      const listener = vi.fn();
      history.onChange(listener);
      const message = history.addMessage('user', 'Hello');
      history.deleteMessage(message.id);
      expect(listener).toHaveBeenCalledWith({ type: 'messageDeleted', messageId: message.id });
    });

    it('should return false for non-existent id', () => {
      expect(history.deleteMessage('non-existent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all messages', () => {
      history.addMessage('user', 'Hello');
      history.addMessage('assistant', 'Hi');
      history.clear();
      expect(history.getMessages()).toHaveLength(0);
    });

    it('should emit cleared event', () => {
      const listener = vi.fn();
      history.onChange(listener);
      history.clear();
      expect(listener).toHaveBeenCalledWith({ type: 'cleared' });
    });
  });

  describe('onChange', () => {
    it('should allow multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      history.onChange(listener1);
      history.onChange(listener2);
      history.addMessage('user', 'Hello');
      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should allow unsubscribing', () => {
      const listener = vi.fn();
      const unsubscribe = history.onChange(listener);
      unsubscribe();
      history.addMessage('user', 'Hello');
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
