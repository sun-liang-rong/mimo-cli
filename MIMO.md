# MiMo CLI

## 项目概述
MiMo CLI 是一个终端 AI 编程助手，基于小米 MiMo 大模型，类似 Claude Code 的功能和体验。

## 技术栈
- 框架: Ink (React for CLI)
- 语言: TypeScript
- 包管理: npm
- 测试: Vitest

## 常用命令
```bash
# 开发模式
npm run dev

# 运行测试
npm test

# 构建
npm run build

# 运行
npm start
```

## 代码规范
- 缩进: 2 空格
- 命名: camelCase (变量/函数), PascalCase (类/组件)
- 注释: 中文注释，JSDoc 格式
- 类型: 严格 TypeScript，所有公共 API 需要类型定义

## 项目结构
```
src/
├── agent/         # Agent 循环和对话管理
├── api/           # API 客户端和类型
├── config/        # 配置管理
├── context/       # 上下文管理和压缩
├── cost/          # 成本追踪
├── session/       # 会话持久化
├── tools/         # 工具系统
├── tui/           # 终端 UI 组件
│   ├── commands/  # 斜杠命令处理
│   └── ...        # 其他 UI 组件
└── index.ts       # 入口文件
```

## 核心功能
1. **Agent 循环**: 流式对话，工具调用，自动重试
2. **工具系统**: Read, Write, Edit, Bash, Glob, Grep, Git
3. **上下文管理**: Token 计数，智能压缩
4. **会话持久化**: JSON 文件存储，支持恢复
5. **成本追踪**: 实时监控 token 和 API 成本

## 注意事项
- 所有工具调用需要用户审批（Read, Glob, Grep 除外）
- 最大迭代次数限制为 50 次
- 上下文窗口大小为 32K tokens
- 会话最多保留 50 个
