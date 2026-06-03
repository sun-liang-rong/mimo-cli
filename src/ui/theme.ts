// src/ui/theme.ts

/** 颜色常量 */
export const Colors = {
  // 前景
  user: 'green',
  assistant: 'cyan',
  thinking: 'gray',
  toolCall: 'yellow',
  toolSuccess: 'green',
  toolError: 'red',
  error: 'red',
  dim: 'gray',
  tokenUsage: 'gray',
  // 背景
  topBarBg: 'cyan',
  topBarFg: 'black',
  footerBarBg: '#333333',
  footerBarFg: 'white',
  // 状态颜色
  statusIdle: 'white',
  statusThinking: 'yellow',
  statusStreaming: 'green',
  statusToolCall: 'cyan',
  statusWaitingInput: 'red',
} as const;

/** 图标/符号 */
export const Icons = {
  user: 'user',
  assistant: '●',
  thinking: ':',
  toolCall: '▸',
  toolSuccess: '✓',
  toolError: '✗',
  statusThinking: '⋯',
  statusStreaming: '▶',
  statusToolCall: '🔧',
  statusWaitingInput: '?',
  prompt: '> ',
} as const;

/** Footer 状态类型 */
export type FooterState = 'idle' | 'thinking' | 'streaming' | 'tool_call' | 'waiting_input';

/** 权限决策 */
export type PermissionDecision = 'allow' | 'deny' | 'always';
