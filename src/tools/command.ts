import { exec } from 'child_process';
import { promisify } from 'util';
import { ToolDefinition, ToolHandler, ToolResult } from './types';
import { ToolRegistry } from './registry';

const execAsync = promisify(exec);

export const executeCommandTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'execute_command',
    description: '执行终端命令',
    parameters: {
      type: 'object',
      description: '命令执行参数',
      properties: {
        command: {
          type: 'string',
          description: '要执行的命令'
        },
        cwd: {
          type: 'string',
          description: '工作目录，默认为当前目录'
        }
      },
      required: ['command']
    }
  }
};

export const executeCommandHandler: ToolHandler = async (args): Promise<ToolResult> => {
  try {
    const options: any = {};
    if (args.cwd) {
      options.cwd = args.cwd;
    }

    const { stdout, stderr } = await execAsync(args.command, options);

    return {
      success: true,
      output: stdout + (stderr ? `\n[STDERR]\n${stderr}` : '')
    };
  } catch (error: any) {
    return {
      success: false,
      output: error.stdout || '',
      error: error.stderr || error.message
    };
  }
};

export function registerCommandTools(registry: ToolRegistry): void {
  registry.register(executeCommandTool, executeCommandHandler);
}
