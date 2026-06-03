// Plugin 系统 - 动态工具注册和外部工具加载

import fs from 'fs/promises'
import path from 'path'
import type { ToolDefinition, ToolResult } from './types.js'

export interface PluginManifest {
  name: string
  version: string
  description: string
  tools: PluginToolDef[]
}

export interface PluginToolDef {
  name: string
  description: string
  input_schema: Record<string, any>
  handler: string // 相对于插件目录的 JS 文件路径
  requiresApproval?: boolean
}

export interface PluginConfig {
  pluginDir: string
  enabledPlugins: string[]
}

const DEFAULT_PLUGIN_CONFIG: PluginConfig = {
  pluginDir: '',
  enabledPlugins: [],
}

export class PluginManager {
  private plugins: Map<string, PluginManifest> = new Map()
  private tools: Map<string, ToolDefinition> = new Map()
  private config: PluginConfig

  constructor(config: Partial<PluginConfig> = {}) {
    this.config = { ...DEFAULT_PLUGIN_CONFIG, ...config }
  }

  /** 加载插件目录 */
  async loadPlugins(): Promise<void> {
    if (!this.config.pluginDir) return

    try {
      const entries = await fs.readdir(this.config.pluginDir, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        if (this.config.enabledPlugins.length > 0 &&
            !this.config.enabledPlugins.includes(entry.name)) continue

        const manifestPath = path.join(this.config.pluginDir, entry.name, 'manifest.json')
        try {
          const raw = await fs.readFile(manifestPath, 'utf-8')
          const manifest: PluginManifest = JSON.parse(raw)
          this.plugins.set(manifest.name, manifest)

          // 加载工具
          for (const toolDef of manifest.tools) {
            const handlerPath = path.join(this.config.pluginDir, entry.name, toolDef.handler)
            const tool = this.createToolFromPlugin(toolDef, handlerPath, manifest.name)
            this.tools.set(tool.name, tool)
          }
        } catch {
          // 插件加载失败，跳过
        }
      }
    } catch {
      // 插件目录不存在
    }
  }

  /** 从插件定义创建工具 */
  private createToolFromPlugin(
    def: PluginToolDef,
    handlerPath: string,
    pluginName: string
  ): ToolDefinition {
    return {
      name: def.name,
      description: `[Plugin: ${pluginName}] ${def.description}`,
      input_schema: def.input_schema,
      requiresApproval: def.requiresApproval ?? true,
      async execute(input: Record<string, any>): Promise<ToolResult> {
        try {
          // 动态加载处理器
          const handler = await import(handlerPath)
          if (typeof handler.default === 'function') {
            const result = await handler.default(input)
            return {
              success: true,
              output: typeof result === 'string' ? result : JSON.stringify(result),
            }
          }
          return {
            success: false,
            output: '',
            error: `Plugin handler at ${handlerPath} does not export a default function`,
          }
        } catch (error: any) {
          return {
            success: false,
            output: '',
            error: `Plugin execution failed: ${error.message}`,
          }
        }
      },
    }
  }

  /** 注册自定义工具 (运行时动态注册) */
  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool)
  }

  /** 获取所有插件工具 */
  getPluginTools(): ToolDefinition[] {
    return Array.from(this.tools.values())
  }

  /** 获取插件列表 */
  getLoadedPlugins(): PluginManifest[] {
    return Array.from(this.plugins.values())
  }

  /** 移除插件 */
  unloadPlugin(name: string): boolean {
    const manifest = this.plugins.get(name)
    if (!manifest) return false

    for (const toolDef of manifest.tools) {
      this.tools.delete(toolDef.name)
    }
    this.plugins.delete(name)
    return true
  }
}
