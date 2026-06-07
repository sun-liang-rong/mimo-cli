import React from 'react';
import { Box, Text } from 'ink';
import { ApproveMode } from '../config/settings.js';

interface StatusBarProps {
  model: string;
  tokens: number;
  maxTokens: number;
  projectType: string;
  isProcessing: boolean;
  turnCount: number;
  cost: string;
  approveMode: ApproveMode;
  planPercent?: number;
  memoryActive?: boolean;
}

export const StatusBar = React.memo(function StatusBar({ model, tokens, maxTokens, projectType, isProcessing, turnCount, cost, approveMode, planPercent, memoryActive }: StatusBarProps) {
  const tokenPercent = Math.round((tokens / maxTokens) * 100);
  const tokenColor = tokenPercent > 80 ? 'red' : tokenPercent > 50 ? 'yellow' : 'green';

  // Token progress bar
  const barWidth = 15;
  const filled = Math.round(barWidth * tokenPercent / 100);
  const progressBar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);

  const approveIcon = approveMode === 'auto' ? '🟢' : approveMode === 'confirm-all' ? '🔴' : '🟡';

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} justifyContent="space-between">
      <Box gap={1}>
        <Text color="cyan" bold>❯</Text>
        <Text color="white">{model}</Text>
        <Text color="magenta">{projectType}</Text>
      </Box>
      <Box gap={1}>
        <Text color={tokenColor}>{progressBar}</Text>
        <Text color="gray">{tokens > 1000 ? `${(tokens / 1000).toFixed(1)}k` : tokens}</Text>
        <Text color="gray">│</Text>
        <Text color="yellow">{cost}</Text>
        <Text color="gray">│</Text>
        <Text color="white">{approveIcon}</Text>
        {planPercent !== undefined && (
          <>
            <Text color="gray">│</Text>
            <Text color="cyan">📋{planPercent}%</Text>
          </>
        )}
        {memoryActive && (
          <>
            <Text color="gray">│</Text>
            <Text color="blue">🧠</Text>
          </>
        )}
        <Text color="gray">│</Text>
        <Text color="yellow">{turnCount}t</Text>
        {isProcessing && <Text color="cyan"> ●</Text>}
      </Box>
    </Box>
  );
});
