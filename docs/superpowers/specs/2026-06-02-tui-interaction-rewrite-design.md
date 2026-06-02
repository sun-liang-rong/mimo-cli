# TUI 交互体验重写设计文档

> 日期: 2026-06-02
> 状态: 已批准
> 方案: 一次性重写 (方案 B)

## 1. 目标

将当前基于 readline + console.log 的简陋交互，重写为基于 blessed 的全屏 TUI 交互，模仿 Claude Code 的简约紧凑风格，实现专业级终端 AI 编程助手体验。

## 2. 布局架构

```
┌─ mimo · mimo-v2.5-pro · default · v1 ────────────────────────────┐
│                                                                    │
│  ChatBox (blessed Log, scrollable)                                │
│                                                                    │
│  user                                                              │
│    帮我重构 ai.ts                                                  │
│                                                                    │
│  ● mimo-v2.5-pro                                                  │
│    我来分析一下这个文件...                                         │
│                                                                    │
│      : thinking 3.2s                                               │
│      ▸ read_file src/core/ai.ts ✓ 0.3s                            │
│      ▸ edit_file src/core/ai.ts ✓ 0.8s                            │
│                                                                    │
│    重构完成。主要改动...                                            │
│                                                                    │
│    1.2k tokens · 4.5s                                              │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│  > Type a message or use / for commands...                         │  InputBox (blessed Textarea)
├────────────────────────────────────────────────────────────────────┤
│  default · mimo-v2.5-pro · idle · Ctrl+C quit                     │  FooterBar
└────────────────────────────────────────────────────────────────────┘
```

### 2.1 组件清单

| 组件 | blessed 类型 | 职责 | 样式 |
|------|-------------|------|------|
| **TopBar** | `Box` | 模型名、权限模式、版本号 | 白字深色背景，单行 |
| **ChatBox** | `Log` | 所有对话内容，自动滚动 | 占主要空间，支持鼠标滚轮 |
| **InputBox** | `Textarea` | 多行输入 | 底部固定，1-3 行自适应高度 |
| **FooterBar** | `Box` | 状态指示 + token 用量 | 单行，状态颜色动态变化 |

### 2.2 布局约束

- TopBar: 高度 1 行, 顶部固定
- FooterBar: 高度 1 行, 底部固定
- InputBox: 高度 1-3 行, 底部固定 (FooterBar 上方)
- ChatBox: 剩余空间, 自适应
- 无右侧任务面板 (任务信息行内显示)

## 3. 流式渲染系统

### 3.1 渲染流程

```
用户输入 "帮我重构 ai.ts"
  │
  ├─ ChatBox.push("user\n  帮我重构 ai.ts")
  ├─ ChatBox.push("● mimo-v2.5-pro")        ← 模型标记行
  │
  ├─ [thinking 阶段]
  │   ├─ ChatBox.push("  : thinking...")     ← 灰色，用覆盖 Box 实时更新
  │   └─ 思考完成 → 写入最终 "  : thinking 3.2s"
  │
  ├─ [streaming 阶段]
  │   ├─ 逐 token 追加到当前 AI 消息行
  │   └─ ChatBox 自动滚动跟随
  │
  ├─ [tool_calls 阶段]
  │   ├─ 每个工具调用:
  │   │   ├─ ChatBox.push("  ▸ read_file src/core/ai.ts ...")
  │   │   └─ 执行完成 → 更新为 "  ▸ read_file src/core/ai.ts ✓ 0.3s"
  │   └─ 工具结果回传模型，继续流式
  │
  └─ [完成]
      └─ ChatBox.push("  1.2k tokens · 4.5s")
```

### 3.2 行内更新机制

blessed Log 不支持原地修改已写入的行。解决方案：

- **thinking 阶段**: 用一个独立的 `Box` 浮在 Log 最后一行位置，实时更新内容。思考完成后，销毁覆盖 Box，将最终状态写入 Log。
- **工具调用状态**: 同理，覆盖 Box 显示 spinner，完成后写入最终结果。
- **streaming 阶段**: 每次 `push()` 追加 token 级别的文本片段，自然形成流式效果。

### 3.3 Markdown 渲染

