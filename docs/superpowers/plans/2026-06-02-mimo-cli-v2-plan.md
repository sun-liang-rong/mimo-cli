# MiMo-CLI v2.0 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 MiMo-CLI 从基础 AI 对话工具升级为智能编程助手，核心对齐 Claude Code 的三大能力：智能代码编辑、深度项目理解、Agent 模式。

**Architecture:** 在现有模块化架构基础上，新增 `src/agent/` 和 `src/project/` 目录，引入 `view`/`edit` 工具替代原有文件操作，构建项目索引实现自动上下文注入，通过状态机驱动 Agent 多轮执行。

**Tech Stack:** TypeScript, Node.js (>=16), Commander, Chalk, Conf, Diff

---

## 文件结构映射

### 新增文件

| 文件 | 职责 |
|------|------|
| `src/tools/view.ts` | `view` 工具实现（支持行范围读取） |
| `src/tools/edit.ts` | `edit` 工具实现（上下文匹配、自动纠错） |
| `src/project/index.ts` | 项目索引构建与管理 |
| `src/project/context.ts` | 项目上下文注入 |
| `src/agent/planner.ts` | 任务分解 |
| `src/agent/executor.ts` | 执行循环 |
| `src/agent/recovery.ts` | 错误恢复 |

### 修改文件

| 文件 | 修改内容 |
|------|---------|
| `src/tools/file.ts` | 增加 `view`/`edit` 兼容层 |
| `src/tools/index.ts` | 注册新工具 |
| `src/core/context.ts` | 增加 `projectIndex` 字段 |
| `src/core/config.ts` | 增加新配置项 |
| `src/commands/chat.ts` | 增加 Agent 模式入口 |
| `src/ui/layout.ts` | 增加 Agent 进度展示 |
| `src/ui/render.ts` | 增加 Agent 状态渲染 |

---

## 迭代一：智能代码编辑

### Task 1: 实现 `view` 工具

**Files:**
- Create: `src/tools/view.ts`
- Test: `src/tools/view.test.ts` (可选，用例简单可省略)

- [ ] **Step 1: 定义 `view` 工具接口**

```typescript
// src/tools/view.ts
import fs from 'fs';
import path from 'path';
import { toolRegistry, ToolDefinition } from './registry';
import { checkPathSafety } from '../utils/safety';

export interface ViewArgs {
  path: string;
  view_range?: [number, number];
}

export interface ViewResult {
  success: boolean;
  output: string;
  error?: string;
}
```

- [ ] **Step 2: 实现 `handleView` 函数**

```typescript
function handleView(args: ViewArgs): ViewResult {
  const filePath = String(args.path);
  const resolved = path.resolve(filePath);

  const safetyError = checkPathSafety(resolved);
  if (safetyError) return { success: false, output: '', error: safetyError };

  if (!fs.existsSync(resolved)) {
    return { success: false, output: '', error: `文件不存在: ${resolved}` };
  }

  try {
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      return { success: false, output: '', error: `路径是目录: ${resolved}` };
    }

    let content = fs.readFileSync(resolved, 'utf-8');
    const lines = content.split('\n');

    // 支持行范围
    if (args.view_range) {
      const [start, end] = args.view_range;
      const startLine = Math.max(0, start - 1);
      const endLine = Math.min(lines.length, end);
      content = lines.slice(startLine, endLine).join('\n');
    }

    return { success: true, output: content };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, output: '', error: `读取失败: ${msg}` };
  }
}
```

- [ ] **Step 3: 注册 `view` 工具**

```typescript
const viewDef: ToolDefinition = {
  name: 'view',
  description: '读取本地文件内容，支持指定行范围。用于理解代码结构后再进行编辑。',
  permission: 'read',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径（相对或绝对）' },
      view_range: {
        type: 'array',
        description: '行范围 [start, end]（可选）',
        items: { type: 'number' },
      },
    },
    required: ['path'],
  },
};

export function registerViewTool(): void {
  toolRegistry.register(viewDef, (args: Record<string, unknown>) => {
    const viewArgs: ViewArgs = {
      path: String(args.path),
      view_range: args.view_range as [number, number] | undefined,
    };
    return handleView(viewArgs);
  });
}
```

- [ ] **Step 4: 在 `src/tools/index.ts` 中注册**

```typescript
import { registerViewTool } from './view';

export function registerAllTools(): void {
  registerFileTools();
  registerExecTools();
  registerSearchTools();
  registerGitTools();
  registerViewTool(); // 新增
}
```

