"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSearchTools = registerSearchTools;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const registry_1 = require("./registry");
const safety_1 = require("../utils/safety");
// ── 工具定义 ──
const listDirDef = {
    name: 'list_dir',
    description: '列出目录下的文件和子目录',
    permission: 'read',
    parameters: {
        type: 'object',
        properties: {
            path: { type: 'string', description: '目录路径（默认当前目录）' },
            recursive: { type: 'string', description: '是否递归列出（true/false），默认 false' },
        },
        required: [],
    },
};
const grepDef = {
    name: 'grep',
    description: '在文件内容中搜索指定文本（类似 grep -rn）',
    permission: 'read',
    parameters: {
        type: 'object',
        properties: {
            pattern: { type: 'string', description: '搜索的文本或正则表达式' },
            path: { type: 'string', description: '搜索目录或文件路径（默认当前目录）' },
            glob: { type: 'string', description: '文件过滤模式（如 *.ts）' },
        },
        required: ['pattern'],
    },
};
const findFilesDef = {
    name: 'find_files',
    description: '按文件名模式查找文件（支持通配符）',
    permission: 'read',
    parameters: {
        type: 'object',
        properties: {
            pattern: { type: 'string', description: '文件名模式（如 *.test.ts）' },
            path: { type: 'string', description: '搜索目录（默认当前目录）' },
        },
        required: ['pattern'],
    },
};
// ── 工具实现 ──
function walkDir(dir, prefix, maxDepth, currentDepth) {
    if (currentDepth > maxDepth)
        return [];
    const lines = [];
    try {
        const entries = fs_1.default.readdirSync(dir, { withFileTypes: true });
        entries.sort((a, b) => {
            if (a.isDirectory() !== b.isDirectory())
                return a.isDirectory() ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
        for (const entry of entries) {
            if (entry.name.startsWith('.') && entry.name !== '.env')
                continue;
            if (entry.name === 'node_modules' || entry.name === 'dist')
                continue;
            const indent = '  '.repeat(currentDepth);
            if (entry.isDirectory()) {
                lines.push(`${indent}📁 ${entry.name}/`);
                lines.push(...walkDir(path_1.default.join(dir, entry.name), prefix, maxDepth, currentDepth + 1));
            }
            else {
                lines.push(`${indent}📄 ${entry.name}`);
            }
        }
    }
    catch {
        // 忽略权限错误
    }
    return lines;
}
function handleListDir(args) {
    const dirPath = String(args.path || '.');
    const recursive = String(args.recursive || 'false') === 'true';
    const resolved = path_1.default.resolve(dirPath);
    const safetyError = (0, safety_1.checkPathSafety)(resolved);
    if (safetyError)
        return { success: false, output: '', error: safetyError };
    if (!fs_1.default.existsSync(resolved)) {
        return { success: false, output: '', error: `目录不存在: ${resolved}` };
    }
    const lines = walkDir(resolved, '', recursive ? 5 : 1, 0);
    return { success: true, output: lines.join('\n') || '(空目录)' };
}
function handleGrep(args) {
    const pattern = String(args.pattern);
    const searchPath = String(args.path || '.');
    const glob = args.glob ? String(args.glob) : undefined;
    const resolved = path_1.default.resolve(searchPath);
    const safetyError = (0, safety_1.checkPathSafety)(resolved);
    if (safetyError)
        return { success: false, output: '', error: safetyError };
    const regex = new RegExp(pattern, 'gi');
    const results = [];
    function searchFile(filePath) {
        try {
            const content = fs_1.default.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');
            lines.forEach((line, i) => {
                if (regex.test(line)) {
                    results.push(`${filePath}:${i + 1}: ${line.trim()}`);
                }
                regex.lastIndex = 0;
            });
        }
        catch {
            // 跳过无法读取的文件
        }
    }
    function searchDir(dir) {
        try {
            const entries = fs_1.default.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.'))
                    continue;
                const fullPath = path_1.default.join(dir, entry.name);
                if (entry.isDirectory()) {
                    searchDir(fullPath);
                }
                else if (entry.isFile()) {
                    if (glob) {
                        const ext = path_1.default.extname(entry.name);
                        if (!glob.replace('*', '').includes(ext))
                            continue;
                    }
                    searchFile(fullPath);
                }
            }
        }
        catch {
            // 忽略权限错误
        }
    }
    try {
        const stat = fs_1.default.statSync(resolved);
        if (stat.isDirectory()) {
            searchDir(resolved);
        }
        else {
            searchFile(resolved);
        }
    }
    catch {
        return { success: false, output: '', error: `路径不存在: ${resolved}` };
    }
    if (results.length === 0) {
        return { success: true, output: '未找到匹配内容' };
    }
    if (results.length > 50) {
        results.splice(50);
        results.push(`... (结果超过 50 条，已截断)`);
    }
    return { success: true, output: results.join('\n') };
}
function handleFindFiles(args) {
    const pattern = String(args.pattern);
    const searchPath = String(args.path || '.');
    const resolved = path_1.default.resolve(searchPath);
    const safetyError = (0, safety_1.checkPathSafety)(resolved);
    if (safetyError)
        return { success: false, output: '', error: safetyError };
    const globRegex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    const matches = [];
    function walk(dir) {
        try {
            const entries = fs_1.default.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.'))
                    continue;
                const fullPath = path_1.default.join(dir, entry.name);
                if (entry.isDirectory()) {
                    walk(fullPath);
                }
                else if (globRegex.test(entry.name)) {
                    matches.push(path_1.default.relative(process.cwd(), fullPath));
                }
            }
        }
        catch {
            // 忽略
        }
    }
    walk(resolved);
    if (matches.length === 0) {
        return { success: true, output: `未找到匹配 "${pattern}" 的文件` };
    }
    if (matches.length > 50) {
        matches.splice(50);
        matches.push('... (超过 50 条，已截断)');
    }
    return { success: true, output: matches.join('\n') };
}
// ── 注册 ──
function registerSearchTools() {
    registry_1.toolRegistry.register(listDirDef, handleListDir);
    registry_1.toolRegistry.register(grepDef, handleGrep);
    registry_1.toolRegistry.register(findFilesDef, handleFindFiles);
}
//# sourceMappingURL=search.js.map