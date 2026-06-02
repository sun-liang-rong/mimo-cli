# TUI 交互体验重写 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 mimo-cli 的终端交互从 readline + console.log 重写为 blessed 全屏 TUI，实现 Claude Code 风格的简约紧凑体验。

**Architecture:** 基于 blessed 构建全屏 TUI 布局（TopBar + ChatBox + InputBox + FooterBar），通过 StreamRenderer 引擎驱动流式渲染，InputBox 自管理输入缓冲区实现 Shift+Enter 多行输入，chat.ts 主循环对接 TUIApp 事件系统。

**Tech Stack:** TypeScript, Node.js, blessed (已有依赖), marked + marked-terminal (已有依赖), chalk (已有依赖)

---

## File Structure

### 新建文件
| 文件 | 职责 |
|------|------|
| `src/ui/theme.ts` | 颜色常量、图标符号、样式定义 |
| `src/ui/topbar.ts` | TopBar blessed Box 组件 |
| `src/ui/footerbar.ts` | FooterBar blessed Box 组件 + 状态管理 |
| `src/ui/chatbox.ts` | ChatBox blessed Log 组件 + 消息渲染 |
| `src/ui/inputbox.ts` | InputBox 组件 + 输入缓冲区 + 历史管理 |
| `src/ui/markdown.ts` | Markdown → ANSI 渲染 (marked + marked-terminal) |
| `src/ui/stream-renderer.ts` | 流式渲染引擎 (thinking/streaming/tool_call 状态机) |
| `src/ui/permission-ui.ts` | 权限确认 UI (ChatBox 内嵌式) |
| `src/ui/app.ts` | TUIApp 主类 (blessed Screen + 布局 + 事件) |

### 修改文件
| 文件 | 改动范围 |
|------|----------|
| `src/core/ai.ts:1-253` | 扩展 StreamCallbacks 接口，新增细粒度回调 |
| `src/commands/chat.ts:1-467` | 重写主循环，对接 TUIApp，移除 readline/layout 依赖 |
| `src/core/permissions.ts:1-89` | 改为返回决策结果而非直接 readline 交互 |

### 删除文件
| 文件 | 原因 |
|------|------|
| `src/ui/layout.ts` | 由 app.ts 替代 |
| `src/ui/components.ts` | 由各组件文件替代 |
| `src/ui/codex-renderer.ts` | 由 stream-renderer.ts 替代 |
| `src/ui/render.ts` | 由 chatbox.ts + stream-renderer.ts 替代 |
| `src/ui/statusbar.ts` | 由 footerbar.ts 替代 |
| `src/ui/tui.ts` | 由 app.ts 替代 |

---

### Task 1: Theme 常量

**Files:**
- Create: `src/ui/theme.ts`

- [ ] **Step 1: 创建 theme.ts**

```typescript
// src/ui/theme.ts

/** 颜色常量 */
export const Colors = {
  // 前景
  user: 'green',
  assistant: 'cyan',
  thinking: 'gray',
  toolCall: 'yellow',
  toolSuccess: 'green',
  toolError: 'red',
  error: 'red',
  dim: 'gray',
  tokenUsage: 'gray',
  // 背景
  topBarBg: 'cyan',
  topBarFg: 'black',
  footerBarBg: '#333333',
  footerBarFg: 'white',
  // 状态颜色
  statusIdle: 'white',
  statusThinking: 'yellow',
  statusStreaming: 'green',
  statusToolCall: 'cyan',
  statusWaitingInput: 'red',
} as const;

/** 图标/符号 */
export const Icons = {
  user: 'user',
  assistant: '●',
  thinking: ':',
  toolCall: '▸',
  toolSuccess: '✓',
  toolError: '✗',
  statusThinking: '⋯',
  statusStreaming: '▶',
  statusToolCall: '🔧',
  statusWaitingInput: '?',
  prompt: '> ',
} as const;

/** Footer 状态类型 */
export type FooterState = 'idle' | 'thinking' | 'streaming' | 'tool_call' | 'waiting_input';

/** 权限决策 */
export type PermissionDecision = 'allow' | 'deny' | 'always';
```

- [ ] **Step 2: 验证编译**

Run: `cd E:/my-project/mimo-cli && npx tsc --noEmit src/ui/theme.ts`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/ui/theme.ts
git commit -m "feat(ui): add theme constants for TUI"
```

---

### Task 2: TopBar 组件

**Files:**
- Create: `src/ui/topbar.ts`
- Depends: Task 1

- [ ] **Step 1: 创建 topbar.ts**

```typescript
// src/ui/topbar.ts

import blessed from 'blessed';
import { Colors } from './theme';

export interface TopBarState {
  model: string;
  permissionMode: string;
  version: string;
}

export class TopBar {
  readonly box: blessed.Widgets.BoxElement;

  constructor(screen: blessed.Widgets.Screen) {
    this.box = blessed.box({
      parent: screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: '',
      style: {
        fg: Colors.topBarFg,
        bg: Colors.topBarBg,
      },
      tags: true,
    });
  }

