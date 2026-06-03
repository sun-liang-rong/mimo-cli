# MiMo CLI 🤖

终端 AI 编程助手，接入小米 MiMo 大模型，灵感来自 Claude Code。

## 功能特性

- 🗣️ **交互式对话** - 终端中的 AI 编程助手
- 📁 **文件操作** - 读取、写入、编辑文件
- 🔍 **代码搜索** - 正则搜索、文件模式匹配
- ⚡ **命令执行** - 运行 shell 命令
- 🔒 **权限管理** - 危险操作需要确认
- 📝 **Markdown 渲染** - 代码语法高亮
- 🔄 **流式输出** - 实时显示 AI 回复

## 安装

```bash
npm install -g mimo-cli
```

## 使用

### 首次运行 - 配置引导

首次运行 `mimo` 时，如果没有配置 API Key，会自动进入配置引导：

```bash
mimo
# 如果未配置，会显示：
# 🚀 MiMo CLI 初始配置
# 首次运行需要配置 API 信息，配置将保存到 ~/.mimo/config.json
# ▶ API Key: 输入你的 MiMo API Key
# ▶ API Base URL: https://api.xiaomimimo.com/v1
# ▶ Model Name: MiMo-7B-RL
```

配置会自动保存到 `~/.mimo/config.json`。

### 交互模式

```bash
mimo
```

### 单次模式

```bash
mimo -p "帮我写一个 Hello World"
```

### 重新配置

```bash
mimo --setup
```

### 配置方式（优先级从高到低）

1. **命令行参数**（最高优先级）：
   ```bash
   mimo --api-key YOUR_KEY --base-url URL --model MODEL
   ```

2. **环境变量**：
   ```bash
   export MIMO_API_KEY="your-api-key"
   export MIMO_BASE_URL="https://api.mimo.ai/v1"
   export MIMO_MODEL="MiMo-7B-RL"
   ```

3. **配置文件** `~/.mimo/config.json`（最低优先级）：
   ```json
   {
     "apiKey": "your-api-key",
     "baseURL": "https://api.xiaomimimo.com/v1",
     "model": "MiMo-7B-RL"
   }
   ```

## 内置工具

| 工具 | 功能 | 需要审批 |
|------|------|----------|
| Read | 读取文件 | ❌ |
| Write | 写入文件 | ✅ |
| Edit | 编辑文件 | ✅ |
| Bash | 执行命令 | ✅ |
| Glob | 文件搜索 | ❌ |
| Grep | 内容搜索 | ❌ |

## 开发

```bash
# 安装依赖
npm install

# 开发模式运行
npm run dev

# 编译
npm run build
```

## License

MIT
