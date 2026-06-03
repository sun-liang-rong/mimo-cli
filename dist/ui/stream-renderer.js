"use strict";
// src/ui/stream-renderer.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamRenderer = void 0;
const blessed_1 = __importDefault(require("blessed"));
const theme_1 = require("./theme");
class StreamRenderer {
    chatbox;
    footerbar;
    screen;
    // 状态
    isThinking = false;
    isStreaming = false;
    thinkingStartTime = 0;
    streamStartTime = 0;
    currentMessage = '';
    currentTokenCount = 0;
    // 覆盖 Box (用于行内动态更新)
    overlayBox = null;
    constructor(chatbox, footerbar, screen) {
        this.chatbox = chatbox;
        this.footerbar = footerbar;
        this.screen = screen;
    }
    /** 获取 ChatBox (供 chat.ts 使用) */
    getChatBox() {
        return this.chatbox;
    }
    /** 获取当前是否正在流式输出 */
    getIsStreaming() {
        return this.isStreaming;
    }
    /** 开始思考阶段 */
    startThinking() {
        if (this.isThinking)
            return;
        this.isThinking = true;
        this.thinkingStartTime = Date.now();
        this.footerbar.setState('thinking');
        // 创建覆盖 Box 显示 thinking 状态
        this.createOverlay(`  {${theme_1.Colors.thinking}-fg}${theme_1.Icons.thinking} thinking...{/fg}`);
    }
    /** 更新思考内容 (实时) */
    updateThinking(_content) {
        if (!this.isThinking)
            return;
        const elapsed = Date.now() - this.thinkingStartTime;
        const duration = (elapsed / 1000).toFixed(1);
        this.updateOverlay(`  {${theme_1.Colors.thinking}-fg}${theme_1.Icons.thinking} thinking ${duration}s{/fg}`);
    }
    /** 结束思考阶段 */
    endThinking() {
        if (!this.isThinking)
            return;
        this.isThinking = false;
        const duration = Date.now() - this.thinkingStartTime;
        // 销毁覆盖 Box
        this.destroyOverlay();
        // 写入最终状态到 ChatBox
        this.chatbox.pushThinkingDone(duration);
    }
    /** 开始流式输出阶段 */
    startStreaming() {
        if (this.isStreaming)
            return;
        this.isStreaming = true;
        this.streamStartTime = Date.now();
        this.currentMessage = '';
        this.currentTokenCount = 0;
        this.footerbar.setState('streaming');
    }
    /** 追加 token (逐字流式) */
    appendToken(token) {
        if (!this.isStreaming)
            return;
        this.currentMessage += token;
        this.currentTokenCount++;
        // 直接追加到 ChatBox (blessed Log 的 add 方法)
        // 逐行追加：处理 token 中可能包含换行的情况
        this.chatbox.log.add(token);
        // 更新 FooterBar
        this.footerbar.updateTokenCount(this.currentTokenCount);
        this.footerbar.updateElapsedTime(Date.now() - this.streamStartTime);
    }
    /** 结束流式输出阶段 */
    endStreaming(tokenCount, durationMs) {
        this.isStreaming = false;
        // 如果有 Markdown 内容，在流式完成后渲染
        if (this.currentMessage.trim()) {
            this.chatbox.pushMarkdown(this.currentMessage);
        }
        // 显示用量统计
        if (tokenCount > 0 || this.currentTokenCount > 0) {
            const tokens = tokenCount || this.currentTokenCount;
            const duration = durationMs || (Date.now() - this.streamStartTime);
            this.chatbox.pushTokenUsage(tokens, duration);
        }
        this.footerbar.setState('idle');
    }
    /** 开始工具调用 */
    startToolCall(name, args) {
        this.footerbar.setState('tool_call', name);
        this.chatbox.pushToolCallStart(name, args);
    }
    /** 结束工具调用 */
    endToolCall(name, args, success, durationMs) {
        this.chatbox.pushToolCallResult(name, args, success, durationMs);
        this.footerbar.setState('idle');
    }
    /** 推入错误 */
    pushError(message) {
        this.chatbox.pushError(message);
    }
    /** 创建覆盖 Box */
    createOverlay(content) {
        if (this.overlayBox)
            return;
        // 获取 ChatBox 的底部位置
        const chatLog = this.chatbox.log;
        const bottom = chatLog.atop + chatLog.height - 1;
        this.overlayBox = blessed_1.default.box({
            parent: this.screen,
            top: bottom,
            left: chatLog.aleft,
            width: chatLog.width,
            height: 1,
            content: content,
            style: {
                bg: 'default',
            },
            tags: true,
        });
        this.screen.render();
    }
    /** 更新覆盖 Box 内容 */
    updateOverlay(content) {
        if (!this.overlayBox)
            return;
        this.overlayBox.setContent(content);
        this.screen.render();
    }
    /** 销毁覆盖 Box */
    destroyOverlay() {
        if (!this.overlayBox)
            return;
        this.overlayBox.destroy();
        this.overlayBox = null;
        this.screen.render();
    }
}
exports.StreamRenderer = StreamRenderer;
//# sourceMappingURL=stream-renderer.js.map