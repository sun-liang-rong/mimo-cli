"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerFileTools = registerFileTools;
exports.readFile = readFile;
exports.writeFile = writeFile;
exports.showDiff = showDiff;
exports.getLanguageFromExt = getLanguageFromExt;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const Diff = __importStar(require("diff"));
const safety_1 = require("../utils/safety");
const registry_1 = require("./registry");
/** 已读取文件的缓存（用于 diff） */
const fileCache = new Map();
// ── 工具定义 ──
const readFileDef = {
    name: 'read_file',
    description: '读取本地文本文件内容，返回文件内容',
    permission: 'read',
    parameters: {
        type: 'object',
        properties: {
            path: { type: 'string', description: '文件路径（相对或绝对）' },
        },
        required: ['path'],
    },
};
const writeFileDef = {
    name: 'write_file',
    description: '创建或覆盖写入本地文件',
    permission: 'write',
    parameters: {
        type: 'object',
        properties: {
            path: { type: 'string', description: '文件路径' },
            content: { type: 'string', description: '要写入的文件内容' },
        },
        required: ['path', 'content'],
    },
};
const editFileDef = {
    name: 'edit_file',
    description: '精确替换文件中的指定字符串（局部编辑）',
    permission: 'write',
    parameters: {
        type: 'object',
        properties: {
            path: { type: 'string', description: '文件路径' },
            old_string: { type: 'string', description: '要替换的原始文本（必须精确匹配）' },
            new_string: { type: 'string', description: '替换后的新文本' },
        },
        required: ['path', 'old_string', 'new_string'],
    },
};
const diffFileDef = {
    name: 'diff_file',
    description: '查看文件修改前后的差异对比',
    permission: 'read',
    parameters: {
        type: 'object',
        properties: {
            path: { type: 'string', description: '文件路径' },
        },
        required: ['path'],
    },
};
// ── 工具实现 ──
function handleReadFile(args) {
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
            // 列出目录内容
            const entries = fs_1.default.readdirSync(resolved, { withFileTypes: true });
            const listing = entries
                .map((e) => `${e.isDirectory() ? '[DIR] ' : '      '}${e.name}`)
                .join('\n');
            return { success: true, output: `目录 ${resolved}:\n${listing}` };
        }
        if (stat.size > 1024 * 1024) {
            return { success: false, output: '', error: `文件过大（${(stat.size / 1024 / 1024).toFixed(1)}MB），限制 1MB` };
        }
        const content = fs_1.default.readFileSync(resolved, 'utf-8');
        fileCache.set(resolved, content);
        return { success: true, output: content };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, output: '', error: `读取失败: ${msg}` };
    }
}
function handleWriteFile(args) {
    const filePath = String(args.path);
    const content = String(args.content);
    const resolved = path_1.default.resolve(filePath);
    const safetyError = (0, safety_1.checkPathSafety)(resolved);
    if (safetyError)
        return { success: false, output: '', error: safetyError };
    try {
        const dir = path_1.default.dirname(resolved);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        fs_1.default.writeFileSync(resolved, content, 'utf-8');
        return { success: true, output: `文件已写入: ${resolved}` };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, output: '', error: `写入失败: ${msg}` };
    }
}
function handleEditFile(args) {
    const filePath = String(args.path);
    const oldString = String(args.old_string);
    const newString = String(args.new_string);
    const resolved = path_1.default.resolve(filePath);
    const safetyError = (0, safety_1.checkPathSafety)(resolved);
    if (safetyError)
        return { success: false, output: '', error: safetyError };
    if (!fs_1.default.existsSync(resolved)) {
        return { success: false, output: '', error: `文件不存在: ${resolved}` };
    }
    try {
        const content = fs_1.default.readFileSync(resolved, 'utf-8');
        const count = content.split(oldString).length - 1;
        if (count === 0) {
            return { success: false, output: '', error: `未找到要替换的文本，请确保 old_string 精确匹配文件内容` };
        }
        if (count > 1) {
            return { success: false, output: '', error: `找到 ${count} 处匹配，请提供更多上下文使 old_string 唯一` };
        }
        const updated = content.replace(oldString, newString);
        fileCache.set(resolved, content); // 缓存旧版本用于 diff
        fs_1.default.writeFileSync(resolved, updated, 'utf-8');
        return { success: true, output: `文件已编辑: ${resolved}` };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, output: '', error: `编辑失败: ${msg}` };
    }
}
function handleDiffFile(args) {
    const filePath = String(args.path);
    const resolved = path_1.default.resolve(filePath);
    const oldContent = fileCache.get(resolved);
    if (oldContent === undefined) {
        return { success: false, output: '', error: `没有 ${resolved} 的历史缓存，请先 read_file 读取后再修改` };
    }
    if (!fs_1.default.existsSync(resolved)) {
        return { success: false, output: '', error: `文件不存在: ${resolved}` };
    }
    const newContent = fs_1.default.readFileSync(resolved, 'utf-8');
    if (oldContent === newContent) {
        return { success: true, output: '文件没有变更' };
    }
    const patch = Diff.createPatch(path_1.default.basename(resolved), oldContent, newContent);
    return { success: true, output: patch };
}
// ── 注册工具 ──
function registerFileTools() {
    registry_1.toolRegistry.register(readFileDef, handleReadFile);
    registry_1.toolRegistry.register(writeFileDef, handleWriteFile);
    registry_1.toolRegistry.register(editFileDef, handleEditFile);
    registry_1.toolRegistry.register(diffFileDef, handleDiffFile);
}
// ── 保留旧接口兼容 slash 命令 ──
function readFile(filePath) {
    const result = handleReadFile({ path: filePath });
    return { success: result.success, content: result.output || undefined, error: result.error };
}
function writeFile(filePath, content) {
    const result = handleWriteFile({ path: filePath, content });
    return { success: result.success, error: result.error };
}
function showDiff(filePath) {
    const result = handleDiffFile({ path: filePath });
    return { success: result.success, diff: result.output || undefined, error: result.error };
}
function getLanguageFromExt(filePath) {
    const ext = path_1.default.extname(filePath).toLowerCase();
    const map = {
        '.ts': 'typescript', '.tsx': 'typescript',
        '.js': 'javascript', '.jsx': 'javascript',
        '.py': 'python', '.java': 'java', '.go': 'go',
        '.rs': 'rust', '.rb': 'ruby', '.php': 'php',
        '.c': 'c', '.cpp': 'cpp', '.h': 'c',
        '.cs': 'csharp', '.swift': 'swift', '.kt': 'kotlin',
        '.html': 'html', '.css': 'css', '.scss': 'scss',
        '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml',
        '.md': 'markdown', '.sh': 'bash', '.sql': 'sql',
        '.xml': 'xml', '.toml': 'toml', '.vue': 'vue',
    };
    return map[ext] || 'text';
}
//# sourceMappingURL=file.js.map