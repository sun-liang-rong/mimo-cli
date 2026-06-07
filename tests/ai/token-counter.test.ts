import { estimateTokens, countMessageTokens, countMessagesTokens, truncateToLimit } from '../../src/ai/token-counter';
import { Message } from '../../src/ai/client';

describe('TokenCounter', () => {
  it('should estimate tokens for ASCII text', () => {
    const tokens = estimateTokens('hello world');
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(20);
  });

  it('should estimate tokens for Chinese text', () => {
    const tokens = estimateTokens('你好世界');
    expect(tokens).toBeGreaterThan(4); // ~1.5 per char = 6
  });

  it('should return 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('should count message tokens', () => {
    const msg: Message = { role: 'user', content: 'hello' };
    const tokens = countMessageTokens(msg);
    expect(tokens).toBeGreaterThan(4); // base overhead + content
  });

  it('should count total messages tokens', () => {
    const messages: Message[] = [
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
    ];
    const total = countMessagesTokens(messages);
    expect(total).toBeGreaterThan(0);
  });

  it('should truncate messages keeping system + recent', () => {
    const messages: Message[] = [
      { role: 'system', content: 'System prompt' },
      { role: 'user', content: 'msg 1' },
      { role: 'assistant', content: 'reply 1' },
      { role: 'user', content: 'msg 2' },
      { role: 'assistant', content: 'reply 2' },
      { role: 'user', content: 'msg 3' },
      { role: 'assistant', content: 'reply 3' },
    ];
    // Very small limit to force truncation
    const result = truncateToLimit(messages, 30);
    expect(result.length).toBeLessThan(messages.length);
    expect(result[0].role).toBe('system');
  });
});
