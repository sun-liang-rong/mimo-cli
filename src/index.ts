#!/usr/bin/env node

// MiMo CLI - 终端 AI 编程助手
// 类似 Claude Code，接入小米 MiMo 大模型

import { program } from 'commander'
import React from 'react'
import { render } from 'ink'
import { logger } from './utils/logger.js'
import { App } from './tui/App.js'
import { Setup } from './tui/Setup.js'
import {
  loadConfig,
  saveConfig,
  isConfigComplete,
  getConfigPath,
} from './config/store.js'
import type { Config } from './config/store.js'
import { loadProjectContext } from './context/project.js'
import { SessionStore } from './session/store.js'

program
  .name('mimo')
  .description('AI coding assistant powered by MiMo')
  .version('0.1.0')
  .option('-k, --api-key <key>', 'MiMo API key (or set MIMO_API_KEY env)')
  .option('-u, --base-url <url>', 'API base URL (or set MIMO_BASE_URL env)')
  .option('-m, --model <model>', 'Model name (or set MIMO_MODEL env)')
  .option('-p, --print <prompt>', 'Single-shot mode: print response and exit')
  .option('--setup', 'Re-run setup wizard')
  .option('-c, --continue', 'Continue the most recent conversation')
  .option('-r, --resume <id>', 'Resume a specific session by ID')
  .option('--max-turns <n>', 'Maximum agentic loops (print mode only)', parseInt)
  .option('--allowed-tools <tools>', 'Comma-separated list of allowed tools')
  .option('--system-prompt <text>', 'Custom system prompt')
  .option('--append-system-prompt <text>', 'Append to default system prompt')
  .option('--list-agents', 'List available sub-agents and exit')
  .option('--json-schema <schema>', 'Force structured JSON output (print mode only)')
  .option('--output-format <format>', 'Output format: text, json, stream-json', 'text')
  .option('--worktree <name>', 'Run in an isolated git worktree')
  .option('--list-worktrees', 'List git worktrees and exit')
  .option('--voice', 'Enable voice input mode')
  .option('--check-voice', 'Check voice tools availability')
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

    // 加载项目上下文
    const projectContext = await loadProjectContext()

    // 检查语音工具
    if (options.checkVoice) {
      await checkVoiceTools()
      return
    }

    // 列出子代理
    if (options.listAgents) {
      await listSubAgents()
      return
    }

    // 列出工作树
    if (options.listWorktrees) {
      await listWorktrees()
      return
    }

    // Git Worktree 模式
    if (options.worktree) {
      await runWithWorktree(config, options.worktree, projectContext.fullContext)
      return
    }

    // Headless 模式 (单次输出)
    if (options.print) {
      await runHeadless(config, options.print, {
        maxTurns: options.maxTurns,
        allowedTools: options.allowedTools?.split(','),
        systemPrompt: options.systemPrompt,
        appendSystemPrompt: options.appendSystemPrompt,
        projectContext: projectContext.fullContext,
        jsonSchema: options.jsonSchema,
        outputFormat: options.outputFormat,
      })
      return
    }

    // 会话恢复模式
    if (options.continue || options.resume) {
      await runSessionResume(config, {
        continueLast: options.continue,
        sessionId: options.resume,
        projectContext: projectContext.fullContext,
      })
      return
    }

    // 交互式 REPL 模式 - 启用备用屏幕缓冲区，避免终端滚动历史累积
    process.stdout.write('\x1b[?1049h')
    process.on('exit', () => {
      process.stdout.write('\x1b[?1049l')
    })
    const app = render(React.createElement(App, { 
      config,
      projectContext: projectContext.fullContext,
    }))

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
          await saveConfig(config)
          app.unmount()
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
async function runHeadless(
  config: Config,
  prompt: string,
  options: {
    maxTurns?: number
    allowedTools?: string[]
    systemPrompt?: string
    appendSystemPrompt?: string
    projectContext?: string
    jsonSchema?: string
    outputFormat?: string
  }
) {
  const { AgentLoop } = await import('./agent/loop.js')
  const { formatStructuredOutput, generateJsonOutput } = await import('./output/structured.js')

  try {
    let systemPrompt = options.systemPrompt || 
      `You are MiMo CLI, an AI coding assistant. Be concise and direct.`
    
    if (options.appendSystemPrompt) {
      systemPrompt += '\n\n' + options.appendSystemPrompt
    }
    
    if (options.projectContext) {
      systemPrompt += '\n\n' + options.projectContext
    }

    // 如果指定了 JSON Schema，添加到系统提示
    if (options.jsonSchema) {
      systemPrompt += `\n\nYou MUST respond with valid JSON that matches this schema:\n${options.jsonSchema}`
    }

    const agent = new AgentLoop(config, systemPrompt, {
      maxIterations: options.maxTurns || 50,
      allowedTools: options.allowedTools,
    })

    const messages: any[] = []

    await agent.sendMessage(prompt, [], {
      onText: (text: string) => {
        if (options.outputFormat !== 'json') {
          process.stdout.write(text)
        }
      },
      onToolCall: (_toolCall, _args) => {},
      onToolResult: (_id, _name, _result, _success) => {},
      onError: (error: string) => {
        process.stderr.write(`Error: ${error}\n`)
      },
      onDone: (msg) => {
        messages.push(msg)
      },
      onThinking: () => {},
      requestApproval: async () => false,
    })

    // 结构化输出
    if (options.outputFormat === 'json' && options.jsonSchema) {
      const schema = JSON.parse(options.jsonSchema)
      const result = formatStructuredOutput(messages, {
        schema,
        format: 'json',
      })
      console.log(generateJsonOutput(result))
    } else {
      process.stdout.write('\n')
    }
  } catch (error: any) {
    process.stderr.write(`Error: ${error.message}\n`)
    process.exit(1)
  }
}

