// 工具注册表 - 管理所有可用工具

import type { ToolDefinition } from './types.js'
import { readTool } from './read.js'
import { writeTool } from './write.js'
import { editTool } from './edit.js'
import { bashTool } from './bash.js'
import { globTool } from './glob.js'
import { grepTool } from './grep.js'
import { gitTool } from './git.js'
import { webSearchTool } from './web-search.js'
import { webFetchTool } from './web-fetch.js'
import { McpClient, loadMcpConfig } from '../mcp/client.js'
import { loadPluginTools } from './plugin.js'

// 所有内置工具
const BUILTIN_TOOLS: ToolDefinition[] = [
  readTool,
  writeTool,
  editTool,
  bashTool,
  globTool,
  grepTool,
  gitTool,
  webSearchTool,
  webFetchTool,
]

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map()
  private allowedTools: Set<string> | null = null
  private mcpClient: McpClient | null = null
  private initialized = false

  constructor(allowedTools?: string[]) {
    for (const tool of BUILTIN_TOOLS) {
      this.tools.set(tool.name, tool)
    }
    
    // 如果指定了允许的工具列表
    if (allowedTools && allowedTools.length > 0) {
      this.allowedTools = new Set(allowedTools)
    }
  }

  /**
   * 异步初始化：加载 MCP 工具和插件工具
   * 构造函数保持同步，需要在创建后手动调用此方法
   */
  async initialize(): Promise<void> {
    if (this.initialized) return
    this.initialized = true

    await this.initMcpTools()
    await this.initPluginTools()
  }

  /**
   * 初始化 MCP 工具
   * 从 .mimo/mcp.json 加载配置，连接 MCP 服务器，注册工具
   */
  private async initMcpTools(): Promise<void> {
    try {
      const serverConfigs = await loadMcpConfig()
      if (serverConfigs.length === 0) return

      this.mcpClient = new McpClient()

      for (const config of serverConfigs) {
        this.mcpClient.registerServer(config)
        const connected = await this.mcpClient.connectServer(config.name)
        if (!connected) {
          console.error(`Failed to connect to MCP server: ${config.name}`)
        }
      }

      // 获取所有 MCP 工具并注册到 tools map
      const mcpTools = this.mcpClient.getToolDefinitions()
      for (const tool of mcpTools) {
        this.tools.set(tool.name, tool)
      }

      if (mcpTools.length > 0) {
        console.log(`Loaded ${mcpTools.length} MCP tools from ${serverConfigs.length} server(s)`)
      }
    } catch (error: any) {
      console.error(`Failed to initialize MCP tools: ${error.message}`)
    }
  }

  /**
   * 初始化插件工具
   * 从 .mimo/tools/ 目录扫描 .json 文件，每个文件定义一个工具
   */
  private async initPluginTools(): Promise<void> {
    try {
      const pluginTools = await loadPluginTools()
      for (const tool of pluginTools) {
        this.tools.set(tool.name, tool)
      }

      if (pluginTools.length > 0) {
        console.log(`Loaded ${pluginTools.length} plugin tools`)
      }
    } catch (error: any) {
      console.error(`Failed to initialize plugin tools: ${error.message}`)
    }
  }

  /**
   * 获取 MCP 客户端（用于外部访问）
   */
  getMcpClient(): McpClient | null {
    return this.mcpClient
  }

  /**
   * 获取所有工具定义（用于发送给 API）
   */
  getToolDefinitions(): Array<{
    type: 'function'
    function: {
      name: string
      description: string
      parameters: Record<string, any>
    }
  }> {
    const tools = Array.from(this.tools.values())
    
    // 如果有白名单，过滤工具
    const filteredTools = this.allowedTools
      ? tools.filter(t => this.allowedTools!.has(t.name))
      : tools
    
    return filteredTools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    }))
  }

  /**
   * 根据名称获取工具
   */
  getTool(name: string): ToolDefinition | undefined {
    const tool = this.tools.get(name)
    
    // 检查白名单
    if (tool && this.allowedTools && !this.allowedTools.has(name)) {
      return undefined
    }
    
    return tool
  }

  /**
   * 执行工具
   */
  async executeTool(
    name: string,
    input: Record<string, any>
  ): Promise<{ success: boolean; output: string; error?: string }> {
    const tool = this.getTool(name)
    if (!tool) {
      return {
        success: false,
        output: '',
        error: `Unknown tool: ${name}${this.allowedTools ? ' (not in allowed list)' : ''}`,
      }
    }
    return tool.execute(input)
  }

  /**
   * 检查工具是否需要审批
   */
  requiresApproval(name: string): boolean {
    const tool = this.tools.get(name)
    return tool?.requiresApproval ?? true
  }

  /**
   * 获取所有工具名称
   */
  getToolNames(): string[] {
    const tools = Array.from(this.tools.keys())
    return this.allowedTools
      ? tools.filter(n => this.allowedTools!.has(n))
      : tools
  }

  /**
   * 检查工具是否被允许
   */
  isToolAllowed(name: string): boolean {
    if (!this.allowedTools) return true
    return this.allowedTools.has(name)
  }

  /**
   * 获取允许的工具列表
   */
  getAllowedTools(): string[] | null {
    return this.allowedTools ? Array.from(this.allowedTools) : null
  }

  /**
   * 断开所有 MCP 服务器连接
   */
  async disconnect(): Promise<void> {
    if (this.mcpClient) {
      await this.mcpClient.disconnectAll()
    }
  }
}

export type { ToolDefinition, ToolResult } from './types.js'
