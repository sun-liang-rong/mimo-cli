# MiMo-CLI v2.0 设计文档：与 Claude Code 对齐

> 版本: v2.0-draft  
> 日期: 2026-06-02  
> 状态: 设计阶段

---

## 1. 设计目标

将 MiMo-CLI 从"基础 AI 对话工具"升级为"智能编程助手"，核心对齐 Claude Code 的三大能力：

1. **智能代码编辑** — AI 理解代码结构，自主完成精确修改
2. **深度项目理解** — 自动分析项目结构，对话时注入相关上下文
3. **Agent 模式** — AI 自主规划、执行多步骤任务

---

## 2. 智能代码编辑（Smart Edit）

### 2.1 核心设计

参考 Claude Code 的 `View` + `Edit` 工具设计，将代码编辑拆分为两个核心工具：

- **`view`** — 读取文件内容，支持范围读取，帮助 AI 理解代码
- **`edit`** — 基于理解进行精确修改，支持上下文匹配

### 2.2 工具定义

```typescript
// view 工具 — 读取文件内容，支持范围读取
interface ViewArgs {
  path: string;
  view_range?: [number, number];  // 可选：只查看特定行范围 [start, end]
}

// edit 工具 — 精确替换（增强版）
interface EditArgs {
  path: string;
  old_string: string;   // 必须精确匹配，但可包含上下文确保唯一性
  new_string: string;
}
```

### 2.3 关键改进：上下文匹配

Claude Code 的 `edit` 工具要求 `old_string` 必须在文件中出现，但**允许包含额外上下文**来确保唯一性。

```typescript
// ❌ 容易失败的简单替换（可能多处匹配）
old_string: "function foo() {"

// ✅ 包含上下文的精确匹配（唯一性更强）
old_string: `
export class UserService {
  constructor(private db: Database) {}
  
