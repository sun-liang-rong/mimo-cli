// 工具系统类型定义

export interface ToolResult {
  success: boolean
  output: string
  error?: string
}

export interface ToolDefinition {
  name: string
  description: string
  input_schema: Record<string, any> // JSON Schema
  execute: (input: Record<string, any>) => Promise<ToolResult>
  requiresApproval: boolean
}
