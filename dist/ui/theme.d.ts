/** 颜色常量 */
export declare const Colors: {
    readonly user: "green";
    readonly assistant: "cyan";
    readonly thinking: "gray";
    readonly toolCall: "yellow";
    readonly toolSuccess: "green";
    readonly toolError: "red";
    readonly error: "red";
    readonly dim: "gray";
    readonly tokenUsage: "gray";
    readonly topBarBg: "cyan";
    readonly topBarFg: "black";
    readonly footerBarBg: "#333333";
    readonly footerBarFg: "white";
    readonly statusIdle: "white";
    readonly statusThinking: "yellow";
    readonly statusStreaming: "green";
    readonly statusToolCall: "cyan";
    readonly statusWaitingInput: "red";
};
/** 图标/符号 */
export declare const Icons: {
    readonly user: "user";
    readonly assistant: "●";
    readonly thinking: ":";
    readonly toolCall: "▸";
    readonly toolSuccess: "✓";
    readonly toolError: "✗";
    readonly statusThinking: "⋯";
    readonly statusStreaming: "▶";
    readonly statusToolCall: "🔧";
    readonly statusWaitingInput: "?";
    readonly prompt: "> ";
};
/** Footer 状态类型 */
export type FooterState = 'idle' | 'thinking' | 'streaming' | 'tool_call' | 'waiting_input';
/** 权限决策 */
export type PermissionDecision = 'allow' | 'deny' | 'always';
//# sourceMappingURL=theme.d.ts.map