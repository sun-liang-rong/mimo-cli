# MiMo CLI UI/UX 优化计划

## 一、当前 UI 架构分析

### 1.1 组件层次结构

```
App.tsx (主入口)
├── StatusBar.tsx (顶部状态栏)
├── TimelineView.tsx (聊天历史视图)
│   └── AgentTask.tsx (代理任务卡片)
│       └── TaskStep.tsx (单个工具调用步骤)
├── ToolApproval.tsx (工具审批弹窗)
└── UserInput.tsx (底部输入框)
```

### 1.2 数据流

```
Timeline 数据结构
├── UserMessageItem (用户消息)
└── AgentTaskItem (代理任务)
    ├── steps: TaskStep[] (工具调用步骤)
    ├── streamingText: string (流式文本)
    └── finalText: string (最终文本)
```

---

## 二、UI/UX 问题清单

### 2.1 视觉设计问题

| 问题 | 当前状态 | 影响 |
|------|----------|------|
| **欢迎页面布局** | ASCII logo 占用大量空间，右侧信息拥挤 | 小终端窗口体验差 |
| **状态栏信息密度过高** | model · cwd · branch · cost 全挤在一行 | 长路径会被截断 |
| **工具调用展示** | 每个工具调用占用 2-3 行，大量调用时滚动过快 | 信息密度低 |
| **Markdown 渲染** | 表格边框在窄终端会溢出 | 边框错乱 |
| **颜色方案** | 使用默认 Ink 颜色，缺乏品牌一致性 | 视觉层次不清晰 |

### 2.2 交互体验问题

| 问题 | 当前状态 | 影响 |
|------|----------|------|
| **审批弹窗** | 只有 y/n 两个选项 | 无法批量授权 |
| **输入框** | 不支持外部编辑器 | 长 prompt 输入困难 |
| **历史导航** | 只有上下箭头 | 无法搜索历史 |
| **滚动控制** | 自动滚动到最新，无法回看 | 工具输出被截断后无法查看 |
| **进度指示** | 只有 spinner 和文字 | 缺乏直观的进度条 |

### 2.3 信息展示问题

| 问题 | 当前状态 | 影响 |
|------|----------|------|
| **工具结果截断** | 超长结果直接截断，无法展开 | 丢失重要信息 |
| **错误展示** | 红色文字，无结构化 | 难以定位问题 |
| **Token 用量** | 只在任务完成后显示 | 无法实时感知消耗 |
| **子代理执行** | 无流式输出，等待过程无反馈 | 用户以为卡死 |

---

## 三、优化方案

### 3.1 欢迎页面重构

**目标**: 适配不同终端尺寸，提供更清晰的信息层次

```tsx
// Welcome.tsx 优化方案
interface WelcomeProps {
  model: string
  workingDir: string
  projectContext?: string
  subAgents?: SubAgentConfig[]
  terminalWidth: number
}

// 响应式布局：
// - 宽终端 (>100): logo 左侧，信息右侧
// - 窄终端 (60-100): logo 上方，信息下方
// - 极窄终端 (<60): 无 logo，纯文字
```

**具体改进**:
1. 根据终端宽度动态调整布局
2. 精简 ASCII logo，提供小型版本
3. 信息分组更清晰：状态、能力、快捷键
4. 添加版本号和更新检查提示

### 3.2 状态栏增强

**目标**: 信息分层，关键信息始终可见

```tsx
// StatusBar.tsx 优化方案
interface StatusBarProps {
  model: string
  workingDir: string
  branch?: string
  costSummary?: string
  contextUsage?: number  // 0-100
  isStreaming?: boolean
  charsPerSecond?: number
}

// 布局：
// 左侧: model · cwd (可折叠)
// 中间: branch · context 指示器
// 右侧: cost · streaming 速度
```

**具体改进**:
1. 添加上下文使用率指示器（颜色编码）
2. 流式输出时显示 chars/s
3. 长路径智能截断（保留首尾）
4. 添加 "busy" 状态指示

### 3.3 工具调用展示优化

**目标**: 提高信息密度，支持展开/折叠

```tsx
// TaskStep.tsx 优化方案
interface ToolCallDisplay {
  // 默认: 压缩到 1 行
  // 展开: 显示完整输入和输出
  // 折叠: 只显示工具名和状态
  mode: 'compact' | 'expanded' | 'collapsed'
  
  // 分组: 同类型的工具调用合并显示
  group?: {
    name: string
    count: number
    successCount: number
  }
}
```

