MiMo-CLI 终端智能助手开发需求文档 v2.0

1. 项目概述
基于 TypeScript + Node.js 开发一款面向开发者的终端 AI 编程助手 CLI 工具，对接小米 MiMo 大模型 API。定位为 Claude Code 的轻量化替代方案，具备完整的代码开发辅助能力，包括智能对话、代码生成与修改、文件操作、终端命令执行、项目上下文管理、任务队列等核心功能。

工具命名：mimo-cli
运行环境：跨平台（Windows / MacOS / Linux）
开发技术：TypeScript、Node.js
设计风格：参照 CodeWhale / Claude Code 终端交互范式

2. 整体产品目标
2.1 终端内实现高质量 AI 编程对话，支持流式输出、思考过程展示、代码块高亮渲染
2.2 深度集成本地项目：文件读写、代码修改、差异对比、多文件批量操作
2.3 AI 驱动的终端命令执行，自动分析报错并给出修复方案
2.4 任务队列系统：支持后台并行执行多个子任务，实时查看任务状态
2.5 权限门控：危险操作需用户确认，安全操作可自动执行
2.6 项目记忆：持久化项目上下文、编码规范、架构约定，跨会话保持
2.7 轻量化打包，npm install -g 即用，无需额外依赖

3. 界面设计规范（参照 CodeWhale TUI）
3.1 整体布局
┌─────────────────────────────────────────────────────────┐
│  mimo  ·  username  ·  model-name  ·  max_tokens  · v1 │  ← 顶部状态栏
├──────────────────────────────────┬──────────────────────┤
│                                  │   Tasks              │
│   对话区域                       │   ─────              │
│                                  │   turn xx (done)     │
│   ● 用户输入                     │   turn xx (running)  │
│   : thinking 块                  │   No live jobs       │
│   > AI 回复内容                  │                      │
│     1. tool call: file_read      │                      │
│     2. tool call: run_command    │                      │
│                                  │                      │
├──────────────────────────────────┴──────────────────────┤
│  Composer                                               │  ← 输入区域
│  Type a message or use /                                │
├─────────────────────────────────────────────────────────┤
│  auto  ·  model  ·  $0.01  ·  saved $0.01  ·  Activity │  ← 底部状态栏
└─────────────────────────────────────────────────────────┘

3.2 视觉规范
- 顶部状态栏：青色背景，显示模式、用户名、模型名、版本
- 对话区：用户输入绿色前缀，AI 回复蓝色前缀
- 思考块：灰色缩进，显示 thinking 状态和耗时
- 工具调用：编号列表，显示工具名和参数摘要
- 右侧 Tasks 面板：实时显示任务队列状态
- 底部状态栏：显示当前模式、模型、花费、活动状态
- Composer 输入框：底部固定，支持斜杠指令自动补全

4. 核心功能需求
4.1 对话与推理能力
4.1.1 流式响应输出，逐 token 渲染，模拟打字机效果
4.1.2 思考过程可视化：显示 thinking 块，标注推理耗时
4.1.3 多轮上下文记忆，自动裁剪超长历史，避免 token 溢出
4.1.4 支持多种推理模式：
  - think：显示推理过程（默认）
  - nothink：跳过推理，直接输出
  - auto：模型自行决定是否推理
4.1.5 上下文压缩：/compact 指令自动压缩历史对话，释放 token 空间
4.1.6 对话导出：支持将完整对话记录导出为 Markdown 文件

4.2 工具调用系统（Tool Use）
4.2.1 工具注册表：所有工具通过统一注册表管理，支持动态加载
4.2.2 工具类型分类：
  - 只读工具（安全，自动执行）：read_file, view, list_dir, search_files, git_status
  - 写入工具（需确认）：write_file, edit_file, edit, multi_edit, run_command
  - 危险工具（强制确认）：delete_file, run_command(rm/format)
4.2.3 工具调用结果流式回传给模型，支持链式调用
4.2.4 工具执行超时机制，默认 30 秒
4.2.5 工具调用失败自动重试（最多 2 次）

4.3 本地文件操作能力
4.3.1 文件读取：支持任意文本文件，自动识别编码，大文件分片读取
4.3.2 文件写入：创建新文件、覆盖写入、追加写入
4.3.3 文件编辑：局部修改现有文件，支持精确字符串替换（edit_file）和上下文匹配编辑（edit）
4.3.4 智能代码编辑（Smart Edit）：
  - view：读取文件内容，支持指定行范围，帮助 AI 理解代码结构
  - edit：基于上下文匹配进行精确编辑，支持模糊匹配和自动纠错
  - multi_edit：原子性编辑多个文件，全部成功或全部失败
4.3.5 文件搜索：按文件名模式匹配（glob）、按内容搜索（grep）
4.3.5 目录浏览：列出目录结构，支持递归展开
4.3.6 差异对比：修改前后 diff 展示，支持侧边对比
4.3.7 批量操作：一次对话中同时修改多个文件

