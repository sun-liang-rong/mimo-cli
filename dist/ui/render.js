"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderThinking = renderThinking;
exports.renderThinkingDone = renderThinkingDone;
exports.renderToolCalls = renderToolCalls;
exports.renderToolResult = renderToolResult;
exports.renderToolDenied = renderToolDenied;
exports.renderUsage = renderUsage;
const chalk_1 = __importDefault(require("chalk"));
/** 渲染思考块（灰色缩进） */
function renderThinking(text) {
    const lines = text.split('\n').filter((l) => l.trim());
    for (const line of lines) {
        console.log(chalk_1.default.gray(`  : ${line}`));
    }
}
/** 渲染思考状态 */
function renderThinkingDone(duration) {
    const time = duration ? chalk_1.default.dim(` · ${(duration / 1000).toFixed(1)}s`) : '';
    console.log(chalk_1.default.gray(`  : thinking done${time}`));
}
/** 渲染工具调用列表 */
function renderToolCalls(toolCalls) {
    toolCalls.forEach((tc, i) => {
        const num = chalk_1.default.yellow(`${i + 1}.`);
        const name = chalk_1.default.cyan.bold(tc.function.name);
        let args = '';
        try {
            const parsed = JSON.parse(tc.function.arguments);
            args = chalk_1.default.dim(` ${formatToolArgs(tc.function.name, parsed)}`);
        }
        catch {
            args = chalk_1.default.dim(` ${tc.function.arguments.slice(0, 80)}`);
        }
        console.log(`  ${num} ${name}${args}`);
    });
}
/** 渲染工具执行结果 */
function renderToolResult(toolName, result) {
    if (result.success) {
        if (result.output) {
            const lines = result.output.split('\n');
            const preview = lines.slice(0, 5).join('\n');
            const more = lines.length > 5 ? chalk_1.default.dim(`\n  ... (+${lines.length - 5} 行)`) : '';
            console.log(chalk_1.default.green(`  [ok] ${toolName}`) + more);
            if (lines.length <= 5) {
                console.log(chalk_1.default.dim(`  ${preview.replace(/\n/g, '\n  ')}`));
            }
        }
        else {
            console.log(chalk_1.default.green(`  [ok] ${toolName}`));
        }
    }
    else {
        console.log(chalk_1.default.red(`  [error] ${toolName}: ${result.error || 'failed'}`));
    }
}
/** 渲染工具被拦截 */
function renderToolDenied(toolName) {
    console.log(chalk_1.default.yellow(`  [warn] ${toolName}: denied`));
}
/** 渲染 Token 用量 */
function renderUsage(usage) {
    console.log(chalk_1.default.dim(`  tokens: ${usage.prompt_tokens} prompt + ${usage.completion_tokens} completion = ${usage.total_tokens} total`));
}
/** 格式化工具参数（简短预览） */
function formatToolArgs(name, args) {
    switch (name) {
        case 'read_file':
            return String(args.path || '');
        case 'write_file':
            return String(args.path || '');
        case 'edit_file':
            return String(args.path || '');
        case 'run_command':
            return String(args.command || '');
        case 'list_dir':
            return String(args.path || '.');
        case 'grep':
            return `"${args.pattern}" in ${args.path || '.'}`;
        case 'find_files':
            return String(args.pattern || '');
        case 'git_status':
            return '';
        case 'git_diff':
            return String(args.file || '');
        case 'git_commit':
            return String(args.message || '').slice(0, 50);
        case 'git_log':
            return `last ${args.count || 10}`;
        default:
            return JSON.stringify(args).slice(0, 60);
    }
}
//# sourceMappingURL=render.js.map