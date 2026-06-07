#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { Command } from 'commander';
import chalk from 'chalk';
import * as readline from 'readline';
import { App } from './app.js';
import { saveConfig, loadResolvedConfig } from './config/settings.js';
import { listSessions } from './storage/history.js';

const program = new Command();

async function promptApiKey(): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(chalk.cyan('请输入 API Key: '), (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function startChat(): Promise<void> {
  try {
    const { waitUntilExit } = render(React.createElement(App));
    await waitUntilExit();
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
      const { waitUntilExit } = render(React.createElement(App));
      await waitUntilExit();
    } else {
      console.error(chalk.red(`\n错误: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  }
}

program
  .name('mimo')
  .description('MiMo CLI - AI 编程助手 (Claude Code 风格)')
  .version('2.0.0');

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
  .option('--auto-approve <tools...>', '设置自动批准的工具列表')
  .action((options) => {
    const config: any = {};
    if (options.apiKey) config.apiKey = options.apiKey;
    if (options.baseUrl) config.baseUrl = options.baseUrl;
    if (options.model) config.model = options.model;
    if (options.autoApprove) config.autoApprove = options.autoApprove;
    saveConfig(config);
    console.log(chalk.green('✓ 配置已保存'));
  });

program
  .command('sessions')
  .description('列出历史会话')
  .action(() => {
    const sessions = listSessions();
    if (sessions.length === 0) {
      console.log(chalk.gray('暂无历史会话'));
    } else {
      console.log(chalk.cyan.bold('\n📂 历史会话\n'));
      for (const s of sessions) {
        console.log(chalk.gray(`${s.id}  ${s.date.slice(0, 16)}  ${s.turns}轮  ${s.summary.slice(0, 50)}`));
      }
    }
  });

(async () => {
  if (process.argv.length <= 2) {
    await startChat();
  } else {
    program.parse();
  }
})();