4.4 终端命令执行能力
4.4.1 同步执行：/run 命令，等待执行完成并返回结果
4.4.2 后台执行：/bg 命令，后台运行，完成后通知
4.4.3 结果捕获：stdout/stderr 分别捕获，保留格式
4.4.4 输出截断：超过 10000 字符自动截断，提示用户
4.4.5 命令历史：记录已执行命令，支持快速复用
4.4.6 安全拦截：高危命令黑名单，敏感操作二次确认

4.5 Git 集成
4.5.1 自动检测当前分支、工作区状态
4.5.2 读取 git diff，理解代码变更
4.5.3 生成有意义的 commit message
4.5.4 创建 git commit
4.5.5 创建 git worktree 隔离并行任务

4.6 项目记忆系统（Memory）
4.6.1 项目级记忆：在项目根目录创建 .mimo/memory.md
  - 存储项目架构、编码规范、技术栈、约定
  - 每次会话自动加载
  - AI 可自主读写记忆文件
4.6.2 项目索引：自动构建项目索引（.mimo/project-index.json）
  - 扫描项目文件结构（源码、配置、测试、文档）
  - 提取代码符号（函数、类、接口）
  - 检测项目元数据（语言、框架、包管理器）
  - 对话时自动注入项目上下文
4.6.3 智能文件选择：根据用户问题自动选择相关文件作为上下文
4.6.4 用户级记忆：~/.mimo-cli/memory/
  - 存储用户偏好、常用配置
  - 跨项目共享
4.6.5 记忆索引：MEMORY.md 作为记忆索引文件
4.6.6 记忆更新：AI 在对话中发现新信息时自动更新记忆

4.7 任务队列系统
4.7.1 后台任务管理：任务状态跟踪（pending/running/completed/failed）
4.7.2 并行执行：多个子任务并发运行
4.7.3 任务依赖：支持任务间依赖关系
4.7.4 任务通知：任务完成时通知用户
4.7.5 任务历史：查看已完成任务的执行记录

4.8 Agent 模式
4.8.1 任务分解：AI 自动将复杂任务分解为可执行的步骤
4.8.2 执行循环：按步骤自动执行工具调用，支持关键节点确认
4.8.3 错误恢复：执行失败时自动重试、修正或回滚
4.8.4 备份机制：Agent 执行前自动备份文件，支持一键回滚
4.8.5 最大轮次限制：默认 20 轮，防止无限循环
4.8.6 用户交互：计划展示、执行进度、关键节点确认

4.9 权限与安全
4.8.1 权限模式：
  - default：危险操作需确认
  - yolo：所有操作自动执行（可信环境）
  - plan：只读模式，禁止任何修改
4.8.2 操作确认：对文件修改、命令执行等操作弹出确认提示
4.8.3 安全拦截：系统敏感路径、高危命令自动拦截
4.8.4 沙箱隔离：可选的命令执行沙箱环境
4.8.5 隐私保护：API Key 本地加密存储，不上传用户代码

4.9 配置管理
4.9.1 首次运行交互式引导配置：API Key + Base URL + Model
4.9.2 配置文件位置：
  - Windows: %APPDATA%/mimo-cli/
  - macOS: ~/Library/Preferences/mimo-cli/
  - Linux: ~/.config/mimo-cli/
4.9.3 配置项：
  - apiKey：API 密钥（必填）
  - baseUrl：接口地址（默认 https://token-plan-cn.xiaomimimo.com/v1）
  - model：模型名称（默认 mimo-v2.5-pro）
  - thinkingMode：推理模式（默认 think）
  - temperature：生成温度（默认 0.7）
  - maxTokens：最大生成长度（默认 4096）
  - maxContextTokens：上下文窗口（默认 32000）
  - autoApprove：自动执行模式（默认 false）
  - theme：界面主题（默认 default）
4.9.4 多环境配置：支持 dev/staging/prod 配置切换
4.9.5 配置热更新：修改配置后立即生效

5. 指令设计规范
5.1 基础 CLI 指令
- mimo                        进入交互式对话
- mimo chat                   显式进入对话模式
- mimo --version / -v         查看版本号
- mimo --help / -h            查看帮助
- mimo config set <key> <val> 设置配置项
- mimo config show            查看当前配置
- mimo config reset           重置所有配置
- mimo models                 查看 API 可用模型列表
- mimo auth status            查看认证状态

5.2 交互内置指令（斜杠指令）
- /help             显示帮助信息
- /clear            清空对话上下文
- /compact          压缩上下文，释放 token 空间
- /cost             查看本次会话 token 用量和花费
- /model [name]     查看/切换模型
- /read <path>      读取本地文件
- /view <path>      查看文件内容（支持行范围）
- /write <path>     写入文件（从 AI 回复中提取代码）
- /edit <path>      编辑文件（上下文匹配）
- /multi_edit       多文件原子编辑
- /diff [path]      查看文件修改差异
- /run <cmd>        执行终端命令
- /bg <cmd>         后台执行命令
- /git              查看 git 状态
- /commit [msg]     创建 git commit
- /agent <task>     Agent 模式（自动分解执行任务）
- /plan             查看当前 Agent 任务计划
- /step             单步执行（调试模式）
- /rollback         撤销所有 Agent 修改
- /index            查看/重建项目索引
- /reindex          强制重建项目索引
- /memory           查看项目记忆
- /save             保存对话记录
- /restore          恢复上次对话
- /mode <name>      切换权限模式（default/yolo/plan）
- /think            显示/隐藏思考过程
- /quit / /exit     退出程序

