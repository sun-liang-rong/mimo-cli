"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatHeader = formatHeader;
exports.formatPrompt = formatPrompt;
exports.formatUserMessage = formatUserMessage;
exports.formatAssistantMessage = formatAssistantMessage;
exports.formatThinking = formatThinking;
exports.formatThinkingDone = formatThinkingDone;
exports.formatToolCall = formatToolCall;
exports.formatToolResult = formatToolResult;
exports.formatStatus = formatStatus;
function formatHeader(state) {
    return `MiMo CLI  v1.0.0  ${state.model}  ${state.permissionMode}`;
}
function formatPrompt() {
    return '> ';
}
function formatUserMessage(text) {
    return `\nuser\n${text}`;
}
function formatAssistantMessage(text) {
    return `\nassistant\n${text}`;
}
function formatThinking() {
    return '  thinking...';
}
function formatThinkingDone(text = 'thinking done') {
    return `  ${text}`;
}
function formatToolCall(name, args) {
    const suffix = args ? ` ${args}` : '';
    return `  tool ${name}${suffix}`;
}
function formatToolResult(name, success) {
    return `  ${success ? 'ok' : 'error'} ${name}`;
}
function formatStatus(activity, usage) {
    const parts = [`status ${activity}`];
    if (usage?.total_tokens !== undefined) {
        parts.push(`${usage.total_tokens} tokens`);
    }
    return parts.join(' | ');
}
//# sourceMappingURL=codex-renderer.js.map