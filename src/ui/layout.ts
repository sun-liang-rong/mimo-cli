import os from 'os';
import readline from 'readline';
import chalk from 'chalk';
import { getConfig } from '../core/config';
import {
  formatHeader,
  formatPrompt,
  formatStatus,
  formatToolResult,
} from './codex-renderer';

let currentTasks: TaskInfo[] = [];
let activityStatus: 'idle' | 'thinking' | 'tool_call' = 'idle';
let inputCallback: ((text: string) => void) | null = null;
let isRunning = false;
let currentUsage: { total_tokens: number } | undefined;
let rl: readline.Interface | null = null;

export interface TaskInfo {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export function initLayout(): void {
  process.stdout.setDefaultEncoding('utf8');
  process.stderr.setDefaultEncoding('utf8');

  const cfg = getConfig();
  console.log(chalk.dim(formatHeader({
    model: cfg.model,
    permissionMode: cfg.permissionMode,
  })));
  console.log(chalk.dim(`user ${os.userInfo().username}`));
}

export function renderTopBar(): void {
  const cfg = getConfig();
  console.log(chalk.dim(formatHeader({
    model: cfg.model,
    permissionMode: cfg.permissionMode,
  })));
}

export function renderFooterBar(usage?: { total_tokens: number }): void {
  currentUsage = usage;
  if (usage) {
    console.log(chalk.dim(formatStatus(activityStatus, usage)));
  }
}

export function setActivityStatus(status: 'idle' | 'thinking' | 'tool_call'): void {
  activityStatus = status;
}

export function appendChat(content: string): void {
  if (!content) {
    console.log('');
    return;
  }
  console.log(content);
}

export function clearChat(): void {
  console.clear();
  renderTopBar();
}

export function refreshTaskPanel(tasks: TaskInfo[]): void {
  currentTasks = tasks;
}

export function startInputLoop(callback: (text: string) => void): void {
  inputCallback = callback;
  isRunning = true;

  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    prompt: chalk.green(formatPrompt()),
  });

  rl.on('line', (value: string) => {
    if (!isRunning || !inputCallback) return;
    rl?.pause();
    inputCallback(value.trim());
  });

  rl.on('SIGINT', () => {
    stopInputLoop();
    process.exit(0);
  });

  rl.prompt();
}

export function continueInputLoop(): void {
  if (!rl || !isRunning) return;
  rl.resume();
  rl.prompt();
}

export function stopInputLoop(): void {
  isRunning = false;
  inputCallback = null;
  rl?.close();
  rl = null;
}

export function getLayout() {
  return {
    screen: null,
    chatBox: null,
    taskPanel: null,
    inputLine: null,
  };
}

export function refreshAll(usage?: { total_tokens: number }): void {
  renderFooterBar(usage);
}

export function getCurrentTasks(): TaskInfo[] {
  return currentTasks;
}

export function renderTaskResult(name: string, success: boolean): void {
  appendChat(chalk.dim(formatToolResult(name, success)));
}
