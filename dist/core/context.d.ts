export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}
export interface Message {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
    reasoning_content?: string;
}
export declare class ContextManager {
    private messages;
    private maxContextTokens;
    constructor(maxContextTokens?: number);
    reset(): void;
    addUserMessage(content: string): void;
    addAssistantMessage(content: string, toolCalls?: ToolCall[], reasoningContent?: string): void;
    addToolMessage(toolCallId: string, content: string): void;
    getMessages(): Message[];
    /** 替换消息列表（用于上下文压缩） */
    replaceMessages(messages: Message[]): void;
    /** 获取最后一条消息 */
    getLastMessage(): Message | undefined;
    get length(): number;
    private trim;
}
//# sourceMappingURL=context.d.ts.map