"use strict";
// src/ui/theme.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.Icons = exports.Colors = void 0;
/** 颜色常量 */
exports.Colors = {
    // 前景
    user: 'green',
    assistant: 'cyan',
    thinking: 'gray',
    toolCall: 'yellow',
    toolSuccess: 'green',
    toolError: 'red',
    error: 'red',
    dim: 'gray',
    tokenUsage: 'gray',
    // 背景
    topBarBg: 'cyan',
    topBarFg: 'black',
    footerBarBg: '#333333',
    footerBarFg: 'white',
    // 状态颜色
    statusIdle: 'white',
    statusThinking: 'yellow',
    statusStreaming: 'green',
    statusToolCall: 'cyan',
    statusWaitingInput: 'red',
};
/** 图标/符号 */
exports.Icons = {
    user: 'user',
    assistant: '●',
    thinking: ':',
    toolCall: '▸',
    toolSuccess: '✓',
    toolError: '✗',
    statusThinking: '⋯',
    statusStreaming: '▶',
    statusToolCall: '🔧',
    statusWaitingInput: '?',
    prompt: '> ',
};
//# sourceMappingURL=theme.js.map