import { ToolDefinition, ToolHandler, ToolResult, ToolMetadata } from './types.js';

export class ToolRegistry {
  private tools: Map<string, { definition: ToolDefinition; handler: ToolHandler; metadata: ToolMetadata }> = new Map();

  register(definition: ToolDefinition, handler: ToolHandler, metadata?: ToolMetadata): void {
    const defaultMeta: ToolMetadata = { readOnly: false, cost: 'medium', maxOutputLength: 8000 };
    this.tools.set(definition.function.name, { definition, handler, metadata: metadata || defaultMeta });
  }

  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => t.definition);
  }

  async execute(name: string, args: Record<string, any>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) return { success: false, output: '', error: `工具未找到: ${name}` };

    try {
      const result = await tool.handler(args);

      // Smart output truncation based on tool metadata
      if (result.output && result.output.length > tool.metadata.maxOutputLength) {
        const maxLen = tool.metadata.maxOutputLength;
        // For read-only tools, keep head + tail (first and last lines are most useful)
        if (tool.metadata.readOnly) {
          const lines = result.output.split('\n');
          if (lines.length > 50) {
            const head = lines.slice(0, 25).join('\n');
            const tail = lines.slice(-25).join('\n');
            result.output = head + '\n... [中间省略 ' + (lines.length - 50) + ' 行] ...\n' + tail;
          } else {
            result.output = result.output.slice(0, maxLen) + '\n... (已截断)';
          }
        } else {
          result.output = result.output.slice(0, maxLen) + '\n... (已截断)';
        }
      }

      return result;
    } catch (error) {
      return { success: false, output: '', error: error instanceof Error ? error.message : String(error) };
    }
  }

  has(name: string): boolean { return this.tools.has(name); }
  getToolNames(): string[] { return Array.from(this.tools.keys()); }
  getMetadata(name: string): ToolMetadata | undefined {
    return this.tools.get(name)?.metadata;
  }
}
