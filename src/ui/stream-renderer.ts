// src/ui/stream-renderer.ts

import blessed from 'blessed';
import { ChatBox } from './chatbox';
import { FooterBar } from './footerbar';
import { Colors, Icons } from './theme';

export class StreamRenderer {
  private chatbox: ChatBox;
  private footerbar: FooterBar;
  private screen: blessed.Widgets.Screen;

  // 状态
  private isThinking: boolean = false;
  private isStreaming: boolean = false;
  private thinkingStartTime: number = 0;
  private streamStartTime: number = 0;
  private currentMessage: string = '';
  private currentTokenCount: number = 0;

  // 覆盖 Box (用于行内动态更新)
  private overlayBox: blessed.Widgets.BoxElement | null = null;

  constructor(chatbox: ChatBox, footerbar: FooterBar, screen: blessed.Widgets.Screen) {
    this.chatbox = chatbox;
    this.footerbar = footerbar;
    this.screen = screen;
  }

  /** 获取 ChatBox (供 chat.ts 使用) */
  getChatBox(): ChatBox {
    return this.chatbox;
  }

  /** 获取当前是否正在流式输出 */
  getIsStreaming(): boolean {
    return this.isStreaming;
  }

  /** 开始思考阶段 */
  startThinking(): void {
    if (this.isThinking) return;
    this.isThinking = true;
    this.thinkingStartTime = Date.now();
    this.footerbar.setState('thinking');

    // 创建覆盖 Box 显示 thinking 状态
    this.createOverlay(`  {${Colors.thinking}-fg}${Icons.thinking} thinking...{/fg}`);
  }

  /** 更新思考内容 (实时) */
  updateThinking(_content: string): void {
    if (!this.isThinking) return;
    const elapsed = Date.now() - this.thinkingStartTime;
    const duration = (elapsed / 1000).toFixed(1);
    this.updateOverlay(`  {${Colors.thinking}-fg}${Icons.thinking} thinking ${duration}s{/fg}`);
  }

  /** 结束思考阶段 */
  endThinking(): void {
    if (!this.isThinking) return;
    this.isThinking = false;
    const duration = Date.now() - this.thinkingStartTime;

    // 销毁覆盖 Box
    this.destroyOverlay();

    // 写入最终状态到 ChatBox
    this.chatbox.pushThinkingDone(duration);
  }

  /** 开始流式输出阶段 */
  startStreaming(): void {
    if (this.isStreaming) return;
    this.isStreaming = true;
    this.streamStartTime = Date.now();
    this.currentMessage = '';
    this.currentTokenCount = 0;
    this.footerbar.setState('streaming');
  }

  /** 追加 token (逐字流式) */
  appendToken(token: string): void {
    if (!this.isStreaming) return;
    this.currentMessage += token;
    this.currentTokenCount++;

    // 直接追加到 ChatBox (blessed Log 的 add 方法)
    // 逐行追加：处理 token 中可能包含换行的情况
    this.chatbox.log.add(token);

    // 更新 FooterBar
    this.footerbar.updateTokenCount(this.currentTokenCount);
    this.footerbar.updateElapsedTime(Date.now() - this.streamStartTime);
  }

  /** 结束流式输出阶段 */
  endStreaming(tokenCount: number, durationMs: number): void {
    this.isStreaming = false;

    // 如果有 Markdown 内容，在流式完成后渲染
    if (this.currentMessage.trim()) {
      this.chatbox.pushMarkdown(this.currentMessage);
    }

    // 显示用量统计
    if (tokenCount > 0 || this.currentTokenCount > 0) {
      const tokens = tokenCount || this.currentTokenCount;
      const duration = durationMs || (Date.now() - this.streamStartTime);
      this.chatbox.pushTokenUsage(tokens, duration);
    }

    this.footerbar.setState('idle');
  }

  /** 开始工具调用 */
  startToolCall(name: string, args: string): void {
    this.footerbar.setState('tool_call', name);
    this.chatbox.pushToolCallStart(name, args);
  }

  /** 结束工具调用 */
  endToolCall(name: string, args: string, success: boolean, durationMs: number): void {
    this.chatbox.pushToolCallResult(name, args, success, durationMs);
    this.footerbar.setState('idle');
  }

  /** 推入错误 */
  pushError(message: string): void {
    this.chatbox.pushError(message);
  }

  /** 创建覆盖 Box */
  private createOverlay(content: string): void {
    if (this.overlayBox) return;

    // 获取 ChatBox 的底部位置
    const chatLog = this.chatbox.log;
    const bottom = (chatLog.atop as number) + (chatLog.height as number) - 1;

    this.overlayBox = blessed.box({
      parent: this.screen,
      top: bottom,
      left: chatLog.aleft,
      width: chatLog.width,
      height: 1,
      content: content,
      style: {
        bg: 'default',
      },
      tags: true,
    });
    this.screen.render();
  }

  /** 更新覆盖 Box 内容 */
  private updateOverlay(content: string): void {
    if (!this.overlayBox) return;
    this.overlayBox.setContent(content);
    this.screen.render();
  }

  /** 销毁覆盖 Box */
  private destroyOverlay(): void {
    if (!this.overlayBox) return;
    this.overlayBox.destroy();
    this.overlayBox = null;
    this.screen.render();
  }
}