AI 回复中的代码块需要语法高亮：

- 使用 `marked` + `marked-terminal` (已有依赖) 将 Markdown 转 ANSI 彩色文本
- 在 streaming 完成后，将原始文本替换为渲染后的 Markdown
- 代码块用 `┃` 前缀标记，方便视觉区分

### 3.4 工具调用计时

记录每个工具调用的开始时间 (`Date.now()` 在本地记录)，完成时计算耗时显示。在 chat.ts 的 tool call 循环中，每次工具执行前记录 `startTime = Date.now()`，完成后计算 `duration = Date.now() - startTime`。

## 4. 输入系统

### 4.1 InputBox 交互规则

| 按键 | 行为 |
|------|------|
| `Enter` | 发送消息 |
| `Shift+Enter` | 插入换行 (多行输入) |
| `Ctrl+J` | 插入换行 (备选，与 Claude Code 一致) |
| `Ctrl+C` | 有内容时清空输入；无内容时退出程序 |
| `Ctrl+L` | 清屏 (清空 ChatBox) |
| `↑` / `↓` | 浏览输入历史 |
| `Tab` | slash 命令自动补全 |
| `Escape` | 取消当前输入 / 取消流式输出 |

### 4.2 Shift+Enter 实现

blessed Textarea 原生不支持 Shift 修饰键区分。实现策略：

- **方案一 (主要)**: 不使用 blessed Textarea 的内置输入处理，而是接管 blessed screen 的 `keypress` 事件，自行管理输入缓冲区
- 监听 `keypress` 事件，检测 `shift` 属性:
  - `shift=false` + `ch='\r'` 或 `ch='\n'` → 发送消息
  - `shift=true` + 回车相关序列 → 插入换行符到缓冲区
  - 普通字符 → 追加到缓冲区
- 每次按键后，将缓冲区内容渲染到 blessed Textarea 显示
- **回退方案**: 终端若不支持 Shift+Enter 检测（Windows 的某些终端），则 `Ctrl+J` 作为换行键
- **InputBox 内部**: 维护 `content: string` 和 `cursorPos: number`，按键事件修改这两个值，然后同步到 Textarea 的 `value` 属性并调用 `screen.render()`

### 4.3 Slash 命令补全

输入 `/` 开头时：

1. 在 ChatBox 底部渲染可用命令列表
2. 继续输入时模糊匹配过滤
3. `Tab` 键补全选中命令
4. `Enter` 执行命令

可用命令列表:
```
/help       显示帮助信息
/clear      清空对话上下文
/compact    压缩上下文
/model      查看/切换模型
/mode       切换权限模式
/think      切换思考模式
/models     列出可用模型
/read       读取文件
/write      写入文件
/diff       查看差异
/run        执行命令
/git        Git 操作
/commit     提交更改
/save       保存对话
/agent      Agent 模式
/quit       退出
```

### 4.4 输入历史

- 维护 `string[]` 类型的历史数组，最大 100 条
- `↑` 键向上翻阅，`↓` 键向下翻阅
- 新输入追加到历史末尾
- 相邻重复项去重

### 4.5 InputBox 自适应高度

- 默认 1 行高度
- 内容超过 1 行时自动扩展，最大 3 行
- 超过 3 行时内部滚动
- ChatBox 高度随之调整

## 5. 交互细节

### 5.1 权限确认 (ChatBox 内嵌式)

```
  ▸ edit_file src/core/ai.ts
    ┌─ 权限确认 ──────────────────────┐
    │ 将修改 src/core/ai.ts           │
    │                                  │
    │  y = 允许  n = 拒绝  a = 始终允许│
    └──────────────────────────────────┘
```

- 确认区域在 ChatBox 内渲染
- 焦点移到 InputBox，用户按 y/n/a 响应
- `a` (always allow) 加入本次会话信任列表
- 10 秒无响应自动超时取消

### 5.2 思考过程展示

- 默认折叠为一行: `: thinking 3.2s` (灰色)
- 终端支持鼠标时可点击展开
- 终端不支持鼠标时直接显示 (不折叠)
- 思考内容用淡灰色标记

### 5.3 错误处理

