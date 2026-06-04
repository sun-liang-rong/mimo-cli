#!/usr/bin/env node

// MiMo CLI - 终端 AI 编程助手
// 类似 Claude Code，接入小米 MiMo 大模型

import fs from 'fs'
if (process.env.DEBUG) {
  fs.appendFileSync('mimo-debug.log', `[${new Date().toISOString()}] MiMo CLI started, DEBUG=${process.env.DEBUG}\n`)
}

import { program } from 'commander'
import React from 'react'
import { render } from 'ink'
import { App } from './tui/App.js'
import { Setup } from './tui/Setup.js'
import {
  loadConfig,
  saveConfig,
  isConfigComplete,
  getConfigPath,
} from './config/store.js'
import type { Config } from './config/store.js'

program
  .name('mimo')
  .description('AI coding assistant powered by MiMo')
  .version('0.1.0')
  .option('-k, --api-key <key>', 'MiMo API key (or set MIMO_API_KEY env)')
  .option('-u, --base-url <url>', 'API base URL (or set MIMO_BASE_URL env)')
  .option('-m, --model <model>', 'Model name (or set MIMO_MODEL env)')
  .option('-p, --print <prompt>', 'Single-shot mode: print response and exit')
  .option('--setup', 'Re-run setup wizard')
  .action(async (options) => {
    // 加载已有配置（文件 + 环境变量）
    let config = await loadConfig()

    // 命令行参数覆盖
    if (options.apiKey) config.apiKey = options.apiKey
    if (options.baseUrl) config.baseURL = options.baseUrl
    if (options.model) config.model = options.model

    // 如果指定了 --setup 或配置不完整，进入配置引导
    if (options.setup || !isConfigComplete(config)) {
      config = await runSetup(config)
    }

    // Headless 模式 (单次输出)
    if (options.print) {
      await runHeadless(config, options.print)
      return
    }

    // 交互式 REPL 模式 - 启用备用屏幕缓冲区，避免终端滚动历史累积
    process.stdout.write('\x1b[?1049h')
    process.on('exit', () => {
      process.stdout.write('\x1b[?1049l')
    })
    const app = render(React.createElement(App, { config }))

    app.waitUntilExit().then(() => {
      process.stdout.write('\x1b[?1049l')
      process.exit(0)
    })
  })

/**
 * 运行配置引导
 */
async function runSetup(initialConfig: Config): Promise<Config> {
  return new Promise<Config>((resolve, reject) => {
    const app = render(
      React.createElement(Setup, {
        initialConfig,
        onComplete: async (config: Config) => {
          // 保存配置
          await saveConfig(config)
          app.unmount()
          // 打印成功信息
          console.log(`\n✅ 配置已保存到 ${getConfigPath()}\n`)
          resolve(config)
        },
        onCancel: () => {
          app.unmount()
          console.log('\n已取消配置。')
          process.exit(0)
        },
      })
    )
  })
}

/**
 * Headless 模式 - 单次输出
 */
async function runHeadless(config: Config, prompt: string) {
  const { AgentLoop } = await import('./agent/loop.js')

  try {
    const systemPrompt = `You are MiMo CLI, an AI coding assistant. Be concise and direct.`
    const agent = new AgentLoop(config, systemPrompt)

    await agent.sendMessage(prompt, [], {
      onText: (text: string) => {
        process.stdout.write(text)
      },
      onToolCall: (_toolCall, _args) => {},
      onToolResult: (_id, _name, _result, _success) => {},
      onError: (error: string) => {
        process.stderr.write(`Error: ${error}\n`)
      },
      onDone: () => {},
      onThinking: () => {},
      requestApproval: async () => false,
    })

    process.stdout.write('\n')
  } catch (error: any) {
    process.stderr.write(`Error: ${error.message}\n`)
    process.exit(1)
  }
}

// 解析命令行参数
program.parse()
