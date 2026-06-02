import { Message, ToolCall } from './context';
import { ToolDefinition } from '../tools/registry';
export interface StreamCallbacks {
    onToken: (token: string) => void;
    onThinking: (text: string) => void;
    onToolCalls: (toolCalls: ToolCall[]) => void;
    onDone: (fullText: string, toolCalls?: ToolCall[], usage?: TokenUsage) => void;
    onError: (error: Error) => void;
}
export interface TokenUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}
/**
 * 获取 API 可用模型列表
 */
export declare function fetchModels(): Promise<{
    success: boolean;
    models?: string[];
    error?: string;
}>;
/**
 * 流式调用 MiMo API
 * 支持普通对话 + 工具调用 + 思考过程
 */
export declare function chatStream(messages: Message[], callbacks: StreamCallbacks, tools?: ToolDefinition[]): Promise<void>;
//# sourceMappingURL=ai.d.ts.map