```
  ✗ run_command npm test
    Error: Command failed with exit code 1

    npm ERR! Test suite failed

  ● mimo-v2.5-pro
    看起来测试失败了，我来检查一下...
```

- 错误信息红色高亮
- AI 自动感知错误并继续处理
- 工具调用失败用 ✗ 标记

### 5.4 FooterBar 状态流转

| 状态 | 显示 | 颜色 |
|------|------|------|
| idle | `default · mimo-v2.5-pro · idle · Ctrl+C quit` | 白 |
| thinking | `default · mimo-v2.5-pro · ⋯ thinking · 3.2s` | 黄 |
| streaming | `default · mimo-v2.5-pro · ▶ streaming · 234 tokens` | 绿 |
| tool_call | `default · mimo-v2.5-pro · 🔧 read_file · 0.8s` | 青 |
| waiting_input | `default · mimo-v2.5-pro · ? permission · y/n/a` | 红 |

## 6. 文件结构

重写后的 `src/ui/` 目录:

```
src/ui/
├── app.ts              ← blessed Screen + 布局管理器 (新建)
├── topbar.ts           ← TopBar 组件 (新建)
├── chatbox.ts          ← ChatBox 组件 + 消息渲染逻辑 (新建)
├── inputbox.ts         ← InputBox 组件 + 输入管理 (新建)
├── footerbar.ts        ← FooterBar 组件 + 状态管理 (新建)
├── stream-renderer.ts  ← 流式渲染引擎 (新建)
├── markdown.ts         ← Markdown → ANSI 渲染 (新建)
├── permission-ui.ts    ← 权限确认 UI (新建)
└── theme.ts            ← 颜色/图标常量 (新建)
```

删除/替换的文件:
- `src/ui/layout.ts` → 由 `app.ts` 替代
- `src/ui/components.ts` → 由各组件文件替代
- `src/ui/codex-renderer.ts` → 由 `stream-renderer.ts` 替代
- `src/ui/render.ts` → 由 `chatbox.ts` + `stream-renderer.ts` 替代
- `src/ui/statusbar.ts` → 由 `footerbar.ts` 替代
- `src/ui/tui.ts` → 由 `app.ts` 替代

## 7. 核心类设计

### 7.1 TUIApp (app.ts)

```typescript
class TUIApp {
  private screen: blessed.Widgets.Screen;
  private topbar: TopBar;
  private chatbox: ChatBox;
  private inputbox: InputBox;
  private footerbar: FooterBar;
  private streamRenderer: StreamRenderer;

  constructor(options: TUIAppOptions);
  start(): void;
  stop(): void;
  getStatus(): TUIStatus;

  // 事件
  on(event: 'input', handler: (text: string) => void): void;
  on(event: 'permission', handler: (decision: PermissionDecision) => void): void;
  on(event: 'cancel', handler: () => void): void;
}
```

### 7.2 StreamRenderer (stream-renderer.ts)

```typescript
class StreamRenderer {
  private chatbox: ChatBox;
  private overlayBox: blessed.Widgets.Box | null;  // 用于行内更新
  private currentMessage: string;
  private toolCallTimings: Map<string, number>;

  startThinking(): void;
  updateThinking(content: string): void;
  endThinking(durationMs: number): void;

  startStreaming(): void;
  appendToken(token: string): void;
  endStreaming(tokenCount: number, durationMs: number): void;

  startToolCall(name: string, args: Record<string, unknown>): void;
  endToolCall(name: string, success: boolean, durationMs: number): void;

  renderMarkdown(content: string): void;
}
```

### 7.3 ChatBox (chatbox.ts)

```typescript
class ChatBox {
  private log: blessed.Widgets.Log;
  private messageBuffer: Message[];

  pushUserMessage(text: string): void;
  pushAssistantHeader(model: string): void;
  pushToolCallResult(name: string, success: boolean, duration: number): void;
  pushTokenUsage(tokens: number, duration: number): void;
  pushPermissionPrompt(tool: string, file: string): Promise<PermissionDecision>;
  pushError(message: string): void;
  clear(): void;
  scrollToBottom(): void;
}
```

### 7.4 InputBox (inputbox.ts)

