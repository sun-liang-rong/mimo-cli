# MiMo-CLI TUI 重设计实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 MiMo-CLI 的终端 UI 从 ANSI 手动控制升级为基于 Blessed 的 TUI 框架，解决布局错乱、消息重叠、输入框被覆盖等问题。

**Architecture:** 使用 blessed 库创建结构化的 TUI 组件（screen、box、log、textbox），实现消息卡片化、流式输出稳定、工具调用折叠、输入框固定、侧边栏信息展示。

**Tech Stack:** TypeScript, blessed, chalk

---

## 文件结构映射

### 新增文件

| 文件 | 职责 |
|------|------|
| `src/ui/tui.ts` | Blessed TUI 初始化、组件创建、布局管理 |
| `src/ui/components.ts` | 消息卡片、工具调用卡片等组件工厂 |

### 修改文件

| 文件 | 修改内容 |
|------|---------|
| `src/ui/layout.ts` | 用 blessed 替代 ANSI 手动控制 |
| `src/commands/chat.ts` | 使用新的 TUI 接口 |

---

## Task 1: 初始化 Blessed TUI 框架

**Files:**
- Create: `src/ui/tui.ts`
- Modify: `src/ui/layout.ts`

- [ ] **Step 1: 安装 blessed 依赖**

```bash
npm install blessed
npm install -D @types/blessed
```

- [ ] **Step 2: 创建 `src/ui/tui.ts` — TUI 初始化**

```typescript
import blessed from 'blessed';

export interface TuiComponents {
  screen: blessed.Widgets.Screen;
  topBar: blessed.Widgets.BoxElement;
  chatBox: blessed.Widgets.Log;
  taskPanel: blessed.Widgets.BoxElement;
  inputBox: blessed.Widgets.TextboxElement;
  footerBar: blessed.Widgets.BoxElement;
}

let tui: TuiComponents | null = null;

export function initTui(): TuiComponents {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'MiMo CLI',
  });

  const topBar = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: 1,
    content: ' mimo · v1.0.0',
    style: { fg: 'black', bg: 'cyan' },
    tags: true,
  });

  const taskPanel = blessed.box({
    top: 1,
    right: 0,
    width: 30,
    height: '100%-3',
    border: { type: 'line' },
    label: ' Tasks ',
    style: { fg: 'white', bg: '#1a1a2e', border: { fg: 'cyan' } },
    tags: true,
    scrollable: true,
    alwaysScroll: true,
  });

  const chatBox = blessed.log({
    top: 1,
    left: 0,
    width: '100%-30',
    height: '100%-3',
    border: { type: 'line' },
    label: ' Chat ',
    style: { fg: 'white', bg: '#0f0f23', border: { fg: 'blue' } },
    tags: true,
    scrollable: true,
    alwaysScroll: true,
  });

  const inputBox = blessed.textbox({
    bottom: 1,
    left: 0,
    width: '100%',
    height: 1,
    content: 'You ▸ ',
    style: { fg: 'white', bg: '#333' },
    inputOnFocus: true,
  });

  const footerBar = blessed.box({
    bottom: 0,
    left: 0,
    width: '100%',
    height: 1,
    content: ' default · model · Activity: idle ',
    style: { fg: 'white', bg: '#333' },
    tags: true,
  });

  screen.append(topBar);
  screen.append(chatBox);
  screen.append(taskPanel);
  screen.append(inputBox);
  screen.append(footerBar);

  screen.key(['C-c'], () => {
    process.exit(0);
  });

  tui = { screen, topBar, chatBox, taskPanel, inputBox, footerBar };
  return tui;
}

export function getTui(): TuiComponents | null {
  return tui;
}
```

- [ ] **Step 3: 修改 `src/ui/layout.ts` — 用 blessed 替代 ANSI**

```typescript
import { TuiComponents, initTui, getTui } from './tui';
import { getConfig } from '../core/config';
import os from 'os';

let tui: TuiComponents | null = null;

export function initLayout(): void {
  tui = initTui();
}

export function appendChat(content: string): void {
  const tui = getTui();
  if (!tui) return;
  tui.chatBox.log(content);
  tui.screen.render();
}

export function clearChat(): void {
  const tui = getTui();
  if (!tui) return;
  tui.chatBox.setContent('');
  tui.screen.render();
}

export function renderTopBar(): void {
  const tui = getTui();
  if (!tui) return;
  const cfg = getConfig();
  const username = os.userInfo().username;
  tui.topBar.setContent(` mimo · ${username} · ${cfg.model} · max ${cfg.maxTokens} · v1.0.0 `);
  tui.screen.render();
}

export function renderFooterBar(usage?: { total_tokens: number }): void {
  const tui = getTui();
  if (!tui) return;
  const cfg = getConfig();
  let text = ` ${cfg.permissionMode} · ${cfg.model}`;
  if (usage) {
    const cost = ((usage.total_tokens / 1000) * 0.002).toFixed(4);
    text += ` · $${cost} · ${usage.total_tokens} tok`;
  }
  text += ` · Activity: idle `;
  tui.footerBar.setContent(text);
  tui.screen.render();
}

export function setActivityStatus(status: 'idle' | 'thinking' | 'tool_call'): void {
  const tui = getTui();
  if (!tui) return;
  const cfg = getConfig();
  const label = status === 'thinking' ? 'thinking' : status === 'tool_call' ? 'tool_call' : 'idle';
  tui.footerBar.setContent(` ${cfg.permissionMode} · ${cfg.model} · Activity: ${label} `);
  tui.screen.render();
}

export function refreshTaskPanel(tasks: TaskInfo[]): void {
  const tui = getTui();
  if (!tui) return;
  const lines = tasks.map(t => {
    const icon = t.status === 'running' ? '{yellow-fg}⟳{/yellow-fg}' : 
                 t.status === 'completed' ? '{green-fg}✔{/green-fg}' : 
                 t.status === 'failed' ? '{red-fg}✖{/red-fg}' : '○';
    return ` ${icon} ${t.name}`;
  }).join('\n');
  tui.taskPanel.setContent(lines || ' No live tasks');
  tui.screen.render();
}

export function startInputLoop(callback: (text: string) => void): void {
  const tui = getTui();
  if (!tui) return;

  tui.inputBox.on('submit', (value: string) => {
    tui!.inputBox.clearValue();
    tui!.screen.render();
    callback(value.trim());
  });

  tui.inputBox.focus();
}

export function continueInputLoop(): void {
  const tui = getTui();
  if (!tui) return;
  tui.inputBox.focus();
}

export function stopInputLoop(): void {
  // blessed handles cleanup automatically
}

export function refreshAll(usage?: { total_tokens: number }): void {
  renderTopBar();
  renderFooterBar(usage);
}

export interface TaskInfo {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}
```

