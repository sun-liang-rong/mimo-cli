"use strict";
// src/ui/chatbox.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatBox = void 0;
const blessed_1 = __importDefault(require("blessed"));
const theme_1 = require("./theme");
const markdown_1 = require("./markdown");
class ChatBox {
    log;
    constructor(screen, options) {
        this.log = blessed_1.default.log({
            parent: screen,
            top: options?.top ?? 1,
            left: 0,
            width: '100%',
            height: options?.height ?? '100%-3',
            scrollback: 1000,
            tags: true,
            mouse: true,
            keys: true,
            vi: true,
            scrollbar: {
                ch: ' ',
                track: {
                    bg: 'gray',
                },
                style: {
                    inverse: true,
                },
            },
            style: {
                fg: 'white',
                bg: 'default',
            },
        });
    }
    /** 推入用户消息 */
    pushUserMessage(text) {
        this.log.add(`{${theme_1.Colors.user}-fg}${theme_1.Icons.user}{/fg}`);
        this.log.add(`  ${text}`);
        this.log.add('');
    }
    /** 推入 AI 回复头部 (模型标记) */
    pushAssistantHeader(model) {
        this.log.add(`{${theme_1.Colors.assistant}-fg}${theme_1.Icons.assistant} ${model}{/fg}`);
    }
    /** 推入思考完成摘要 */
    pushThinkingDone(durationMs) {
        const duration = (durationMs / 1000).toFixed(1);
        this.log.add(`  {${theme_1.Colors.thinking}-fg}${theme_1.Icons.thinking} thinking ${duration}s{/fg}`);
    }
    /** 推入工具调用结果 */
    pushToolCallResult(name, args, success, durationMs) {
        const duration = (durationMs / 1000).toFixed(1);
        const icon = success ? theme_1.Icons.toolSuccess : theme_1.Icons.toolError;
        const color = success ? theme_1.Colors.toolSuccess : theme_1.Colors.toolError;
        const suffix = args ? ` ${args}` : '';
        this.log.add(`  {${theme_1.Colors.toolCall}-fg}${theme_1.Icons.toolCall}{/fg} {${color}-fg}${name}${suffix} ${icon} ${duration}s{/fg}`);
    }
    /** 推入工具调用开始 (等待状态) */
    pushToolCallStart(name, args) {
        const suffix = args ? ` ${args}` : '';
        this.log.add(`  {${theme_1.Colors.toolCall}-fg}${theme_1.Icons.toolCall}{/fg} {${theme_1.Colors.toolCall}-fg}${name}${suffix} ...{/fg}`);
    }
    /** 推入 token 用量统计 */
    pushTokenUsage(tokens, durationMs) {
        const tokenStr = tokens < 1000 ? `${tokens} tokens` : `${(tokens / 1000).toFixed(1)}k tokens`;
        const duration = (durationMs / 1000).toFixed(1);
        this.log.add(`  {${theme_1.Colors.tokenUsage}-fg}${tokenStr} · ${duration}s{/fg}`);
        this.log.add('');
    }
    /** 推入错误消息 */
    pushError(message) {
        this.log.add(`  {${theme_1.Colors.error}-fg}${theme_1.Icons.toolError} ${message}{/fg}`);
    }
    /** 推入普通文本 (用于流式追加) */
    pushText(text) {
        this.log.add(text);
    }
    /** 推入 Markdown 渲染后的文本 */
    pushMarkdown(text) {
        if ((0, markdown_1.hasMarkdown)(text)) {
            const rendered = (0, markdown_1.renderMarkdown)(text);
            // 逐行添加，保持滚动行为
            const lines = rendered.split('\n');
            for (const line of lines) {
                this.log.add(line);
            }
        }
        else {
            this.log.add(text);
        }
    }
    /** 推入权限确认提示 */
    pushPermissionPrompt(toolName, detail) {
        this.log.add(`  {${theme_1.Colors.toolCall}-fg}${theme_1.Icons.toolCall} ${toolName}{/fg}`);
        this.log.add(`    {yellow-fg}权限确认: ${detail}{/yellow-fg}`);
        this.log.add(`    {${theme_1.Colors.dim}-fg}y = 允许  n = 拒绝  a = 始终允许{/${theme_1.Colors.dim}-fg}`);
    }
    /** 清空聊天区 */
    clear() {
        // blessed Log 没有 clear 方法，需要通过 _clines 清空
        this.log._clines = [];
        this.log.setContent('');
        this.log.screen.render();
    }
    /** 滚动到底部 */
    scrollToBottom() {
        this.log.setScrollPerc(100);
        this.log.screen.render();
    }
}
exports.ChatBox = ChatBox;
//# sourceMappingURL=chatbox.js.map