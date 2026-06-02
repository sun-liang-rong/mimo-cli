#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { registerConfigCommand } from './commands/config';
import { startChat } from './commands/chat';
import { fetchModels } from './core/ai';
import { get } from './core/config';
import { log } from './utils/logger';
import { createSpinner } from './utils/spinner';

const program = new Command();

program
  .name('mimo')
  .description('MiMo CLI - terminal AI coding assistant powered by MiMo')
  .version('1.0.0', '-v, --version', 'show version');

// 注册 config 子命令
registerConfigCommand(program);

// mimo models —— 查看可用模型列表
program
  .command('models')
  .description('list available API models')
  .action(async () => {
    const current = get('model');
    const spinner = createSpinner('Fetching models...');
    spinner.start();

    const result = await fetchModels();
    spinner.stop();

    if (!result.success) {
      log.error(result.error!);
      return;
    }

    console.log('');
    console.log(chalk.cyan.bold('  Available models:'));
    console.log('');
    for (const m of result.models!) {
      const marker = m === current ? chalk.green('  * ') : '    ';
      const name = m === current ? chalk.green.bold(m) : m;
      console.log(`${marker}${name}`);
    }
    console.log('');
    log.info(`Current model: ${chalk.green.bold(current)}`);
    log.dim('Switch model: mimo config set model <model>');
    console.log('');
  });

// 默认命令：进入交互式对话
program
  .action(async () => {
    await startChat();
  });

// 也支持 mimo chat 显式调用
program
  .command('chat')
  .description('start interactive chat')
  .action(async () => {
    await startChat();
  });

program.parse();
