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
declare class ToolRegistry {
    private tools;
    register(definition: ToolDefinition, handler: ToolHandler): void;
    get(name: string): RegisteredTool | undefined;
    getAll(): RegisteredTool[];
    /** 获取所有工具定义（用于 API 调用的 tools 参数） */
    getDefinitions(): ToolDefinition[];
    /** 执行工具调用 */
    execute(name: string, args: Record<string, unknown>): Promise<ToolResult>;
}
export declare const toolRegistry: ToolRegistry;
export {};
//# sourceMappingURL=registry.d.ts.map