/**
 * 会话恢复模式
 */
async function runSessionResume(
  config: Config,
  options: {
    continueLast?: boolean
    sessionId?: string
    projectContext?: string
  }
) {
  const store = new SessionStore()
  
  let session = null
  if (options.continueLast) {
    session = await store.getLatest()
  } else if (options.sessionId) {
    session = await store.load(options.sessionId)
    if (!session) {
      const sessions = await store.list()
      session = sessions.find(s => s.id.startsWith(options.sessionId!)) || null
    }
  }

  if (!session) {
    console.error('❌ No session found to resume.')
    process.exit(1)
  }

  console.log(`📂 Resuming session: ${session.id}`)
  console.log(`   Model: ${session.model}`)
  console.log(`   Messages: ${session.messages.length}`)
  console.log('')

  process.stdout.write('\x1b[?1049h')
  process.on('exit', () => {
    process.stdout.write('\x1b[?1049l')
  })
  
  const app = render(React.createElement(App, { 
    config,
    projectContext: options.projectContext,
    initialSession: session,
  }))

  app.waitUntilExit().then(() => {
    process.stdout.write('\x1b[?1049l')
    process.exit(0)
  })
}

/**
 * 列出子代理
 */
async function listSubAgents() {
  const { loadSubAgents } = await import('./agents/manager.js')
  
  try {
    const agents = await loadSubAgents()
    
    if (agents.length === 0) {
      console.log('📭 No sub-agents found.')
      console.log('')
      console.log('Create agents in .mimo/agents/ directory.')
      console.log('')
      console.log('Example (.mimo/agents/code-reviewer.md):')
      console.log('---')
      console.log('name: code-reviewer')
      console.log('description: Reviews code for bugs and best practices')
      console.log('---')
      console.log('You are a senior code reviewer...')
      return
    }

    console.log('🤖 Available Sub-Agents')
    console.log('─'.repeat(40))
    console.log('')

    for (const agent of agents) {
      console.log(`  @${agent.name}`)
      if (agent.description) {
        console.log(`    ${agent.description}`)
      }
      if (agent.model) {
        console.log(`    Model: ${agent.model}`)
      }
      if (agent.tools) {
        console.log(`    Tools: ${agent.tools.join(', ')}`)
      }
      console.log('')
    }

    console.log('Usage: mimo (interactive) then @agent-name <message>')
  } catch (error: any) {
    console.error(`Failed to load sub-agents: ${error.message}`)
    process.exit(1)
  }
}