**具体改进**:
1. 默认压缩模式：`✓ Read src/index.ts (120ms)`
2. 同类工具自动分组：`3× Read (2✓ 1✗)`
3. 点击展开显示完整 diff/输出
4. 添加工具调用时间线可视化

### 3.4 审批流程增强

**目标**: 减少审批摩擦，支持批量操作

```tsx
// ToolApproval.tsx 优化方案
interface ApprovalOptions {
  // 基础选项
  allowOnce: boolean      // y - 允许一次
  denyOnce: boolean       // n - 拒绝一次
  
  // 高级选项
  allowAlways: boolean    // a - 本次会话始终允许此工具
  allowPattern: boolean   // p - 允许匹配此模式的所有调用
  
  // 批量选项
  allowAllPending: boolean // Y - 允许所有待审批的调用
}
```

**具体改进**:
1. 添加快捷键说明：`y/n/a/p/Y`
2. 显示待审批队列数量
3. 支持 `--allow-tools` 启动参数预授权
4. 添加 "信任模式" 指示器

### 3.5 输入框增强

**目标**: 支持多种输入方式，提升长文本输入体验

```tsx
// UserInput.tsx 优化方案
interface InputFeatures {
  // 多行输入
  multiline: boolean      // Shift+Enter 换行
  
  // 外部编辑器
  openEditor: boolean     // Ctrl+E 打开 $EDITOR
  
  // 历史搜索
  historySearch: boolean  // Ctrl+R 搜索历史
  
  // 快捷插入
  fileReference: boolean  // @ 自动补全文件路径
  agentReference: boolean // @ 自动补全代理名称
}
```

**具体改进**:
1. `Ctrl+E` 打开外部编辑器（$EDITOR 或 vim）
2. `Ctrl+R` 反向搜索历史命令
3. `@` 触发文件/代理自动补全
4. 多行输入时显示行号
5. 添加字符计数器

### 3.6 滚动和回看

**目标**: 支持历史回看，不丢失重要输出

```tsx
// TimelineView.tsx 优化方案
interface ScrollBehavior {
  // 自动滚动
  autoScroll: boolean        // 默认 true
  autoScrollThreshold: number // 距离底部 N 行时触发
  
  // 手动滚动
  scrollUp: () => void       // Ctrl+Up / PageUp
  scrollDown: () => void     // Ctrl+Down / PageDown
  scrollToTop: () => void    // Home
  scrollToBottom: () => void // End
  
  // 搜索
  searchContent: (query: string) => void  // Ctrl+F
}
```

**具体改进**:
1. `Ctrl+Up/Down` 或 `PageUp/PageDown` 滚动
2. 滚动时显示 "Scrolling..." 提示
3. 新消息到达时显示 "New messages ↓" 提示
4. `Ctrl+F` 搜索聊天历史

### 3.7 Markdown 渲染增强

**目标**: 更好的代码展示和表格适配

```tsx
// Markdown.tsx 优化方案
interface MarkdownFeatures {
  // 代码块
  codeBlock: {
    showLineNumbers: boolean
    showCopyButton: boolean
    maxHeight: number  // 最大显示行数
  }
  
  // 表格
  table: {
    responsive: boolean    // 窄终端自动转为垂直布局
    maxColWidth: number    // 列宽上限
    truncateCells: boolean // 超长内容截断
  }
  
  // 链接
  links: {
    showUrl: boolean  // 内联显示 URL
    clickable: boolean // 终端支持点击
  }
}
```

**具体改进**:
1. 代码块添加行号和语言标签
2. 窄终端表格自动转为垂直布局
3. 链接显示完整 URL（终端支持时可点击）
4. 长代码块可折叠

### 3.8 错误展示优化

**目标**: 结构化错误信息，便于定位和修复

```tsx
// 错误展示组件
interface ErrorDisplay {
  // 错误类型
  type: 'api' | 'tool' | 'network' | 'permission' | 'unknown'
  
  // 结构化信息
  title: string
  message: string
  details?: string
  suggestion?: string
  
  // 操作
  actions: Array<{
    label: string
    handler: () => void
  }>
}
```

**具体改进**:
1. 错误分类：API 错误、工具错误、网络错误
2. 提供修复建议
3. 添加重试按钮
4. 显示错误上下文（相关代码行）

### 3.9 实时指标

**目标**: 实时显示性能和资源使用

