import { exec } from 'child_process';
import { promisify } from 'util';
import { ToolDefinition, ToolHandler, ToolResult } from './types.js';
import { ToolRegistry } from './registry.js';
import { ToolError } from '../utils/errors.js';

const execAsync = promisify(exec);
const DEFAULT_TIMEOUT = 30000;
const MAX_TIMEOUT = 300000;

export const executeCommandTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'execute_command',
    description: '在终端中执行命令。优先使用专用工具（如 git_* 系列）而非通过此工具执行 git 命令。执行前会评估安全性，危险命令会被拦截。',
    parameters: {
      type: 'object', description: '命令执行参数',
      properties: {
        command: { type: 'string', description: '要执行的 Shell 命令' },
        cwd: { type: 'string', description: '工作目录，默认为当前目录' },
        timeout: { type: 'number', description: '超时时间（毫秒），默认 30000，最大 300000' }
      },
      required: ['command']
    }
  }
};

export const executeCommandHandler: ToolHandler = async (args): Promise<ToolResult> => {
  try {
    const timeout = Math.min((args.timeout as number) || DEFAULT_TIMEOUT, MAX_TIMEOUT);
    const options: { timeout: number; maxBuffer: number; cwd?: string } = { timeout, maxBuffer: 1024 * 1024 };
    if (args.cwd) options.cwd = args.cwd as string;

    const { stdout, stderr } = await execAsync(args.command as string, options);
    let output = '';
    if (stdout) output += stdout;
    if (stderr) output += (output ? '\n[STDERR]\n' : '') + stderr;
    if (!output) output = '(命令执行成功，无输出)';

    if (output.length > 15000) {
      // Keep head + tail for command output
      const lines = output.split('\n');
      if (lines.length > 100) {
        const head = lines.slice(0, 50).join('\n');
        const tail = lines.slice(-50).join('\n');
        output = head + '\n... [中间省略 ' + (lines.length - 100) + ' 行] ...\n' + tail;
      } else {
        output = output.slice(0, 15000) + '\n... (输出已截断)';
      }
    }

    return { success: true, output };
  } catch (error: unknown) {
    const stdout = (error as { stdout?: string }).stdout || '';
    let output = stdout.length > 3000 ? stdout.slice(0, 3000) + '\n... (已截断)' : stdout;
    const errMsg = (error as { killed?: boolean; stderr?: string; message?: string }).killed
      ? `命令超时（${(args.timeout as number) || DEFAULT_TIMEOUT}ms）`
      : ((error as { stderr?: string }).stderr?.slice(0, 1000) || (error as Error).message?.slice(0, 500));
    return { success: false, output, error: errMsg };
  }
};

export function registerCommandTools(registry: ToolRegistry): void {
  registry.register(executeCommandTool, executeCommandHandler, { readOnly: false, cost: 'high', maxOutputLength: 15000 });
}