/**
 * 列出工作树
 */
async function listWorktrees() {
  const { GitWorktreeManager, formatWorktreeList } = await import('./git/worktree.js')
  
  try {
    const manager = new GitWorktreeManager()
    const isRepo = await manager.isGitRepo()
    
    if (!isRepo) {
      console.log('❌ Not in a Git repository')
      process.exit(1)
    }

    const worktrees = await manager.listWorktrees()
    console.log(formatWorktreeList(worktrees))
  } catch (error: any) {
    console.error(`Failed to list worktrees: ${error.message}`)
    process.exit(1)
  }
}

/**
 * 使用工作树运行
 */
async function runWithWorktree(
  config: Config,
  branch: string,
  projectContext?: string
) {
  const { GitWorktreeManager } = await import('./git/worktree.js')
  
  try {
    const manager = new GitWorktreeManager()
    const isRepo = await manager.isGitRepo()
    
    if (!isRepo) {
      console.log('❌ Not in a Git repository')
      process.exit(1)
    }

    // 创建或获取工作树
    let worktree
    const worktrees = await manager.listWorktrees()
    const existing = worktrees.find(w => w.branch === branch)
    
    if (existing) {
      worktree = existing
      console.log(`🌿 Using existing worktree: ${branch}`)
    } else {
      console.log(`🌿 Creating worktree: ${branch}`)
      worktree = await manager.createWorktree({
        branch,
        createBranch: true,
      })
    }

    console.log(`   Path: ${worktree.path}`)
    console.log('')

    // 在工作树目录中启动
    process.chdir(worktree.path)
    
    process.stdout.write('\x1b[?1049h')
    process.on('exit', () => {
      process.stdout.write('\x1b[?1049l')
    })
    
    const app = render(React.createElement(App, { 
      config,
      projectContext,
    }))

    app.waitUntilExit().then(() => {
      process.stdout.write('\x1b[?1049l')
      process.exit(0)
    })
  } catch (error: any) {
    console.error(`Worktree error: ${error.message}`)
    process.exit(1)
  }
}

/**
 * 检查语音工具
 */
async function checkVoiceTools() {
  const { checkVoiceTools: check, formatVoiceResult } = await import('./voice/recognition.js')
  
  const tools = await check()
  
  console.log('🎤 Voice Tools Status')
  console.log('─'.repeat(40))
  console.log('')
  console.log(`  ffmpeg:  ${tools.ffmpeg ? '✅' : '❌'}`)
  console.log(`  arecord: ${tools.arecord ? '✅' : '❌'}`)
  console.log(`  whisper: ${tools.whisper ? '✅' : '❌'}`)
  console.log('')
  
  if (!tools.whisper) {
    console.log('To install whisper:')
    console.log('  pip install openai-whisper')
  }
  
  if (!tools.arecord && process.platform === 'linux') {
    console.log('To install arecord:')
    console.log('  apt install alsa-utils')
  }
}

// 全局错误处理
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception', { message: error.message, stack: error.stack })
  console.error(`\n❌ Uncaught Exception: ${error.message}`)
  if (process.env.DEBUG) {
    console.error(error.stack)
  }
  process.exit(1)
})

process.on('unhandledRejection', (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason)
  const stack = reason instanceof Error ? reason.stack : undefined
  logger.error('Unhandled rejection', { message, stack })
  console.error(`\n❌ Unhandled Rejection: ${message}`)
  if (process.env.DEBUG && stack) {
    console.error(stack)
  }
  process.exit(1)
})

// 解析命令行参数
program.parse()
