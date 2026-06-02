import chalk from 'chalk';
import { getConfig } from '../core/config';

/** 渲染顶部状态栏 */
export function renderStatusBar(): string {
  const cfg = getConfig();
  const mode = cfg.permissionMode.toUpperCase();
  const parts = [
    chalk.bgCyan.black(` ${mode} `),
    chalk.white('·'),
    chalk.green(cfg.model),
    chalk.white('·'),
    chalk.dim(`max ${cfg.maxTokens}`),
    chalk.white('·'),
    chalk.dim('v1.0.0'),
  ];
  return parts.join(' ');
}

/** 渲染底部状态栏 */
export function renderFooterBar(usage?: { total_tokens: number; saved?: number }): string {
  const cfg = getConfig();
  const parts = [
    chalk.cyan(cfg.permissionMode),
    chalk.white('·'),
    chalk.green(cfg.model),
  ];

  if (usage) {
    parts.push(chalk.white('·'));
    parts.push(chalk.yellow(`$${((usage.total_tokens / 1000) * 0.002).toFixed(4)}`));
  }

  parts.push(chalk.dim('·'));
  parts.push(chalk.dim('Ctrl+C 退出'));

  return parts.join(' ');
}
