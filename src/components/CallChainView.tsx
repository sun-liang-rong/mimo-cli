import React, { useState } from 'react';
import { Box, Text } from 'ink';

export interface CallChainEntry {
  id: string;
  toolName: string;
  args: Record<string, any>;
  status: 'running' | 'completed' | 'failed';
  duration?: number;
  isSubAgent?: boolean;
  subAgentName?: string;
  timestamp: number;
  children?: CallChainEntry[];
}

interface CallChainViewProps {
  entries: CallChainEntry[];
  maxDepth?: number;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m${Math.round((ms % 60000) / 1000)}s`;
}

function summarizeArgs(args: Record<string, any>): string {
  return Object.entries(args)
    .slice(0, 2)
    .map(([k, v]) => {
      const val = typeof v === 'string' ? v.slice(0, 40) : JSON.stringify(v).slice(0, 40);
      return `${k}=${val}`;
    })
    .join(', ');
}

const CallChainNode: React.FC<{ entry: CallChainEntry; depth: number; maxDepth: number }> = ({ entry, depth, maxDepth }) => {
  if (depth > maxDepth) return null;

  const indent = '  '.repeat(depth);
  const statusIcon = entry.status === 'running' ? '⟳' : entry.status === 'completed' ? '✓' : '✗';
  const statusColor = entry.status === 'running' ? 'cyan' : entry.status === 'completed' ? 'green' : 'red';

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="gray">{indent}│ </Text>
        <Text color={statusColor}>{statusIcon} </Text>
        {entry.isSubAgent ? (
          <Text color="magenta" bold>[{entry.subAgentName}]</Text>
        ) : (
          <>
            <Text color="yellow">{entry.toolName}</Text>
            <Text color="gray">({summarizeArgs(entry.args)})</Text>
          </>
        )}
        {entry.duration !== undefined && (
          <Text color="gray"> {formatDuration(entry.duration)}</Text>
        )}
      </Box>
      {entry.children?.map(child => (
        <CallChainNode key={child.id} entry={child} depth={depth + 1} maxDepth={maxDepth} />
      ))}
    </Box>
  );
};

export function CallChainView({ entries, maxDepth = 3 }: CallChainViewProps) {
  if (entries.length === 0) {
    return <Text color="gray">暂无调用记录</Text>;
  }

  return (
    <Box flexDirection="column" marginLeft={1}>
      <Text color="cyan" bold>🔗 调用链</Text>
      {entries.map(entry => (
        <CallChainNode key={entry.id} entry={entry} depth={0} maxDepth={maxDepth} />
      ))}
    </Box>
  );
}
