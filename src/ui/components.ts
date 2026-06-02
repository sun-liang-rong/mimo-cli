import chalk from 'chalk';
import {
  formatAssistantMessage,
  formatThinkingDone,
  formatToolCall,
  formatUserMessage,
} from './codex-renderer';

export function createUserMessage(text: string): string {
  return chalk.green.bold(formatUserMessage(text));
}

export function createAiMessage(text: string): string {
  return chalk.blue.bold(formatAssistantMessage(text));
}

export function createToolCallCard(name: string, args: string): string {
  return chalk.yellow(formatToolCall(name, args));
}

export function createThinkingBlock(text: string): string {
  return chalk.gray(formatThinkingDone(text));
}
