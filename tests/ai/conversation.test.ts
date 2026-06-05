import { ConversationManager } from '../../src/ai/conversation';

describe('ConversationManager', () => {
  let conversation: ConversationManager;

  beforeEach(() => {
    conversation = new ConversationManager();
  });

  it('should initialize with system prompt', () => {
    const messages = conversation.getMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('system');
  });

  it('should add user message', () => {
    conversation.addMessage({ role: 'user', content: '你好' });
    const messages = conversation.getMessages();
    expect(messages).toHaveLength(2);
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toBe('你好');
  });

  it('should add assistant message', () => {
    conversation.addMessage({ role: 'user', content: '你好' });
    conversation.addMessage({ role: 'assistant', content: '你好！有什么可以帮助你的？' });
    const messages = conversation.getMessages();
    expect(messages).toHaveLength(3);
  });

  it('should handle tool calls and results', () => {
    conversation.addMessage({ role: 'user', content: '读取文件' });
    conversation.addToolCall({
      id: 'call_1',
      type: 'function',
      function: { name: 'read_file', arguments: '{"path":"test.txt"}' }
    });
    conversation.addToolResult('call_1', '{"success":true,"output":"文件内容"}');
    
    const messages = conversation.getMessages();
    expect(messages.length).toBeGreaterThan(2);
  });

  it('should clear history', () => {
    conversation.addMessage({ role: 'user', content: '你好' });
    conversation.clear();
    const messages = conversation.getMessages();
    expect(messages).toHaveLength(1);
  });

  it('should start new turn', () => {
    conversation.addMessage({ role: 'user', content: '第一个问题' });
    conversation.startNewTurn();
    conversation.addMessage({ role: 'user', content: '第二个问题' });
    
    expect(conversation.getTurnCount()).toBe(2);
  });
});
