"use strict";
// src/ui/markdown.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderMarkdown = renderMarkdown;
exports.hasMarkdown = hasMarkdown;
const marked_1 = require("marked");
const marked_terminal_1 = __importDefault(require("marked-terminal"));
// 配置 marked-terminal 渲染器
const terminalRenderer = new marked_terminal_1.default({
    width: 80,
    showSectionPrefix: false,
    reflowText: false,
});
marked_1.marked.setOptions({
    renderer: terminalRenderer,
});
/**
 * 将 Markdown 文本渲染为 ANSI 彩色终端文本
 */
function renderMarkdown(text) {
    try {
        const result = marked_1.marked.parse(text);
        // marked.parse 可能返回 string 或 Promise<string>
        // 同步模式下返回 string
        if (typeof result === 'string') {
            return result;
        }
        // 如果返回 Promise (unlikely with sync marked), 回退到原文
        return text;
    }
    catch {
        // 渲染失败时返回原文
        return text;
    }
}
/**
 * 检测文本是否包含 Markdown 特征
 */
function hasMarkdown(text) {
    return /```|`[^`]+`|\*\*|__|\[.*\]\(|^#{1,6}\s/m.test(text);
}
//# sourceMappingURL=markdown.js.map