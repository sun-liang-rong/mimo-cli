# MiMo CLI

基于小米 MiMo 大模型的终端 AI 编程助手，支持交互式对话、代码生成、文件操作、终端命令执行。

## 安装

```bash
npm install -g mimo-cli
```

## 快速开始

### 1. 配置 API Key

```bash
mimo config set apiKey <your-mimo-api-key>
```

### 2. 开始对话

```bash
mimo
```

## 命令一览

| 命令 | 说明 |
|------|------|
| `mimo` | 进入交互式对话模式 |
| `mimo --version` | 查看版本号 |
| `mimo --help` | 查看帮助信息 |
| `mimo config set <key> <value>` | 设置配置项 |
| `mimo config show` | 查看当前配置 |
| `mimo config reset` | 重置所有配置 |
| `mimo chat` | 显式进入对话模式 |

## 交互式对话指令

在对话界面中，可使用以下内置指令：

| 指令 | 说明 |
|------|------|
| `/help` | 显示帮助信息 |
| `/clear` | 清空对话上下文 |
| `/read <文件路径>` | 读取本地代码文件并让 AI 分析 |
| `/write <文件路径>` | 将 AI 生成的代码写入文件 |
| `/run <命令>` | 执行本地终端命令，AI 自动分析结果 |
| `/diff <文件路径>` | 查看文件修改前后的差异 |
| `/quit` | 退出程序 |

## 配置项

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `apiKey` | (必填) | MiMo API 密钥 |
| `baseUrl` | `https://api.mimo.xiaomi.com/v1` | API 接口地址 |
| `model` | `MiMo-7B-RL` | 使用的模型名称 |
| `temperature` | `0.7` | 生成温度 (0-2) |
| `maxTokens` | `4096` | 最大生成长度 |
| `maxContextTokens` | `32000` | 上下文窗口大小 |

### 配置示例

```bash
# 设置 API Key
mimo config set apiKey sk-xxxxxxxxxxxx

# 切换模型
mimo config set model MiMo-7B-Chat

# 调整温度
mimo config set temperature 0.3

# 自定义 API 地址（兼容 OpenAI 协议的第三方服务）
mimo config set baseUrl https://your-api.com/v1

# 查看所有配置
mimo config show

# 重置为默认值
mimo config reset
```

## 使用场景

### 编程问答

```bash
$ mimo
You ▸ 用 TypeScript 实现一个快速排序
MiMo ▸ 以下是快速排序的 TypeScript 实现...
```

### 读取并分析代码

```bash
You ▸ /read ./src/index.ts
# 文件内容被读取并展示，AI 自动分析
```

### 执行命令并分析报错

```bash
You ▸ /run npm test
# 执行测试，如有失败 AI 会分析原因并给出修复建议
```

### 生成代码并写入文件

```bash
You ▸ 帮我写一个 Express 服务器
MiMo ▸ 好的，这是一个基础的 Express 服务器...
You ▸ /write ./server.ts
# AI 生成的代码自动写入文件
```

### 查看代码修改差异

```bash
You ▸ /diff ./server.ts
# 展示文件修改前后的 diff
```

## 安全特性

- **高危命令拦截** — 自动拦截 `rm -rf /`、`format` 等危险命令
- **敏感路径保护** — 禁止访问 `/etc`、`/boot` 等系统目录
- **文件大小限制** — 单文件读取限制 1MB
- **API Key 脱敏** — 配置展示时自动隐藏中间部分

## 开发

```bash
git clone <repo-url>
cd mimo-cli
npm install
npm run build
npm link    # 本地全局可用
```

## 许可证

MIT
