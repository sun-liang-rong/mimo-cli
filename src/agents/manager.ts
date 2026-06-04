// 子代理系统 - 支持 @agent-name 调用专用子代理

import fs from 'fs/promises'
import path from 'path'
import type { Message } from '../api/types.js'
import type { MiMoConfig } from '../api/types.js'
import { MiMoClient } from '../api/client.js'

export interface SubAgentConfig {
  /** 代理名称 */
  name: string
  /** 代理描述 */
  description: string
  /** 使用的模型 (可选，默认使用主模型) */
  model?: string
  /** 系统提示 */
  systemPrompt: string
  /** 允许的工具列表 (可选，默认使用所有工具) */
  tools?: string[]
  /** 最大迭代次数 */
  maxIterations?: number
}

export interface SubAgentResult {
  /** 代理名称 */
  agentName: string
  /** 执行结果 */
  result: string
  /** 是否成功 */
  success: boolean
  /** 错误信息 (如果失败) */
  error?: string
  /** 使用的 token 数 */
  tokensUsed?: number
}

const DEFAULT_AGENTS_DIR = '.mimo/agents'

/**
 * 加载子代理配置
 */
export async function loadSubAgents(workingDir: string = process.cwd()): Promise<SubAgentConfig[]> {
  const agentsDir = path.join(workingDir, DEFAULT_AGENTS_DIR)
  const agents: SubAgentConfig[] = []
  
  try {
    const files = await fs.readdir(agentsDir)
    
    for (const file of files) {
      if (!file.endsWith('.md') && !file.endsWith('.json')) continue
      
      try {
        const content = await fs.readFile(path.join(agentsDir, file), 'utf-8')
        
        if (file.endsWith('.json')) {
          // JSON 格式
          const config = JSON.parse(content) as SubAgentConfig
          agents.push(config)
        } else {
          // Markdown 格式 - 解析 frontmatter
          const config = parseAgentMarkdown(content, file.replace(/\.(md|json)$/, ''))
          if (config) {
            agents.push(config)
          }
        }
      } catch (error) {
        console.error(`Failed to load agent ${file}:`, error)
      }
    }
  } catch {
    // 目录不存在，返回空数组
  }
  
  return agents
}

/**
 * 解析 Markdown 格式的代理配置
 */
function parseAgentMarkdown(content: string, fallbackName: string): SubAgentConfig | null {
  // 简单的 frontmatter 解析
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  
  if (!frontmatterMatch) {
    // 没有 frontmatter，整个内容作为系统提示
    return {
      name: fallbackName,
      description: `Agent: ${fallbackName}`,
      systemPrompt: content.trim(),
    }
  }
  
  const frontmatter = frontmatterMatch[1]
  const systemPrompt = frontmatterMatch[2].trim()
  
  // 解析 frontmatter 字段
  const config: SubAgentConfig = {
    name: fallbackName,
    description: '',
    systemPrompt,
  }
  
  const nameMatch = frontmatter.match(/name:\s*(.+)/)
  if (nameMatch) config.name = nameMatch[1].trim()
  
  const descMatch = frontmatter.match(/description:\s*(.+)/)
  if (descMatch) config.description = descMatch[1].trim()
  
  const modelMatch = frontmatter.match(/model:\s*(.+)/)
  if (modelMatch) config.model = modelMatch[1].trim()
  
  const toolsMatch = frontmatter.match(/tools:\s*\[([^\]]+)\]/)
  if (toolsMatch) {
    config.tools = toolsMatch[1].split(',').map(t => t.trim().replace(/['"]/g, ''))
  }
  
  const maxIterMatch = frontmatter.match(/maxIterations:\s*(\d+)/)
  if (maxIterMatch) config.maxIterations = parseInt(maxIterMatch[1])
  
  return config
}

/**
 * 获取所有可用的子代理名称
 */
export function getSubAgentNames(agents: SubAgentConfig[]): string[] {
  return agents.map(a => a.name)
}

/**
 * 查找子代理
 */
export function findSubAgent(agents: SubAgentConfig[], name: string): SubAgentConfig | undefined {
  return agents.find(a => a.name === name || a.name.toLowerCase() === name.toLowerCase())
}

/**
 * 执行子代理
 */
export async function executeSubAgent(
  agent: SubAgentConfig,
  userMessage: string,
  config: MiMoConfig,
  context?: string
): Promise<SubAgentResult> {
  try {
    // 创建客户端
    const clientConfig: Partial<MiMoConfig> = {
      ...config,
      model: agent.model || config.model,
    }
    const client = new MiMoClient(clientConfig)
    
    // 构建系统提示
    let systemPrompt = agent.systemPrompt
    if (context) {
      systemPrompt += `\n\nContext:\n${context}`
    }
    
    // 构建消息
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ]
    
    // 执行对话
    let result = ''
    const maxIterations = agent.maxIterations || 10
    
    for (let i = 0; i < maxIterations; i++) {
      const events: Array<{ type: string; content?: string; error?: string }> = []
      
      for await (const event of client.streamChat(messages)) {
        events.push(event)
      }
      
      // 处理事件
      let assistantContent = ''
      let hasToolCalls = false
      
      for (const event of events) {
        if (event.type === 'text') {
          assistantContent += event.content
        } else if (event.type === 'tool_call') {
          hasToolCalls = true
          // 子代理不执行工具调用，只返回文本
        } else if (event.type === 'error') {
          return {
            agentName: agent.name,
            result: '',
            success: false,
            error: event.error,
          }
        }
      }
      
      result += assistantContent
      
      // 如果没有工具调用，完成
      if (!hasToolCalls) {
        break
      }
      
      // 添加助手消息到历史
      messages.push({ role: 'assistant', content: assistantContent })
      
      // 由于子代理不执行工具，添加一个提示
      messages.push({
        role: 'user',
        content: 'Please provide your response without using tools. Focus on analysis and recommendations.',
      })
    }
    
    return {
      agentName: agent.name,
      result,
      success: true,
    }
  } catch (error: any) {
    return {
      agentName: agent.name,
      result: '',
      success: false,
      error: error.message,
    }
  }
}

/**
 * 创建默认子代理配置示例
 */
export function createDefaultAgentExample(): string {
  return `---
name: code-reviewer
description: Reviews code for bugs, security issues, and best practices
model: MiMo-7B-RL
tools: [Read, Glob, Grep]
maxIterations: 5
---

You are a senior code reviewer. Review code for:
- Bugs and logic errors
- Security vulnerabilities
- Performance issues
- Code style and best practices

Provide specific, actionable feedback with line numbers.
`
}
