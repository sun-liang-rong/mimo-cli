// src/ui/footerbar.ts

import blessed from 'blessed';
import { Colors, Icons, FooterState } from './theme';

export class FooterBar {
  readonly box: blessed.Widgets.BoxElement;
  private state: FooterState = 'idle';
  private detail: string = '';
  private model: string = '';
  private permissionMode: string = 'default';
  private tokenCount: number = 0;
  private elapsedMs: number = 0;

  constructor(screen: blessed.Widgets.Screen) {
    this.box = blessed.box({
      parent: screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: '',
      style: {
        fg: Colors.footerBarFg,
        bg: Colors.footerBarBg,
      },
      tags: true,
    });
  }

  /** 更新基础信息 */
  updateInfo(model: string, permissionMode: string): void {
    this.model = model;
    this.permissionMode = permissionMode;
    this.render();
  }

  setState(state: FooterState, detail?: string): void {
    this.state = state;
    this.detail = detail || '';
    this.render();
  }

  updateTokenCount(count: number): void {
    this.tokenCount = count;
    this.render();
  }

  updateElapsedTime(ms: number): void {
    this.elapsedMs = ms;
    this.render();
  }

  private render(): void {
    const stateDisplay = this.formatState();
    const stateColor = this.getStateColor();

    const parts: string[] = [
      `{${stateColor}-fg}${this.permissionMode}{/fg}`,
      '·',
      `{${stateColor}-fg}${this.model}{/fg}`,
      '·',
      `{${stateColor}-fg}${stateDisplay}{/fg}`,
    ];

    if (this.tokenCount > 0 && this.state === 'streaming') {
      parts.push('·');
      parts.push(`{gray-fg}${this.formatTokens()}{/fg}`);
    }

    parts.push('·');
    parts.push('{gray-fg}Ctrl+C quit{/fg}');

    this.box.setContent(parts.join(' '));
    this.box.screen.render();
  }

  private formatState(): string {
    switch (this.state) {
      case 'idle':
        return 'idle';
      case 'thinking':
        return `${Icons.statusThinking} thinking ${this.formatElapsed()}`;
      case 'streaming':
        return `${Icons.statusStreaming} streaming ${this.formatTokens()}`;
      case 'tool_call':
        return `${Icons.statusToolCall} ${this.detail} ${this.formatElapsed()}`;
      case 'waiting_input':
        return `${Icons.statusWaitingInput} permission y/n/a`;
    }
  }

  private getStateColor(): string {
    switch (this.state) {
      case 'idle':
        return Colors.statusIdle;
      case 'thinking':
        return Colors.statusThinking;
      case 'streaming':
        return Colors.statusStreaming;
      case 'tool_call':
        return Colors.statusToolCall;
      case 'waiting_input':
        return Colors.statusWaitingInput;
    }
  }

  private formatElapsed(): string {
    if (this.elapsedMs === 0) return '';
    return `${(this.elapsedMs / 1000).toFixed(1)}s`;
  }

  private formatTokens(): string {
    if (this.tokenCount < 1000) return `${this.tokenCount} tokens`;
    return `${(this.tokenCount / 1000).toFixed(1)}k tokens`;
  }
}
