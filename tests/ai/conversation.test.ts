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

  it('should count turns', () => {
    conversation.addMessage({ role: 'user', content: '第一个问题' });
    conversation.addMessage({ role: 'user', content: '第二个问题' });
    expect(conversation.getTurnCount()).toBe(2);
  });

  it('should return context summary', () => {
    conversation.addMessage({ role: 'user', content: '你好' });
    const summary = conversation.getContextSummary();
    expect(summary.turns).toBe(1);
    expect(summary.maxTokens).toBeGreaterThan(0);
    expect(summary.tokens).toBeGreaterThan(0);
  });

  it('should export history as markdown', () => {
    conversation.addMessage({ role: 'user', content: '你好' });
    conversation.addMessage({ role: 'assistant', content: '你好！' });
    const md = conversation.exportHistory();
    expect(md).toContain('MiMo CLI 对话历史');
    expect(md).toContain('你好');
  });

  it('should get and set raw messages', () => {
    conversation.addMessage({ role: 'user', content: 'test' });
    const raw = conversation.getMessagesRaw();
    expect(raw).toHaveLength(1);
    
    const newMessages = [
      { role: 'user' as const, content: 'restored' }
    ];
    conversation.setMessages(newMessages);
    expect(conversation.getMessagesRaw()).toHaveLength(1);
    expect(conversation.getMessagesRaw()[0].content).toBe('restored');
  });
});

describe('Multi-turn conversation', () => {
  it('should maintain full message history across multiple user messages', () => {
    const conversation = new ConversationManager();

    // Turn 1
    conversation.addMessage({ role: 'user', content: '你好' });
    conversation.addMessage({ role: 'assistant', content: '你好！有什么可以帮助你的？' });

    // Turn 2
    conversation.addMessage({ role: 'user', content: '帮我读取文件' });
    conversation.addMessage({
      role: 'assistant' as any,
      content: '好的，让我读取文件',
      tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'read_file', arguments: '{"path":"test.ts"}' } }]
    } as any);
    conversation.addToolResult('call_1', '{"success":true,"output":"文件内容"}');
    conversation.addMessage({ role: 'assistant', content: '文件内容已读取，内容是...' });

    // Turn 3 - should still have full history
    const messages = conversation.getMessages();
    const userMsgs = messages.filter(m => m.role === 'user');
    const assistantMsgs = messages.filter(m => m.role === 'assistant');
    const toolMsgs = messages.filter(m => m.role === 'tool');

    expect(userMsgs).toHaveLength(2);
    expect(assistantMsgs.length).toBeGreaterThanOrEqual(3);
    expect(toolMsgs).toHaveLength(1);
    expect(conversation.getTurnCount()).toBe(2);
  });

  it('should handle multi-turn with tool calls in sequence', () => {
    const conversation = new ConversationManager();

    // Turn 1 with tool calls
    conversation.addMessage({ role: 'user', content: '列出文件' });
    conversation.addMessage({
      role: 'assistant' as any,
      content: null,
      tool_calls: [{ id: 'tc1', type: 'function', function: { name: 'list_files', arguments: '{"path":"."}' } }]
    } as any);
    conversation.addToolResult('tc1', '{"success":true,"output":"file1.ts\nfile2.ts"}');
    conversation.addMessage({ role: 'assistant', content: '当前目录有 file1.ts 和 file2.ts' });

    // Turn 2 with different tool
    conversation.addMessage({ role: 'user', content: '读取 file1.ts' });
    conversation.addMessage({
      role: 'assistant' as any,
      content: null,
      tool_calls: [{ id: 'tc2', type: 'function', function: { name: 'read_file', arguments: '{"path":"file1.ts"}' } }]
    } as any);
    conversation.addToolResult('tc2', '{"success":true,"output":"const x = 1;"}');
    conversation.addMessage({ role: 'assistant', content: 'file1.ts 的内容是 const x = 1;' });

    const messages = conversation.getMessages();
    // Should have: system + 2 users + 3 assistants (2 with tool_calls) + 2 tools + 1 final assistant
    expect(messages.length).toBeGreaterThanOrEqual(8);
    expect(messages.filter(m => m.role === 'tool')).toHaveLength(2);
  });
});
