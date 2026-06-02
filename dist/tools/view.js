"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleView = handleView;
exports.registerViewTool = registerViewTool;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const safety_1 = require("../utils/safety");
const registry_1 = require("./registry");
const viewDef = {
    name: 'view',
    description: 'Read a file with optional line range. Use this to understand code before editing.',
    permission: 'read',
    parameters: {
        type: 'object',
        properties: {
            path: { type: 'string', description: 'File path' },
            view_range: {
                type: 'array',
                description: 'Line range [start, end] (1-indexed, optional)',
            },
        },
        required: ['path'],
    },
};
function handleView(args) {
    const filePath = String(args.path);
    const resolved = path_1.default.resolve(filePath);
    const safetyError = (0, safety_1.checkPathSafety)(resolved);
    if (safetyError)
        return { success: false, output: '', error: safetyError };
    if (!fs_1.default.existsSync(resolved)) {
        return { success: false, output: '', error: `文件不存在: ${resolved}` };
    }
    try {
        const stat = fs_1.default.statSync(resolved);
        if (stat.isDirectory()) {
            return { success: false, output: '', error: `路径是目录，不是文件: ${resolved}` };
        }
        if (stat.size > 1024 * 1024) {
            return { success: false, output: '', error: `文件过大（${(stat.size / 1024 / 1024).toFixed(1)}MB），限制 1MB` };
        }
        const content = fs_1.default.readFileSync(resolved, 'utf-8');
        const lines = content.split('\n');
        const viewRange = args.view_range;
        if (viewRange && Array.isArray(viewRange) && viewRange.length === 2) {
            const start = Math.max(1, Math.min(viewRange[0], viewRange[1]));
            const end = Math.min(lines.length, Math.max(viewRange[0], viewRange[1]));
            const sliced = lines.slice(start - 1, end);
            return { success: true, output: sliced.join('\n') };
        }
        return { success: true, output: content };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, output: '', error: `读取失败: ${msg}` };
    }
}
function registerViewTool() {
    registry_1.toolRegistry.register(viewDef, handleView);
}
//# sourceMappingURL=view.js.map