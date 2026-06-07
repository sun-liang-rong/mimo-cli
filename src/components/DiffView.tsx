import React from 'react';
import { Box, Text } from 'ink';
import * as Diff from 'diff';

interface DiffViewProps {
  oldText: string;
  newText: string;
  fileName?: string;
}

export function DiffView({ oldText, newText, fileName }: DiffViewProps) {
  const changes = Diff.diffLines(oldText, newText);
  const lines: React.ReactNode[] = [];
  let lineNum = 0;

  for (const change of changes) {
    const changeLines = change.value.split('\n').filter((_, i, arr) => i < arr.length - 1 || arr[arr.length - 1] !== '');
    for (const line of changeLines) {
      lineNum++;
      if (change.added) {
        lines.push(
          <Text key={lineNum}>
            <Text color="gray">{String(lineNum).padStart(4)}│ </Text>
            <Text color="green" bold>+ </Text>
            <Text color="green">{line}</Text>
          </Text>
        );
      } else if (change.removed) {
        lines.push(
          <Text key={`r${lineNum}`}>
            <Text color="gray">{String(lineNum).padStart(4)}│ </Text>
            <Text color="red" bold>- </Text>
            <Text color="red">{line}</Text>
          </Text>
        );
      } else {
        lines.push(
          <Text key={lineNum}>
            <Text color="gray">{String(lineNum).padStart(4)}│ </Text>
            <Text color="gray">  {line}</Text>
          </Text>
        );
      }
    }
  }

  return (
    <Box flexDirection="column" marginLeft={2} marginTop={0} marginBottom={0}>
      {fileName && <Text color="cyan" bold>{fileName}</Text>}
      <Text color="gray">{'─'.repeat(50)}</Text>
      {lines}
    </Box>
  );
}
