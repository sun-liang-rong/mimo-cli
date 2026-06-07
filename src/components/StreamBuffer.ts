import { ToolCallState } from './ToolCallBlock.js';

/**
 * StreamBuffer: throttles streaming text re-renders only.
 *
 * Only content deltas are batched — tool call state changes
 * go directly through React state (they are infrequent enough
 * not to cause flicker).
 */
export class StreamBuffer {
  private content = '';
  private toolCalls: ToolCallState[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushCallback: ((content: string, toolCalls: ToolCallState[]) => void) | null = null;
  private readonly FLUSH_INTERVAL = 80; // ms between flushes

  onFlush(callback: (content: string, toolCalls: ToolCallState[]) => void): void {
    this.flushCallback = callback;
  }

  appendContent(text: string): void {
    this.content += text;
    this.ensureFlushTimer();
  }

  updateToolCalls(toolCalls: ToolCallState[]): void {
    this.toolCalls = toolCalls;
  }

  private ensureFlushTimer(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => this.flush(), this.FLUSH_INTERVAL);
  }

  flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.flushCallback) {
      this.flushCallback(this.content, this.toolCalls);
    }
  }

  getContent(): string { return this.content; }

  reset(): void {
    this.content = '';
    this.toolCalls = [];
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }
}