```tsx
// StreamingMetrics.tsx 增强
interface RealtimeMetrics {
  // 流式输出
  charsPerSecond: number
  tokensPerSecond: number
  
  // 上下文
  contextUsage: number      // 0-100%
  contextRemaining: number  // 剩余 token 数
  
  // 成本
  currentCost: number       // 当前对话成本
  estimatedTotal: number    // 预估总成本
  
  // 工具
  toolCallsTotal: number
  toolCallsSuccess: number
  toolCallsFailed: number
}
```

**具体改进**:
1. 状态栏实时显示 context 使用率（颜色编码）
2. 流式输出时显示 tokens/s
3. 工具调用进度条
4. 成本实时累加显示

---

## 四、交互快捷键方案

### 4.1 全局快捷键

| 快捷键 | 功能 | 当前状态 |
|--------|------|----------|
| `Ctrl+C` | 取消/退出 | ✅ 已实现 |
| `Ctrl+L` | 清屏 | ❌ 未实现 |
| `Ctrl+O` | 展开所有步骤 | ❌ 未实现 |
| `Ctrl+E` | 打开外部编辑器 | ❌ 未实现 |
| `Ctrl+R` | 搜索历史 | ❌ 未实现 |
| `Ctrl+F` | 搜索内容 | ❌ 未实现 |
| `Ctrl+Up` | 向上滚动 | ❌ 未实现 |
| `Ctrl+Down` | 向下滚动 | ❌ 未实现 |
| `PageUp` | 向上翻页 | ❌ 未实现 |
| `PageDown` | 向下翻页 | ❌ 未实现 |
| `Home` | 跳转到顶部 | ❌ 未实现 |
| `End` | 跳转到底部 | ❌ 未实现 |

### 4.2 输入框快捷键

| 快捷键 | 功能 | 当前状态 |
|--------|------|----------|
| `Enter` | 发送消息 | ✅ 已实现 |
| `Shift+Enter` | 换行 | ✅ 已实现 |
| `Up/Down` | 历史导航 | ✅ 已实现 |
| `Tab` | 自动补全 | ❌ 未实现 |
| `Ctrl+A` | 跳转到行首 | ❌ 未实现 |
| `Ctrl+E` | 跳转到行尾 | ❌ 未实现 |
| `Ctrl+K` | 删除到行尾 | ❌ 未实现 |
| `Ctrl+U` | 删除到行首 | ❌ 未实现 |
| `Ctrl+W` | 删除前一个单词 | ❌ 未实现 |

### 4.3 审批快捷键

| 快捷键 | 功能 | 当前状态 |
|--------|------|----------|
| `y/Y` | 允许一次 | ✅ 已实现 |
| `n/N` | 拒绝一次 | ✅ 已实现 |
| `a` | 本次会话始终允许 | ❌ 未实现 |
| `p` | 允许匹配模式 | ❌ 未实现 |
| `Y` | 允许所有待审批 | ❌ 未实现 |

---

## 五、视觉设计规范

### 5.1 颜色方案

```typescript
// 品牌色
const BRAND_COLORS = {
  primary: 'cyan',      // 主色调
  secondary: 'blue',    // 辅助色
  accent: 'yellow',     // 强调色
}

// 状态色
const STATUS_COLORS = {
  success: 'green',
  error: 'red',
  warning: 'yellow',
  info: 'blue',
  muted: 'gray',
}

// 工具状态色
const TOOL_STATUS_COLORS = {
  running: 'cyan',
  completed: 'green',
  error: 'red',
  denied: 'yellow',
  pending: 'gray',
}
```

### 5.2 间距规范

```typescript
const SPACING = {
  // 内边距
  paddingX: 1,          // 水平内边距
  paddingY: 0,          // 垂直内边距
  
  // 外边距
  marginTop: 1,         // 组件顶部间距
  marginBottom: 1,      // 组件底部间距
  marginLeft: 2,        // 缩进层级
  
  // 行间距
  lineHeight: 1,        // 单行文本
  lineHeightRelaxed: 1.5, // 多行文本
}
```

### 5.3 图标规范

```typescript
const ICONS = {
  // 状态指示
  spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ',
  pending: '·',
  
  // 工具图标
  read: '📖',
  write: '✏️',
  edit: '🔧',
  bash: '⚡',
  glob: '🔍',
  grep: '🔎',
  git: '📦',
  
  // UI 元素
  bullet: '•',
  arrow: '→',
  chevron: '▸',
  separator: '·',
  cursor: '▌',
}
```

---

## 六、实施优先级

### Phase 1: 核心体验 (1-2 天)

