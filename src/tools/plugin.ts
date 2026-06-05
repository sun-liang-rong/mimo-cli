// Plugin 工具加载器 - 从 .mimo/tools/ 目录加载自定义工具

import * as path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import type { ToolDefinition, ToolResult } from './types.js'

const execFileAsync = promisify(execFile)

export interface PluginToolConfig {
  /** 工具名称 */
  name: string
  /** 工具描述 */
  description: string
  /** 输入 JSON Schema */
  input_schema: Record<string, any>
  /** 执行命令 (shell 命令，支持 ${input.xxx} 占位符) */
  command: string
  /** 是否需要审批 */
  requiresApproval?: boolean
}

/**
 * 从 .mimo/tools/ 目录扫描并加载所有 .json 插件工具定义
 */
export async function loadPluginTools(toolsDir?: string): Promise<ToolDefinition[]> {
  const fsMod = await import('fs/promises')
  const defaultDir = path.join(process.cwd(), '.mimo', 'tools')
  const dir = toolsDir || defaultDir

  const tools: ToolDefinition[] = []

  try {
    const entries = await fsMod.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue

      try {
        const filePath = path.join(dir, entry.name)
        const content = await fsMod.readFile(filePath, 'utf-8')
        const config: PluginToolConfig = JSON.parse(content)

        if (!config.name || !config.command) {
          console.error(`Plugin tool ${entry.name}: missing required fields (name, command)`)
          continue
        }

        tools.push(createPluginTool(config))
      } catch (error: any) {
        console.error(`Failed to load plugin tool from ${entry.name}: ${error.message}`)
      }
    }
  } catch {
    // .mimo/tools/ 目录不存在，返回空数组
  }

  return tools
}

/**
 * 从插件配置创建 ToolDefinition
 */
function createPluginTool(config: PluginToolConfig): ToolDefinition {
  return {
    name: config.name,
    description: `[Plugin] ${config.description}`,
    input_schema: config.input_schema || { type: 'object', properties: {} },
    requiresApproval: config.requiresApproval ?? true,
    async execute(input: Record<string, any>): Promise<ToolResult> {
      try {
        // 将 input 注入到命令中：替换 ${input.xxx} 占位符
        let cmd = config.command
        for (const [key, value] of Object.entries(input)) {
          const placeholder = `\${input.${key}}`
          const replacement = typeof value === 'string' ? value : JSON.stringify(value)
          cmd = cmd.split(placeholder).join(escapeShell(replacement))
        }

        const { stdout, stderr } = await execFileAsync('sh', ['-c', cmd], {
          timeout: 30000,
          maxBuffer: 1024 * 1024 * 10,
        })

        return {
          success: true,
          output: (stdout || '') + (stderr ? `\nstderr: ${stderr}` : ''),
        }
      } catch (error: any) {
        return {
          success: false,
          output: error.stdout || '',
          error: `Plugin tool execution failed: ${error.message}`,
        }
      }
    },
  }
}

/**
 * Plugin Manager - manages custom tools registration and loading
 */
export interface PluginManagerConfig {
  pluginDir?: string
  enabledPlugins?: string[]
}

export class PluginManager {
  private tools: Map<string, ToolDefinition> = new Map()
  private loadedPlugins: string[] = []
  private config: PluginManagerConfig

  constructor(config?: PluginManagerConfig) {
    this.config = config || {}
  }

  /** Get all registered plugin tools */
  getPluginTools(): ToolDefinition[] {
    return Array.from(this.tools.values())
  }

  /** Get list of loaded plugin names */
  getLoadedPlugins(): string[] {
    return [...this.loadedPlugins]
  }

  /** Register a custom tool */
  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool)
  }

  /** Unload a loaded plugin by name */
  unloadPlugin(name: string): boolean {
    if (this.loadedPlugins.includes(name)) {
      this.loadedPlugins = this.loadedPlugins.filter(n => n !== name)
      return true
    }
    return false
  }

  /** Load plugins from the configured plugin directory */
  async loadPlugins(): Promise<void> {
    const dir = this.config.pluginDir
    if (!dir) return

    const loaded = await loadPluginTools(dir)
    for (const tool of loaded) {
      this.tools.set(tool.name, tool)
    }
    this.loadedPlugins.push(...loaded.map(t => t.name))
  }
}

/**
 * 简单的 shell 转义
 */
function escapeShell(str: string): string {
  return "'" + str.replace(/'/g, "'\\''") + "'"
}