```typescript
class InputBox {
  private textarea: blessed.Widgets.Textarea;
  private history: string[];
  private historyIndex: number;

  getValue(): string;
  clear(): void;
  setPlaceholder(text: string): void;

  // 事件
  on(event: 'submit', handler: (text: string) => void): void;
  on(event: 'cancel', handler: () => void): void;
  on(event: 'clear', handler: () => void): void;
  on(event: 'tabComplete', handler: (partial: string) => void): void;
}
```

### 7.5 FooterBar (footerbar.ts)

```typescript
type FooterState = 'idle' | 'thinking' | 'streaming' | 'tool_call' | 'waiting_input';

class FooterBar {
  private box: blessed.Widgets.Box;

  setState(state: FooterState, detail?: string): void;
  updateTokenCount(count: number): void;
  updateElapsedTime(ms: number): void;
}
```

## 8. 与现有代码的集成

### 8.1 chat.ts 主循环改造

当前 `commands/chat.ts` 的主循环:
```
readline → processInput → AI 调用 → console.log 输出
```

改为:
```
TUIApp.on('input') → processInput → StreamRenderer 流式输出
```

关键变更:
- 移除 readline 依赖
- 移除 `src/ui/layout.ts` 中的 `printUserMessage()` / `printAssistantMessage()` 等
- `core/ai.ts` 的 `streamWithTools()` 回调从拼接字符串改为调用 `StreamRenderer` 方法
- 权限确认从 `readline.question()` 改为 `ChatBox.pushPermissionPrompt()`

### 8.2 core/ai.ts 回调适配

当前 `StreamCallbacks` interface 需要扩展，新增细粒度回调：

当前回调:
```typescript
interface StreamCallbacks {
  onToken: (token: string) => void;
  onToolCall: (tool: ToolCall) => void;
}
```

扩展为:
```typescript
interface StreamCallbacks {
  onToken: (token: string) => void;           // → StreamRenderer.appendToken()
  onThinkingStart: () => void;                 // → StreamRenderer.startThinking()
  onThinkingContent: (content: string) => void; // → StreamRenderer.updateThinking()
  onThinkingEnd: () => void;                   // → StreamRenderer.endThinking()
  onToolCallStart: (name: string, args: any) => void; // → StreamRenderer.startToolCall()
  onToolCallEnd: (name: string, result: any) => void; // → StreamRenderer.endToolCall()
  onStreamEnd: (usage: Usage) => void;         // → StreamRenderer.endStreaming()
}
```

在 `streamWithTools()` 中，解析 SSE 事件时根据 `type` 字段分发到对应回调:
- `reasoning_content` 增量 → `onThinkingContent()`
- 首个 `reasoning_content` → `onThinkingStart()`
- `reasoning_content` 结束 → `onThinkingEnd()`
- `tool_calls` 开始 → `onToolCallStart()`
- `tool_calls` 结果返回 → `onToolCallEnd()`
- `choices[0].finish_reason` 非 null → `onStreamEnd()`

### 8.3 不受影响的模块

以下模块无需修改:
- `src/core/config.ts` — 配置管理
- `src/core/context.ts` — 上下文管理
- `src/core/memory.ts` — 记忆系统
- `src/tools/*` — 工具注册与执行
- `src/project/*` — 项目索引
- `src/agent/*` — Agent 模式
- `src/utils/safety.ts` — 安全校验
- `src/utils/logger.ts` — 日志工具 (可选保留用于调试)

## 9. 兼容性

- **终端要求**: 支持 ANSI 颜色 + 256 色的终端 (Windows Terminal, iTerm2, Alacritty, WezTerm 等)
- **Windows**: blessed 对 Windows 的支持有限，需测试 `windows.compat` 选项
- **回退方案**: 如果 blessed 在当前终端无法工作，自动降级到 ANSI 增强模式
- **最小终端尺寸**: 80×24，更小时显示警告

## 10. 测试策略

- 单元测试: StreamRenderer 的 Markdown 渲染、状态转换
- 集成测试: 端到端输入→流式输出→权限确认流程
- 手动测试: 在 Windows Terminal / Git Bash / WSL 中验证
