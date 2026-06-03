import blessed from 'blessed';
export declare class ChatBox {
    readonly log: any;
    constructor(screen: blessed.Widgets.Screen, options?: {
        top?: number;
        height?: number | string;
    });
    /** 推入用户消息 */
    pushUserMessage(text: string): void;
    /** 推入 AI 回复头部 (模型标记) */
    pushAssistantHeader(model: string): void;
    /** 推入思考完成摘要 */
    pushThinkingDone(durationMs: number): void;
    /** 推入工具调用结果 */
    pushToolCallResult(name: string, args: string, success: boolean, durationMs: number): void;
    /** 推入工具调用开始 (等待状态) */
    pushToolCallStart(name: string, args: string): void;
    /** 推入 token 用量统计 */
    pushTokenUsage(tokens: number, durationMs: number): void;
    /** 推入错误消息 */
    pushError(message: string): void;
    /** 推入普通文本 (用于流式追加) */
    pushText(text: string): void;
    /** 推入 Markdown 渲染后的文本 */
    pushMarkdown(text: string): void;
    /** 推入权限确认提示 */
    pushPermissionPrompt(toolName: string, detail: string): void;
    /** 清空聊天区 */
    clear(): void;
    /** 滚动到底部 */
    scrollToBottom(): void;
}
//# sourceMappingURL=chatbox.d.ts.map