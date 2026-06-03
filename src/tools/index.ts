// 工具注册表 - 管理所有可用工具

import type { ToolDefinition } from './types.js'
import { readTool } from './read.js'
import { writeTool } from './write.js'
import { editTool } from './edit.js'
import { bashTool } from './bash.js'
import { globTool } from './glob.js'
import { grepTool } from './grep.js'
import { gitTool } from './git.js'

// 所有内置工具
const BUILTIN_TOOLS: ToolDefinition[] = [
  readTool,
  writeTool,
  editTool,
  bashTool,
  globTool,
  grepTool,
  gitTool,
]

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map()

  constructor() {
    for (const tool of BUILTIN_TOOLS) {
      this.tools.set(tool.name, tool)
    }
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
    return Array.from(this.tools.values()).map((tool) => ({
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
    return this.tools.get(name)
  }

  /**
   * 执行工具
   */
  async executeTool(
    name: string,
    input: Record<string, any>
  ): Promise<{ success: boolean; output: string; error?: string }> {
    const tool = this.tools.get(name)
    if (!tool) {
      return {
        success: false,
        output: '',
        error: `Unknown tool: ${name}`,
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
    return Array.from(this.tools.keys())
  }
}

export type { ToolDefinition, ToolResult } from './types.js'