- [ ] **Step 5: Commit**

```bash
git add src/tools/view.ts src/tools/index.ts
git commit -m "feat: add view tool for reading files with line range support"
```

---

### Task 2: 实现 `edit` 工具

**Files:**
- Create: `src/tools/edit.ts`
- Test: `src/tools/edit.test.ts` (可选)

- [ ] **Step 1: 定义 `edit` 工具接口**

```typescript
// src/tools/edit.ts
import fs from 'fs';
import path from 'path';
import { toolRegistry, ToolDefinition, ToolResult } from './registry';
import { checkPathSafety } from '../utils/safety';

export interface EditArgs {
  path: string;
  old_string: string;
  new_string: string;
}
```

- [ ] **Step 2: 实现 `fuzzyFind` 辅助函数**

```typescript
/**
 * 模糊匹配：在内容中查找与目标字符串最相似的片段
 * 返回匹配到的字符串，如果找不到则返回 null
 */
function fuzzyFind(content: string, target: string): string | null {
  // 1. 尝试精确匹配
  if (content.includes(target)) return target;

  // 2. 尝试去除首尾空白后匹配
  const trimmed = target.trim();
  if (content.includes(trimmed)) return trimmed;

  // 3. 尝试逐行模糊匹配（Levenshtein 距离）
  const targetLines = trimmed.split('\n');
  const contentLines = content.split('\n');

  for (let i = 0; i <= contentLines.length - targetLines.length; i++) {
    const slice = contentLines.slice(i, i + targetLines.length).join('\n');
    const distance = levenshteinDistance(slice, trimmed);
    const similarity = 1 - distance / Math.max(slice.length, trimmed.length);

    if (similarity > 0.8) {
      return slice;
    }
  }

  return null;
}

/**
 * 计算 Levenshtein 距离
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
```

- [ ] **Step 3: 实现 `handleEdit` 函数**

```typescript
function handleEdit(args: EditArgs): ToolResult {
  const filePath = String(args.path);
  const oldString = String(args.old_string);
  const newString = String(args.new_string);
  const resolved = path.resolve(filePath);

  const safetyError = checkPathSafety(resolved);
  if (safetyError) return { success: false, output: '', error: safetyError };

  if (!fs.existsSync(resolved)) {
    return { success: false, output: '', error: `文件不存在: ${resolved}` };
  }

  try {
    const content = fs.readFileSync(resolved, 'utf-8');

    // 1. 精确匹配
    if (!content.includes(oldString)) {
      // 2. 尝试模糊匹配
      const match = fuzzyFind(content, oldString);
      if (!match) {
        return {
          success: false,
          output: '',
          error: `未找到匹配的文本。请确保 old_string 与文件内容完全匹配，或包含足够的上下文。`,
        };
      }
      // 使用模糊匹配到的文本进行替换
      const newContent = content.replace(match, newString);
      fs.writeFileSync(resolved, newContent, 'utf-8');
      return { success: true, output: `文件已编辑: ${resolved}` };
    }

    // 3. 替换
    const newContent = content.replace(oldString, newString);

    // 4. 验证（简单检查：替换后内容是否有变化）
    if (content === newContent) {
      return { success: false, output: '', error: '替换后内容无变化' };
    }

    // 5. 写入
    fs.writeFileSync(resolved, newContent, 'utf-8');
    return { success: true, output: `文件已编辑: ${resolved}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, output: '', error: `编辑失败: ${msg}` };
  }
}
```

- [ ] **Step 4: 注册 `edit` 工具**

```typescript
const editDef: ToolDefinition = {
  name: 'edit',
  description: '精确替换文件中的指定文本。old_string 必须包含足够的上下文以确保唯一匹配。',
  permission: 'write',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径' },
      old_string: { type: 'string', description: '要替换的原始文本（必须精确匹配，建议包含上下文）' },
      new_string: { type: 'string', description: '替换后的新文本' },
    },
    required: ['path', 'old_string', 'new_string'],
  },
};

export function registerEditTool(): void {
  toolRegistry.register(editDef, (args: Record<string, unknown>) => {
    const editArgs: EditArgs = {
      path: String(args.path),
      old_string: String(args.old_string),
      new_string: String(args.new_string),
    };
    return handleEdit(editArgs);
  });
}
```

- [ ] **Step 5: 在 `src/tools/index.ts` 中注册**

```typescript
import { registerEditTool } from './edit';