5.3 斜杠指令交互细节
- 输入 "/" 时显示指令列表（模糊搜索）
- 支持 Tab 补全指令名
- 指令参数用方括号表示可选，尖括号表示必填
- 无效指令给出建议（"你是否想输入 /clear?"）

6. AI 模型对接规范
6.1 API 协议：兼容 OpenAI Chat Completions 协议
  POST {baseUrl}/chat/completions
  Headers: Authorization: Bearer {apiKey}
  Body: { model, messages, temperature, max_tokens, stream }
6.2 流式响应：SSE（Server-Sent Events），data: {...}\n\n 格式
6.3 工具调用：通过 tools 字段传递工具定义，模型返回 tool_calls
6.4 思考模式：通过 thinking 参数控制推理过程输出
6.5 可用模型列表：
  - mimo-v2.5-pro（推荐）
  - mimo-v2.5
  - mimo-v2-pro
  - mimo-v2-tts
6.6 错误码处理：
  - 400：参数错误，解析具体原因给出提示
  - 401：API Key 无效，引导重新配置
  - 429：请求限流，自动重试（指数退避）
  - 500：服务端错误，提示稍后重试
  - timeout：请求超时，建议检查网络

7. 非功能性需求
7.1 规范性：TypeScript 严格模式，所有导出类型有完整类型定义
7.2 兼容性：Windows / macOS / Linux 全平台，Node.js >= 16
7.3 稳定性：进程不崩溃，所有错误有友好提示，支持优雅退出
7.4 安全性：高危命令拦截、敏感路径保护、密钥加密存储
7.5 性能：启动 < 200ms，流式输出首 token < 2s
7.6 可扩展性：工具注册表支持插件扩展，未来可接 MCP 协议

8. 项目模块划分
mimo-cli/
├── src/
│   ├── index.ts                  CLI 入口，commander 注册
│   ├── commands/
│   │   ├── chat.ts               交互式对话主循环（含 Agent 模式）
│   │   ├── config.ts             配置管理子命令
│   │   └── models.ts             模型列表子命令
│   ├── core/
│   │   ├── ai.ts                 MiMo API 封装（流式/工具调用）
│   │   ├── context.ts            对话上下文管理（裁剪/压缩/持久化）
│   │   ├── config.ts             配置管理（读写/校验/加密）
│   │   ├── memory.ts             项目记忆系统
│   │   └── permissions.ts        权限管理与安全拦截
│   ├── tools/
│   │   ├── registry.ts           工具注册表
│   │   ├── file.ts               文件读写/编辑/diff
│   │   ├── view.ts               文件查看（支持行范围）
│   │   ├── edit.ts               智能编辑（上下文匹配）
│   │   ├── multi-edit.ts         多文件原子编辑
│   │   ├── exec.ts               终端命令执行
│   │   ├── search.ts             文件搜索（glob/grep）
│   │   ├── git.ts                Git 集成
│   │   └── index.ts              工具统一导出
│   ├── project/
│   │   ├── index.ts              项目索引构建与管理
│   │   └── context.ts            项目上下文注入与智能文件选择
│   ├── agent/
│   │   ├── planner.ts            任务分解
│   │   ├── executor.ts           执行循环
│   │   └── recovery.ts           错误恢复与备份
│   ├── ui/
│   │   ├── prompt.ts             输入区域与斜杠指令
│   │   ├── render.ts             消息渲染（思考块/工具调用/代码块）
│   │   ├── statusbar.ts          顶部/底部状态栏
│   │   ├── taskpanel.ts          右侧任务面板
│   │   └── theme.ts              主题配色
│   └── utils/
│       ├── logger.ts             彩色输出
│       ├── spinner.ts            加载动画
│       └── safety.ts             安全校验

9. 迭代规划
9.1 一期（基础可用）：对话、流式输出、思考块、配置管理、文件读写、基础指令
9.2 二期（开发增强）：工具调用系统、命令执行、代码编辑、diff、权限门控
9.3 三期（项目级）：Git 集成、项目记忆、任务队列、多文件操作、上下文压缩
9.4 四期（智能编辑）：view/edit 工具、上下文匹配、模糊匹配、多文件原子编辑
9.5 五期（项目理解）：项目索引、自动上下文注入、智能文件选择
9.6 六期（Agent 模式）：任务分解、执行循环、错误恢复、备份回滚
9.7 七期（生态完善）：MCP 协议、插件系统、对话导出、worktree 隔离、性能优化