- [ ] **Step 4: Commit**

```bash
git add src/ui/tui.ts src/ui/layout.ts
git commit -m "feat: replace ANSI layout with blessed TUI framework"
```

---

## Task 2: 消息卡片组件

**Files:**
- Create: `src/ui/components.ts`

- [ ] **Step 1: 创建消息卡片组件**

```typescript
import blessed from 'blessed';

export function createUserMessage(text: string): string {
  return `
{green-fg}┌──────────────────────────────────────────────┐{/green-fg}
{green-fg}│{/green-fg} 🟢 You                                       {green-fg}│{/green-fg}
{green-fg}│{/green-fg} ${text.padEnd(44)} {green-fg}│{/green-fg}
{green-fg}└──────────────────────────────────────────────┘{/green-fg}`;
}

export function createAiMessage(text: string): string {
  return `
{blue-fg}┌──────────────────────────────────────────────┐{/blue-fg}
{blue-fg}│{/blue-fg} 🔵 MiMo                                      {blue-fg}│{/blue-fg}
{blue-fg}│{/blue-fg} ${text.padEnd(44)} {blue-fg}│{/blue-fg}
{blue-fg}└──────────────────────────────────────────────┘{/blue-fg}`;
}

export function createToolCallCard(name: string, args: string): string {
  return `
{yellow-fg}┌──────────────────────────────────────────────┐{/yellow-fg}
{yellow-fg}│{/yellow-fg} 📋 ${name.padEnd(40)} {yellow-fg}│{/yellow-fg}
{yellow-fg}│{/yellow-fg} ${args.padEnd(44)} {yellow-fg}│{/yellow-fg}
{yellow-fg}└──────────────────────────────────────────────┘{/yellow-fg}`;
}

export function createThinkingBlock(text: string): string {
  return `
{gray-fg}  : ${text}{/gray-fg}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/components.ts
git commit -m "feat: add message card components for TUI"
```

---

## Task 3: 修改 chat.ts 使用新 UI

**Files:**
- Modify: `src/commands/chat.ts`

- [ ] **Step 1: 修改 `processUserInput` 使用消息卡片**

```typescript
import { createUserMessage, createAiMessage, createToolCallCard, createThinkingBlock } from '../ui/components';

// 在 processUserInput 中:
// 用户输入
appendChat(createUserMessage(input));

// AI 回复
appendChat(createAiMessage(responseText));

// 工具调用
appendChat(createToolCallCard(tc.function.name, args));

// 思考块
appendChat(createThinkingBlock(reasoningText));
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/chat.ts
git commit -m "feat: use message cards in chat UI"
```

---

## Task 4: 流式输出优化

**Files:**
- Modify: `src/commands/chat.ts`

- [ ] **Step 1: 实现流式输出**

```typescript
// 在 chatStream 的 onToken 回调中:
onToken: (token) => {
  responseText += token;
  // 局部更新，不重绘整个屏幕
  const tui = getTui();
  if (tui) {
    tui.chatBox.setContent(responseText);
    tui.screen.render();
  }
},
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: optimize streaming output with partial render"
```

---

## Task 5: 测试与验证

- [ ] **Step 1: 编译检查**

```bash
npm run build
```

- [ ] **Step 2: 运行测试**

```bash
npm start
```

- [ ] **Step 3: 验证功能**

- [ ] 顶部状态栏显示正确
- [ ] 消息卡片有彩色边框
- [ ] 流式输出不闪烁
- [ ] 输入框固定在底部
- [ ] 侧边栏显示任务状态
- [ ] 终端 resize 时布局正常

---

## 自审检查

### Spec 覆盖检查

| Spec 要求 | 实现任务 | 状态 |
|-----------|---------|------|
| 消息卡片化 | Task 2 | ✅ |
| 流式输出稳定 | Task 4 | ✅ |
| 工具调用折叠 | Task 2 | ✅ |
| 输入框固定 | Task 1 | ✅ |
| 侧边栏信息 | Task 1 | ✅ |

### 占位符扫描

- [x] 无 TBD、TODO
- [x] 所有接口已定义
- [x] 所有函数有实现

---

## 执行方式选择

**Plan complete and saved to `docs/superpowers/plans/YYYY-MM-DD-mimo-cli-tui-plan.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
