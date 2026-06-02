"use strict";
/**
 * 工具注册表 — 定义所有 AI 可调用的工具
 * 兼容 OpenAI function calling 格式
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolRegistry = void 0;
class ToolRegistry {
    tools = new Map();
    register(definition, handler) {
        this.tools.set(definition.name, { definition, handler });
    }
    get(name) {
        return this.tools.get(name);
    }
    getAll() {
        return Array.from(this.tools.values());
    }
    /** 获取所有工具定义（用于 API 调用的 tools 参数） */
    getDefinitions() {
        return Array.from(this.tools.values()).map((t) => t.definition);
    }
    /** 执行工具调用 */
    async execute(name, args) {
        const tool = this.tools.get(name);
        if (!tool) {
            return { success: false, output: '', error: `未知工具: ${name}` };
        }
        try {
            return await tool.handler(args);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { success: false, output: '', error: `工具执行异常: ${msg}` };
        }
    }
}
exports.toolRegistry = new ToolRegistry();
//# sourceMappingURL=registry.js.map