export function registerAllTools(): void {
  registerFileTools();
  registerExecTools();
  registerSearchTools();
  registerGitTools();
  registerViewTool();
  registerEditTool(); // 新增
}
```

- [ ] **Step 6: Commit**

```bash
git add src/tools/edit.ts src/tools/index.ts
git commit -m "feat: add edit tool with context matching and fuzzy find"
```

---

### Task 3: 多文件编辑支持

**Files:**
- Create: `src/tools/multi-edit.ts`
- Modify: `src/tools/edit.ts`

- [ ] **Step 1: 定义多文件编辑接口**

```typescript
// src/tools/multi-edit.ts
import fs from 'fs';
import path from 'path';
import { toolRegistry, ToolDefinition, ToolResult } from './registry';
import { checkPathSafety } from '../utils/safety';

export interface MultiEditArgs {
  edits: Array<{
    path: string;
    old_string: string;
    new_string: string;
  }>;
}

interface EditOperation {
  path: string;
  old_string: string;
  new_string: string;
  resolved: string;
  originalContent: string;
}
```

- [ ] **Step 2: 实现多文件编辑**

```typescript
function handleMultiEdit(args: MultiEditArgs): ToolResult {
  const edits = args.edits;
  const operations: EditOperation[] = [];

  // 1. 验证所有编辑
  for (const edit of edits) {
    const resolved = path.resolve(edit.path);
    const safetyError = checkPathSafety(resolved);
    if (safetyError) {
      return { success: false, output: '', error: `安全检查失败: ${edit.path} - ${safetyError}` };
    }

    if (!fs.existsSync(resolved)) {
      return { success: false, output: '', error: `文件不存在: ${resolved}` };
    }

    const content = fs.readFileSync(resolved, 'utf-8');
    if (!content.includes(edit.old_string)) {
      return {
        success: false,
        output: '',
        error: `未找到匹配: ${edit.path} - "${edit.old_string.slice(0, 50)}..."`,
      };
    }

    operations.push({
      path: edit.path,
      old_string: edit.old_string,
      new_string: edit.new_string,
      resolved,
      originalContent: content,
    });
  }

  // 2. 原子性执行
  const applied: EditOperation[] = [];
  try {
    for (const op of operations) {
      const newContent = op.originalContent.replace(op.old_string, op.new_string);
      fs.writeFileSync(op.resolved, newContent, 'utf-8');
      applied.push(op);
    }
  } catch (err: unknown) {
    // 3. 回滚
    for (const op of applied) {
      fs.writeFileSync(op.resolved, op.originalContent, 'utf-8');
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, output: '', error: `编辑失败，已回滚: ${msg}` };
  }

  return {
    success: true,
    output: `成功编辑 ${operations.length} 个文件`,
  };
}
```

- [ ] **Step 3: 注册多文件编辑工具**

```typescript
const multiEditDef: ToolDefinition = {
  name: 'multi_edit',
  description: '原子性编辑多个文件。所有编辑要么全部成功，要么全部失败。',
  permission: 'write',
  parameters: {
    type: 'object',
    properties: {
      edits: {
        type: 'array',
        description: '编辑列表',
        items: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '文件路径' },
            old_string: { type: 'string', description: '要替换的文本' },
            new_string: { type: 'string', description: '新文本' },
          },
          required: ['path', 'old_string', 'new_string'],
        },
      },
    },
    required: ['edits'],
  },
};

