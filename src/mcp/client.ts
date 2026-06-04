// MCP (Model Context Protocol) 集成 - 外部工具服务器

import { spawn, ChildProcess } from 'child_process'
import type { ToolDefinition, ToolResult } from '../tools/types.js'

export interface McpServerConfig {
  /** 服务器名称 */
  name: string
  /** 启动命令 */
  command: string
  /** 命令参数 */
  args?: string[]
  /** 环境变量 */
  env?: Record<string, string>
  /** 是否自动启动 */
  autoStart?: boolean
}

export interface McpTool {
  /** 工具名称 (格式: mcp__<server>__<tool>) */
  name: string
  /** 工具描述 */
  description: string
  /** 输入 Schema */
  inputSchema: Record<string, any>
  /** 所属服务器 */
  server: string
}

export interface McpMessage {
  jsonrpc: '2.0'
  id?: number | string
  method?: string
  params?: any
  result?: any
  error?: { code: number; message: string; data?: any }
}

/**
 * MCP 客户端 - 管理与 MCP 服务器的通信
 */
export class McpClient {
  private servers: Map<string, {
    config: McpServerConfig
    process: ChildProcess | null
    tools: McpTool[]
    connected: boolean
    messageId: number
    pendingRequests: Map<number, {
      resolve: (value: any) => void
      reject: (reason: any) => void
    }>
  }> = new Map()

  /**
   * 注册 MCP 服务器
   */
  registerServer(config: McpServerConfig): void {
    this.servers.set(config.name, {
      config,
      process: null,
      tools: [],
      connected: false,
      messageId: 0,
      pendingRequests: new Map(),
    })
  }

