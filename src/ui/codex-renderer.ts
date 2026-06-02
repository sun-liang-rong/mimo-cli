export interface HeaderState {
  model: string;
  permissionMode: string;
}

export interface UsageState {
  total_tokens?: number;
}

export function formatHeader(state: HeaderState): string {
  return `MiMo CLI  v1.0.0  ${state.model}  ${state.permissionMode}`;
}

export function formatPrompt(): string {
  return '> ';
}

export function formatUserMessage(text: string): string {
  return `\nuser\n${text}`;
}

export function formatAssistantMessage(text: string): string {
  return `\nassistant\n${text}`;
}

export function formatThinking(): string {
  return '  thinking...';
}

export function formatThinkingDone(text: string = 'thinking done'): string {
  return `  ${text}`;
}

export function formatToolCall(name: string, args: string): string {
  const suffix = args ? ` ${args}` : '';
  return `  tool ${name}${suffix}`;
}

export function formatToolResult(name: string, success: boolean): string {
  return `  ${success ? 'ok' : 'error'} ${name}`;
}

export function formatStatus(activity: string, usage?: UsageState): string {
  const parts = [`status ${activity}`];
  if (usage?.total_tokens !== undefined) {
    parts.push(`${usage.total_tokens} tokens`);
  }
  return parts.join(' | ');
}
