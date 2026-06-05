#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import * as readline from 'readline';
import { InteractiveCLI } from './cli/interactive';
import { saveConfig, loadConfig } from './config/settings';

const program = new Command();

async function promptApiKey(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(chalk.cyan('请输入 API Key: '), (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function startChat(): Promise<void> {
  try {
    const cli = new InteractiveCLI();
    await cli.start();
  } catch (error) {
    if (error instanceof Error && error.message.includes('API Key')) {
      console.log(chalk.yellow('\n首次使用需要配置 API Key\n'));
      console.log(chalk.gray('获取 API Key: https://token-plan-cn.xiaomimimo.com\n'));
      
      const apiKey = await promptApiKey();
      
      if (!apiKey) {
        console.error(chalk.red('\n未输入 API Key，退出'));
        process.exit(1);
      }
      
      saveConfig({ apiKey });
      console.log(chalk.green('\n✓ API Key 已保存\n'));
      
      const cli = new InteractiveCLI();
      await cli.start();
    } else {
      console.error(chalk.red(`\n错误: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  }
}

program
  .name('mimo')
  .description('MiMo CLI - AI 编程助手')
  .version('1.0.0');

program
  .command('chat')
  .description('启动交互式对话')
  .action(startChat);

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

if (process.argv.length <= 2) {
  startChat();
} else {
  program.parse();
}
