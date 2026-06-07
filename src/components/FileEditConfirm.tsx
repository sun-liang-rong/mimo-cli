import React from 'react';
import { Box, Text, useInput } from 'ink';
import { DiffView } from './DiffView.js';
import { theme, icons } from '../display/theme.js';

interface FileEditConfirmProps {
  fileName: string;
  oldText: string;
  newText: string;
  level: 'confirm' | 'dangerous';
  onConfirm: (approved: boolean) => void;
}

export function FileEditConfirm({ fileName, oldText, newText, level, onConfirm }: FileEditConfirmProps) {
  useInput((input) => {
    if (input === 'y' || input === 'Y') onConfirm(true);
    if (input === 'n' || input === 'N') onConfirm(false);
  });

  const borderColor = level === 'dangerous' ? 'red' : 'yellow';

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={borderColor} paddingX={1} marginLeft={1}>
      <Box marginBottom={0}>
        {level === 'dangerous' ? (
          <Text color="red" bold>{icons.warning} 危险操作: </Text>
        ) : (
          <Text color="yellow" bold>{icons.warning} 需要确认: </Text>
        )}
        <Text color="white" bold>{fileName}</Text>
      </Box>
      <DiffView oldText={oldText} newText={newText} />
      <Box marginTop={0}>
        <Text color="gray">  </Text>
        <Text color="green" bold>[y]</Text>
        <Text color="gray"> 确认 / </Text>
        <Text color="red" bold>[n]</Text>
        <Text color="gray"> 拒绝</Text>
      </Box>
    </Box>
  );
}