  /**
   * 连接到 MCP 服务器
   */
  async connectServer(name: string): Promise<boolean> {
    const server = this.servers.get(name)
    if (!server) {
      throw new Error(`Server not found: ${name}`)
    }

    if (server.connected) {
      return true
    }

    try {
      const child = spawn(server.config.command, server.config.args || [], {
        env: { ...process.env, ...server.config.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      server.process = child

      // 设置消息处理
      let buffer = ''
      child.stdout?.on('data', (data) => {
        buffer += data.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const message = JSON.parse(line) as McpMessage
              this.handleMessage(name, message)
            } catch {
              // 忽略非 JSON 输出
            }
          }
        }
      })

      child.stderr?.on('data', (data) => {
        console.error(`MCP server ${name} stderr: ${data}`)
      })

      child.on('exit', (code) => {
        server.connected = false
        server.process = null
        console.error(`MCP server ${name} exited with code ${code}`)
      })

      // 等待连接
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Connection timeout: ${name}`))
        }, 10000)

        // 发送 initialize 请求
        this.sendRequest(name, 'initialize', {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'mimo-cli',
            version: '0.1.0',
          },
        }).then(() => {
          clearTimeout(timeout)
          server.connected = true
          resolve()
        }).catch((err) => {
          clearTimeout(timeout)
          reject(err)
        })
      })

      // 获取工具列表
      await this.discoverTools(name)

      return true
    } catch (error: any) {
      console.error(`Failed to connect to MCP server ${name}: ${error.message}`)
      return false
    }
  }

  /**
   * 发现服务器提供的工具
   */
  private async discoverTools(name: string): Promise<void> {
    const server = this.servers.get(name)
    if (!server) return

    try {
      const result = await this.sendRequest(name, 'tools/list', {})
      
      if (result && result.tools) {
        server.tools = result.tools.map((tool: any) => ({
          name: `mcp__${name}__${tool.name}`,
          description: tool.description || '',
          inputSchema: tool.inputSchema || {},
          server: name,
        }))
      }
    } catch (error: any) {
      console.error(`Failed to discover tools for ${name}: ${error.message}`)
    }
  }

  /**
   * 发送 JSON-RPC 请求
   */
  private async sendRequest(serverName: string, method: string, params: any): Promise<any> {
    const server = this.servers.get(serverName)
    if (!server || !server.process) {
      throw new Error(`Server not connected: ${serverName}`)
    }

    const id = ++server.messageId
    const message: McpMessage = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    }

    return new Promise((resolve, reject) => {
      server.pendingRequests.set(id, { resolve, reject })

      const timeout = setTimeout(() => {
        server.pendingRequests.delete(id)
        reject(new Error(`Request timeout: ${method}`))
      }, 30000)

      const messageStr = JSON.stringify(message) + '\n'
      server.process!.stdin?.write(messageStr, (err) => {
        if (err) {
          clearTimeout(timeout)
          server.pendingRequests.delete(id)
          reject(err)
        }
      })
    })
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(serverName: string, message: McpMessage): void {
    const server = this.servers.get(serverName)
    if (!server) return

    // 处理响应
    if (message.id !== undefined && (message.result || message.error)) {
      const pending = server.pendingRequests.get(message.id as number)
      if (pending) {
        server.pendingRequests.delete(message.id as number)
        if (message.error) {
          pending.reject(new Error(message.error.message))
        } else {
          pending.resolve(message.result)
        }
      }
    }

    // 处理通知
    if (message.method && message.id === undefined) {
      // 可以在这里处理服务器通知
    }
  }

  /**
   * 调用 MCP 工具
   */
  async callTool(toolName: string, args: Record<string, any>): Promise<ToolResult> {
    // 解析工具名称: mcp__<server>__<tool>
    const match = toolName.match(/^mcp__(\w+)__(.+)$/)
    if (!match) {
      return {
        success: false,
        output: '',
        error: `Invalid MCP tool name: ${toolName}`,
      }
    }

    const [, serverName, actualToolName] = match
    const server = this.servers.get(serverName)

    if (!server) {
      return {
        success: false,
        output: '',
        error: `MCP server not found: ${serverName}`,
      }
    }

    if (!server.connected) {
      // 尝试自动连接
      const connected = await this.connectServer(serverName)
      if (!connected) {
        return {
          success: false,
          output: '',
          error: `Failed to connect to MCP server: ${serverName}`,
        }
      }
    }

    try {
      const result = await this.sendRequest(serverName, 'tools/call', {
        name: actualToolName,
        arguments: args,
      })

      return {
        success: true,
        output: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
      }
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: `MCP tool call failed: ${error.message}`,
      }
    }
  }

  /**
   * 获取所有 MCP 工具定义
   */
  getToolDefinitions(): ToolDefinition[] {
    const tools: ToolDefinition[] = []

    for (const [, server] of this.servers) {
      for (const mcpTool of server.tools) {
        tools.push({
          name: mcpTool.name,
          description: `[MCP:${mcpTool.server}] ${mcpTool.description}`,
          input_schema: mcpTool.inputSchema,
          requiresApproval: true,
          execute: async (input) => this.callTool(mcpTool.name, input),
        })
      }
    }

    return tools
  }

  /**
   * 获取所有已注册的服务器
   */
  getServers(): McpServerConfig[] {
    return Array.from(this.servers.values()).map(s => s.config)
  }

  /**
   * 获取服务器状态
   */
  getServerStatus(name: string): { connected: boolean; tools: number } | null {
    const server = this.servers.get(name)
    if (!server) return null

    return {
      connected: server.connected,
      tools: server.tools.length,
    }
  }

  /**
   * 断开所有服务器
   */
  async disconnectAll(): Promise<void> {
    for (const [name, server] of this.servers) {
      if (server.process) {
        server.process.kill()
        server.process = null
        server.connected = false
      }
    }
  }
}

/**
 * 从配置文件加载 MCP 服务器配置
 */
export async function loadMcpConfig(configPath?: string): Promise<McpServerConfig[]> {
  const fs = await import('fs/promises')
  const path = await import('path')

  const defaultPath = path.join(process.cwd(), '.mimo', 'mcp.json')
  const filePath = configPath || defaultPath

  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const config = JSON.parse(content)

    if (config.servers && Array.isArray(config.servers)) {
      return config.servers
    }

    return []
  } catch {
    return []
  }
}

/**
 * 创建默认 MCP 配置示例
 */
export function createMcpConfigExample(): string {
  return JSON.stringify({
    servers: [
      {
        name: 'github',
        command: 'npx',
        args: ['@modelcontextprotocol/server-github'],
        env: {
          GITHUB_TOKEN: 'your-token-here',
        },
      },
      {
        name: 'postgres',
        command: 'npx',
        args: ['@modelcontextprotocol/server-postgres', 'postgresql://localhost/mydb'],
      },
    ],
  }, null, 2)
}
