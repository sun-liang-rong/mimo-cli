import React from 'react';
import { Box, Text } from 'ink';
import { ToolCall } from '../ai/client.js';
import { icons } from '../display/theme.js';

export interface ToolCallState {
  toolCall: ToolCall;
  args: Record<string, any>;
  result?: { success: boolean; output: string; error?: string };
  isRunning: boolean;
  duration?: number;
  isParallel?: boolean;
}

interface ToolCallBlockProps {
  toolCall: ToolCall;
  args: Record<string, any>;
  result?: { success: boolean; output: string; error?: string };
  isRunning: boolean;
  duration?: number;
  isParallel?: boolean;
}

function getToolIcon(name: string): string {
  if (name.startsWith('git_')) return icons.git;
  if (name === 'execute_command') return icons.command;
  if (name === 'read_file' || name === 'list_files' || name === 'search_files' || name === 'query_graph' || name === 'get_context') return icons.search;
  if (name === 'save_memory') return '🧠';
  if (name === 'spawn_subtask') return '🤖';
  return icons.file;
}

function getToolColor(name: string): string {
  if (name.startsWith('git_')) return 'magenta';
  if (name === 'execute_command') return 'yellow';
  if (name === 'save_memory') return 'blue';
  if (name === 'spawn_subtask') return 'magenta';
  return 'cyan';
}

function summarizeArgs(args: Record<string, any>): string {
  return Object.entries(args)
    .map(([k, v]) => {
      const val = typeof v === 'string' ? v.slice(0, 60) : JSON.stringify(v).slice(0, 60);
      return `${k}=${val}`;
    })
    .join(', ');
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}


export function ToolCallBlock({ toolCall, args, result, isRunning, duration, isParallel }: ToolCallBlockProps) {
  const name = toolCall.function.name;
  const icon = getToolIcon(name);
  const color = getToolColor(name);
  const argsSummary = summarizeArgs(args);
  const truncatedArgs = argsSummary.length > 80 ? argsSummary.slice(0, 80) + '...' : argsSummary;

  return (
    <Box flexDirection="column" marginLeft={1} marginTop={0} marginBottom={0}>
      <Box>
        <Text color="gray">│ </Text>
        {isParallel && <Text color="yellow">⇶ </Text>}
        <Text color={color}>{icon} </Text>
        <Text color={color} bold>{name}</Text>
        <Text color="gray">({truncatedArgs})</Text>
        {isRunning && <Text color="cyan"> ●</Text>}
        {!isRunning && result && (
          result.success
            ? <Text color="green"> {icons.success}</Text>
            : <Text color="red"> {icons.error}</Text>
        )}
        {duration !== undefined && !isRunning && (
          <Text color="gray"> {formatDuration(duration)}</Text>
        )}
        {!isRunning && result && !result.success && (
          <Text color="red"> — {result.error?.slice(0, 80)}</Text>
        )}
      </Box>
    </Box>
  );
}
