import { Message } from './client.js';

/** Token count cache to avoid recomputing for same messages */
const tokenCache = new Map<string, number>();
const CACHE_MAX_SIZE = 1000;

function getCacheKey(text: string): string {
  // Simple hash for caching
  let hash = 0;
  for (let i = 0; i < Math.min(text.length, 200); i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `${hash}_${text.length}`;
}

function cleanupCache(): void {
  if (tokenCache.size > CACHE_MAX_SIZE) {
    const entriesToDelete = tokenCache.size - CACHE_MAX_SIZE;
    let count = 0;
    for (const key of tokenCache.keys()) {
      if (count >= entriesToDelete) break;
      tokenCache.delete(key);
      count++;
    }
  }
}

export function estimateTokens(text: string): number {
  if (!text) return 0;

  const cacheKey = getCacheKey(text);
  const cached = tokenCache.get(cacheKey);
  if (cached !== undefined) return cached;

  let tokens = 0;
  for (const char of text) {
    if (/[一-鿿㐀-䶿豈-﫿]/.test(char)) {
      tokens += 1.5;
    } else if (/\s/.test(char)) {
      tokens += 0.25;
    } else {
      tokens += 0.3;
    }
  }

  const result = Math.ceil(tokens);
  tokenCache.set(cacheKey, result);
  cleanupCache();
  return result;
}

export function countMessageTokens(message: Message): number {
  let tokens = 4;
  if (message.content) tokens += estimateTokens(message.content);
  if (message.tool_calls) {
    for (const tc of message.tool_calls) {
      tokens += estimateTokens(tc.function.name) + estimateTokens(tc.function.arguments) + 10;
    }
  }
  if (message.tool_call_id) tokens += 10;
  return tokens;
}

export function countMessagesTokens(messages: Message[]): number {
  return messages.reduce((sum, m) => sum + countMessageTokens(m), 0);
}

export function truncateToLimit(messages: Message[], maxTokens: number): Message[] {
  if (messages.length <= 1) return messages;
  const systemMessage = messages[0];
  const otherMessages = messages.slice(1);
  const systemTokens = countMessageTokens(systemMessage);
  if (systemTokens >= maxTokens) return [systemMessage];
  const remaining = maxTokens - systemTokens;
  let used = 0;
  const kept: Message[] = [];
  for (let i = otherMessages.length - 1; i >= 0; i--) {
    const msgTokens = countMessageTokens(otherMessages[i]);
    if (used + msgTokens > remaining) break;
    used += msgTokens;
    kept.unshift(otherMessages[i]);
  }
  return [systemMessage, ...kept];
}
