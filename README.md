# MiMo CLI

一个类似 Claude Code 的终端 AI 编程助手，接入小米 MiMo 大模型。

## 功能特性

- 🤖 接入小米 MiMo 大模型 (`mimo-v2.5-pro`)
- 📁 文件读取、写入和列出
- ⚡ 执行终端命令
- 🔧 Git 操作（状态、提交、差异）
- 💬 多轮对话历史
- 🌊 流式输出
- 🔧 工具调用（Function Calling）

## 安装

```bash
npm install -g mimo-cli
```

## 配置

```bash
mimo config --api-key <your-api-key>
mimo config --base-url https://token-plan-cn.xiaomimimo.com/v1
mimo config --model mimo-v2.5-pro
```

## 使用

### 交互式模式

```bash
mimo chat
```

### 命令列表

- `/help` - 显示帮助
- `/clear` - 清空对话历史
- `/tools` - 显示可用工具
- `/quit` - 退出程序

### 可用工具

| 工具名 | 功能 |
|--------|------|
| `read_file` | 读取文件内容 |
| `write_file` | 写入文件内容 |
| `list_files` | 列出目录中的文件 |
| `execute_command` | 执行终端命令 |
| `git_status` | 获取 Git 仓库状态 |
| `git_commit` | 创建 Git 提交 |
| `git_diff` | 查看 Git 差异 |

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev chat

# 构建
npm run build

# 测试
npm test
```

## 技术栈

- Node.js 18+
- TypeScript
- Commander.js
- OpenAI SDK
- Simple-Git
- Chalk
- Ora

## 许可证

MIT
