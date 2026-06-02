"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerExecTools = registerExecTools;
exports.executeCommand = executeCommand;
const child_process_1 = require("child_process");
const safety_1 = require("../utils/safety");
const registry_1 = require("./registry");
// ── 工具定义 ──
const runCommandDef = {
    name: 'run_command',
    description: '执行本地终端命令，返回 stdout/stderr 输出',
    permission: 'write',
    parameters: {
        type: 'object',
        properties: {
            command: { type: 'string', description: '要执行的终端命令' },
        },
        required: ['command'],
    },
};
// ── 工具实现 ──
function handleRunCommand(args) {
    const cmd = String(args.command);
    const safetyError = (0, safety_1.checkCommandSafety)(cmd);
    if (safetyError)
        return { success: false, output: '', error: safetyError };
    try {
        const stdout = (0, child_process_1.execSync)(cmd, {
            encoding: 'utf-8',
            timeout: 30000,
            maxBuffer: 1024 * 1024,
            windowsHide: true,
        });
        const output = stdout.trim();
        return { success: true, output: output || '(命令执行成功，无输出)' };
    }
    catch (err) {
        const execErr = err;
        const parts = [];
        if (execErr.stdout)
            parts.push(`stdout:\n${execErr.stdout.trim()}`);
        if (execErr.stderr)
            parts.push(`stderr:\n${execErr.stderr.trim()}`);
        if (!parts.length)
            parts.push(execErr.message);
        parts.push(`exit code: ${execErr.status ?? 1}`);
        return {
            success: false,
            output: parts.join('\n'),
            error: `命令执行失败 (exit ${execErr.status ?? 1})`,
        };
    }
}
// ── 注册 ──
function registerExecTools() {
    registry_1.toolRegistry.register(runCommandDef, handleRunCommand);
}
function executeCommand(cmd) {
    const result = handleRunCommand({ command: cmd });
    return {
        success: result.success,
        stdout: result.output || undefined,
        stderr: result.error || undefined,
        exitCode: result.success ? 0 : 1,
        error: result.error,
    };
}
//# sourceMappingURL=exec.js.map