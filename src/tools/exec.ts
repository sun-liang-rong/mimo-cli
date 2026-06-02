import { execSync, ExecException } from 'child_process';
import { checkCommandSafety } from '../utils/safety';
import { toolRegistry, ToolDefinition, ToolResult } from './registry';

// ── 工具定义 ──

const runCommandDef: ToolDefinition = {
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

function handleRunCommand(args: Record<string, unknown>): ToolResult {
  const cmd = String(args.command);

  const safetyError = checkCommandSafety(cmd);
  if (safetyError) return { success: false, output: '', error: safetyError };

  try {
    const stdout = execSync(cmd, {
      encoding: 'utf-8',
      timeout: 30000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    });

    const output = stdout.trim();
    return { success: true, output: output || '(命令执行成功，无输出)' };
  } catch (err: unknown) {
    const execErr = err as ExecException & { stdout?: string; stderr?: string; status?: number };
    const parts: string[] = [];
    if (execErr.stdout) parts.push(`stdout:\n${execErr.stdout.trim()}`);
    if (execErr.stderr) parts.push(`stderr:\n${execErr.stderr.trim()}`);
    if (!parts.length) parts.push(execErr.message);
    parts.push(`exit code: ${execErr.status ?? 1}`);

    return {
      success: false,
      output: parts.join('\n'),
      error: `命令执行失败 (exit ${execErr.status ?? 1})`,
    };
  }
}

// ── 注册 ──

export function registerExecTools(): void {
  toolRegistry.register(runCommandDef, handleRunCommand);
}

// ── 保留旧接口 ──

export interface ExecResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  error?: string;
}

export function executeCommand(cmd: string): ExecResult {
  const result = handleRunCommand({ command: cmd });
  return {
    success: result.success,
    stdout: result.output || undefined,
    stderr: result.error || undefined,
    exitCode: result.success ? 0 : 1,
    error: result.error,
  };
}