1. **审批流程增强** - 添加 always allow 和批量审批
2. **输入框增强** - 添加 Ctrl+E 外部编辑器
3. **状态栏优化** - 添加 context 使用率指示器
4. **工具调用分组** - 同类工具自动合并显示

### Phase 2: 信息展示 (2-3 天)

5. **滚动控制** - 添加 Ctrl+Up/Down 滚动
6. **工具结果展开** - 支持点击查看完整输出
7. **错误展示优化** - 结构化错误信息
8. **实时指标** - tokens/s 和成本实时显示

### Phase 3: 视觉打磨 (1-2 天)

9. **欢迎页面响应式** - 适配不同终端尺寸
10. **颜色方案统一** - 建立品牌色彩系统
11. **Markdown 增强** - 代码块行号、表格响应式
12. **间距和排版** - 统一视觉节奏

### Phase 4: 高级功能 (2-3 天)

13. **历史搜索** - Ctrl+R 模糊搜索
14. **内容搜索** - Ctrl+F 搜索聊天记录
15. **自动补全** - Tab 补全文件路径和代理名
16. **进度可视化** - 工具调用时间线

---

## 七、技术实现要点

### 7.1 Ink 组件最佳实践

```tsx
// 使用 Box 的 flex 属性控制布局
<Box flexDirection="column" flexGrow={1} overflow="hidden">
  {/* 内容区 */}
</Box>

// 使用 Text 的样式属性
<Text color="cyan" bold dimColor>
  内容
</Text>

// 响应式终端尺寸
const { stdout } = useStdout()
const width = stdout.columns || 80
const height = stdout.rows || 24
```

### 7.2 状态管理

```tsx
// 使用 useRef 保持引用稳定性
const timelineRef = useRef(timeline)
useEffect(() => { timelineRef.current = timeline }, [timeline])

// 使用 useCallback 优化回调
const handleUserMessage = useCallback(async (text: string) => {
  // 处理逻辑
}, [dependencies])
```

### 7.3 性能优化

```tsx
// 虚拟化长列表
const visibleItems = pickVisibleItems(items, availableHeight)

// 避免不必要的重渲染
const MemoizedComponent = React.memo(Component)

// 使用 key 优化列表渲染
{items.map(item => <Item key={item.id} {...item} />)}
```

---

## 八、测试策略

### 8.1 单元测试

```typescript
// Timeline 操作测试
describe('Timeline', () => {
  it('should add user message', () => {
    const timeline = createTimeline()
    const updated = addUserMessage(timeline, 'Hello')
    expect(updated.items).toHaveLength(1)
  })
})

// 工具调用分组测试
describe('Tool grouping', () => {
  it('should group consecutive same-type calls', () => {
    const steps = [readStep1, readStep2, writeStep1]
    const grouped = groupToolCalls(steps)
    expect(grouped).toHaveLength(2)
  })
})
```

### 8.2 组件测试

```tsx
// 使用 ink-testing-library
import { render } from 'ink-testing-library'

describe('StatusBar', () => {
  it('should render model name', () => {
    const { lastFrame } = render(<StatusBar model="MiMo" />)
    expect(lastFrame()).toContain('MiMo')
  })
})
```

### 8.3 集成测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npx vitest run src/tui/__tests__/StatusBar.test.tsx

# 监听模式
npm run test:watch
```

---

## 九、验收标准

### 9.1 功能验收

- [ ] 审批支持 always allow 模式
- [ ] Ctrl+E 打开外部编辑器
- [ ] Ctrl+Up/Down 滚动聊天历史
- [ ] 状态栏显示 context 使用率
- [ ] 工具调用支持分组显示
- [ ] 错误信息结构化展示
- [ ] 流式输出显示 tokens/s

### 9.2 视觉验收

- [ ] 欢迎页面适配 80/120/160 列终端
- [ ] 颜色方案统一，符合品牌规范
- [ ] 间距和排版一致
- [ ] 图标使用统一

### 9.3 性能验收

- [ ] 1000 条消息时渲染流畅 (<16ms)
- [ ] 流式输出时 UI 不卡顿
- [ ] 内存使用稳定，无泄漏

---

## 十、参考资源

- [Ink 文档](https://github.com/vadimdemedes/ink)
- [Claude Code UI 源码](https://github.com/anthropics/claude-code)
- [终端 UI 设计指南](https://terminalgui.com/)
- [ANSI 转义序列](https://en.wikipedia.org/wiki/ANSI_escape_code)
