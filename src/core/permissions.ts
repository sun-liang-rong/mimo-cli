import readline from 'readline';
import chalk from 'chalk';
import { get, PermissionMode } from './config';
import { ToolDefinition, ToolPermission } from '../tools/registry';
import { log } from '../utils/logger';

/**
 * 权限门控 — 判断工具调用是否需要用户确认
 */
export async function checkPermission(
  toolDef: ToolDefinition,
  args: Record<string, unknown>,
  rl: readline.Interface,
): Promise<boolean> {
  const mode = get('permissionMode');

  // plan 模式：只允许只读操作
  if (mode === 'plan') {
    if (toolDef.permission !== 'read') {
      log.warn(`Plan 模式下禁止执行写入操作: ${toolDef.name}`);
      return false;
    }
    return true;
  }

  // yolo 模式：全部自动通过
  if (mode === 'yolo') {
    return true;
  }

  // default 模式：按权限级别判断
  if (toolDef.permission === 'read') {
    return true; // 只读操作自动通过
  }

  // 写入/危险操作需要确认
  return promptConfirm(toolDef, args, rl);
}

function promptConfirm(
  toolDef: ToolDefinition,
  args: Record<string, unknown>,
  rl: readline.Interface,
): Promise<boolean> {
  return new Promise((resolve) => {
    const label = formatToolCall(toolDef, args);
    console.log('');
    console.log(chalk.yellow.bold('  权限确认:'));
    console.log(chalk.white(`  工具: ${toolDef.name}`));
    console.log(chalk.dim(`  参数: ${label}`));
    console.log('');

    rl.question(
      chalk.cyan('  允许执行? ') + chalk.dim('(y/n/always) '),
      (answer) => {
        const a = answer.trim().toLowerCase();
        if (a === 'y' || a === 'yes' || a === '') {
          resolve(true);
        } else if (a === 'always') {
          // 设置 yolo 模式
          const { set } = require('./config');
          set('permissionMode', 'yolo' as PermissionMode);
          log.success('已切换为 Yolo 模式，后续操作自动执行');
          resolve(true);
        } else {
          resolve(false);
        }
      },
    );
  });
}

function formatToolCall(toolDef: ToolDefinition, args: Record<string, unknown>): string {
  switch (toolDef.name) {
    case 'read_file':
      return `读取文件: ${args.path}`;
    case 'write_file':
      return `写入文件: ${args.path}`;
    case 'edit_file':
      return `编辑文件: ${args.path}`;
    case 'run_command':
      return `执行命令: ${args.command}`;
    case 'git_commit':
      return `Git 提交: ${args.message}`;
    default:
      return JSON.stringify(args).slice(0, 100);
  }
}
