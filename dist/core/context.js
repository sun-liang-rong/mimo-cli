"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextManager = void 0;
const SYSTEM_PROMPT = `你是 MiMo，一个运行在终端中的高级 AI 编程助手。你的能力包括：
1. 回答编程问题、解释代码、提供编程建议
2. 读取和分析本地代码文件
3. 生成新代码文件并写入本地目录
4. 编辑现有代码文件（局部修改）
5. 搜索项目文件（按文件名或内容）
6. 执行终端命令并分析输出
7. 操作 Git（查看状态、创建提交）
8. 给出调试和修复建议

工具调用规范：
- 读取文件前先用 read_file 获取内容
- 修改文件时优先用 edit_file 精确替换，避免覆盖整个文件
- 执行命令后分析输出，如有错误主动给出修复建议
- 每次操作后向用户简要说明你做了什么

请简洁、专业地回答用户问题。当需要生成代码时，使用 markdown 代码块格式。`;
class ContextManager {
    messages = [];
    maxContextTokens;
    constructor(maxContextTokens = 32000) {
        this.maxContextTokens = maxContextTokens;
        this.reset();
    }
    reset() {
        this.messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    }
    addUserMessage(content) {
        this.messages.push({ role: 'user', content });
        this.trim();
    }
    addAssistantMessage(content, toolCalls, reasoningContent) {
        const msg = { role: 'assistant', content };
        if (toolCalls && toolCalls.length > 0)
            msg.tool_calls = toolCalls;
        if (reasoningContent)
            msg.reasoning_content = reasoningContent;
        this.messages.push(msg);
    }
    addToolMessage(toolCallId, content) {
        this.messages.push({
            role: 'tool',
            content,
            tool_call_id: toolCallId,
        });
    }
    getMessages() {
        return [...this.messages];
    }
    /** 替换消息列表（用于上下文压缩） */
    replaceMessages(messages) {
        this.messages = messages;
    }
    /** 获取最后一条消息 */
    getLastMessage() {
        return this.messages[this.messages.length - 1];
    }
    get length() {
        return this.messages.length;
    }
    trim() {
        const estimateTokens = (text) => {
            return Math.ceil(text.length / 2);
        };
        let totalTokens = this.messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
        const tokenBudget = this.maxContextTokens - 4096;
        while (totalTokens > tokenBudget && this.messages.length > 2) {
            // 保留 system prompt，从最早的非 system 消息开始移除
            // 如果移除的是 assistant 消息且有 tool_calls，也移除对应的 tool 消息
            let removed = this.messages.splice(1, 1)[0];
            totalTokens -= estimateTokens(removed.content);
            // 如果移除的是带 tool_calls 的 assistant，也移除后续的 tool 消息
            while (removed.tool_calls && this.messages[1]?.role === 'tool') {
                const toolMsg = this.messages.splice(1, 1)[0];
                totalTokens -= estimateTokens(toolMsg.content);
            }
        }
    }
}
exports.ContextManager = ContextManager;
//# sourceMappingURL=context.js.map