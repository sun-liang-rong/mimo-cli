export interface HeaderState {
    model: string;
    permissionMode: string;
}
export interface UsageState {
    total_tokens?: number;
}
export declare function formatHeader(state: HeaderState): string;
export declare function formatPrompt(): string;
export declare function formatUserMessage(text: string): string;
export declare function formatAssistantMessage(text: string): string;
export declare function formatThinking(): string;
export declare function formatThinkingDone(text?: string): string;
export declare function formatToolCall(name: string, args: string): string;
export declare function formatToolResult(name: string, success: boolean): string;
export declare function formatStatus(activity: string, usage?: UsageState): string;
//# sourceMappingURL=codex-renderer.d.ts.map