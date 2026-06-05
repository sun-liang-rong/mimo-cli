#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { InteractiveCLI } from './cli/interactive';
import { saveConfig } from './config/settings';

const program = new Command();

program
  .name('mimo')
  .description('MiMo CLI - AI 编程助手')
  .version('1.0.0');

program
  .command('chat')
  .description('启动交互式对话')
  .action(async () => {
    try {
      const cli = new InteractiveCLI();
      await cli.start();
    } catch (error) {
      if (error instanceof Error && error.message.includes('API Key')) {
        console.error(chalk.red('\n错误: 未配置 API Key'));
        console.log(chalk.yellow('\n请运行: mimo config --api-key <your-api-key>'));
        console.log(chalk.gray('\n获取 API Key: https://token-plan-cn.xiaomimimo.com'));
      } else {
        console.error(chalk.red(`\n错误: ${error instanceof Error ? error.message : String(error)}`));
      }
      process.exit(1);
    }
  });

program
  .command('config')
  .description('配置 MiMo CLI')
  .option('--api-key <key>', '设置 API Key')
  .option('--base-url <url>', '设置 API Base URL')
  .option('--model <model>', '设置模型名称')
  .action((options) => {
    const config: any = {};
    if (options.apiKey) config.apiKey = options.apiKey;
    if (options.baseUrl) config.baseUrl = options.baseUrl;
    if (options.model) config.model = options.model;

    saveConfig(config);
    console.log(chalk.green('配置已保存'));
  });

program.parse();