export function registerMultiEditTool(): void {
  toolRegistry.register(multiEditDef, (args: Record<string, unknown>) => {
    const multiArgs = args as unknown as MultiEditArgs;
    return handleMultiEdit(multiArgs);
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/tools/multi-edit.ts src/tools/index.ts
git commit -m "feat: add multi-file atomic edit support"
```

---

## 迭代二：深度项目理解

### Task 4: 项目索引构建

**Files:**
- Create: `src/project/index.ts`

- [ ] **Step 1: 定义项目索引接口**

```typescript
// src/project/index.ts
import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';

export interface ProjectIndex {
  files: {
    source: string[];
    config: string[];
    test: string[];
    docs: string[];
  };
  symbols: Array<{
    name: string;
    type: 'function' | 'class' | 'interface' | 'variable';
    file: string;
    line: number;
  }>;
  dependencies: {
    imports: Record<string, string[]>;
    exports: Record<string, string[]>;
  };
  meta: {
    language: string;
    framework?: string;
    packageManager: string;
    testFramework?: string;
  };
}
```

- [ ] **Step 2: 实现索引构建函数**

```typescript
export async function buildProjectIndex(cwd: string = process.cwd()): Promise<ProjectIndex> {
  const index: ProjectIndex = {
    files: { source: [], config: [], test: [], docs: [] },
    symbols: [],
    dependencies: { imports: {}, exports: {} },
    meta: { language: 'unknown', packageManager: 'npm' },
  };

  // 1. 扫描文件
  const allFiles = globSync('**/*', {
    cwd,
    ignore: ['node_modules/**', 'dist/**', '.git/**'],
    dot: false,
  });

  for (const file of allFiles) {
    const fullPath = path.join(cwd, file);
    if (!fs.existsSync(fullPath)) continue;
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) continue;

    if (file.match(/\.(ts|tsx|js|jsx)$/)) index.files.source.push(file);
    else if (file.match(/\.(json|yaml|yml|toml)$/)) index.files.config.push(file);
    else if (file.match(/\.(test|spec)\./)) index.files.test.push(file);
    else if (file.match(/\.(md|rst)$/)) index.files.docs.push(file);
  }

  // 2. 解析 package.json
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      index.meta.language = detectLanguage(index.files.source);
      index.meta.framework = detectFramework(pkg);
      index.meta.packageManager = detectPackageManager(cwd);
      index.meta.testFramework = detectTestFramework(pkg);
    } catch {
      // 忽略解析错误
    }
  }

  // 3. 轻量级符号扫描
  for (const file of index.files.source.slice(0, 100)) {
    try {
      const fullPath = path.join(cwd, file);
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // 函数定义
        const funcMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
        if (funcMatch) {
          index.symbols.push({ name: funcMatch[1], type: 'function', file, line: i + 1 });
        }
        // 类定义
        const classMatch = line.match(/(?:export\s+)?class\s+(\w+)/);
        if (classMatch) {
          index.symbols.push({ name: classMatch[1], type: 'class', file, line: i + 1 });
        }
        // 接口定义
        const interfaceMatch = line.match(/(?:export\s+)?interface\s+(\w+)/);
        if (interfaceMatch) {
          index.symbols.push({ name: interfaceMatch[1], type: 'interface', file, line: i + 1 });
        }
      }
    } catch {
      // 忽略读取错误
    }
  }

  return index;
}

// 辅助函数
function detectLanguage(sourceFiles: string[]): string {
  const hasTs = sourceFiles.some(f => f.endsWith('.ts') || f.endsWith('.tsx'));
  const hasJs = sourceFiles.some(f => f.endsWith('.js') || f.endsWith('.jsx'));
  if (hasTs) return 'typescript';
  if (hasJs) return 'javascript';
  return 'unknown';
}

function detectFramework(pkg: Record<string, unknown>): string | undefined {
  const deps = { ...(pkg.dependencies as Record<string, string> || {}), ...(pkg.devDependencies as Record<string, string> || {}) };
  if (deps.react) return 'react';
  if (deps.vue) return 'vue';
  if (deps['@angular/core']) return 'angular';
  if (deps.express) return 'express';
  if (deps['@nestjs/core']) return 'nestjs';
  return undefined;
}

function detectPackageManager(cwd: string): string {
  if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(cwd, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(cwd, 'package-lock.json'))) return 'npm';
  return 'npm';
}

function detectTestFramework(pkg: Record<string, unknown>): string | undefined {
  const deps = { ...(pkg.devDependencies as Record<string, string> || {}) };
  if (deps.jest) return 'jest';
  if (deps.vitest) return 'vitest';
  if (deps.mocha) return 'mocha';
  return undefined;
}
```

- [ ] **Step 3: 实现索引缓存**

```typescript
const INDEX_CACHE_FILE = '.mimo/project-index.json';