  update(state: TopBarState): void {
    const parts = [
      ' mimo',
      ` · ${state.model}`,
      ` · ${state.permissionMode}`,
      ` · v${state.version}`,
    ];
    this.box.setContent(parts.join(''));
    this.box.screen.render();
  }
}
```

- [ ] **Step 2: 验证编译**

Run: `cd E:/my-project/mimo-cli && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/ui/topbar.ts
git commit -m "feat(ui): add TopBar component"
```

---

### Task 3: FooterBar 组件

**Files:**
- Create: `src/ui/footerbar.ts`
- Depends: Task 1

- [ ] **Step 1: 创建 footerbar.ts**

```typescript
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
    const mode = this.permissionMode;
    const model = this.model;

    const stateDisplay = this.formatState();
    const stateColor = this.getStateColor();

    const parts = [
      `{${stateColor}-fg}${mode}{/fg}`,
      '·',
      `{${stateColor}-fg}${model}{/fg}`,
      '·',
      `{${stateColor}-fg}${stateDisplay}{/fg}`,
    ];

    if (this.tokenCount > 0) {
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
      case 'idle': return 'idle';
      case 'thinking': return `${Icons.statusThinking} thinking ${this.formatElapsed()}`;
      case 'streaming': return `${Icons.statusStreaming} streaming ${this.formatTokens()}`;
      case 'tool_call': return `${Icons.statusToolCall} ${this.detail} ${this.formatElapsed()}`;
      case 'waiting_input': return `${Icons.statusWaitingInput} permission y/n/a`;
    }
  }

  private getStateColor(): string {
    switch (this.state) {
      case 'idle': return Colors.statusIdle;
      case 'thinking': return Colors.statusThinking;
      case 'streaming': return Colors.statusStreaming;
      case 'tool_call': return Colors.statusToolCall;
      case 'waiting_input': return Colors.statusWaitingInput;
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
```

- [ ] **Step 2: 验证编译**

Run: `cd E:/my-project/mimo-cli && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/ui/footerbar.ts
git commit -m "feat(ui): add FooterBar component with state management"
```

---

### Task 4: Markdown 渲染

**Files:**
- Create: `src/ui/markdown.ts`

- [ ] **Step 1: 创建 markdown.ts**

```typescript
// src/ui/markdown.ts

import { marked } from 'marked';
import { TerminalRenderer } from 'marked-terminal';

// 配置 marked-terminal 渲染器
const terminalRenderer = new TerminalRenderer({
  width: 80,
  showSectionPrefix: false,
  reflowText: false,
});

marked.setOptions({
  renderer: terminalRenderer,
});

/**
 * 将 Markdown 文本渲染为 ANSI 彩色终端文本
 */
export function renderMarkdown(text: string): string {
  try {
    const result = marked.parse(text);
    // marked.parse 可能返回 string 或 Promise<string>
    // 同步模式下返回 string
    if (typeof result === 'string') {
      return result;
    }
    // 如果返回 Promise (unlikely with sync marked), 回退到原文
    return text;
  } catch {
    // 渲染失败时返回原文
    return text;
  }
}

/**
 * 检测文本是否包含 Markdown 特征
 */
export function hasMarkdown(text: string): boolean {
  return /```|`[^`]+`|\*\*|__|\[.*\]\(|^#{1,6}\s/m.test(text);
}
```

- [ ] **Step 2: 验证编译**

Run: `cd E:/my-project/mimo-cli && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/ui/markdown.ts
git commit -m "feat(ui): add Markdown to ANSI renderer"
```

---

### Task 5: ChatBox 组件

**Files:**
- Create: `src/ui/chatbox.ts`
- Depends: Task 1, Task 4

- [ ] **Step 1: 创建 chatbox.ts**

```typescript
// src/ui/chatbox.ts

import blessed from 'blessed';
import { Colors, Icons } from './theme';
import { renderMarkdown, hasMarkdown } from './markdown';

export class ChatBox {
  readonly log: blessed.Widgets.LogElement;

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
    this.log.add(`    {yellow-fg}权限确认: ${detail}{/fg}`);
    this.log.add(`    {dim-fg}y = 允许  n = 拒绝  a = 始终允许{/fg}`);
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
```

- [ ] **Step 2: 验证编译**

Run: `cd E:/my-project/mimo-cli && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/ui/chatbox.ts
git commit -m "feat(ui): add ChatBox component with message rendering"
```

---

### Task 6: InputBox 组件

**Files:**
- Create: `src/ui/inputbox.ts`
- Depends: Task 1

- [ ] **Step 1: 创建 inputbox.ts**

```typescript
// src/ui/inputbox.ts

import blessed from 'blessed';
import { EventEmitter } from 'events';
import { Colors, Icons } from './theme';

export interface InputBoxOptions {
  screen: blessed.Widgets.Screen;
  placeholder?: string;
}

const MAX_HISTORY = 100;

export class InputBox extends EventEmitter {
  readonly box: blessed.Widgets.BoxElement;
  private screen: blessed.Widgets.Screen;
  private content: string = '';
  private cursorPos: number = 0;
  private placeholder: string;
  private history: string[] = [];
  private historyIndex: number = -1;
  private active: boolean = false;
  private waitingPermission: boolean = false;

  constructor(options: InputBoxOptions) {
    super();
    this.screen = options.screen;
    this.placeholder = options.placeholder || `${Icons.prompt}Type a message or use / for commands...`;

    this.box = blessed.box({
      parent: options.screen,
      bottom: 1,
      left: 0,
      width: '100%',
      height: 3,
      style: {
        fg: 'white',
        bg: '#1a1a2e',
      },
      tags: true,
    });

    this.renderInput();
  }

  /** 激活输入 (开始监听按键) */
  activate(): void {
    if (this.active) return;
    this.active = true;
    this.screen.program.on('keypress', this.handleKeypress);
    this.screen.render();
  }

  /** 停用输入 */
  deactivate(): void {
    this.active = false;
    this.screen.program.removeListener('keypress', this.handleKeypress);
  }

  /** 获取当前输入内容 */
  getValue(): string {
    return this.content;
  }

  /** 清空输入 */
  clear(): void {
    this.content = '';
    this.cursorPos = 0;
    this.historyIndex = -1;
    this.renderInput();
  }

  /** 设置占位提示 */
  setPlaceholder(text: string): void {
    this.placeholder = text;
    this.renderInput();
  }

  /** 进入权限确认模式 */
  enterPermissionMode(): void {
    this.waitingPermission = true;
    this.setPlaceholder('y = 允许  n = 拒绝  a = 始终允许');
  }

  /** 退出权限确认模式 */
  exitPermissionMode(): void {
    this.waitingPermission = false;
    this.setPlaceholder(`${Icons.prompt}Type a message or use / for commands...`);
  }

  /** 添加到历史 */
  private addToHistory(text: string): void {
    if (!text.trim()) return;
    // 相邻去重
    if (this.history.length > 0 && this.history[this.history.length - 1] === text) return;
    this.history.push(text);
    if (this.history.length > MAX_HISTORY) {
      this.history.shift();
    }
  }

  /** 按键处理 */
  private handleKeypress = (ch: string, key: any): void => {
    if (!this.active) return;

    // 权限确认模式: 只接受 y/n/a
    if (this.waitingPermission) {
      if (ch === 'y' || ch === 'Y') {
        this.emit('permission', 'allow');
        this.exitPermissionMode();
      } else if (ch === 'n' || ch === 'N') {
        this.emit('permission', 'deny');
        this.exitPermissionMode();
      } else if (ch === 'a' || ch === 'A') {
        this.emit('permission', 'always');
        this.exitPermissionMode();
      }
      return;
    }

    const name = key?.name || '';
    const shift = key?.shift || false;
    const ctrl = key?.ctrl || false;
    const meta = key?.meta || false;

    // Ctrl+C: 有内容清空，无内容退出
    if (ctrl && name === 'c') {
      if (this.content.length > 0) {
        this.clear();
      } else {
        this.emit('quit');
      }
      return;
    }

    // Ctrl+L: 清屏
    if (ctrl && name === 'l') {
      this.emit('clear');
      return;
    }

    // Ctrl+J: 换行 (备选)
    if (ctrl && name === 'j') {
      this.insertChar('\n');
      return;
    }

    // Escape: 取消
    if (name === 'escape') {
      this.emit('cancel');
      return;
    }

    // Enter / Return
    if (name === 'enter' || name === 'return') {
      if (shift) {
        // Shift+Enter: 换行
        this.insertChar('\n');
      } else {
        // Enter: 发送
        const text = this.content;
        if (text.trim()) {
          this.addToHistory(text);
          this.clear();
          this.emit('submit', text);
        }
      }
      return;
    }

    // 上下箭头: 历史
    if (name === 'up') {
      if (this.history.length > 0) {
        if (this.historyIndex < this.history.length - 1) {
          this.historyIndex++;
        }
        this.content = this.history[this.history.length - 1 - this.historyIndex];
        this.cursorPos = this.content.length;
        this.renderInput();
      }
      return;
    }

    if (name === 'down') {
      if (this.historyIndex > 0) {
        this.historyIndex--;
        this.content = this.history[this.history.length - 1 - this.historyIndex];
      } else {
        this.historyIndex = -1;
        this.content = '';
      }
      this.cursorPos = this.content.length;
      this.renderInput();
      return;
    }

    // Backspace
    if (name === 'backspace') {
      if (this.cursorPos > 0) {
        this.content = this.content.slice(0, this.cursorPos - 1) + this.content.slice(this.cursorPos);
        this.cursorPos--;
        this.renderInput();
      }
      return;
    }

    // Delete
    if (name === 'delete') {
      if (this.cursorPos < this.content.length) {
        this.content = this.content.slice(0, this.cursorPos) + this.content.slice(this.cursorPos + 1);
        this.renderInput();
      }
      return;
    }

    // 左右箭头
    if (name === 'left') {
      if (this.cursorPos > 0) {
        this.cursorPos--;
        this.renderInput();
      }
      return;
    }

    if (name === 'right') {
      if (this.cursorPos < this.content.length) {
        this.cursorPos++;
        this.renderInput();
      }
      return;
    }

    // Tab: 补全
    if (name === 'tab') {
      this.emit('tabComplete', this.content);
      return;
    }

    // 普通字符输入
    if (ch && !ctrl && !meta && ch.length === 1) {
      this.insertChar(ch);
    }
  };

  /** 在光标位置插入字符 */
  private insertChar(ch: string): void {
    this.content = this.content.slice(0, this.cursorPos) + ch + this.content.slice(this.cursorPos);
    this.cursorPos += ch.length;
    this.renderInput();
  }

  /** 渲染输入框 */
  private renderInput(): void {
    const displayContent = this.content || '';
    const lines = displayContent.split('\n');

    // 自适应高度 (1-3 行)
    const contentLines = Math.max(1, Math.min(3, lines.length));
    this.box.height = contentLines + 1; // +1 for padding

    if (displayContent) {
      // 显示实际内容，带光标标记
      const promptLine = `{${Colors.user}-fg}${Icons.prompt}{/fg}`;
      const contentLines = displayContent.split('\n');
      const rendered = contentLines
        .map((line, i) => i === 0 ? `${promptLine}${line}` : `  ${line}`)
        .join('\n');
      this.box.setContent(rendered);
    } else {
      // 显示占位提示
      this.box.setContent(`{${Colors.dim}-fg}${this.placeholder}{/fg}`);
    }

    this.screen.render();
  }
}
```

- [ ] **Step 2: 验证编译**

Run: `cd E:/my-project/mimo-cli && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/ui/inputbox.ts
git commit -m "feat(ui): add InputBox component with Shift+Enter and history"
```

---

### Task 7: StreamRenderer 引擎

**Files:**
- Create: `src/ui/stream-renderer.ts`
- Depends: Task 5, Task 3

- [ ] **Step 1: 创建 stream-renderer.ts**

```typescript
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

    // 获取 ChatBox 的位置和大小
    const chatLog = this.chatbox.log;
    const bottom = chatLog.atop + chatLog.height - 1;

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
```

- [ ] **Step 2: 验证编译**

Run: `cd E:/my-project/mimo-cli && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/ui/stream-renderer.ts
git commit -m "feat(ui): add StreamRenderer engine for live streaming"
```

---

### Task 8: PermissionUI 组件

**Files:**
- Create: `src/ui/permission-ui.ts`
- Depends: Task 5, Task 6

- [ ] **Step 1: 创建 permission-ui.ts**

```typescript
// src/ui/permission-ui.ts

import { ChatBox } from './chatbox';
import { InputBox } from './inputbox';
import { PermissionDecision } from './theme';

const PERMISSION_TIMEOUT_MS = 10000;

export class PermissionUI {
  private chatbox: ChatBox;
  private inputbox: InputBox;
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  constructor(chatbox: ChatBox, inputbox: InputBox) {
    this.chatbox = chatbox;
    this.inputbox = inputbox;
  }

  /**
   * 请求权限确认
   * 在 ChatBox 内显示确认提示，等待用户通过 InputBox 响应
   */
  requestPermission(toolName: string, detail: string): Promise<PermissionDecision> {
    return new Promise((resolve) => {
      // 在 ChatBox 内显示确认提示
      this.chatbox.pushPermissionPrompt(toolName, detail);

      // 切换 InputBox 到权限模式
      this.inputbox.enterPermissionMode();

      // 设置超时
      this.timeoutHandle = setTimeout(() => {
        this.cleanup();
        resolve('deny');
      }, PERMISSION_TIMEOUT_MS);

      // 监听权限决策
      const handler = (decision: PermissionDecision) => {
        this.cleanup();
        resolve(decision);
      };

      this.inputbox.once('permission', handler);
    });
  }

  private cleanup(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
    this.inputbox.exitPermissionMode();
  }
}
```

- [ ] **Step 2: 验证编译**

Run: `cd E:/my-project/mimo-cli && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/ui/permission-ui.ts
git commit -m "feat(ui): add PermissionUI for inline permission prompts"
```

---

### Task 9: TUIApp 主类

**Files:**
- Create: `src/ui/app.ts`
- Depends: Task 2, 3, 5, 6, 7, 8

- [ ] **Step 1: 创建 app.ts**

```typescript
// src/ui/app.ts

import blessed from 'blessed';
import { EventEmitter } from 'events';
import os from 'os';
import { TopBar, TopBarState } from './topbar';
import { FooterBar } from './footerbar';
import { ChatBox } from './chatbox';
import { InputBox } from './inputbox';
import { StreamRenderer } from './stream-renderer';
import { PermissionUI } from './permission-ui';
import { PermissionDecision } from './theme';

export interface TUIAppOptions {
  model: string;
  permissionMode: string;
  version: string;
}

export class TUIApp extends EventEmitter {
  private screen: blessed.Widgets.Screen;
  private topbar: TopBar;
  private footerbar: FooterBar;
  private chatbox: ChatBox;
  private inputbox: InputBox;
  private streamRenderer: StreamRenderer;
  private permissionUI: PermissionUI;
  private options: TUIAppOptions;

  constructor(options: TUIAppOptions) {
    super();
    this.options = options;

    // 创建 blessed Screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'MiMo CLI',
      fullUnicode: true,
      dockBorders: true,
    });

    // 创建组件
    this.topbar = new TopBar(this.screen);
    this.footerbar = new FooterBar(this.screen);
    this.chatbox = new ChatBox(this.screen);
    this.inputbox = new InputBox({ screen: this.screen });
    this.streamRenderer = new StreamRenderer(this.chatbox, this.footerbar, this.screen);
    this.permissionUI = new PermissionUI(this.chatbox, this.inputbox);

    // 初始化 TopBar
    this.topbar.update({
      model: options.model,
      permissionMode: options.permissionMode,
      version: options.version,
    });

    // 绑定事件
    this.bindEvents();
  }

  /** 启动 TUI */
  start(): void {
    // 显示欢迎信息
    const username = os.userInfo().username;
    this.chatbox.pushText(`{cyan-fg}{bold}MiMo CLI{/bold}{/cyan-fg}`);
    this.chatbox.pushText(`{gray-fg}Welcome, ${username}. Type a message to start.{/gray-fg}`);
    this.chatbox.pushText(`{gray-fg}/help for commands{/gray-fg}`);
    this.chatbox.pushText('');

    // 激活输入
    this.inputbox.activate();
    this.screen.render();
  }

  /** 停止 TUI */
  stop(): void {
    this.inputbox.deactivate();
    this.screen.destroy();
  }

  /** 获取 StreamRenderer (供 chat.ts 使用) */
  getStreamRenderer(): StreamRenderer {
    return this.streamRenderer;
  }

  /** 获取 ChatBox */
  getChatBox(): ChatBox {
    return this.chatbox;
  }

  /** 获取 InputBox */
  getInputBox(): InputBox {
    return this.inputbox;
  }

  /** 获取 FooterBar */
  getFooterBar(): FooterBar {
    return this.footerbar;
  }

  /** 获取 PermissionUI */
  getPermissionUI(): PermissionUI {
    return this.permissionUI;
  }

  /** 更新 TopBar 状态 */
  updateTopBar(state: TopBarState): void {
    this.topbar.update(state);
  }

  /** 绑定事件 */
  private bindEvents(): void {
    // 输入提交
    this.inputbox.on('submit', (text: string) => {
      this.emit('input', text);
    });

    // 退出
    this.inputbox.on('quit', () => {
      this.emit('quit');
    });

    // 清屏
    this.inputbox.on('clear', () => {
      this.chatbox.clear();
      this.emit('clear');
    });

    // 取消
    this.inputbox.on('cancel', () => {
      this.emit('cancel');
    });

    // Tab 补全
    this.inputbox.on('tabComplete', (partial: string) => {
      this.emit('tabComplete', partial);
    });

    // 全局 Ctrl+C (备用)
    this.screen.key(['C-c'], () => {
      this.emit('quit');
    });
  }
}
```

- [ ] **Step 2: 验证编译**

Run: `cd E:/my-project/mimo-cli && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/ui/app.ts
git commit -m "feat(ui): add TUIApp main class with blessed layout"
```

---

### Task 10: 扩展 StreamCallbacks 接口

**Files:**
- Modify: `src/core/ai.ts:1-253`

- [ ] **Step 1: 扩展 StreamCallbacks 接口**

在 `src/core/ai.ts` 中，将 `StreamCallbacks` 接口从：

```typescript
export interface StreamCallbacks {
  onToken: (token: string) => void;
  onThinking: (text: string) => void;
  onToolCalls: (toolCalls: ToolCall[]) => void;
  onDone: (fullText: string, toolCalls?: ToolCall[], usage?: TokenUsage) => void;
  onError: (error: Error) => void;
}
```

改为：

```typescript
export interface StreamCallbacks {
  onToken: (token: string) => void;
  onThinking: (text: string) => void;
  onToolCalls: (toolCalls: ToolCall[]) => void;
  onDone: (fullText: string, toolCalls?: ToolCall[], usage?: TokenUsage) => void;
  onError: (error: Error) => void;

  // 新增细粒度回调 (可选，用于 TUI 流式渲染)
  onThinkingStart?: () => void;
  onThinkingContent?: (content: string) => void;
  onThinkingEnd?: () => void;
  onToolCallStart?: (name: string, args: Record<string, unknown>) => void;
  onToolCallEnd?: (name: string, result: { success: boolean; output: string }) => void;
  onStreamEnd?: (usage: TokenUsage) => void;
}
```

- [ ] **Step 2: 在 chatStream 中分发细粒度回调**

在 `src/core/ai.ts` 的 SSE 解析循环中，在处理 `delta.reasoning_content` 的位置（约第 180 行），添加：

```typescript
          // 思考内容
          if (delta.reasoning_content) {
            if (!reasoningStarted) {
              reasoningStarted = true;
              callbacks.onThinkingStart?.();
            }
            reasoningText += delta.reasoning_content;
            callbacks.onThinking(delta.reasoning_content);
            callbacks.onThinkingContent?.(delta.reasoning_content);
          }
```

在 `reasoningText` 变量声明后添加 `let reasoningStarted = false;`。

在 `finish_reason` 检测处（约第 206 行），添加：

```typescript
          // 完成原因
          if (choice.finish_reason === 'tool_calls') {
            // ... 现有代码 ...
          }
          if (choice.finish_reason === 'stop' || choice.finish_reason === 'end_turn') {
            if (reasoningStarted) {
              callbacks.onThinkingEnd?.();
            }
          }
```

在 `callbacks.onDone(...)` 调用前（约第 241 行），添加：

```typescript
    // 细粒度回调: 流结束
    if (usage) {
      callbacks.onStreamEnd?.(usage);
    }
```

- [ ] **Step 3: 验证编译**

Run: `cd E:/my-project/mimo-cli && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add src/core/ai.ts
git commit -m "feat(core): extend StreamCallbacks with fine-grained hooks"
```

---

### Task 11: 重写 chat.ts 主循环

**Files:**
- Modify: `src/commands/chat.ts` (完全重写)
- Depends: Task 9, Task 10

- [ ] **Step 1: 重写 chat.ts**

将 `src/commands/chat.ts` 完全重写为以下内容：

```typescript
import os from 'os';
import chalk from 'chalk';
import { ContextManager } from '../core/context';
import { chatStream, fetchModels, TokenUsage } from '../core/ai';
import { get, set, isConfigured } from '../core/config';
import { toolRegistry } from '../tools/registry';
import { registerAllTools } from '../tools';
import { ProjectMemory } from '../core/memory';
import { TUIApp, TUIAppOptions } from '../ui/app';
import { StreamRenderer } from '../ui/stream-renderer';
import { PermissionUI } from '../ui/permission-ui';
import { PermissionDecision } from '../ui/theme';

// ── 首次配置 ──

async function firstTimeSetup(): Promise<void> {
  console.log('');
  console.log(chalk.cyan.bold('MiMo CLI setup'));
  console.log(chalk.dim('Configure the API endpoint and key to start.'));
  console.log('');

  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const defaultUrl = get('baseUrl');
  const baseUrlInput = await new Promise<string>((resolve) =>
    rl.question(chalk.yellow('  API URL') + chalk.dim(` (default ${defaultUrl}): `), resolve),
  );
  const baseUrl = baseUrlInput.trim() || defaultUrl;
  set('baseUrl', baseUrl);
  console.log(chalk.green('[ok]') + ` API URL: ${baseUrl}`);
  console.log('');

  let apiKey = '';
  while (!apiKey) {
    apiKey = await new Promise<string>((resolve) =>
      rl.question(chalk.yellow('  API Key') + chalk.dim(' (required): '), resolve),
    );
    apiKey = apiKey.trim();
    if (!apiKey) console.log(chalk.yellow('[warn]') + ' API Key cannot be empty');
  }
  set('apiKey', apiKey);
  console.log(chalk.green('[ok]') + ` API Key: ${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`);
  console.log('');

  rl.close();
}

// ── Tool Call Loop ──

const MAX_TOOL_ROUNDS = 10;

async function processUserInput(input: string, ctx: ContextManager, renderer: StreamRenderer, permissionUI: PermissionUI): Promise<void> {
  ctx.addUserMessage(input);

  let rounds = 0;
  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;

    let responseText = '';
    let reasoningText = '';
    let toolCalls: import('../core/context').ToolCall[] = [];
    let usage: TokenUsage | undefined;
    const turnStartTime = Date.now();

    // 在 ChatBox 中显示用户消息和模型标记
    renderer.getChatBox().pushUserMessage(input);
    renderer.getChatBox().pushAssistantHeader(get('model'));

    await chatStream(ctx.getMessages(), {
      onToken: (token) => {
        if (!renderer.getIsStreaming()) {
          renderer.startStreaming();
        }
        renderer.appendToken(token);
        responseText += token;
      },
      onThinking: (text) => {
        reasoningText += text;
      },
      onThinkingStart: () => {
        renderer.startThinking();
      },
      onThinkingContent: (_content) => {
        renderer.updateThinking(_content);
      },
      onThinkingEnd: () => {
        renderer.endThinking();
      },
      onToolCalls: (calls) => {
        toolCalls = calls;
      },
      onDone: (fullText, calls, u) => {
        responseText = fullText;
        if (calls) toolCalls = calls;
        if (u) usage = u;
      },
      onError: (error) => {
        renderer.pushError(error.message);
      },
      onStreamEnd: (u) => {
        if (u) usage = u;
        const duration = Date.now() - turnStartTime;
        renderer.endStreaming(u?.total_tokens || 0, duration);
      },
    }, toolRegistry.getDefinitions());

    // 处理工具调用
    if (toolCalls.length > 0) {
      ctx.addAssistantMessage(responseText, toolCalls, reasoningText || undefined);

      for (const tc of toolCalls) {
        const toolDef = toolRegistry.get(tc.function.name);
        if (!toolDef) {
          ctx.addToolMessage(tc.id, '{"error":"unknown tool"}');
          renderer.pushError(`unknown tool: ${tc.function.name}`);
          continue;
        }

        let args: Record<string, unknown> = {};
        try { args = JSON.parse(tc.function.arguments); } catch { args = {}; }

        // 格式化工具参数摘要
        const argsSummary = formatToolArgs(tc.function.name, args);

        // 权限检查
        if (toolDef.definition.permission !== 'read') {
          const decision = await permissionUI.requestPermission(tc.function.name, argsSummary);
          if (decision === 'deny') {
            ctx.addToolMessage(tc.id, '{"error":"permission denied"}');
            renderer.endToolCall(tc.function.name, argsSummary, false, 0);
            continue;
          }
          if (decision === 'always') {
            set('permissionMode', 'yolo' as any);
          }
        }

        // 执行工具
        const toolStartTime = Date.now();
        renderer.startToolCall(tc.function.name, argsSummary);

        const result = await toolRegistry.execute(tc.function.name, args);
        const toolDuration = Date.now() - toolStartTime;

        ctx.addToolMessage(tc.id, result.success ? result.output : `Error: ${result.error || '失败'}`);
        renderer.endToolCall(tc.function.name, argsSummary, result.success, toolDuration);
      }

      continue;
    }

    // 普通文本回复
    if (responseText) {
      ctx.addAssistantMessage(responseText, undefined, reasoningText || undefined);
    }

    break;
  }
}

function formatToolArgs(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'read_file': return String(args.path || '');
    case 'write_file': return String(args.path || '');
    case 'edit_file': return String(args.path || '');
    case 'run_command': return String(args.command || '').slice(0, 50);
    case 'list_dir': return String(args.path || '.');
    case 'grep': return `"${args.pattern}"`;
    case 'find_files': return String(args.pattern || '');
    case 'git_status': return '';
    case 'git_diff': return String(args.file || '');
    case 'git_commit': return String(args.message || '').slice(0, 50);
    case 'git_log': return `last ${args.count || 10}`;
    default: return JSON.stringify(args).slice(0, 50);
  }
}

// ── 斜杠指令 ──

async function handleCommand(input: string, ctx: ContextManager, renderer: StreamRenderer, permissionUI: PermissionUI): Promise<string | undefined> {
  const parts = input.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const arg = parts.slice(1).join(' ');
  const chatbox = renderer.getChatBox();

  switch (cmd) {
    case '/quit': case '/exit': return 'quit';

    case '/clear':
      ctx.reset();
      chatbox.clear();
      chatbox.pushText('{green-fg}[ok] Context cleared{/green-fg}');
      return;

    case '/help': {
      const commands = [
        ['help', '显示帮助信息'],
        ['clear', '清空对话上下文'],
        ['compact', '压缩上下文'],
        ['model <name>', '切换模型'],
        ['mode <mode>', '权限模式'],
        ['think', '切换思考模式'],
        ['models', '列出可用模型'],
        ['read <path>', '读取文件'],
        ['write <path>', '写入文件'],
        ['diff <path>', '查看差异'],
        ['run <cmd>', '执行命令'],
        ['git', 'Git 状态'],
        ['commit <msg>', '提交更改'],
        ['save', '保存对话'],
        ['agent <task>', 'Agent 模式'],
        ['quit', '退出'],
      ];
      chatbox.pushText('{cyan-fg}{bold}Commands{/bold}{/cyan-fg}');
      for (const [name, desc] of commands) {
        chatbox.pushText(`  {yellow-fg}/${name}{/yellow-fg}  ${desc}`);
      }
      chatbox.pushText('');
      return;
    }

    case '/models': {
      const current = get('model');
      const result = await fetchModels();
      if (!result.success) {
        chatbox.pushError(result.error!);
        return;
      }
      chatbox.pushText('');
      for (const m of result.models!) {
        const active = m === current;
        if (active) {
          chatbox.pushText(`  {green-fg}* {bold}${m}{/bold}{/green-fg}`);
        } else {
          chatbox.pushText(`    ${m}`);
        }
      }
      chatbox.pushText(`{gray-fg}Current: ${current}  Switch: /model <name>{/gray-fg}`);
      return;
    }

    case '/model': {
      if (!arg) {
        chatbox.pushText('{yellow-fg}Usage: /model <model>{/yellow-fg}');
        return;
      }
      set('model', arg);
      chatbox.pushText(`{green-fg}[ok] model: ${arg}{/green-fg}`);
      return;
    }

    case '/mode': {
      if (!arg || !['default', 'yolo', 'plan'].includes(arg)) {
        chatbox.pushText('{yellow-fg}Usage: /mode <default|yolo|plan>{/yellow-fg}');
        return;
      }
      set('permissionMode', arg as any);
      chatbox.pushText(`{green-fg}[ok] permission: ${arg}{/green-fg}`);
      return;
    }

    case '/think': {
      const cur = get('thinkingMode');
      const modes: Array<'think' | 'nothink' | 'auto'> = ['think', 'nothink', 'auto'];
      const next = modes[(modes.indexOf(cur) + 1) % modes.length];
      set('thinkingMode', next);
      chatbox.pushText(`{green-fg}[ok] thinking: ${cur} -> ${next}{/green-fg}`);
      return;
    }

    case '/compact': {
      const msgs = ctx.getMessages();
      if (msgs.length <= 2) {
        chatbox.pushText('{gray-fg}Already compact{/gray-fg}');
        return;
      }
      const sys = msgs[0];
      const recent = msgs.slice(-4);
      const removed = msgs.length - 1 - recent.length;
      if (removed > 0) {
        ctx.replaceMessages([sys, { role: 'user', content: `[已压缩 ${removed} 条]` }, ...recent]);
        chatbox.pushText(`{green-fg}[ok] compacted ${removed} messages{/green-fg}`);
      }
      return;
    }

    case '/read': {
      if (!arg) {
        chatbox.pushText('{yellow-fg}Usage: /read <path>{/yellow-fg}');
        return;
      }
      const r = await toolRegistry.execute('read_file', { path: arg });
      if (r.success) {
        chatbox.pushText(`{green-fg}[ok] ${arg}{/green-fg}`);
        ctx.addUserMessage(`[文件 ${arg}]:\n\`\`\`\n${r.output}\n\`\`\``);
      } else {
        chatbox.pushError(r.error!);
      }
      return;
    }

    case '/write': {
      if (!arg) {
        chatbox.pushText('{yellow-fg}Usage: /write <path>{/yellow-fg}');
        return;
      }
      const msgs = ctx.getMessages();
      const last = [...msgs].reverse().find((m) => m.role === 'assistant');
      if (!last) {
        chatbox.pushText('{yellow-fg}No assistant message found{/yellow-fg}');
        return;
      }
      const code = last.content.match(/```[\w]*\n([\s\S]*?)```/);
      if (!code) {
        chatbox.pushText('{yellow-fg}No code block found{/yellow-fg}');
        return;
      }
      const r = await toolRegistry.execute('write_file', { path: arg, content: code[1] });
      if (r.success) {
        chatbox.pushText(`{green-fg}[ok] ${arg}{/green-fg}`);
      } else {
        chatbox.pushError(r.error!);
      }
      return;
    }

    case '/diff': {
      if (!arg) {
        chatbox.pushText('{yellow-fg}Usage: /diff <path>{/yellow-fg}');
        return;
      }
      const r = await toolRegistry.execute('diff_file', { path: arg });
      if (r.success) {
        chatbox.pushText(r.output || 'No diff');
      } else {
        chatbox.pushError(r.error!);
      }
      return;
    }

    case '/run': {
      if (!arg) {
        chatbox.pushText('{yellow-fg}Usage: /run <command>{/yellow-fg}');
        return;
      }
      const r = await toolRegistry.execute('run_command', { command: arg });
      if (r.success) {
        chatbox.pushText('{green-fg}[ok] success{/green-fg}');
        if (r.output) chatbox.pushText(`{gray-fg}${r.output}{/gray-fg}`);
      } else {
        chatbox.pushError(r.error!);
        if (r.output) chatbox.pushText(`{gray-fg}${r.output}{/gray-fg}`);
      }
      return;
    }

    case '/git': {
      const r = await toolRegistry.execute('git_status', {});
      if (r.success) {
        chatbox.pushText(r.output);
      } else {
        chatbox.pushError(r.error!);
      }
      return;
    }

    case '/commit': {
      if (!arg) {
        chatbox.pushText('{yellow-fg}Usage: /commit <msg>{/yellow-fg}');
        return;
      }
      const r = await toolRegistry.execute('git_commit', { message: arg });
      if (r.success) {
        chatbox.pushText(r.output);
      } else {
        chatbox.pushError(r.error!);
      }
      return;
    }

    case '/save': {
      const msgs = ctx.getMessages();
      const content = msgs.map((m) => {
        if (m.role === 'system') return `# System\n${m.content}`;
        if (m.role === 'user') return `## You\n${m.content}`;
        if (m.role === 'assistant') return `## MiMo\n${m.content}`;
        if (m.role === 'tool') return `### Tool\n${m.content}`;
        return '';
      }).filter(Boolean).join('\n\n---\n\n');
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const file = `.mimo/session-${ts}.md`;
      try {
        const fs = require('fs');
        const path = require('path');
        const dir = path.dirname(file);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(file, content, 'utf-8');
        chatbox.pushText(`{green-fg}[ok] ${file}{/green-fg}`);
      } catch {
        chatbox.pushError('save failed');
      }
      return;
    }

    case '/agent': {
      if (!arg) {
        chatbox.pushText('{yellow-fg}Usage: /agent <task description>{/yellow-fg}');
        return;
      }

      chatbox.pushText('{cyan-fg}Agent mode starting...{/cyan-fg}');

      const { decomposeTask } = await import('../agent/planner');
      const { executePlan } = await import('../agent/executor');

      const planResult = await decomposeTask(arg);
      if (!planResult.success || !planResult.plan) {
        chatbox.pushError(`Task decomposition failed: ${planResult.error}`);
        return;
      }

      const plan = planResult.plan;
      chatbox.pushText(`{green-fg}[ok] Task decomposed into ${plan.steps.length} steps{/green-fg}`);

      for (const step of plan.steps) {
        chatbox.pushText(`  ${step.id}. ${step.description}`);
      }

      const result = await executePlan(plan, {
        onStepStart: (step, total) => {
          chatbox.pushText(`{gray-fg}Executing step ${step}/${total}...{/gray-fg}`);
        },
        onStepComplete: (step, total, success) => {
          const icon = success ? '{green-fg}[ok]{/green-fg}' : '{red-fg}[error]{/red-fg}';
          chatbox.pushText(`${icon} Step ${step}/${total}`);
        },
        onConfirm: async () => true,
      });

      if (result.success) {
        chatbox.pushText('{green-fg}[ok] Agent task completed{/green-fg}');
      } else {
        chatbox.pushError(`Agent task failed: ${result.output}`);
      }
      return;
    }

    default:
      chatbox.pushText(`{yellow-fg}Unknown command: ${cmd}{/yellow-fg}`);
      return;
  }
}

// ── 主入口 ──

export async function startChat(): Promise<void> {
  if (!isConfigured()) {
    await firstTimeSetup();
  }

  registerAllTools();

  const maxContextTokens = get('maxContextTokens');
  const ctx = new ContextManager(maxContextTokens);

  // 创建 TUI
  const app = new TUIApp({
    model: get('model'),
    permissionMode: get('permissionMode'),
    version: '1.0.0',
  });

  const renderer = app.getStreamRenderer();
  const permissionUI = app.getPermissionUI();

  // 项目记忆
  const memory = new ProjectMemory();
  if (memory.exists()) {
    renderer.getChatBox().pushText('{gray-fg}[memory] Loaded project memory{/gray-fg}');
  }

  // 启动 TUI
  app.start();

  // 输入事件处理
  app.on('input', async (text: string) => {
    // 停用输入 (防止输入干扰)
    app.getInputBox().deactivate();

    if (text.startsWith('/')) {
      const handled = await handleCommand(text, ctx, renderer, permissionUI);
      if (handled === 'quit') {
        app.stop();
        process.exit(0);
      }
    } else {
      await processUserInput(text, ctx, renderer, permissionUI);
    }

    // 重新激活输入
    app.getInputBox().activate();
  });

  // 退出事件
  app.on('quit', () => {
    app.stop();
    process.exit(0);
  });

  // 清屏事件
  app.on('clear', () => {
    ctx.reset();
  });
}
```

- [ ] **Step 2: 验证编译**

Run: `cd E:/my-project/mimo-cli && npx tsc --noEmit`
Expected: 无错误（可能有旧文件的引用需要清理）

- [ ] **Step 3: Commit**

```bash
git add src/commands/chat.ts
git commit -m "feat(commands): rewrite chat.ts to use TUIApp"
```

---

### Task 12: 删除旧 UI 文件

**Files:**
- Delete: `src/ui/layout.ts`
- Delete: `src/ui/components.ts`
- Delete: `src/ui/codex-renderer.ts`
- Delete: `src/ui/render.ts`
- Delete: `src/ui/statusbar.ts`
- Delete: `src/ui/tui.ts`

- [ ] **Step 1: 删除旧文件**

```bash
rm src/ui/layout.ts src/ui/components.ts src/ui/codex-renderer.ts src/ui/render.ts src/ui/statusbar.ts src/ui/tui.ts
```

- [ ] **Step 2: 检查是否有其他文件引用这些旧文件**

Run: `cd E:/my-project/mimo-cli && grep -rn "layout\|components\|codex-renderer\|render\|statusbar" src/ --include="*.ts" | grep -v "node_modules" | grep "from.*ui/"`
Expected: 无引用（chat.ts 已重写，不再引用旧文件）

如果发现引用，修复导入路径。

- [ ] **Step 3: 验证编译**

Run: `cd E:/my-project/mimo-cli && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(ui): remove old UI files replaced by blessed TUI"
```

---

### Task 13: 更新测试

**Files:**
- Modify: `test/codex-renderer.test.cjs`

- [ ] **Step 1: 更新测试文件**

将 `test/codex-renderer.test.cjs` 替换为针对新组件的测试：

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');

// 测试 theme 常量
const theme = require('../dist/ui/theme.js');

test('theme exports expected constants', () => {
  assert.ok(theme.Colors);
  assert.ok(theme.Icons);
  assert.equal(typeof theme.Colors.user, 'string');
  assert.equal(typeof theme.Icons.assistant, 'string');
  assert.equal(theme.FooterState, undefined); // type, not runtime
});

test('theme icons are ASCII-safe or known Unicode', () => {
  const { Icons } = theme;
  // 这些符号在大多数终端中可以正常显示
  assert.equal(Icons.user, 'user');
  assert.equal(Icons.assistant, '●');
  assert.equal(Icons.thinking, ':');
  assert.equal(Icons.toolCall, '▸');
});

// 测试 markdown 渲染
const markdown = require('../dist/ui/markdown.js');

test('markdown renderMarkdown returns string', () => {
  const result = markdown.renderMarkdown('hello **world**');
  assert.equal(typeof result, 'string');
  assert.ok(result.length > 0);
});

test('markdown hasMarkdown detects markdown features', () => {
  assert.equal(markdown.hasMarkdown('```js\ncode\n```'), true);
  assert.equal(markdown.hasMarkdown('**bold**'), true);
  assert.equal(markdown.hasMarkdown('plain text'), false);
});
```

- [ ] **Step 2: 构建并运行测试**

Run: `cd E:/my-project/mimo-cli && npm run build && node --test test`
Expected: 所有测试通过

- [ ] **Step 3: Commit**

```bash
git add test/codex-renderer.test.cjs
git commit -m "test: update tests for new TUI components"
```

---

### Task 14: 构建验证 + 手动测试

**Files:**
- None (验证步骤)

- [ ] **Step 1: 完整构建**

Run: `cd E:/my-project/mimo-cli && npm run build`
Expected: 编译成功，无错误

- [ ] **Step 2: 运行测试**

Run: `cd E:/my-project/mimo-cli && npm test`
Expected: 所有测试通过

- [ ] **Step 3: 手动启动验证**

Run: `cd E:/my-project/mimo-cli && node dist/index.js`

验证清单:
- [ ] blessed 全屏布局正确渲染
- [ ] TopBar 显示模型名和模式
- [ ] ChatBox 显示欢迎信息
- [ ] InputBox 可以输入文字
- [ ] Enter 发送消息
- [ ] Shift+Enter 或 Ctrl+J 换行
- [ ] Ctrl+C 退出
- [ ] /help 显示命令列表
- [ ] /quit 退出

- [ ] **Step 4: Final Commit**

```bash
git add -A
git commit -m "feat(ui): complete TUI rewrite - blessed full-screen layout with streaming"
```
