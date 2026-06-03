// src/ui/chatbox.ts

import blessed from 'blessed';
import { Colors, Icons } from './theme';
import { renderMarkdown, hasMarkdown } from './markdown';

export class ChatBox {
  readonly log: any;

  constructor(screen: blessed.Widgets.Screen, options?: { top?: number; height?: number | string }) {
    this.log = blessed.log({
      parent: screen,
      top: options?.top ?? 1,
      left: 0,
      width: '100%',
      height: options?.height ?? '100%-3',
      scrollback: 1000,
      tags: true,
      mouse: true,
      keys: true,
      vi: true,
      scrollbar: {
        ch: ' ',
        track: {
          bg: 'gray',
        },
        style: {
          inverse: true,
        },
      },
      style: {
        fg: 'white',
        bg: 'default',
      },
    });
  }

  /** 推入用户消息 */
  pushUserMessage(text: string): void {
    this.log.add(`{${Colors.user}-fg}${Icons.user}{/fg}`);
    this.log.add(`  ${text}`);
    this.log.add('');
  }

  /** 推入 AI 回复头部 (模型标记) */
  pushAssistantHeader(model: string): void {
    this.log.add(`{${Colors.assistant}-fg}${Icons.assistant} ${model}{/fg}`);
  }

  /** 推入思考完成摘要 */
  pushThinkingDone(durationMs: number): void {
    const duration = (durationMs / 1000).toFixed(1);
    this.log.add(`  {${Colors.thinking}-fg}${Icons.thinking} thinking ${duration}s{/fg}`);
  }

  /** 推入工具调用结果 */
  pushToolCallResult(name: string, args: string, success: boolean, durationMs: number): void {
    const duration = (durationMs / 1000).toFixed(1);
    const icon = success ? Icons.toolSuccess : Icons.toolError;
    const color = success ? Colors.toolSuccess : Colors.toolError;
    const suffix = args ? ` ${args}` : '';
    this.log.add(`  {${Colors.toolCall}-fg}${Icons.toolCall}{/fg} {${color}-fg}${name}${suffix} ${icon} ${duration}s{/fg}`);
  }

  /** 推入工具调用开始 (等待状态) */
  pushToolCallStart(name: string, args: string): void {
    const suffix = args ? ` ${args}` : '';
    this.log.add(`  {${Colors.toolCall}-fg}${Icons.toolCall}{/fg} {${Colors.toolCall}-fg}${name}${suffix} ...{/fg}`);
  }

  /** 推入 token 用量统计 */
  pushTokenUsage(tokens: number, durationMs: number): void {
    const tokenStr = tokens < 1000 ? `${tokens} tokens` : `${(tokens / 1000).toFixed(1)}k tokens`;
    const duration = (durationMs / 1000).toFixed(1);
    this.log.add(`  {${Colors.tokenUsage}-fg}${tokenStr} · ${duration}s{/fg}`);
    this.log.add('');
  }

  /** 推入错误消息 */
  pushError(message: string): void {
    this.log.add(`  {${Colors.error}-fg}${Icons.toolError} ${message}{/fg}`);
  }

  /** 推入普通文本 (用于流式追加) */
  pushText(text: string): void {
    this.log.add(text);
  }

  /** 推入 Markdown 渲染后的文本 */
  pushMarkdown(text: string): void {
    if (hasMarkdown(text)) {
      const rendered = renderMarkdown(text);
      // 逐行添加，保持滚动行为
      const lines = rendered.split('\n');
      for (const line of lines) {
        this.log.add(line);
      }
    } else {
      this.log.add(text);
    }
  }

  /** 推入权限确认提示 */
  pushPermissionPrompt(toolName: string, detail: string): void {
    this.log.add(`  {${Colors.toolCall}-fg}${Icons.toolCall} ${toolName}{/fg}`);
    this.log.add(`    {yellow-fg}权限确认: ${detail}{/yellow-fg}`);
    this.log.add(`    {${Colors.dim}-fg}y = 允许  n = 拒绝  a = 始终允许{/${Colors.dim}-fg}`);
  }

  /** 清空聊天区 */
  clear(): void {
    // blessed Log 没有 clear 方法，需要通过 _clines 清空
    (this.log as any)._clines = [];
    this.log.setContent('');
    this.log.screen.render();
  }

  /** 滚动到底部 */
  scrollToBottom(): void {
    this.log.setScrollPerc(100);
    this.log.screen.render();
  }
}