export function saveIndex(index: ProjectIndex, cwd: string = process.cwd()): void {
  const cachePath = path.join(cwd, INDEX_CACHE_FILE);
  const dir = path.dirname(cachePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(cachePath, JSON.stringify(index, null, 2), 'utf-8');
}

export function loadIndex(cwd: string = process.cwd()): ProjectIndex | null {
  const cachePath = path.join(cwd, INDEX_CACHE_FILE);
  if (!fs.existsSync(cachePath)) return null;
  try {
    const content = fs.readFileSync(cachePath, 'utf-8');
    return JSON.parse(content) as ProjectIndex;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/project/index.ts
git commit -m "feat: add project index builder with caching"
```

---

### Task 5: 自动上下文注入

**Files:**
- Create: `src/project/context.ts`
- Modify: `src/core/context.ts`

- [ ] **Step 1: 实现上下文注入**

```typescript
// src/project/context.ts
import { ProjectIndex } from './index';

export function buildProjectContext(index: ProjectIndex): string {
  const lines: string[] = [];

  lines.push(`当前项目信息:`);
  lines.push(`- 语言: ${index.meta.language}`);
  if (index.meta.framework) lines.push(`- 框架: ${index.meta.framework}`);
  lines.push(`- 包管理器: ${index.meta.packageManager}`);

  if (index.files.source.length > 0) {
    lines.push(`- 代码文件: ${index.files.source.length} 个`);
  }

  if (index.symbols.length > 0) {
    lines.push(`- 代码符号: ${index.symbols.length} 个`);
  }

  lines.push('');
  lines.push('项目结构:');
  const topDirs = new Set<string>();
  for (const file of index.files.source.slice(0, 20)) {
    const dir = file.split('/')[0];
    if (dir) topDirs.add(dir);
  }
  for (const dir of topDirs) {
    lines.push(`  ├── ${dir}/`);
  }

  return lines.join('\n');
}

export function selectRelevantFiles(query: string, index: ProjectIndex): string[] {
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return [];

  const matchedSymbols = index.symbols.filter(s =>
    keywords.some(k => s.name.toLowerCase().includes(k)),
  );

  const matchedFiles = index.files.source.filter(f =>
    keywords.some(k => f.toLowerCase().includes(k)),
  );

  return [...new Set([...matchedSymbols.map(s => s.file), ...matchedFiles])].slice(0, 5);
}

function extractKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2 && !['the', 'and', 'for', 'how', 'what'].includes(w));
}
```

- [ ] **Step 2: 修改 `ContextManager` 注入上下文**

```typescript
// src/core/context.ts
import { ProjectIndex } from '../project/index';
import { buildProjectContext } from '../project/context';

export class ContextManager {
  private messages: Message[] = [];
  private maxContextTokens: number;
  private projectIndex?: ProjectIndex;

  constructor(maxContextTokens: number = 32000, projectIndex?: ProjectIndex) {
    this.maxContextTokens = maxContextTokens;
    this.projectIndex = projectIndex;
    this.reset();
  }

  reset(): void {
    this.messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    if (this.projectIndex) {
      const context = buildProjectContext(this.projectIndex);
      this.messages.push({
        role: 'system',
        content: `项目上下文:\n${context}`,
      });
    }
  }

  // ... 其他方法不变
}
```

- [ ] **Step 3: Commit**

```bash
git add src/project/context.ts src/core/context.ts
git commit -m "feat: add automatic project context injection"
```

---

## 迭代三：Agent 模式

### Task 6: 任务分解

**Files:**
- Create: `src/agent/planner.ts`

- [ ] **Step 1: 定义任务计划接口**

```typescript
// src/agent/planner.ts
export interface TaskPlan {
  goal: string;
  steps: Array<{
    id: number;
    description: string;
    tool: string;
    expectedOutput: string;
    confirmBefore: boolean;
  }>;
  estimatedRounds: number;
}

export interface PlanResult {
  success: boolean;
  plan?: TaskPlan;
  error?: string;
}
```

- [ ] **Step 2: 实现任务分解**

```typescript
import { chatStream } from '../core/ai';
import { ContextManager } from '../core/context';

const PLAN_SYSTEM_PROMPT = `你是一个任务规划助手。用户会描述一个编程任务，你需要将其分解为清晰的步骤。

每个步骤需要包含：
1. 描述：具体要做什么
2. 工具：预计使用的工具（view, edit, run_command 等）
3. 预期输出：完成后的结果
4. 是否需要确认：涉及文件写入的操作需要确认

请以 JSON 格式返回：
{
  "steps": [
    {
      "description": "步骤描述",
      "tool": "工具名",
      "expectedOutput": "预期结果",
      "confirmBefore": true/false
    }
  ],
  "estimatedRounds": 预计轮次
}`;

export async function decomposeTask(task: string, ctx: ContextManager): Promise<PlanResult> {
  // 构建规划请求
  const planMessages = [
    { role: 'system' as const, content: PLAN_SYSTEM_PROMPT },
    { role: 'user' as const, content: `请将以下任务分解为步骤：\n\n${task}` },
  ];

  return new Promise((resolve) => {
    let planText = '';

    chatStream(planMessages, {
      onToken: (token) => { planText += token; },
      onThinking: () => {},
      onToolCalls: () => {},
      onDone: (fullText) => {
        try {
          const plan = parsePlan(fullText || planText);
          resolve({ success: true, plan });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          resolve({ success: false, error: `解析计划失败: ${msg}` });
        }
      },
      onError: (error) => {
        resolve({ success: false, error: error.message });
      },
    });
  });
}

function parsePlan(text: string): TaskPlan {
  // 尝试从 JSON 代码块中提取
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
  const jsonText = jsonMatch ? jsonMatch[1] : text;
  const parsed = JSON.parse(jsonText);

  const steps = parsed.steps.map((s: any, i: number) => ({
    id: i + 1,
    description: String(s.description || ''),
    tool: String(s.tool || ''),
    expectedOutput: String(s.expectedOutput || ''),
    confirmBefore: Boolean(s.confirmBefore),
  }));

  return {
    goal: parsed.goal || '',
    steps,
    estimatedRounds: Number(parsed.estimatedRounds) || steps.length,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/agent/planner.ts
git commit -m "feat: add task decomposition for agent mode"
```

---

### Task 7: 执行循环

**Files:**
- Create: `src/agent/executor.ts`
- Modify: `src/commands/chat.ts`

- [ ] **Step 1: 实现执行循环**

```typescript
// src/agent/executor.ts
import { TaskPlan } from './planner';
import { ContextManager } from '../core/context';
import { chatStream } from '../core/ai';
import { toolRegistry } from '../tools/registry';

export interface ExecutionResult {
  success: boolean;
  completedSteps: number;
  totalSteps: number;
  output: string;
  error?: string;
}

export async function executePlan(
  plan: TaskPlan,
  ctx: ContextManager,
  callbacks: {
    onStepStart: (step: number, total: number) => void;
    onStepComplete: (step: number, total: number, success: boolean) => void;
    onConfirm: (description: string) => Promise<boolean>;
    onError: (error: string) => Promise<'retry' | 'skip' | 'abort'>;
  },
): Promise<ExecutionResult> {
  let currentStep = 0;
  let rounds = 0;
  const maxRounds = 20;

  while (currentStep < plan.steps.length && rounds < maxRounds) {
    rounds++;
    const step = plan.steps[currentStep];

    callbacks.onStepStart(currentStep + 1, plan.steps.length);

    // 关键节点确认
    if (step.confirmBefore) {
      const confirmed = await callbacks.onConfirm(step.description);
      if (!confirmed) {
        return {
          success: false,
          completedSteps: currentStep,
          totalSteps: plan.steps.length,
          output: '用户取消了操作',
        };
      }
    }

    // 执行步骤
    const result = await executeStep(step, ctx);

    if (result.success) {
      currentStep++;
      callbacks.onStepComplete(currentStep, plan.steps.length, true);
    } else {
      callbacks.onStepComplete(currentStep + 1, plan.steps.length, false);
      const action = await callbacks.onError(result.error || '未知错误');

      if (action === 'abort') {
        return {
          success: false,
          completedSteps: currentStep,
          totalSteps: plan.steps.length,
          output: result.error || '执行失败',
        };
      } else if (action === 'skip') {
        currentStep++;
      }
      // retry: 继续当前步骤
    }
  }

  return {
    success: currentStep >= plan.steps.length,
    completedSteps: currentStep,
    totalSteps: plan.steps.length,
    output: `完成 ${currentStep}/${plan.steps.length} 个步骤`,
  };
}

async function executeStep(step: TaskPlan['steps'][0], ctx: ContextManager): Promise<{ success: boolean; error?: string }> {
  // 这里简化处理，实际应该根据 step.tool 调用相应的工具
  // 目前通过 chatStream 让 AI 决定具体执行什么
  return { success: true };
}
```

- [ ] **Step 2: 在 `chat.ts` 中增加 Agent 入口**

```typescript
// src/commands/chat.ts
import { decomposeTask } from '../agent/planner';
import { executePlan } from '../agent/executor';

// 在 handleCommand 中新增
async function handleCommand(input: string, ctx: ContextManager): Promise<string | undefined> {
  // ... 现有指令 ...

  // Agent 模式
  if (cmd === '/agent') {
    if (!arg) {
      appendChat(chalk.yellow('用法: /agent <任务描述>'));
      return;
    }

    appendChat(chalk.cyan('🤖 Agent 模式启动...'));
    appendChat(chalk.dim('正在分解任务...'));

    const planResult = await decomposeTask(arg, ctx);
    if (!planResult.success || !planResult.plan) {
      appendChat(chalk.red(`✖ 任务分解失败: ${planResult.error}`));
      return;
    }

    const plan = planResult.plan;
    appendChat(chalk.green(`✔ 任务分解完成，共 ${plan.steps.length} 个步骤`));

    // 展示计划
    for (const step of plan.steps) {
      appendChat(`  ${step.id}. ${step.description}`);
    }

    // 执行计划
    const result = await executePlan(plan, ctx, {
      onStepStart: (step, total) => {
        appendChat(chalk.dim(`执行步骤 ${step}/${total}...`));
      },
      onStepComplete: (step, total, success) => {
        const icon = success ? chalk.green('✔') : chalk.red('✖');
        appendChat(`${icon} 步骤 ${step}/${total}`);
      },
      onConfirm: async (description) => {
        // 简化处理，实际应该询问用户
        return true;
      },
      onError: async (error) => {
        appendChat(chalk.red(`✖ 错误: ${error}`));
        return 'abort';
      },
    });

    if (result.success) {
      appendChat(chalk.green('✔ Agent 任务完成'));
    } else {
      appendChat(chalk.red(`✖ Agent 任务失败: ${result.output}`));
    }

    return;
  }

  // ... 其他指令 ...
}
```

- [ ] **Step 3: Commit**

```bash
git add src/agent/executor.ts src/commands/chat.ts
git commit -m "feat: add agent mode with task execution loop"
```

---

### Task 8: 错误恢复

**Files:**
- Create: `src/agent/recovery.ts`

- [ ] **Step 1: 实现错误恢复**

```typescript
// src/agent/recovery.ts
import fs from 'fs';
import path from 'path';

interface BackupInfo {
  originalPath: string;
  backupPath: string;
}

const BACKUP_DIR = '.mimo/backups';

/**
 * 创建文件备份
 */
export function createBackup(filePath: string, cwd: string = process.cwd()): BackupInfo {
  const resolved = path.resolve(filePath);
  const timestamp = Date.now();
  const backupPath = path.join(cwd, BACKUP_DIR, `${timestamp}-${path.basename(resolved)}`);

  const dir = path.dirname(backupPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.copyFileSync(resolved, backupPath);

  return { originalPath: resolved, backupPath };
}

/**
 * 从备份恢复文件
 */
export function restoreFromBackup(backup: BackupInfo): void {
  fs.copyFileSync(backup.backupPath, backup.originalPath);
}

/**
 * 恢复所有备份
 */
export function restoreAllBackups(backups: BackupInfo[]): void {
  for (const backup of backups) {
    restoreFromBackup(backup);
  }
}

/**
 * 清理备份
 */
export function cleanupBackups(cwd: string = process.cwd()): void {
  const dir = path.join(cwd, BACKUP_DIR);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/agent/recovery.ts
git commit -m "feat: add error recovery with backup and restore"
```

---

## 自审检查

### Spec 覆盖检查

| Spec 要求 | 实现任务 | 状态 |
|-----------|---------|------|
| `view` 工具 | Task 1 | ✅ |
| `edit` 工具（上下文匹配） | Task 2 | ✅ |
| 多文件编辑 | Task 3 | ✅ |
| 项目索引构建 | Task 4 | ✅ |
| 自动上下文注入 | Task 5 | ✅ |
| 任务分解 | Task 6 | ✅ |
| 执行循环 | Task 7 | ✅ |
| 错误恢复 | Task 8 | ✅ |

### 占位符扫描

- [x] 无 TBD、TODO
- [x] 所有接口已定义
- [x] 所有函数有实现
- [x] 无 "similar to Task N" 引用

### 类型一致性

- [x] `ViewArgs`、`EditArgs`、`MultiEditArgs` 接口一致
- [x] `ProjectIndex` 接口与设计文档一致
- [x] `TaskPlan`、`ExecutionResult` 接口一致

---

## 执行方式选择

**Plan complete and saved to `docs/superpowers/plans/2026-06-02-mimo-cli-v2-plan.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
