import blessed from 'blessed';
import { ChatBox } from './chatbox';
import { FooterBar } from './footerbar';
export declare class StreamRenderer {
    private chatbox;
    private footerbar;
    private screen;
    private isThinking;
    private isStreaming;
    private thinkingStartTime;
    private streamStartTime;
    private currentMessage;
    private currentTokenCount;
    private overlayBox;
    constructor(chatbox: ChatBox, footerbar: FooterBar, screen: blessed.Widgets.Screen);
    /** 获取 ChatBox (供 chat.ts 使用) */
    getChatBox(): ChatBox;
    /** 获取当前是否正在流式输出 */
    getIsStreaming(): boolean;
    /** 开始思考阶段 */
    startThinking(): void;
    /** 更新思考内容 (实时) */
    updateThinking(_content: string): void;
    /** 结束思考阶段 */
    endThinking(): void;
    /** 开始流式输出阶段 */
    startStreaming(): void;
    /** 追加 token (逐字流式) */
    appendToken(token: string): void;
    /** 结束流式输出阶段 */
    endStreaming(tokenCount: number, durationMs: number): void;
    /** 开始工具调用 */
    startToolCall(name: string, args: string): void;
    /** 结束工具调用 */
    endToolCall(name: string, args: string, success: boolean, durationMs: number): void;
    /** 推入错误 */
    pushError(message: string): void;
    /** 创建覆盖 Box */
    private createOverlay;
    /** 更新覆盖 Box 内容 */
    private updateOverlay;
    /** 销毁覆盖 Box */
    private destroyOverlay;
}
//# sourceMappingURL=stream-renderer.d.ts.map