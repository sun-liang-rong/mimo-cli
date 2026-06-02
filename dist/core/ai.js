"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchModels = fetchModels;
exports.chatStream = chatStream;
const config_1 = require("./config");
/**
 * 获取 API 可用模型列表
 */
async function fetchModels() {
    const { apiKey, baseUrl } = (0, config_1.getConfig)();
    if (!apiKey)
        return { success: false, error: '未配置 API Key' };
    const url = `${baseUrl.replace(/\/+$/, '')}/models`;
    try {
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(10000),
        });
        if (!res.ok)
            return { success: false, error: `请求失败 (${res.status})` };
        const data = await res.json();
        const models = data.data?.map((m) => m.id) || [];
        return { success: true, models };
    }
    catch (err) {
        return { success: false, error: err instanceof Error ? err.message : '网络异常' };
    }
}
/**
 * 流式调用 MiMo API
 * 支持普通对话 + 工具调用 + 思考过程
 */
async function chatStream(messages, callbacks, tools) {
    const apiKey = (0, config_1.get)('apiKey');
    const baseUrl = (0, config_1.get)('baseUrl');
    const model = (0, config_1.get)('model');
    const temperature = (0, config_1.get)('temperature');
    const maxTokens = (0, config_1.get)('maxTokens');
    const thinkingMode = (0, config_1.get)('thinkingMode');
    if (!apiKey) {
        callbacks.onError(new Error('未配置 API Key，请先运行: mimo config set apiKey <your-key>'));
        return;
    }
    const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
    // 构建请求体
    const body = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
    };
    // 工具定义
    if (tools && tools.length > 0) {
        body.tools = tools.map((t) => ({
            type: 'function',
            function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters,
            },
        }));
    }
    // 思考模式
    if (thinkingMode === 'nothink') {
        body.reasoning_effort = 'none';
    }
    else if (thinkingMode === 'auto') {
        body.reasoning_effort = 'auto';
    }
    // 'think' 时使用默认值
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120000);
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            let errorMsg = `API 请求失败 (${response.status})`;
            if (response.status === 401)
                errorMsg = 'API Key 无效或已过期，请检查配置';
            else if (response.status === 429)
                errorMsg = '请求过于频繁，请稍后再试';
            else if (response.status === 500)
                errorMsg = '服务端错误，请稍后再试';
            else if (response.status === 400) {
                errorMsg = '参数错误，请检查配置';
                if (errorText.toLowerCase().includes('model')) {
                    errorMsg += `\n当前模型: ${model}`;
                    errorMsg += `\n请运行: mimo config set model <正确的模型名>`;
                    errorMsg += `\n或运行: mimo models  查看可用模型列表`;
                }
            }
            if (errorText)
                errorMsg += `\n${errorText.slice(0, 300)}`;
            callbacks.onError(new Error(errorMsg));
            return;
        }
        if (!response.body) {
            callbacks.onError(new Error('响应体为空'));
            return;
        }
        let fullText = '';
        let reasoningText = '';
        const toolCalls = [];
        let usage;
        // tool_calls 累积器（流式分片）
        const toolCallChunks = new Map();
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data:'))
                    continue;
                const data = trimmed.slice(5).trim();
                if (data === '[DONE]')
                    continue;
                try {
                    const parsed = JSON.parse(data);
                    const choice = parsed.choices?.[0];
                    // 使用量统计
                    if (parsed.usage) {
                        usage = {
                            prompt_tokens: parsed.usage.prompt_tokens || 0,
                            completion_tokens: parsed.usage.completion_tokens || 0,
                            total_tokens: parsed.usage.total_tokens || 0,
                        };
                    }
                    if (!choice)
                        continue;
                    const delta = choice.delta;
                    if (!delta)
                        continue;
                    // 思考内容
                    if (delta.reasoning_content) {
                        reasoningText += delta.reasoning_content;
                        callbacks.onThinking(delta.reasoning_content);
                    }
                    // 普通文本内容
                    if (delta.content) {
                        fullText += delta.content;
                        callbacks.onToken(delta.content);
                    }
                    // 工具调用（流式累积）
                    if (delta.tool_calls) {
                        for (const tc of delta.tool_calls) {
                            const idx = tc.index ?? 0;
                            if (!toolCallChunks.has(idx)) {
                                toolCallChunks.set(idx, { id: '', name: '', args: '' });
                            }
                            const chunk = toolCallChunks.get(idx);
                            if (tc.id)
                                chunk.id = tc.id;
                            if (tc.function?.name)
                                chunk.name += tc.function.name;
                            if (tc.function?.arguments)
                                chunk.args += tc.function.arguments;
                        }
                    }
                    // 完成原因
                    if (choice.finish_reason === 'tool_calls') {
                        // 工具调用完成，构建完整 tool_calls
                        for (const [, chunk] of toolCallChunks) {
                            toolCalls.push({
                                id: chunk.id,
                                type: 'function',
                                function: {
                                    name: chunk.name,
                                    arguments: chunk.args,
                                },
                            });
                        }
                        callbacks.onToolCalls(toolCalls);
                    }
                }
                catch {
                    // 忽略解析错误
                }
            }
        }
        // 如果 SSE 没有发 finish_reason='tool_calls'，但累积到了 tool_calls
        if (toolCalls.length === 0 && toolCallChunks.size > 0) {
            for (const [, chunk] of toolCallChunks) {
                toolCalls.push({
                    id: chunk.id,
                    type: 'function',
                    function: {
                        name: chunk.name,
                        arguments: chunk.args,
                    },
                });
            }
            callbacks.onToolCalls(toolCalls);
        }
        callbacks.onDone(fullText, toolCalls.length > 0 ? toolCalls : undefined, usage);
    }
    catch (err) {
        if (err instanceof Error) {
            if (err.name === 'AbortError') {
                callbacks.onError(new Error('请求超时（120秒），请检查网络连接'));
            }
            else {
                callbacks.onError(new Error(`网络请求异常: ${err.message}`));
            }
        }
        else {
            callbacks.onError(new Error('未知错误'));
        }
    }
}
//# sourceMappingURL=ai.js.map