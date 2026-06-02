import { ToolCall } from '../core/context';
import { ToolResult } from '../tools/registry';
/** 渲染思考块（灰色缩进） */
export declare function renderThinking(text: string): void;
/** 渲染思考状态 */
export declare function renderThinkingDone(duration?: number): void;
/** 渲染工具调用列表 */
export declare function renderToolCalls(toolCalls: ToolCall[]): void;
/** 渲染工具执行结果 */
export declare function renderToolResult(toolName: string, result: ToolResult): void;
/** 渲染工具被拦截 */
export declare function renderToolDenied(toolName: string): void;
/** 渲染 Token 用量 */
export declare function renderUsage(usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}): void;
//# sourceMappingURL=render.d.ts.map