# MiMo CLI v2.0

一个 Claude Code 风格的终端 AI 编程助手，接入小米 MiMo 大模型。

## ✨ 功能特性

### 🎨 Claude Code 风格 UI
- **ink + React** 组件化终端渲染
- 流式 Markdown 实时渲染（代码高亮、标题、列表、链接）
- 左侧竖线标记 Assistant 回复
- 工具调用折叠展示（图标 + 状态）
- diff 彩色预览（红/绿/青）
- 文件编辑确认对话框
- 思考中动画指示器
- 底部状态栏（模型/token/项目类型）

### 🤖 AI 能力
- 接入小米 MiMo 大模型 (`mimo-v2.5-pro`)
- **流式输出** — AI 回复逐字显示
- **Agent Loop** — AI 自主规划并执行多步骤任务（事件驱动架构）
- **上下文管理** — 智能 token 计数与裁剪 + /compact 压缩
- 多轮对话历史

### 🔧 工具系统（15 个工具）
| 工具 | 功能 | 权限 |
|------|------|------|
| `read_file` | 读取文件（支持行号范围） | ● 安全 |
| `write_file` | 写入文件 | ● 需确认 |
| `edit_file` | 精确替换文件内容 | ● 需确认 |
| `search_files` | 搜索文件内容（正则） | ● 安全 |
| `list_files` | 列出目录文件（支持递归） | ● 安全 |
| `execute_command` | 执行终端命令 | ● 需确认 |
| `git_status` | Git 仓库状态 | ● 安全 |
| `git_commit` | 创建 Git 提交 | ● 需确认 |
| `git_diff` | 查看 Git 差异 | ● 安全 |
| `git_log` | 查看提交历史 | ● 安全 |
| `git_branch` | 分支管理 | ● 需确认 |
| `git_stage` | 暂存文件 | ● 需确认 |

### ⌨️ 输入增强
- **多行输入** — Shift+Enter 换行，Enter 发送
- **↑/↓ 箭头** — 浏览历史输入
- **Tab** — 命令补全
- **Escape** — 取消当前输入
- **Ctrl+C** — 中断当前任务 / 双击退出

### 📂 项目感知
- 自动检测项目类型（Node.js/Python/Rust/Go/Java）
- 自动注入项目上下文到 AI prompt

### 💾 对话持久化
- 退出时自动保存会话
- 浏览和恢复历史会话
- 导出对话为 Markdown

## 安装

```bash
npm install -g mimo-cli
```

## 配置

```bash
# 设置 API Key
mimo config --api-key <your-api-key>

# 设置模型
mimo config --model mimo-v2.5-pro

# 设置自动批准的工具
mimo config --auto-approve read_file list_files git_status
```

## 使用

### 交互式模式
```bash
mimo chat
```

### 命令列表
| 命令 | 功能 |
|------|------|
| `/help` | 显示帮助 |
| `/clear` | 清空对话历史 |
| `/compact` | 压缩上下文 |
| `/tools` | 显示可用工具 |
| `/sessions` | 列出历史会话 |
| `/resume <id>` | 恢复历史会话 |
| `/model [name]` | 查看/切换模型 |
| `/export` | 导出对话为 Markdown |
| `/quit` | 退出程序 |

## 开发

```bash
npm install
npm run dev chat    # 开发模式
npm run build       # 编译
npm run lint        # 类型检查
```

## 技术栈

- Node.js 18+ / TypeScript (ESM)
- React 18 + ink 4 (React for CLI)
- OpenAI SDK / Commander.js / Chalk 5
- Simple-Git / diff

## 许可证

MIT
