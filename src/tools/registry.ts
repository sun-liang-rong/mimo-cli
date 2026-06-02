/**
 * 工具注册表 — 定义所有 AI 可调用的工具
 * 兼容 OpenAI function calling 格式
 */

export type ToolPermission = 'read' | 'write' | 'dangerous';

export interface ToolDefinition {
  name: string;
  description: string;
  permission: ToolPermission;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export type ToolHandler = (args: Record<string, unknown>) => ToolResult | Promise<ToolResult>;

interface RegisteredTool {
  definition: ToolDefinition;
  handler: ToolHandler;
}

class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();

  register(definition: ToolDefinition, handler: ToolHandler): void {
    this.tools.set(definition.name, { definition, handler });
  }

  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  getAll(): RegisteredTool[] {
    return Array.from(this.tools.values());
  }

  /** 获取所有工具定义（用于 API 调用的 tools 参数） */
  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  /** 执行工具调用 */
  async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, output: '', error: `未知工具: ${name}` };
    }
    try {
      return await tool.handler(args);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, output: '', error: `工具执行异常: ${msg}` };
    }
  }
}

export const toolRegistry = new ToolRegistry();