  function foo() {
`
```

### 2.4 自动纠错机制

如果 `old_string` 匹配失败：

1. **模糊匹配** — 尝试 Levenshtein 距离匹配
2. **自动重试** — 提示 AI "匹配失败，请重新查看文件"
3. **AI 重新调用 `view`** — 获取最新内容后修正编辑

### 2.5 多文件编辑支持

```typescript
interface MultiEditArgs {
  edits: Array<{
    path: string;
    old_string: string;
    new_string: string;
  }>;
}
```

所有编辑先验证通过，再**原子性执行**。任一失败则全部回滚。

### 2.6 工作流程

```
用户描述需求
    ↓
AI 调用 view 读取相关文件
    ↓
AI 分析代码，生成 edit 计划
    ↓
验证 old_string 是否匹配
    ↓
展示 diff（预览模式）
    ↓
用户确认 / yolo 自动执行
    ↓
原子性应用所有编辑
    ↓
验证结果（语法检查）
```

### 2.7 技术实现

**不引入 AST 解析（一期）**

原因：
- 字符串匹配 + 上下文已经足够处理 90% 的场景
- 减少依赖，降低复杂度
- 后期可以无缝添加 AST 增强

**编辑执行逻辑：**

```typescript
function applyEdit(filePath: string, oldString: string, newString: string): Result {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // 1. 精确匹配
  if (!content.includes(oldString)) {
    // 2. 尝试模糊匹配
    const match = fuzzyFind(content, oldString);
    if (!match) {
      return { success: false, error: '匹配失败' };
    }
  }
  
  // 3. 替换
  const newContent = content.replace(oldString, newString);
  
  // 4. 验证（可选）
  if (isTypeScript(filePath)) {
    validateSyntax(newContent);
  }
  
  // 5. 写入
  fs.writeFileSync(filePath, newContent);
  return { success: true };
}
```

### 2.8 与现有代码的整合

- 保留现有的 `read_file`、`write_file`、`edit_file`
- 新增 `view` 作为 `read_file` 的增强版（支持行范围）
- 新增 `edit` 作为 `edit_file` 的增强版（支持上下文匹配、自动纠错）
- 逐步迁移：新功能用 `view`/`edit`，旧功能保持兼容

---

## 3. 深度项目理解（Deep Project Understanding）

### 3.1 核心设计

参考 Claude Code 的"自动上下文"机制，让 AI 在对话前自动理解项目结构和代码关系。

### 3.2 项目索引结构

启动时自动构建，缓存到 `.mimo/project-index.json`：

```typescript
interface ProjectIndex {
  // 文件列表（按类型分类）
  files: {
    source: string[];      // src/ 下的代码文件
    config: string[];      // 配置文件
    test: string[];        // 测试文件
    docs: string[];        // 文档
  };
  
  // 代码符号索引（轻量级）
  symbols: Array<{
    name: string;          // 函数/类/变量名
    type: 'function' | 'class' | 'interface' | 'variable';
    file: string;
    line: number;
  }>;
  
  // 依赖关系
  dependencies: {
    imports: Record<string, string[]>;  // 文件 -> 导入的模块
    exports: Record<string, string[]>;  // 文件 -> 导出的符号
  };
  
  // 项目元数据
  meta: {
    language: string;       // typescript / javascript / python ...
    framework?: string;     // react / vue / express ...
    packageManager: string;  // npm / yarn / pnpm
    testFramework?: string; // jest / vitest ...
  };
}
```

### 3.3 自动上下文注入

对话时，自动将以下信息注入 system prompt：

```
当前项目: mimo-cli
语言: TypeScript
框架: Node.js CLI

相关文件（基于用户问题自动选择）:
- src/core/ai.ts (MiMo API 调用)
- src/tools/registry.ts (工具注册)

项目结构:
├── src/
│   ├── core/      # 核心模块
│   ├── tools/     # 工具系统
│   └── ui/        # 终端 UI
├── package.json
└── tsconfig.json
```

### 3.4 智能文件选择

用户提问时，自动判断需要读取哪些文件：

```typescript
function selectRelevantFiles(query: string, index: ProjectIndex): string[] {
  // 1. 关键词匹配
  const keywords = extractKeywords(query);
  
  // 2. 符号索引匹配
  const matchedSymbols = index.symbols.filter(s => 
    keywords.some(k => s.name.toLowerCase().includes(k))
  );
  
  // 3. 文件路径匹配
  const matchedFiles = index.files.source.filter(f =>
    keywords.some(k => f.toLowerCase().includes(k))
  );
  
  // 4. 去重 + 限制数量（最多 5 个文件）
  return [...new Set([...matchedSymbols.map(s => s.file), ...matchedFiles])]
    .slice(0, 5);
}
```

### 3.5 索引构建实现

```typescript
async function buildProjectIndex(): Promise<ProjectIndex> {
  const index: ProjectIndex = {
    files: { source: [], config: [], test: [], docs: [] },
    symbols: [],
    dependencies: { imports: {}, exports: {} },
    meta: { language: 'unknown', packageManager: 'npm' },
  };
  
  // 1. 扫描文件
  const allFiles = await glob('**/*', { ignore: ['node_modules', 'dist', '.git'] });
  
  for (const file of allFiles) {
    if (file.match(/\.(ts|tsx|js|jsx)$/)) index.files.source.push(file);
    else if (file.match(/\.(json|yaml|yml|toml)$/)) index.files.config.push(file);
    else if (file.match(/\.(test|spec)\./)) index.files.test.push(file);
    else if (file.match(/\.(md|rst)$/)) index.files.docs.push(file);
  }
  
  // 2. 解析 package.json 获取元数据
  const pkg = JSON.parse(await fs.readFile('package.json', 'utf-8'));
  index.meta.language = detectLanguage(index.files.source);
  index.meta.framework = detectFramework(pkg);
  index.meta.packageManager = detectPackageManager();
  
  // 3. 轻量级符号扫描（正则，非 AST）
  for (const file of index.files.source.slice(0, 100)) {
    const content = await fs.readFile(file, 'utf-8');
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // 匹配函数定义
      const funcMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
      if (funcMatch) {
        index.symbols.push({ name: funcMatch[1], type: 'function', file, line: i + 1 });
      }
      // 匹配类定义
      const classMatch = line.match(/(?:export\s+)?class\s+(\w+)/);
      if (classMatch) {
        index.symbols.push({ name: classMatch[1], type: 'class', file, line: i + 1 });
      }
    }
  }
  
  return index;
}
```

### 3.6 索引更新策略

- **启动时构建** — 首次启动扫描整个项目
- **文件变化时增量更新** — 监听文件变化（`fs.watch`），只更新变更的文件
- **手动刷新** — 用户可通过 `/reindex` 指令强制重建

### 3.7 与现有代码的整合

- 在 `ContextManager` 中增加 `projectIndex` 字段
- 对话前自动注入项目上下文
- 新增 `/index` 斜杠指令：查看/重建项目索引

---

## 4. Agent 模式（Agent Mode）

### 4.1 核心设计

参考 Claude Code 的 Agent 能力，AI 能够自主规划、执行多步骤任务，并在关键节点与用户交互。

### 4.2 Agent 模式 vs 普通对话模式

| 特性 | 普通对话 | Agent 模式 |
|------|---------|-----------|
| 工具调用 | 单轮，用户确认后执行 | 多轮自动，关键节点确认 |
| 任务分解 | 用户手动分解 | AI 自动分解 |
| 错误处理 | 用户手动重试 | AI 自动重试/修正 |
| 上下文管理 | 用户手动提供 | 自动注入项目上下文 |
| 适用场景 | 简单问答、单文件编辑 | 复杂功能实现、重构 |

### 4.3 任务分解

用户输入任务描述后，AI 先进行任务分解：

```typescript
interface TaskPlan {
  goal: string;                    // 原始目标
  steps: Array<{
    id: number;
    description: string;            // 步骤描述
    tool: string;                   // 预计使用的工具
    expectedOutput: string;         // 预期结果
    confirmBefore: boolean;         // 执行前是否需要确认
  }>;
  estimatedRounds: number;         // 预计轮次
}

// 示例
// 用户: "帮我添加一个用户认证模块"
// AI 分解:
// 1. 查看现有项目结构，确认技术栈
// 2. 创建 auth 目录和相关文件
// 3. 实现登录/注册逻辑
// 4. 添加中间件保护路由
// 5. 创建测试文件
```

### 4.4 执行循环

```typescript
async function agentLoop(task: string, ctx: ContextManager): Promise<void> {
  // 1. 任务分解
  const plan = await decomposeTask(task, ctx);
  
  // 2. 展示计划，用户确认
  const confirmed = await showPlanAndConfirm(plan);
  if (!confirmed) return;
  
  // 3. 执行循环
  let currentStep = 0;
  let rounds = 0;
  const maxRounds = 20;
  
  while (currentStep < plan.steps.length && rounds < maxRounds) {
    rounds++;
    const step = plan.steps[currentStep];
    
    // 执行步骤
    const result = await executeStep(step, ctx);
    
    // 检查结果
    if (result.success) {
      currentStep++;
    } else {
      // 失败处理：AI 分析错误，决定重试或调整计划
      const retry = await handleError(result, step, ctx);
      if (!retry) break;
    }
    
    // 关键节点确认
    if (step.confirmBefore) {
      const shouldContinue = await askUserContinue();
      if (!shouldContinue) break;
    }
  }
  
  // 4. 总结
  await summarizeResults(ctx);
}
```

### 4.5 工具调用链

Agent 模式下，AI 可以连续调用多个工具，形成工具链：

```
用户: "帮我实现一个 JWT 认证中间件"

AI 思考:
1. 需要查看现有项目结构 → view src/
2. 需要确认使用的框架 → view package.json
3. 创建中间件文件 → edit src/middleware/auth.ts
4. 更新路由文件 → edit src/routes/index.ts
5. 创建测试文件 → edit src/middleware/auth.test.ts

执行链:
view(src/) → view(package.json) → edit(auth.ts) → edit(index.ts) → edit(auth.test.ts)
```

### 4.6 错误恢复机制

```typescript
interface ErrorRecovery {
  // 错误类型
  type: 'syntax_error' | 'test_failure' | 'tool_error' | 'logic_error';
  
  // 恢复策略
  strategy: 'retry' | 'modify_approach' | 'ask_user' | 'rollback';
  
  // 恢复动作
  action: string;
}

// 示例恢复场景
// 错误: edit 工具执行后，文件语法错误
// 策略: rollback → 重新 view 文件 → 修正 edit → 重试
```

### 4.7 用户交互设计

**计划展示：**

```
┌─────────────────────────────────────┐
│  Agent 任务计划                      │
├─────────────────────────────────────┤
│  目标: 添加用户认证模块               │
│                                     │
│  步骤:                               │
│  1. [ ] 查看项目结构                 │
│  2. [ ] 创建 auth/ 目录             │
│  3. [ ] 实现登录/注册逻辑            │
│  4. [ ] 添加中间件                   │
│  5. [ ] 创建测试                     │
│                                     │
│  预计轮次: 5-8                       │
│                                     │
│  [开始执行] [修改计划] [取消]        │
└─────────────────────────────────────┘
```

**执行进度：**

```
执行中... (步骤 3/5)
  ✔ 查看项目结构
  ✔ 创建 auth/ 目录
  → 实现登录/注册逻辑...
  
  当前操作: edit src/auth/login.ts
  [查看详情] [暂停] [取消]
```

**关键节点确认：**

```
即将执行写入操作:
  文件: src/auth/login.ts
  操作: 创建新文件（约 50 行）
  
  [确认执行] [查看 diff] [跳过此步] [终止任务]
```

### 4.8 安全机制

- **最大轮次限制** — 默认 20 轮，防止无限循环
- **文件变更确认** — 写入操作默认需要确认（yolo 模式可跳过）
- **自动备份** — Agent 执行前自动备份所有修改的文件
- **一键回滚** — `/rollback` 指令可撤销所有 Agent 修改

### 4.9 与现有代码的整合

- 新增 `/agent <任务>` 斜杠指令进入 Agent 模式
- 新增 `/plan` 查看当前任务计划
- 新增 `/step` 单步执行（调试模式）
- Agent 模式复用现有的 `processUserInput`，但改为自动循环

---

## 5. 与现有代码的整合策略

### 5.1 模块划分

```
mimo-cli/
├── src/
│   ├── index.ts                  # CLI 入口（不变）
│   ├── commands/
│   │   ├── chat.ts               # 交互式对话（增强 Agent 模式）
│   │   ├── config.ts             # 配置管理（不变）
│   │   └── models.ts             # 模型列表（不变）
│   ├── core/
│   │   ├── ai.ts                 # MiMo API 封装（不变）
│   │   ├── context.ts            # 对话上下文（增加 projectIndex）
│   │   ├── config.ts             # 配置管理（增加新配置项）
│   │   ├── memory.ts             # 项目记忆（不变）
│   │   └── permissions.ts        # 权限管理（增加 Agent 确认）
│   ├── tools/
│   │   ├── registry.ts           # 工具注册表（不变）
│   │   ├── file.ts             # 文件工具（增加 view/edit）
│   │   ├── exec.ts             # 命令执行（不变）
│   │   ├── search.ts           # 搜索工具（不变）
│   │   ├── git.ts              # Git 工具（不变）
│   │   └── index.ts            # 工具统一注册（增加新工具）
│   ├── ui/
│   │   ├── layout.ts           # 终端布局（增加 Agent 进度展示）
│   │   ├── render.ts           # 渲染（增加 Agent 状态渲染）
│   │   └── statusbar.ts        # 状态栏（增加 Agent 模式指示）
│   ├── agent/
│   │   ├── planner.ts          # 任务分解
│   │   ├── executor.ts         # 执行循环
│   │   └── recovery.ts         # 错误恢复
│   ├── project/
│   │   ├── index.ts            # 项目索引构建
│   │   └── context.ts          # 上下文注入
│   └── utils/
│       ├── logger.ts           # 日志（不变）
│       ├── spinner.ts          # 加载动画（不变）
│       └── safety.ts           # 安全检查（增加 Agent 备份）
```

### 5.2 新增配置项

```typescript
interface MiMoConfig {
  // 现有配置...
  
  // 新增
  agentMode: boolean;           // 是否默认启用 Agent 模式
  autoIndex: boolean;           // 启动时自动构建索引
  maxAgentRounds: number;       // Agent 最大轮次
  agentConfirmWrites: boolean;  // Agent 写入前是否确认
}
```

### 5.3 新增斜杠指令

| 指令 | 功能 |
|------|------|
| `/agent <任务>` | 进入 Agent 模式，执行多步骤任务 |
| `/plan` | 查看当前 Agent 任务计划 |
| `/step` | 单步执行（调试模式） |
| `/rollback` | 撤销所有 Agent 修改 |
| `/index` | 查看/重建项目索引 |
| `/reindex` | 强制重建项目索引 |

---

## 6. 技术选型

| 功能 | 技术方案 | 理由 |
|------|---------|------|
| 代码编辑 | 字符串匹配 + 上下文 | 简单高效，覆盖 90% 场景 |
| 项目索引 | 正则扫描 + JSON 缓存 | 轻量快速，无需 AST 依赖 |
| Agent 执行 | 状态机 + 轮次限制 | 可控、可调试、可回滚 |
| 错误恢复 | 备份 + 重试 + 回滚 | 安全、可靠 |
| 文件监听 | `fs.watch` / `chokidar` | 增量更新索引 |

---

## 7. 风险与应对

| 风险 | 影响 | 应对策略 |
|------|------|---------|
| 编辑定位不准确 | 高 | 上下文匹配 + 模糊匹配 + 自动重试 |
| Agent 无限循环 | 高 | 最大轮次限制 + 用户确认 |
| 索引构建过慢 | 中 | 限制扫描文件数 + 增量更新 |
| 项目理解不准确 | 中 | 轻量级正则扫描，后期可升级 AST |
| 用户体验不一致 | 低 | 保持现有交互范式，新功能渐进式引入 |

---

## 8. 迭代规划

### 8.1 一期（智能编辑）

- [ ] 实现 `view` 工具（支持行范围）
- [ ] 实现 `edit` 工具（上下文匹配、自动纠错）
- [ ] 多文件编辑支持
- [ ] 编辑预览（diff 展示）
- [ ] 编辑备份与回滚

### 8.2 二期（项目理解）

- [ ] 项目索引构建
- [ ] 自动上下文注入
- [ ] 智能文件选择
- [ ] 索引增量更新
- [ ] `/index` 指令

### 8.3 三期（Agent 模式）

- [ ] 任务分解
- [ ] 执行循环
- [ ] 错误恢复
- [ ] 用户交互（计划展示、进度、确认）
- [ ] `/agent` 指令

---

## 9. 附录

### 9.1 参考文档

- [Claude Code 官方文档](https://docs.anthropic.com/en/docs/claude-code/overview)
- [Claude Code 工具参考](https://docs.anthropic.com/en/docs/claude-code/tool-use)

### 9.2 术语表

| 术语 | 说明 |
|------|------|
| Agent 模式 | AI 自主规划、执行多步骤任务的工作模式 |
| 上下文匹配 | 通过包含额外上下文来确保编辑定位唯一性的技术 |
| 项目索引 | 对项目结构、代码符号等信息的结构化缓存 |
| 原子性编辑 | 所有编辑要么全部成功，要么全部失败 |
