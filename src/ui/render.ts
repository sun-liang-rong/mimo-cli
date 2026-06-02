import chalk from 'chalk';
import { ToolCall } from '../core/context';
import { ToolResult } from '../tools/registry';

/** 渲染思考块（灰色缩进） */
export function renderThinking(text: string): void {
  const lines = text.split('\n').filter((l) => l.trim());
  for (const line of lines) {
    console.log(chalk.gray(`  : ${line}`));
  }
}

/** 渲染思考状态 */
export function renderThinkingDone(duration?: number): void {
  const time = duration ? chalk.dim(` · ${(duration / 1000).toFixed(1)}s`) : '';
  console.log(chalk.gray(`  : thinking done${time}`));
}

/** 渲染工具调用列表 */
export function renderToolCalls(toolCalls: ToolCall[]): void {
  toolCalls.forEach((tc, i) => {
    const num = chalk.yellow(`${i + 1}.`);
    const name = chalk.cyan.bold(tc.function.name);
    let args = '';
    try {
      const parsed = JSON.parse(tc.function.arguments);
      args = chalk.dim(` ${formatToolArgs(tc.function.name, parsed)}`);
    } catch {
      args = chalk.dim(` ${tc.function.arguments.slice(0, 80)}`);
    }
    console.log(`  ${num} ${name}${args}`);
  });
}

/** 渲染工具执行结果 */
export function renderToolResult(toolName: string, result: ToolResult): void {
  if (result.success) {
    if (result.output) {
      const lines = result.output.split('\n');
      const preview = lines.slice(0, 5).join('\n');
      const more = lines.length > 5 ? chalk.dim(`\n  ... (+${lines.length - 5} 行)`) : '';
      console.log(chalk.green(`  [ok] ${toolName}`) + more);
      if (lines.length <= 5) {
        console.log(chalk.dim(`  ${preview.replace(/\n/g, '\n  ')}`));
      }
    } else {
      console.log(chalk.green(`  [ok] ${toolName}`));
    }
  } else {
    console.log(chalk.red(`  [error] ${toolName}: ${result.error || 'failed'}`));
  }
}

/** 渲染工具被拦截 */
export function renderToolDenied(toolName: string): void {
  console.log(chalk.yellow(`  [warn] ${toolName}: denied`));
}

/** 渲染 Token 用量 */
export function renderUsage(usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }): void {
  console.log(
    chalk.dim(
      `  tokens: ${usage.prompt_tokens} prompt + ${usage.completion_tokens} completion = ${usage.total_tokens} total`,
    ),
  );
}

/** 格式化工具参数（简短预览） */
function formatToolArgs(name: string, args: Record<string, unknown>): string {
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
