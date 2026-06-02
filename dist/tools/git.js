"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerGitTools = registerGitTools;
const child_process_1 = require("child_process");
const registry_1 = require("./registry");
// ── 工具定义 ──
const gitStatusDef = {
    name: 'git_status',
    description: '查看当前 Git 仓库状态（分支、变更文件列表）',
    permission: 'read',
    parameters: {
        type: 'object',
        properties: {},
        required: [],
    },
};
const gitDiffDef = {
    name: 'git_diff',
    description: '查看 Git 工作区或暂存区的代码差异',
    permission: 'read',
    parameters: {
        type: 'object',
        properties: {
            file: { type: 'string', description: '指定文件路径（可选，默认查看所有变更）' },
            staged: { type: 'string', description: '是否查看暂存区（true/false），默认 false' },
        },
        required: [],
    },
};
const gitCommitDef = {
    name: 'git_commit',
    description: '创建 Git 提交（自动 git add 并 commit）',
    permission: 'write',
    parameters: {
        type: 'object',
        properties: {
            message: { type: 'string', description: 'Commit message' },
            files: { type: 'string', description: '要提交的文件（空格分隔），默认全部' },
        },
        required: ['message'],
    },
};
const gitLogDef = {
    name: 'git_log',
    description: '查看最近的 Git 提交历史',
    permission: 'read',
    parameters: {
        type: 'object',
        properties: {
            count: { type: 'string', description: '显示的提交数量，默认 10' },
        },
        required: [],
    },
};
// ── 工具实现 ──
function runGit(args) {
    try {
        return (0, child_process_1.execSync)(`git ${args.join(' ')}`, {
            encoding: 'utf-8',
            timeout: 10000,
            windowsHide: true,
        }).trim();
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(msg);
    }
}
function isGitRepo() {
    try {
        runGit(['rev-parse', '--is-inside-work-tree']);
        return true;
    }
    catch {
        return false;
    }
}
function handleGitStatus() {
    if (!isGitRepo()) {
        return { success: false, output: '', error: '当前目录不是 Git 仓库' };
    }
    try {
        const branch = runGit(['branch', '--show-current']);
        const status = runGit(['status', '--short']);
        const output = [`Branch: ${branch}`, '', status || '(工作区干净)'].join('\n');
        return { success: true, output };
    }
    catch (err) {
        return { success: false, output: '', error: String(err) };
    }
}
function handleGitDiff(args) {
    if (!isGitRepo()) {
        return { success: false, output: '', error: '当前目录不是 Git 仓库' };
    }
    const file = args.file ? String(args.file) : '';
    const staged = String(args.staged || 'false') === 'true';
    try {
        const cmd = ['diff'];
        if (staged)
            cmd.push('--cached');
        if (file)
            cmd.push(file);
        const output = runGit(cmd);
        return { success: true, output: output || '(无差异)' };
    }
    catch (err) {
        return { success: false, output: '', error: String(err) };
    }
}
function handleGitCommit(args) {
    if (!isGitRepo()) {
        return { success: false, output: '', error: '当前目录不是 Git 仓库' };
    }
    const message = String(args.message);
    const files = args.files ? String(args.files) : '.';
    try {
        runGit(['add', files]);
        const output = runGit(['commit', '-m', message]);
        return { success: true, output };
    }
    catch (err) {
        return { success: false, output: '', error: String(err) };
    }
}
function handleGitLog(args) {
    if (!isGitRepo()) {
        return { success: false, output: '', error: '当前目录不是 Git 仓库' };
    }
    const count = String(args.count || '10');
    try {
        const output = runGit([
            'log', `--oneline`, `-n`, count,
        ]);
        return { success: true, output: output || '(无提交记录)' };
    }
    catch (err) {
        return { success: false, output: '', error: String(err) };
    }
}
// ── 注册 ──
function registerGitTools() {
    registry_1.toolRegistry.register(gitStatusDef, handleGitStatus);
    registry_1.toolRegistry.register(gitDiffDef, handleGitDiff);
    registry_1.toolRegistry.register(gitCommitDef, handleGitCommit);
    registry_1.toolRegistry.register(gitLogDef, handleGitLog);
}
//# sourceMappingURL=git.js.map